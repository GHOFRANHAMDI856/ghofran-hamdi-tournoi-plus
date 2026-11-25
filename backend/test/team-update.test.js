import assert from 'node:assert/strict';
import express from 'express';
import { test } from 'node:test';
import request from 'supertest';
import { errorHandler } from '../src/errors.js';
import { createTournamentsRouter } from '../src/routes/tournaments.js';

const organizer = { email: 'organizer@example.com', role: 'organisateur' };

function createTestApp(user = organizer) {
  const team = {
    id: 'team-1',
    tournament_id: 'tournament-1',
    owner_email: organizer.email,
    name: 'Original',
    capacity: 5,
  };
  const otherTeam = { ...team, id: 'team-2', name: 'Other' };
  const members = ['one@example.com', 'two@example.com', 'three@example.com'];
  const db = {
    prepare(sql) {
      if (sql.includes('FROM teams') && sql.includes('JOIN tournaments')) {
        return {
          get: async (id, ownerEmail) => (
            id === team.id && ownerEmail === organizer.email ? { ...team } : undefined
          ),
        };
      }
      if (sql.includes('LOWER(name) = LOWER(?)')) {
        return {
          get: async (tournamentId, name, excludedId) => (
            [team, otherTeam].find((candidate) => (
              candidate.tournament_id === tournamentId
              && candidate.id !== excludedId
              && candidate.name.toLowerCase() === name.toLowerCase()
            ))
          ),
        };
      }
      if (sql.includes('COUNT(*) AS count FROM team_members')) {
        return { get: async () => ({ count: members.length }) };
      }
      if (sql.includes('SELECT player_email FROM team_members')) {
        return { all: async () => members.map((player_email) => ({ player_email })) };
      }
      if (sql.includes('UPDATE teams SET name = ?, capacity = ?')) {
        return {
          run: async (name, capacity) => {
            team.name = name;
            team.capacity = capacity;
            return { changes: 1 };
          },
        };
      }
      throw new Error(`Unexpected SQL in team update test: ${sql}`);
    },
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/tournaments', createTournamentsRouter({ db }));
  app.use(errorHandler);
  return app;
}

test('updates team details and rejects duplicate names or capacity below member count', async () => {
  const app = createTestApp();
  const forbidden = await request(createTestApp({ email: 'player@example.com', role: 'joueur' }))
    .put('/api/tournaments/teams/team-1')
    .send({ name: 'Updated', capacity: 3 });
  assert.equal(forbidden.status, 403);

  const updated = await request(app)
    .put('/api/tournaments/teams/team-1')
    .send({ name: 'Updated', capacity: 3 });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.team, {
    id: 'team-1',
    tournamentId: 'tournament-1',
    ownerEmail: organizer.email,
    name: 'Updated',
    capacity: 3,
    memberEmails: ['one@example.com', 'two@example.com', 'three@example.com'],
  });

  const duplicate = await request(app)
    .put('/api/tournaments/teams/team-1')
    .send({ name: 'other', capacity: 3 });
  assert.equal(duplicate.status, 409);

  const tooSmall = await request(app)
    .put('/api/tournaments/teams/team-1')
    .send({ name: 'Updated', capacity: 2 });
  assert.equal(tooSmall.status, 409);
});
