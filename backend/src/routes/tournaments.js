import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiError, requireEntity, requireRole, requireText } from '../errors.js';

const formats = new Set(['elimination', 'league', 'groups']);
const statuses = new Set(['draft', 'open', 'in_progress', 'completed']);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function parseTournamentInput(body) {
  const input = {
    name: requireText(body?.name, 'name', 120),
    sport: requireText(body?.sport, 'sport', 80),
    startDate: body?.startDate,
    endDate: body?.endDate,
    location: requireText(body?.location, 'location', 200),
    description: typeof body?.description === 'string' ? body.description.trim() : '',
    rules: typeof body?.rules === 'string' ? body.rules.trim() : '',
    format: body?.format,
    status: body?.status,
    maxTeams: body?.maxTeams,
  };

  if (
    !validDate(input.startDate)
    || !validDate(input.endDate)
    || input.endDate < input.startDate
    || !formats.has(input.format)
    || !statuses.has(input.status)
    || !Number.isInteger(input.maxTeams)
    || input.maxTeams < 2
    || input.maxTeams > 100
    || input.description.length > 2000
    || input.rules.length > 5000
  ) {
    throw new ApiError(400, 'Les informations du tournoi sont invalides.');
  }

  return input;
}

function tournamentFromRow(row) {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    sport: row.sport,
    startDate: row.start_date,
    endDate: row.end_date,
    location: row.location,
    description: row.description,
    rules: row.rules,
    format: row.format,
    status: row.status,
    maxTeams: row.max_teams,
  };
}

function findTournament(db, id) {
  return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
}

export function createTournamentsRouter({ db }) {
  const router = Router();

  router.get('/', (_request, response) => {
    const rows = db.prepare("SELECT * FROM tournaments WHERE status <> 'draft' ORDER BY start_date").all();
    response.json({ tournaments: rows.map(tournamentFromRow) });
  });

  router.get('/mine', requireRole('organisateur'), (request, response) => {
    const rows = db.prepare(
      'SELECT * FROM tournaments WHERE owner_email = ? ORDER BY start_date',
    ).all(request.user.email);
    response.json({ tournaments: rows.map(tournamentFromRow) });
  });

  router.get('/:id', (request, response) => {
    const tournament = requireEntity(findTournament(db, request.params.id));
    if (tournament.status === 'draft' && tournament.owner_email !== request.user?.email) {
      throw new ApiError(404, 'Tournoi introuvable.');
    }
    response.json({ tournament: tournamentFromRow(tournament) });
  });

  router.post('/', requireRole('organisateur'), (request, response) => {
    const input = parseTournamentInput(request.body);
    const id = randomUUID();
    db.prepare(`
      INSERT INTO tournaments (
        id, owner_email, name, sport, start_date, end_date, location,
        description, rules, format, status, max_teams
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      request.user.email,
      input.name,
      input.sport,
      input.startDate,
      input.endDate,
      input.location,
      input.description,
      input.rules,
      input.format,
      input.status,
      input.maxTeams,
    );
    response.status(201).json({ tournament: tournamentFromRow(findTournament(db, id)) });
  });

  router.put('/:id', requireRole('organisateur'), (request, response) => {
    const input = parseTournamentInput(request.body);
    const tournament = requireEntity(findTournament(db, request.params.id));
    if (tournament.owner_email !== request.user.email) {
      throw new ApiError(404, 'Tournoi introuvable.');
    }

    const teamCount = db.prepare('SELECT COUNT(*) AS count FROM teams WHERE tournament_id = ?')
      .get(tournament.id).count;
    if (input.maxTeams < teamCount) {
      throw new ApiError(409, 'Le nombre maximal d’équipes ne peut pas être inférieur au nombre d’équipes inscrites.');
    }

    db.prepare(`
      UPDATE tournaments
      SET name = ?, sport = ?, start_date = ?, end_date = ?, location = ?,
          description = ?, rules = ?, format = ?, status = ?, max_teams = ?
      WHERE id = ?
    `).run(
      input.name,
      input.sport,
      input.startDate,
      input.endDate,
      input.location,
      input.description,
      input.rules,
      input.format,
      input.status,
      input.maxTeams,
      tournament.id,
    );
    response.json({ tournament: tournamentFromRow(findTournament(db, tournament.id)) });
  });

  router.delete('/:id', requireRole('organisateur'), (request, response) => {
    const result = db.prepare('DELETE FROM tournaments WHERE id = ? AND owner_email = ?')
      .run(request.params.id, request.user.email);
    if (result.changes === 0) {
      throw new ApiError(404, 'Tournoi introuvable.');
    }
    response.status(204).end();
  });

  router.get('/:id/teams', requireRole('organisateur'), (request, response) => {
    const tournament = requireEntity(findTournament(db, request.params.id));
    if (tournament.owner_email !== request.user.email) {
      throw new ApiError(404, 'Tournoi introuvable.');
    }
    const teams = db.prepare(`
      SELECT t.id, t.tournament_id AS tournamentId, t.owner_email AS ownerEmail,
             t.name, t.capacity, GROUP_CONCAT(tm.player_email) AS members
      FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
      WHERE t.tournament_id = ?
      GROUP BY t.id ORDER BY t.name COLLATE NOCASE
    `).all(tournament.id).map((team) => ({
      id: team.id,
      tournamentId: team.tournamentId,
      ownerEmail: team.ownerEmail,
      name: team.name,
      capacity: team.capacity,
      memberEmails: team.members ? team.members.split(',') : [],
    }));
    response.json({ teams });
  });

  router.post('/:id/teams', requireRole('organisateur'), (request, response) => {
    const tournament = requireEntity(findTournament(db, request.params.id));
    const name = requireText(request.body?.name, 'name', 100);
    const capacity = request.body?.capacity;
    if (
      tournament.owner_email !== request.user.email
      || tournament.status === 'completed'
      || !Number.isInteger(capacity)
      || capacity < 2
      || capacity > 100
    ) {
      throw new ApiError(400, 'Impossible de créer cette équipe avec les informations fournies.');
    }
    const teamCount = db.prepare('SELECT COUNT(*) AS count FROM teams WHERE tournament_id = ?')
      .get(tournament.id).count;
    if (teamCount >= tournament.max_teams) {
      throw new ApiError(409, 'Le nombre maximal d’équipes est atteint.');
    }

    const teamId = randomUUID();
    db.prepare(
      'INSERT INTO teams (id, tournament_id, owner_email, name, capacity) VALUES (?, ?, ?, ?, ?)',
    ).run(teamId, tournament.id, request.user.email, name, capacity);
    response.status(201).json({
      team: {
        id: teamId,
        tournamentId: tournament.id,
        ownerEmail: request.user.email,
        name,
        capacity,
        memberEmails: [],
      },
    });
  });

  router.delete('/teams/:teamId', requireRole('organisateur'), (request, response) => {
    const team = db.prepare(`
      SELECT teams.id FROM teams
      JOIN tournaments ON tournaments.id = teams.tournament_id
      WHERE teams.id = ? AND tournaments.owner_email = ?
    `).get(request.params.teamId, request.user.email);
    if (!team) {
      throw new ApiError(404, 'Équipe introuvable.');
    }
    const match = db.prepare(
      'SELECT id FROM matches WHERE home_team_id = ? OR away_team_id = ? LIMIT 1',
    ).get(team.id, team.id);
    if (match) {
      throw new ApiError(409, 'Une équipe déjà affectée à un match ne peut pas être supprimée.');
    }
    db.prepare('DELETE FROM teams WHERE id = ?').run(team.id);
    response.status(204).end();
  });

  router.delete('/teams/:teamId/members/:email', requireRole('organisateur'), (request, response) => {
    const member = db.prepare(`
      SELECT tm.team_id FROM team_members tm
      JOIN teams ON teams.id = tm.team_id
      JOIN tournaments ON tournaments.id = teams.tournament_id
      WHERE tm.team_id = ? AND tm.player_email = ? COLLATE NOCASE
        AND tournaments.owner_email = ?
    `).get(request.params.teamId, request.params.email, request.user.email);
    if (!member) {
      throw new ApiError(404, 'Membre introuvable dans cette équipe.');
    }
    db.prepare('DELETE FROM team_members WHERE team_id = ? AND player_email = ?')
      .run(member.team_id, request.params.email);
    response.status(204).end();
  });

  return router;
}
