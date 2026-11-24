import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiError, requireEntity, requireRole, requireText } from '../errors.js';

function getTournament(db, id) {
  return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
}

function getTeam(db, id) {
  return db.prepare(`
    SELECT teams.*, tournaments.owner_email AS tournament_owner, tournaments.status AS tournament_status,
           tournaments.name AS tournament_name, tournaments.sport AS tournament_sport,
           tournaments.start_date AS tournament_start_date
    FROM teams JOIN tournaments ON tournaments.id = teams.tournament_id
    WHERE teams.id = ?
  `).get(id);
}

function teamFromRow(db, row) {
  const memberEmails = db.prepare(
    'SELECT player_email FROM team_members WHERE team_id = ? ORDER BY player_email',
  ).all(row.id).map((member) => member.player_email);
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    ownerEmail: row.owner_email,
    name: row.name,
    capacity: row.capacity,
    memberEmails,
  };
}

function matchFromRow(db, row) {
  const points = db.prepare(
    'SELECT player_email, points FROM player_points WHERE match_id = ?',
  ).all(row.id);
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    ownerEmail: row.owner_email,
    refereeEmail: row.referee_email ?? '',
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    homeScore: row.home_score,
    awayScore: row.away_score,
    playerPoints: Object.fromEntries(points.map((point) => [point.player_email, point.points])),
  };
}

function parseMatchInput(body) {
  const refereeEmail = body?.refereeEmail;
  const homeTeamId = body?.homeTeamId;
  const awayTeamId = body?.awayTeamId;
  const startAt = body?.startAt;
  const endAt = body?.endAt;
  const location = requireText(body?.location, 'location', 200);

  if (
    typeof refereeEmail !== 'string'
    || typeof homeTeamId !== 'string'
    || typeof awayTeamId !== 'string'
    || !homeTeamId
    || !awayTeamId
    || homeTeamId === awayTeamId
    || typeof startAt !== 'string'
    || typeof endAt !== 'string'
    || !Number.isFinite(Date.parse(startAt))
    || !Number.isFinite(Date.parse(endAt))
    || Date.parse(startAt) >= Date.parse(endAt)
  ) {
    throw new ApiError(400, 'Les informations du match sont invalides.');
  }

  return {
    refereeEmail: refereeEmail.trim().toLowerCase(),
    homeTeamId,
    awayTeamId,
    startAt,
    endAt,
    location,
  };
}

function validateSchedule(db, tournamentId, ownerEmail, input, exceptMatchId) {
  const tournament = requireEntity(getTournament(db, tournamentId), 'Tournoi introuvable.');
  if (tournament.owner_email !== ownerEmail || tournament.status === 'completed') {
    throw new ApiError(404, 'Tournoi introuvable.');
  }

  const teams = db.prepare(
    'SELECT id FROM teams WHERE tournament_id = ? AND owner_email = ?',
  ).all(tournamentId, ownerEmail).map((team) => team.id);
  if (!teams.includes(input.homeTeamId) || !teams.includes(input.awayTeamId)) {
    throw new ApiError(400, 'Les deux équipes doivent appartenir à ce tournoi.');
  }

  if (input.refereeEmail) {
    const referee = db.prepare(
      "SELECT email FROM users WHERE email = ? COLLATE NOCASE AND role = 'arbitre'",
    ).get(input.refereeEmail);
    if (!referee) {
      throw new ApiError(400, 'L’arbitre sélectionné est introuvable.');
    }
    input.refereeEmail = referee.email;
  }

  const matches = db.prepare(
    'SELECT * FROM matches WHERE owner_email = ? AND id <> ?',
  ).all(ownerEmail, exceptMatchId ?? '');
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAt);
  const conflict = matches.some((match) => {
    const sameTeam = [match.home_team_id, match.away_team_id]
      .some((teamId) => teamId === input.homeTeamId || teamId === input.awayTeamId);
    const sameVenue = match.location.toLocaleLowerCase() === input.location.toLocaleLowerCase();
    return (sameTeam || sameVenue)
      && start < Date.parse(match.end_at)
      && Date.parse(match.start_at) < end;
  });
  if (conflict) {
    throw new ApiError(409, 'Ce créneau chevauche un autre match pour une équipe ou un lieu.');
  }
}

export function createCompetitionRouter({ db, optionalAuth }) {
  const router = Router();
  router.use(optionalAuth);

  router.get('/teams/directory', optionalAuth, requireRole('joueur'), (request, response) => {
    const teams = db.prepare(`
      SELECT teams.*, tournaments.status AS tournament_status,
             tournaments.name AS tournament_name, tournaments.sport AS tournament_sport,
             tournaments.start_date AS tournament_start_date
      FROM teams JOIN tournaments ON tournaments.id = teams.tournament_id
      WHERE tournaments.status = 'open'
        AND (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) < teams.capacity
        AND NOT EXISTS (
          SELECT 1 FROM team_members mine
          JOIN teams joined_team ON joined_team.id = mine.team_id
          WHERE mine.player_email = ? AND joined_team.tournament_id = teams.tournament_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM join_requests pending
          JOIN teams pending_team ON pending_team.id = pending.team_id
          WHERE pending.player_email = ? AND pending.status = 'pending'
            AND pending_team.tournament_id = teams.tournament_id
        )
      ORDER BY tournaments.start_date, teams.name COLLATE NOCASE
    `).all(request.user.email, request.user.email);
    response.json({
      teams: teams.map((row) => ({
        team: teamFromRow(db, row),
        tournament: {
          id: row.tournament_id,
          ownerEmail: row.owner_email,
          name: row.tournament_name,
          sport: row.tournament_sport,
          startDate: row.tournament_start_date,
        },
      })),
    });
  });

  router.get('/teams/mine', requireRole('joueur'), (request, response) => {
    const rows = db.prepare(`
      SELECT teams.* FROM teams
      JOIN team_members ON team_members.team_id = teams.id
      WHERE team_members.player_email = ?
      ORDER BY teams.name COLLATE NOCASE
    `).all(request.user.email);
    response.json({ teams: rows.map((row) => teamFromRow(db, row)) });
  });

  router.post('/teams/:teamId/join-requests', requireRole('joueur'), (request, response) => {
    const team = requireEntity(getTeam(db, request.params.teamId), 'Équipe introuvable.');
    if (team.tournament_status !== 'open') {
      throw new ApiError(409, 'Les inscriptions à ce tournoi ne sont pas ouvertes.');
    }

    const createRequest = db.transaction(() => {
      const membership = db.prepare(`
        SELECT 1 FROM team_members
        JOIN teams ON teams.id = team_members.team_id
        WHERE team_members.player_email = ? AND teams.tournament_id = ?
        LIMIT 1
      `).get(request.user.email, team.tournament_id);
      const pending = db.prepare(`
        SELECT 1 FROM join_requests
        JOIN teams ON teams.id = join_requests.team_id
        WHERE join_requests.player_email = ? AND join_requests.status = 'pending'
          AND teams.tournament_id = ?
        LIMIT 1
      `).get(request.user.email, team.tournament_id);
      const memberCount = db.prepare(
        'SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?',
      ).get(team.id).count;

      if (membership || pending) {
        throw new ApiError(409, 'Vous avez déjà rejoint une équipe ou une demande est en attente pour ce tournoi.');
      }
      if (memberCount >= team.capacity) {
        throw new ApiError(409, 'Cette équipe a atteint sa capacité maximale.');
      }

      const id = randomUUID();
      db.prepare(`
        INSERT INTO join_requests (id, team_id, player_email, status, reason)
        VALUES (?, ?, ?, 'pending', '')
      `).run(id, team.id, request.user.email);
      return { id, teamId: team.id, playerEmail: request.user.email, status: 'pending', reason: '' };
    });

    response.status(201).json({ joinRequest: createRequest() });
  });

  router.get('/join-requests/mine', requireRole('joueur'), (request, response) => {
    const rows = db.prepare(`
      SELECT id, team_id AS teamId, player_email AS playerEmail, status, reason
      FROM join_requests WHERE player_email = ? ORDER BY rowid DESC
    `).all(request.user.email);
    response.json({ joinRequests: rows });
  });

  router.get('/tournaments/:tournamentId/join-requests', requireRole('organisateur'), (request, response) => {
    const tournament = requireEntity(getTournament(db, request.params.tournamentId), 'Tournoi introuvable.');
    if (tournament.owner_email !== request.user.email) {
      throw new ApiError(404, 'Tournoi introuvable.');
    }
    const rows = db.prepare(`
      SELECT join_requests.id, join_requests.team_id AS teamId,
             join_requests.player_email AS playerEmail, join_requests.status, join_requests.reason
      FROM join_requests JOIN teams ON teams.id = join_requests.team_id
      WHERE teams.tournament_id = ? ORDER BY join_requests.rowid DESC
    `).all(tournament.id);
    response.json({ joinRequests: rows });
  });

  router.patch('/join-requests/:requestId', requireRole('organisateur'), (request, response) => {
    const { approved, reason = '' } = request.body ?? {};
    if (typeof approved !== 'boolean' || typeof reason !== 'string' || reason.length > 500) {
      throw new ApiError(400, 'La décision d’inscription est invalide.');
    }
    const joinRequest = db.prepare(`
      SELECT join_requests.*, teams.tournament_id, teams.capacity, tournaments.owner_email,
             tournaments.status AS tournament_status
      FROM join_requests
      JOIN teams ON teams.id = join_requests.team_id
      JOIN tournaments ON tournaments.id = teams.tournament_id
      WHERE join_requests.id = ?
    `).get(request.params.requestId);
    if (!joinRequest || joinRequest.owner_email !== request.user.email || joinRequest.status !== 'pending') {
      throw new ApiError(404, 'Demande en attente introuvable.');
    }

    const review = db.transaction(() => {
      if (approved) {
        if (joinRequest.tournament_status !== 'open') {
          throw new ApiError(409, 'Les inscriptions à ce tournoi ne sont pas ouvertes.');
        }
        const alreadyJoined = db.prepare(`
          SELECT 1 FROM team_members
          JOIN teams ON teams.id = team_members.team_id
          WHERE team_members.player_email = ? AND teams.tournament_id = ?
        `).get(joinRequest.player_email, joinRequest.tournament_id);
        const memberCount = db.prepare(
          'SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?',
        ).get(joinRequest.team_id).count;
        if (alreadyJoined || memberCount >= joinRequest.capacity) {
          throw new ApiError(409, 'Le joueur est déjà inscrit ou l’équipe est complète.');
        }
        db.prepare('INSERT INTO team_members (team_id, player_email) VALUES (?, ?)')
          .run(joinRequest.team_id, joinRequest.player_email);
      }

      const status = approved ? 'approved' : 'rejected';
      db.prepare('UPDATE join_requests SET status = ?, reason = ? WHERE id = ?')
        .run(status, reason.trim(), joinRequest.id);
      return {
        id: joinRequest.id,
        teamId: joinRequest.team_id,
        playerEmail: joinRequest.player_email,
        status,
        reason: reason.trim(),
      };
    });
    response.json({ joinRequest: review() });
  });

  router.get('/tournaments/:tournamentId/matches', requireRole('organisateur'), (request, response) => {
    const tournament = requireEntity(getTournament(db, request.params.tournamentId), 'Tournoi introuvable.');
    if (tournament.owner_email !== request.user.email) {
      throw new ApiError(404, 'Tournoi introuvable.');
    }
    const rows = db.prepare('SELECT * FROM matches WHERE tournament_id = ? ORDER BY start_at')
      .all(tournament.id);
    response.json({ matches: rows.map((row) => matchFromRow(db, row)) });
  });

  router.post('/tournaments/:tournamentId/matches', requireRole('organisateur'), (request, response) => {
    const input = parseMatchInput(request.body);
    const tournament = requireEntity(getTournament(db, request.params.tournamentId), 'Tournoi introuvable.');
    validateSchedule(db, tournament.id, request.user.email, input);
    const id = randomUUID();
    db.prepare(`
      INSERT INTO matches (
        id, tournament_id, owner_email, referee_email, home_team_id, away_team_id,
        start_at, end_at, location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tournament.id,
      request.user.email,
      input.refereeEmail || null,
      input.homeTeamId,
      input.awayTeamId,
      input.startAt,
      input.endAt,
      input.location,
    );
    response.status(201).json({
      match: matchFromRow(db, db.prepare('SELECT * FROM matches WHERE id = ?').get(id)),
    });
  });

  router.get('/matches/public', (_request, response) => {
    const rows = db.prepare(`
      SELECT matches.* FROM matches
      JOIN tournaments ON tournaments.id = matches.tournament_id
      WHERE tournaments.status <> 'draft' ORDER BY matches.start_at
    `).all();
    response.json({ matches: rows.map((row) => matchFromRow(db, row)) });
  });

  router.get('/matches/mine', requireRole('joueur'), (request, response) => {
    const rows = db.prepare(`
      SELECT DISTINCT matches.* FROM matches
      JOIN team_members ON team_members.team_id IN (matches.home_team_id, matches.away_team_id)
      WHERE team_members.player_email = ? ORDER BY matches.start_at
    `).all(request.user.email);
    response.json({ matches: rows.map((row) => matchFromRow(db, row)) });
  });

  router.get('/matches/assigned', requireRole('arbitre'), (request, response) => {
    const rows = db.prepare(
      'SELECT * FROM matches WHERE referee_email = ? ORDER BY start_at',
    ).all(request.user.email);
    response.json({ matches: rows.map((row) => matchFromRow(db, row)) });
  });

  router.put('/matches/:matchId', requireRole('organisateur'), (request, response) => {
    const match = requireEntity(db.prepare(
      'SELECT * FROM matches WHERE id = ? AND owner_email = ?',
    ).get(request.params.matchId, request.user.email), 'Match introuvable.');
    const input = parseMatchInput(request.body);
    validateSchedule(db, match.tournament_id, request.user.email, input, match.id);
    db.prepare(`
      UPDATE matches SET referee_email = ?, home_team_id = ?, away_team_id = ?,
                         start_at = ?, end_at = ?, location = ? WHERE id = ?
    `).run(
      input.refereeEmail || null,
      input.homeTeamId,
      input.awayTeamId,
      input.startAt,
      input.endAt,
      input.location,
      match.id,
    );
    response.json({
      match: matchFromRow(db, db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id)),
    });
  });

  router.delete('/matches/:matchId', requireRole('organisateur'), (request, response) => {
    const result = db.prepare(
      'DELETE FROM matches WHERE id = ? AND owner_email = ?',
    ).run(request.params.matchId, request.user.email);
    if (result.changes === 0) {
      throw new ApiError(404, 'Match introuvable.');
    }
    response.status(204).end();
  });

  router.patch('/matches/:matchId/score', requireRole('organisateur'), (request, response) => {
    const { side, score } = request.body ?? {};
    if (!['home', 'away'].includes(side) || (score !== null && (!Number.isInteger(score) || score < 0))) {
      throw new ApiError(400, 'Le score est invalide.');
    }
    const match = requireEntity(db.prepare(
      'SELECT * FROM matches WHERE id = ? AND owner_email = ?',
    ).get(request.params.matchId, request.user.email), 'Match introuvable.');
    const column = side === 'home' ? 'home_score' : 'away_score';
    db.prepare(`UPDATE matches SET ${column} = ? WHERE id = ?`).run(score, match.id);
    response.json({
      match: matchFromRow(db, db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id)),
    });
  });

  router.put('/matches/:matchId/points', requireRole('organisateur'), (request, response) => {
    const { playerEmail, points } = request.body ?? {};
    if (
      typeof playerEmail !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(playerEmail)
      || (points !== null && (!Number.isInteger(points) || points < 0))
    ) {
      throw new ApiError(400, 'Les points du joueur sont invalides.');
    }
    const match = requireEntity(db.prepare(
      'SELECT * FROM matches WHERE id = ? AND owner_email = ?',
    ).get(request.params.matchId, request.user.email), 'Match introuvable.');
    const normalizedEmail = playerEmail.trim().toLowerCase();
    const participant = db.prepare(`
      SELECT 1 FROM team_members
      WHERE player_email = ? AND team_id IN (?, ?)
    `).get(normalizedEmail, match.home_team_id, match.away_team_id);
    if (!participant) {
      throw new ApiError(400, 'Les points ne peuvent être attribués qu’à un joueur participant au match.');
    }
    if (points === null) {
      db.prepare('DELETE FROM player_points WHERE match_id = ? AND player_email = ?')
        .run(match.id, normalizedEmail);
    } else {
      db.prepare(`
        INSERT INTO player_points (match_id, player_email, points) VALUES (?, ?, ?)
        ON CONFLICT(match_id, player_email) DO UPDATE SET points = excluded.points
      `).run(match.id, normalizedEmail, points);
    }
    response.json({
      match: matchFromRow(db, db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id)),
    });
  });

  router.get('/matches/:matchId/points/me', requireRole('joueur'), (request, response) => {
    const match = requireEntity(db.prepare('SELECT id FROM matches WHERE id = ?')
      .get(request.params.matchId), 'Match introuvable.');
    const participant = db.prepare(`
      SELECT 1 FROM team_members
      WHERE player_email = ? AND team_id IN (
        SELECT home_team_id FROM matches WHERE id = ?
        UNION SELECT away_team_id FROM matches WHERE id = ?
      )
    `).get(request.user.email, match.id, match.id);
    if (!participant) {
      throw new ApiError(404, 'Match introuvable.');
    }
    const result = db.prepare(
      'SELECT points FROM player_points WHERE match_id = ? AND player_email = ?',
    ).get(match.id, request.user.email);
    response.json({ points: result?.points ?? null });
  });

  router.get('/follows', requireRole('spectateur'), (request, response) => {
    const rows = db.prepare(
      'SELECT tournament_id FROM followed_tournaments WHERE user_email = ? ORDER BY tournament_id',
    ).all(request.user.email);
    response.json({ tournamentIds: rows.map((row) => row.tournament_id) });
  });

  router.put('/tournaments/:tournamentId/follow', requireRole('spectateur'), (request, response) => {
    const tournament = requireEntity(getTournament(db, request.params.tournamentId), 'Tournoi introuvable.');
    if (tournament.status === 'draft') {
      throw new ApiError(404, 'Tournoi introuvable.');
    }
    const existing = db.prepare(
      'SELECT 1 FROM followed_tournaments WHERE user_email = ? AND tournament_id = ?',
    ).get(request.user.email, tournament.id);
    if (existing) {
      db.prepare('DELETE FROM followed_tournaments WHERE user_email = ? AND tournament_id = ?')
        .run(request.user.email, tournament.id);
      response.json({ followed: false });
      return;
    }
    db.prepare('INSERT INTO followed_tournaments (user_email, tournament_id) VALUES (?, ?)')
      .run(request.user.email, tournament.id);
    response.json({ followed: true });
  });

  return router;
}
