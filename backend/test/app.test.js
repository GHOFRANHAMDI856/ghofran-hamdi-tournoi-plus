import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

const jwtSecret = 'test-secret-with-more-than-thirty-two-characters';
let temporaryDirectory;
let db;
let app;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tournoi-plus-api-'));
  db = createDatabase(path.join(temporaryDirectory, 'test.sqlite'));
  app = createApp({ db, jwtSecret });
});

afterEach(() => {
  db.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function register(name, email, role) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'motdepasse-securise', role });
  assert.equal(response.status, 201);
  return response.body;
}

function withToken(token) {
  return { Authorization: `Bearer ${token}` };
}

test('registers users with a password hash and issues a token', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Organisateur',
      email: 'ORGA@example.com',
      password: 'motdepasse-securise',
      role: 'organisateur',
    });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.user, {
    name: 'Organisateur',
    email: 'orga@example.com',
    role: 'organisateur',
  });
  assert.ok(response.body.token);
  const savedUser = db.prepare('SELECT password_hash FROM users WHERE email = ?')
    .get('orga@example.com');
  assert.notEqual(savedUser.password_hash, 'motdepasse-securise');

  const currentUser = await request(app)
    .get('/api/auth/me')
    .set(withToken(response.body.token));
  assert.deepEqual(currentUser.body.user, response.body.user);
});

test('protects tournament operations and supports a full team-match workflow', async () => {
  const organizer = await register('Organisateur', 'organizer@example.com', 'organisateur');
  const player = await register('Joueuse', 'player@example.com', 'joueur');
  const referee = await register('Arbitre', 'referee@example.com', 'arbitre');
  const spectator = await register('Spectatrice', 'spectator@example.com', 'spectateur');

  const unauthorized = await request(app).post('/api/tournaments').send({});
  assert.equal(unauthorized.status, 401);

  const tournamentResponse = await request(app)
    .post('/api/tournaments')
    .set(withToken(organizer.token))
    .send({
      name: 'Coupe régionale',
      sport: 'Football',
      startDate: '2027-02-10',
      endDate: '2027-02-12',
      location: 'Stade municipal',
      description: '',
      rules: '',
      format: 'elimination',
      status: 'open',
      maxTeams: 4,
    });
  assert.equal(tournamentResponse.status, 201);
  const tournament = tournamentResponse.body.tournament;

  const createTeam = (name) => request(app)
    .post(`/api/tournaments/${tournament.id}/teams`)
    .set(withToken(organizer.token))
    .send({ name, capacity: 5 });
  const homeTeamResponse = await createTeam('Les Aigles');
  const awayTeamResponse = await createTeam('Les Lions');
  assert.equal(homeTeamResponse.status, 201);
  assert.equal(awayTeamResponse.status, 201);
  const homeTeam = homeTeamResponse.body.team;
  const awayTeam = awayTeamResponse.body.team;

  const joinRequestResponse = await request(app)
    .post(`/api/teams/${homeTeam.id}/join-requests`)
    .set(withToken(player.token))
    .send();
  assert.equal(joinRequestResponse.status, 201);

  const approval = await request(app)
    .patch(`/api/join-requests/${joinRequestResponse.body.joinRequest.id}`)
    .set(withToken(organizer.token))
    .send({ approved: true });
  assert.equal(approval.status, 200);
  assert.equal(approval.body.joinRequest.status, 'approved');

  const matchResponse = await request(app)
    .post(`/api/tournaments/${tournament.id}/matches`)
    .set(withToken(organizer.token))
    .send({
      refereeEmail: 'referee@example.com',
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      startAt: '2027-02-10T09:00:00Z',
      endAt: '2027-02-10T10:00:00Z',
      location: 'Terrain 1',
    });
  assert.equal(matchResponse.status, 201);
  const match = matchResponse.body.match;

  const assignedMatches = await request(app)
    .get('/api/matches/assigned')
    .set(withToken(referee.token));
  assert.deepEqual(assignedMatches.body.matches.map((item) => item.id), [match.id]);

  const score = await request(app)
    .patch(`/api/matches/${match.id}/score`)
    .set(withToken(organizer.token))
    .send({ side: 'home', score: 3 });
  assert.equal(score.body.match.homeScore, 3);

  const points = await request(app)
    .put(`/api/matches/${match.id}/points`)
    .set(withToken(organizer.token))
    .send({ playerEmail: player.user.email, points: 2 });
  assert.equal(points.body.match.playerPoints[player.user.email], 2);

  const playerMatches = await request(app)
    .get('/api/matches/mine')
    .set(withToken(player.token));
  assert.deepEqual(playerMatches.body.matches.map((item) => item.id), [match.id]);
  const playerPoints = await request(app)
    .get(`/api/matches/${match.id}/points/me`)
    .set(withToken(player.token));
  assert.equal(playerPoints.body.points, 2);

  const followed = await request(app)
    .put(`/api/tournaments/${tournament.id}/follow`)
    .set(withToken(spectator.token));
  assert.deepEqual(followed.body, { followed: true });
  const followedIds = await request(app)
    .get('/api/follows')
    .set(withToken(spectator.token));
  assert.deepEqual(followedIds.body.tournamentIds, [tournament.id]);

  const forbidden = await request(app)
    .post('/api/tournaments')
    .set(withToken(player.token))
    .send({});
  assert.equal(forbidden.status, 403);
});

test('rejects invalid roles, weak passwords, and overlapping match schedules', async () => {
  const invalidRole = await request(app)
    .post('/api/auth/register')
    .send({ name: 'User', email: 'user@example.com', password: 'long-enough-password', role: 'admin' });
  assert.equal(invalidRole.status, 400);

  const weakPassword = await request(app)
    .post('/api/auth/register')
    .send({ name: 'User', email: 'user@example.com', password: 'short', role: 'joueur' });
  assert.equal(weakPassword.status, 400);

  const organizer = await register('Organisateur', 'organizer@example.com', 'organisateur');
  const tournamentResponse = await request(app)
    .post('/api/tournaments')
    .set(withToken(organizer.token))
    .send({
      name: 'Tournoi',
      sport: 'Football',
      startDate: '2027-02-10',
      endDate: '2027-02-12',
      location: 'Stade',
      description: '',
      rules: '',
      format: 'league',
      status: 'open',
      maxTeams: 4,
    });
  const tournamentId = tournamentResponse.body.tournament.id;
  const teams = [];
  for (const name of ['A', 'B', 'C']) {
    const response = await request(app)
      .post(`/api/tournaments/${tournamentId}/teams`)
      .set(withToken(organizer.token))
      .send({ name, capacity: 5 });
    teams.push(response.body.team);
  }

  const createMatch = (homeTeamId, awayTeamId, location) => request(app)
    .post(`/api/tournaments/${tournamentId}/matches`)
    .set(withToken(organizer.token))
    .send({
      refereeEmail: '',
      homeTeamId,
      awayTeamId,
      startAt: '2027-02-10T09:00:00Z',
      endAt: '2027-02-10T10:00:00Z',
      location,
    });
  assert.equal((await createMatch(teams[0].id, teams[1].id, 'Terrain 1')).status, 201);
  assert.equal((await createMatch(teams[0].id, teams[2].id, 'Terrain 2')).status, 409);
});
