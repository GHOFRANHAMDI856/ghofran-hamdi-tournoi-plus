const json = (schema) => ({
  'application/json': { schema },
});

const response = (description, schema) => ({
  description,
  ...(schema ? { content: json(schema) } : {}),
});

const errorResponse = (description) => response(description, { $ref: '#/components/schemas/ApiError' });
const success = (description, schema) => response(description, schema);
const bearer = [{ BearerAuth: [] }];

const pathParameter = (name, description, format) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', ...(format ? { format } : {}) },
});

const body = (schema, description = 'JSON request body') => ({
  required: true,
  description,
  content: json({ $ref: `#/components/schemas/${schema}` }),
});

const operation = (tags, summary, description, responses, options = {}) => ({
  tags: [tags],
  summary,
  description,
  ...(options.parameters ? { parameters: options.parameters } : {}),
  ...(options.requestBody ? { requestBody: options.requestBody } : {}),
  ...(options.security ? { security: options.security } : {}),
  responses,
});

const authRequired = errorResponse('Missing, invalid, or expired bearer token.');
const forbidden = errorResponse('The authenticated user does not have the required role.');
const invalidRequest = errorResponse('The request body or path parameter is invalid.');
const notFound = errorResponse('The requested resource was not found.');
const conflict = errorResponse('The request conflicts with the current resource state.');
const internalError = errorResponse('An unexpected server error occurred.');

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Tournoi Plus API',
    version: '1.0.0',
    description: 'REST API for user accounts, tournaments, teams, registrations, matches, points, and follows.',
  },
  servers: [{ url: '/', description: 'Current server' }],
  tags: [
    { name: 'Health', description: 'Service status.' },
    { name: 'Authentication', description: 'Registration, login, and authenticated user information.' },
    { name: 'Tournaments', description: 'Tournament discovery and organizer management.' },
    { name: 'Teams', description: 'Team discovery, membership, and organizer management.' },
    { name: 'Join requests', description: 'Player registration requests and organizer review.' },
    { name: 'Matches', description: 'Match scheduling, results, and player point totals.' },
    { name: 'Points', description: 'Player access to their own match points.' },
    { name: 'Follows', description: 'Spectator tournament follows.' },
  ],
  paths: {
    '/api/health': {
      get: operation('Health', 'Check API health', 'Returns the current API health status.', {
        200: success('The API is available.', {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', example: 'ok' } },
        }),
      }),
    },
    '/api/auth/register': {
      post: operation('Authentication', 'Register a user', 'Creates an account and returns a signed bearer token. Passwords must contain 8–72 UTF-8 bytes.', {
        201: success('Account created.', { $ref: '#/components/schemas/AuthSession' }),
        400: invalidRequest,
        409: errorResponse('The email address is already registered.'),
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        429: errorResponse('The authentication rate limit was exceeded.'),
        500: internalError,
      }, {
        requestBody: body('RegisterRequest'),
      }),
    },
    '/api/auth/login': {
      post: operation('Authentication', 'Log in', 'Validates credentials and returns a signed bearer token.', {
        200: success('Credentials accepted.', { $ref: '#/components/schemas/AuthSession' }),
        400: invalidRequest,
        401: errorResponse('The email address or password is incorrect.'),
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        429: errorResponse('The authentication rate limit was exceeded.'),
        500: internalError,
      }, {
        requestBody: body('LoginRequest'),
      }),
    },
    '/api/auth/me': {
      get: operation('Authentication', 'Get current user', 'Returns the user associated with the bearer token.', {
        200: success('Authenticated user.', {
          type: 'object',
          required: ['user'],
          properties: { user: { $ref: '#/components/schemas/User' } },
        }),
        401: authRequired,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/auth/referees': {
      get: operation('Authentication', 'List referees', 'Lists referees for an organizer to assign to matches.', {
        200: success('Referee accounts.', {
          type: 'object',
          required: ['referees'],
          properties: {
            referees: { type: 'array', items: { $ref: '#/components/schemas/Referee' } },
          },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/tournaments': {
      get: operation('Tournaments', 'List public tournaments', 'Returns all tournaments except drafts.', {
        200: success('Public tournaments.', {
          type: 'object',
          required: ['tournaments'],
          properties: { tournaments: { type: 'array', items: { $ref: '#/components/schemas/Tournament' } } },
        }),
        500: internalError,
      }),
      post: operation('Tournaments', 'Create a tournament', 'Creates a tournament owned by the authenticated organizer.', {
        201: success('Tournament created.', {
          type: 'object',
          required: ['tournament'],
          properties: { tournament: { $ref: '#/components/schemas/Tournament' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('TournamentInput') }),
    },
    '/api/tournaments/mine': {
      get: operation('Tournaments', 'List my tournaments', 'Returns tournaments owned by the authenticated organizer, including drafts.', {
        200: success('Owned tournaments.', {
          type: 'object',
          required: ['tournaments'],
          properties: { tournaments: { type: 'array', items: { $ref: '#/components/schemas/Tournament' } } },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/tournaments/{id}': {
      parameters: [pathParameter('id', 'Tournament identifier.')],
      get: operation('Tournaments', 'Get a tournament', 'Returns a tournament; drafts are visible only to their owner.', {
        200: success('Tournament details.', {
          type: 'object',
          required: ['tournament'],
          properties: { tournament: { $ref: '#/components/schemas/Tournament' } },
        }),
        404: notFound,
        500: internalError,
      }),
      put: operation('Tournaments', 'Update a tournament', 'Replaces tournament details. The maximum team count cannot be below its current team count.', {
        200: success('Tournament updated.', {
          type: 'object',
          required: ['tournament'],
          properties: { tournament: { $ref: '#/components/schemas/Tournament' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('TournamentInput') }),
      delete: operation('Tournaments', 'Delete a tournament', 'Deletes a tournament owned by the authenticated organizer.', {
        204: response('Tournament deleted.'),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/tournaments/{id}/teams': {
      parameters: [pathParameter('id', 'Tournament identifier.')],
      get: operation('Teams', 'List tournament teams', 'Returns teams for a tournament owned by the authenticated organizer, including member email addresses.', {
        200: success('Tournament teams.', {
          type: 'object',
          required: ['teams'],
          properties: { teams: { type: 'array', items: { $ref: '#/components/schemas/Team' } } },
        }),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
      post: operation('Teams', 'Create a tournament team', 'Creates a team for a tournament owned by the authenticated organizer.', {
        201: success('Team created.', {
          type: 'object',
          required: ['team'],
          properties: { team: { $ref: '#/components/schemas/Team' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, {
        security: bearer,
        requestBody: body('CreateTeamRequest'),
      }),
    },
    '/api/tournaments/teams/{teamId}': {
      parameters: [pathParameter('teamId', 'Team identifier.')],
      put: operation('Teams', 'Update a team', 'Updates the name and capacity of a team in a tournament owned by the authenticated organizer. Names must be unique within the tournament, and capacity cannot be less than the current member count.', {
        200: success('Team updated.', {
          type: 'object',
          required: ['team'],
          properties: { team: { $ref: '#/components/schemas/Team' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('UpdateTeamRequest') }),
      delete: operation('Teams', 'Delete a team', 'Deletes a team belonging to a tournament owned by the authenticated organizer. Teams assigned to matches cannot be deleted.', {
        204: response('Team deleted.'),
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/tournaments/teams/{teamId}/members/{email}': {
      parameters: [
        pathParameter('teamId', 'Team identifier.'),
        pathParameter('email', 'Email address of the team member.', 'email'),
      ],
      delete: operation('Teams', 'Remove a team member', 'Removes a player from a team in a tournament owned by the authenticated organizer.', {
        204: response('Team member removed.'),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/teams/directory': {
      get: operation('Teams', 'Browse available teams', 'Lists teams in open tournaments that have capacity and where the player is not already registered or awaiting a decision.', {
        200: success('Available teams and tournament summaries.', {
          type: 'object',
          required: ['teams'],
          properties: {
            teams: {
              type: 'array',
              items: {
                type: 'object',
                required: ['team', 'tournament'],
                properties: {
                  team: { $ref: '#/components/schemas/Team' },
                  tournament: { $ref: '#/components/schemas/TournamentSummary' },
                },
              },
            },
          },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/teams/mine': {
      get: operation('Teams', 'List my teams', 'Returns teams the authenticated player belongs to.', {
        200: success('Player teams.', {
          type: 'object',
          required: ['teams'],
          properties: { teams: { type: 'array', items: { $ref: '#/components/schemas/Team' } } },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/teams/{teamId}/join-requests': {
      parameters: [pathParameter('teamId', 'Team identifier.')],
      post: operation('Join requests', 'Request to join a team', 'Creates a pending join request for the authenticated player. The player cannot be a member of, or have another pending request in, the same tournament.', {
        201: success('Join request created.', {
          type: 'object',
          required: ['joinRequest'],
          properties: { joinRequest: { $ref: '#/components/schemas/JoinRequest' } },
        }),
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/join-requests/mine': {
      get: operation('Join requests', 'List my join requests', 'Returns join requests submitted by the authenticated player, newest first.', {
        200: success('Player join requests.', {
          type: 'object',
          required: ['joinRequests'],
          properties: { joinRequests: { type: 'array', items: { $ref: '#/components/schemas/JoinRequest' } } },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/tournaments/{tournamentId}/join-requests': {
      parameters: [pathParameter('tournamentId', 'Tournament identifier.')],
      get: operation('Join requests', 'List tournament join requests', 'Returns requests for a tournament owned by the authenticated organizer.', {
        200: success('Tournament join requests.', {
          type: 'object',
          required: ['joinRequests'],
          properties: { joinRequests: { type: 'array', items: { $ref: '#/components/schemas/JoinRequest' } } },
        }),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/join-requests/{requestId}': {
      parameters: [pathParameter('requestId', 'Join request identifier.')],
      patch: operation('Join requests', 'Review a join request', 'Approves or rejects a pending request owned by the authenticated organizer. An approval adds the player to the team.', {
        200: success('Join request reviewed.', {
          type: 'object',
          required: ['joinRequest'],
          properties: { joinRequest: { $ref: '#/components/schemas/JoinRequest' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, {
        security: bearer,
        requestBody: body('ReviewJoinRequest'),
      }),
    },
    '/api/tournaments/{tournamentId}/matches': {
      parameters: [pathParameter('tournamentId', 'Tournament identifier.')],
      get: operation('Matches', 'List tournament matches', 'Returns scheduled matches for a tournament owned by the authenticated organizer.', {
        200: success('Tournament matches.', {
          type: 'object',
          required: ['matches'],
          properties: { matches: { type: 'array', items: { $ref: '#/components/schemas/Match' } } },
        }),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
      post: operation('Matches', 'Schedule a match', 'Schedules a match between two teams in the tournament. The assigned referee may be omitted with an empty string.', {
        201: success('Match scheduled.', {
          type: 'object',
          required: ['match'],
          properties: { match: { $ref: '#/components/schemas/Match' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('MatchInput') }),
    },
    '/api/matches/public': {
      get: operation('Matches', 'List public matches', 'Returns matches whose tournaments are not drafts, ordered by start time.', {
        200: success('Public matches.', {
          type: 'object',
          required: ['matches'],
          properties: { matches: { type: 'array', items: { $ref: '#/components/schemas/Match' } } },
        }),
        500: internalError,
      }),
    },
    '/api/matches/mine': {
      get: operation('Matches', 'List my matches', 'Returns matches involving a team the authenticated player belongs to.', {
        200: success('Player matches.', {
          type: 'object',
          required: ['matches'],
          properties: { matches: { type: 'array', items: { $ref: '#/components/schemas/Match' } } },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/matches/assigned': {
      get: operation('Matches', 'List assigned matches', 'Returns matches assigned to the authenticated referee.', {
        200: success('Assigned matches.', {
          type: 'object',
          required: ['matches'],
          properties: { matches: { type: 'array', items: { $ref: '#/components/schemas/Match' } } },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/matches/{matchId}': {
      parameters: [pathParameter('matchId', 'Match identifier.')],
      put: operation('Matches', 'Update a match', 'Replaces match scheduling details for an organizer-owned match.', {
        200: success('Match updated.', {
          type: 'object',
          required: ['match'],
          properties: { match: { $ref: '#/components/schemas/Match' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        409: conflict,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('MatchInput') }),
      delete: operation('Matches', 'Delete a match', 'Deletes a match owned by the authenticated organizer.', {
        204: response('Match deleted.'),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/matches/{matchId}/score': {
      parameters: [pathParameter('matchId', 'Match identifier.')],
      patch: operation('Matches', 'Update a match score', 'Sets or clears the score for the home or away team on an organizer-owned match.', {
        200: success('Match score updated.', {
          type: 'object',
          required: ['match'],
          properties: { match: { $ref: '#/components/schemas/Match' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('MatchScoreRequest') }),
    },
    '/api/matches/{matchId}/points': {
      parameters: [pathParameter('matchId', 'Match identifier.')],
      put: operation('Matches', 'Set player points', 'Sets a participant’s points on an organizer-owned match; set points to null to remove the entry.', {
        200: success('Match points updated.', {
          type: 'object',
          required: ['match'],
          properties: { match: { $ref: '#/components/schemas/Match' } },
        }),
        400: invalidRequest,
        401: authRequired,
        403: forbidden,
        404: notFound,
        413: errorResponse('The JSON request body exceeds the configured size limit.'),
        500: internalError,
      }, { security: bearer, requestBody: body('PlayerPointsRequest') }),
    },
    '/api/matches/{matchId}/points/me': {
      parameters: [pathParameter('matchId', 'Match identifier.')],
      get: operation('Points', 'Get my match points', 'Returns the authenticated player’s points for a match, or null when no points have been recorded.', {
        200: success('Player points.', {
          type: 'object',
          required: ['points'],
          properties: { points: { type: 'integer', minimum: 0, nullable: true, example: 2 } },
        }),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/follows': {
      get: operation('Follows', 'List followed tournaments', 'Returns tournament identifiers followed by the authenticated spectator.', {
        200: success('Followed tournament identifiers.', {
          type: 'object',
          required: ['tournamentIds'],
          properties: { tournamentIds: { type: 'array', items: { type: 'string', format: 'uuid' } } },
        }),
        401: authRequired,
        403: forbidden,
        500: internalError,
      }, { security: bearer }),
    },
    '/api/tournaments/{tournamentId}/follow': {
      parameters: [pathParameter('tournamentId', 'Tournament identifier.')],
      put: operation('Follows', 'Toggle a tournament follow', 'Adds or removes the authenticated spectator’s follow. Calling this operation toggles the current state.', {
        200: success('Follow state after toggling.', {
          type: 'object',
          required: ['followed'],
          properties: { followed: { type: 'boolean', description: 'True when the tournament is now followed.' } },
        }),
        401: authRequired,
        403: forbidden,
        404: notFound,
        500: internalError,
      }, { security: bearer }),
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT returned by POST /api/auth/register or POST /api/auth/login.',
      },
    },
    schemas: {
      ApiError: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', description: 'Human-readable error message.' } },
      },
      User: {
        type: 'object',
        required: ['email', 'name', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['organisateur', 'joueur', 'spectateur', 'arbitre'] },
        },
      },
      Referee: {
        type: 'object',
        required: ['name', 'email'],
        properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' } },
      },
      AuthSession: {
        type: 'object',
        required: ['user', 'token'],
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', description: 'JWT bearer access token.' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 72, description: 'Maximum 72 UTF-8 bytes.' },
          role: { type: 'string', enum: ['organisateur', 'joueur', 'spectateur', 'arbitre'], default: 'spectateur' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      Tournament: {
        type: 'object',
        required: ['id', 'ownerEmail', 'name', 'sport', 'startDate', 'endDate', 'location', 'description', 'rules', 'format', 'status', 'maxTeams'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          ownerEmail: { type: 'string', format: 'email' },
          name: { type: 'string', maxLength: 120 },
          sport: { type: 'string', maxLength: 80 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          location: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          rules: { type: 'string', maxLength: 5000 },
          format: { type: 'string', enum: ['elimination', 'league', 'groups'] },
          status: { type: 'string', enum: ['draft', 'open', 'in_progress', 'completed'] },
          maxTeams: { type: 'integer', minimum: 2, maximum: 100 },
        },
      },
      TournamentInput: {
        type: 'object',
        required: ['name', 'sport', 'startDate', 'endDate', 'location', 'format', 'status', 'maxTeams'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          sport: { type: 'string', minLength: 1, maxLength: 80 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date', description: 'Must be on or after startDate.' },
          location: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000, default: '' },
          rules: { type: 'string', maxLength: 5000, default: '' },
          format: { type: 'string', enum: ['elimination', 'league', 'groups'] },
          status: { type: 'string', enum: ['draft', 'open', 'in_progress', 'completed'] },
          maxTeams: { type: 'integer', minimum: 2, maximum: 100 },
        },
      },
      TournamentSummary: {
        type: 'object',
        required: ['id', 'ownerEmail', 'name', 'sport', 'startDate'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          ownerEmail: { type: 'string', format: 'email' },
          name: { type: 'string' },
          sport: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
        },
      },
      Team: {
        type: 'object',
        required: ['id', 'tournamentId', 'ownerEmail', 'name', 'capacity', 'memberEmails'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          tournamentId: { type: 'string', format: 'uuid' },
          ownerEmail: { type: 'string', format: 'email' },
          name: { type: 'string', maxLength: 100 },
          capacity: { type: 'integer', minimum: 2, maximum: 100 },
          memberEmails: { type: 'array', items: { type: 'string', format: 'email' } },
        },
      },
      CreateTeamRequest: {
        type: 'object',
        required: ['name', 'capacity'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          capacity: { type: 'integer', minimum: 2, maximum: 100 },
        },
      },
      UpdateTeamRequest: {
        type: 'object',
        required: ['name', 'capacity'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          capacity: { type: 'integer', minimum: 2, maximum: 100 },
        },
      },
      JoinRequest: {
        type: 'object',
        required: ['id', 'teamId', 'playerEmail', 'status', 'reason'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          teamId: { type: 'string', format: 'uuid' },
          playerEmail: { type: 'string', format: 'email' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          reason: { type: 'string', maxLength: 500 },
        },
      },
      ReviewJoinRequest: {
        type: 'object',
        required: ['approved'],
        properties: {
          approved: { type: 'boolean' },
          reason: { type: 'string', maxLength: 500, default: '' },
        },
      },
      Match: {
        type: 'object',
        required: ['id', 'tournamentId', 'ownerEmail', 'refereeEmail', 'homeTeamId', 'awayTeamId', 'startAt', 'endAt', 'location', 'homeScore', 'awayScore', 'playerPoints'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          tournamentId: { type: 'string', format: 'uuid' },
          ownerEmail: { type: 'string', format: 'email' },
          refereeEmail: { type: 'string', format: 'email', description: 'Empty when no referee is assigned.' },
          homeTeamId: { type: 'string', format: 'uuid' },
          awayTeamId: { type: 'string', format: 'uuid' },
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
          location: { type: 'string', maxLength: 200 },
          homeScore: { type: 'integer', minimum: 0, nullable: true },
          awayScore: { type: 'integer', minimum: 0, nullable: true },
          playerPoints: {
            type: 'object',
            description: 'Map of participant email address to awarded points.',
            additionalProperties: { type: 'integer', minimum: 0 },
          },
        },
      },
      MatchInput: {
        type: 'object',
        required: ['refereeEmail', 'homeTeamId', 'awayTeamId', 'startAt', 'endAt', 'location'],
        properties: {
          refereeEmail: { type: 'string', description: 'Referee email or an empty string to leave unassigned.' },
          homeTeamId: { type: 'string', format: 'uuid' },
          awayTeamId: { type: 'string', format: 'uuid', description: 'Must differ from homeTeamId.' },
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time', description: 'Must be after startAt.' },
          location: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
      MatchScoreRequest: {
        type: 'object',
        required: ['side', 'score'],
        properties: {
          side: { type: 'string', enum: ['home', 'away'] },
          score: { type: 'integer', minimum: 0, nullable: true },
        },
      },
      PlayerPointsRequest: {
        type: 'object',
        required: ['playerEmail', 'points'],
        properties: {
          playerEmail: { type: 'string', format: 'email' },
          points: { type: 'integer', minimum: 0, nullable: true },
        },
      },
    },
  },
};
