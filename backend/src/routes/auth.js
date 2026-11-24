import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError, requireRole } from '../errors.js';

export function createAuthRouter({ db, authenticate, jwtSecret, jwtExpiresIn }) {
  const router = Router();

  router.post('/register', async (request, response) => {
    const { name, email, password, role = 'spectateur' } = request.body ?? {};
    if (
      typeof name !== 'string'
      || name.trim().length < 2
      || name.trim().length > 100
      || typeof email !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof password !== 'string'
      || password.length < 8
      || Buffer.byteLength(password, 'utf8') > 72
      || !['organisateur', 'joueur', 'spectateur', 'arbitre'].includes(role)
    ) {
      throw new ApiError(400, 'Les informations d’inscription sont invalides.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      db.prepare(
        'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
      ).run(normalizedEmail, name.trim(), passwordHash, role);
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ApiError(409, 'Cette adresse e-mail est déjà utilisée.');
      }
      throw error;
    }

    const user = { email: normalizedEmail, name: name.trim(), role };
    const token = jwt.sign({}, jwtSecret, { subject: normalizedEmail, expiresIn: jwtExpiresIn });
    response.status(201).json({ user, token });
  });

  router.post('/login', async (request, response) => {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new ApiError(400, 'Adresse e-mail ou mot de passe invalide.');
    }

    const user = db.prepare(
      'SELECT email, name, role, password_hash FROM users WHERE email = ? COLLATE NOCASE',
    ).get(email.trim());
    const passwordMatches = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, '$2b$12$C6UzMDM.H6dfI/f/IKcEe.8nqN1vdHHEy0cm7.7qRxR8AO4sP4QpK');

    if (!user || !passwordMatches) {
      throw new ApiError(401, 'Adresse e-mail ou mot de passe incorrect.');
    }

    const publicUser = { email: user.email, name: user.name, role: user.role };
    const token = jwt.sign({}, jwtSecret, { subject: user.email, expiresIn: jwtExpiresIn });
    response.json({ user: publicUser, token });
  });

  router.get('/me', authenticate, (request, response) => {
    response.json({ user: request.user });
  });

  router.get('/referees', authenticate, requireRole('organisateur'), (_request, response) => {
    const referees = db.prepare(
      "SELECT name, email FROM users WHERE role = 'arbitre' ORDER BY name COLLATE NOCASE",
    ).all();
    response.json({ referees });
  });

  return router;
}
