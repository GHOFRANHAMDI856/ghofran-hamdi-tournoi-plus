import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createAuthMiddleware, createOptionalAuthMiddleware } from './auth-middleware.js';
import { errorHandler } from './errors.js';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi.js';
import { createAuthRouter } from './routes/auth.js';
import { createCompetitionRouter } from './routes/competition.js';
import { createTournamentsRouter } from './routes/tournaments.js';

export function createApp({
  db,
  jwtSecret = process.env.JWT_SECRET,
  jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1d',
  corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200',
}) {
  if (!db) {
    throw new Error('Une connexion PostgreSQL est requise pour démarrer l’API.');
  }
  if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères.');
  }

  const app = express();
  const authenticate = createAuthMiddleware(db, jwtSecret);
  const optionalAuth = createOptionalAuthMiddleware(db, jwtSecret);
  const allowedOrigins = new Set(corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  });

  app.disable('x-powered-by');
  app.use('/swagger', helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.get('/swagger/openapi.json', (_request, response) => {
    response.json(openApiSpec);
  });
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: 'Tournoi Plus API',
  }));
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth', createAuthRouter({
    db,
    authenticate,
    jwtSecret,
    jwtExpiresIn,
  }));
  app.use('/api/tournaments', optionalAuth, createTournamentsRouter({ db }));
  app.use('/api', createCompetitionRouter({ db, optionalAuth }));

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route introuvable.' });
  });
  app.use(errorHandler);
  return app;
}
