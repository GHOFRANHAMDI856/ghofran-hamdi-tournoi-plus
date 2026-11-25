import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openApiSpec } from '../src/openapi.js';

const app = createApp({
  db: {},
  jwtSecret: 'test-secret-with-more-than-thirty-two-characters',
});

const registeredOperations = {
  '/api/health': ['get'],
  '/api/auth/register': ['post'],
  '/api/auth/login': ['post'],
  '/api/auth/me': ['get'],
  '/api/auth/referees': ['get'],
  '/api/tournaments': ['get', 'post'],
  '/api/tournaments/mine': ['get'],
  '/api/tournaments/{id}': ['get', 'put', 'delete'],
  '/api/tournaments/{id}/teams': ['get', 'post'],
  '/api/tournaments/teams/{teamId}': ['delete', 'put'],
  '/api/tournaments/teams/{teamId}/members/{email}': ['delete'],
  '/api/teams/directory': ['get'],
  '/api/teams/mine': ['get'],
  '/api/teams/{teamId}/join-requests': ['post'],
  '/api/join-requests/mine': ['get'],
  '/api/tournaments/{tournamentId}/join-requests': ['get'],
  '/api/join-requests/{requestId}': ['patch'],
  '/api/tournaments/{tournamentId}/matches': ['get', 'post'],
  '/api/matches/public': ['get'],
  '/api/matches/mine': ['get'],
  '/api/matches/assigned': ['get'],
  '/api/matches/{matchId}': ['put', 'delete'],
  '/api/matches/{matchId}/score': ['patch'],
  '/api/matches/{matchId}/points': ['put'],
  '/api/matches/{matchId}/points/me': ['get'],
  '/api/follows': ['get'],
  '/api/tournaments/{tournamentId}/follow': ['put'],
};

test('serves Swagger UI and the OpenAPI document', async () => {
  const ui = await request(app).get('/swagger').redirects(1);
  assert.equal(ui.status, 200);
  assert.match(ui.text, /id="swagger-ui"/);
  assert.match(ui.headers['content-security-policy'], /script-src 'self' 'unsafe-inline'/);

  const document = await request(app).get('/swagger/openapi.json');
  assert.equal(document.status, 200);
  assert.equal(document.body.openapi, '3.0.3');
  assert.deepEqual(document.body.paths, openApiSpec.paths);
});

test('documents every registered REST operation with descriptions and responses', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(openApiSpec.paths).map(([path, pathItem]) => [
      path,
      Object.keys(pathItem).filter((key) => ['get', 'post', 'put', 'patch', 'delete'].includes(key)).sort(),
    ])),
    Object.fromEntries(Object.entries(registeredOperations).map(([path, methods]) => [path, methods.sort()])),
  );

  for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
    const pathParameters = (path.match(/\{[^}]+\}/g) ?? []).map((parameter) => parameter.slice(1, -1));
    const sharedParameters = pathItem.parameters ?? [];
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const endpoint = pathItem[method];
      if (!endpoint) continue;

      assert.ok(endpoint.summary, `${method.toUpperCase()} ${path} needs a summary`);
      assert.ok(endpoint.description, `${method.toUpperCase()} ${path} needs a description`);
      assert.ok(Object.keys(endpoint.responses).length > 0, `${method.toUpperCase()} ${path} needs responses`);
      assert.ok(Object.keys(endpoint.responses).some((status) => status.startsWith('2')), `${method.toUpperCase()} ${path} needs a success response`);
      for (const parameter of pathParameters) {
        assert.ok(
          [...sharedParameters, ...(endpoint.parameters ?? [])].some((item) => item.name === parameter && item.in === 'path' && item.required),
          `${method.toUpperCase()} ${path} needs path parameter ${parameter}`,
        );
      }
    }
  }

  const updateTeam = openApiSpec.paths['/api/tournaments/teams/{teamId}'].put;
  assert.deepEqual(updateTeam.security, [{ BearerAuth: [] }]);
  assert.equal(updateTeam.requestBody.required, true);
  assert.equal(
    updateTeam.requestBody.content['application/json'].schema.$ref,
    '#/components/schemas/UpdateTeamRequest',
  );
  assert.ok(updateTeam.responses['409']);
});
