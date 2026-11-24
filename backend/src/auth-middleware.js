import jwt from 'jsonwebtoken';

export function createAuthMiddleware(db, jwtSecret) {
  return (request, response, next) => {
    const authorization = request.get('authorization') ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      response.status(401).json({ error: 'Authentification requise.' });
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      const user = db.prepare(
        'SELECT email, name, role FROM users WHERE email = ?',
      ).get(payload.sub);

      if (!user) {
        response.status(401).json({ error: 'Session invalide.' });
        return;
      }

      request.user = user;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        response.status(401).json({ error: 'Jeton invalide ou expiré.' });
        return;
      }

      next(error);
    }
  };
}

export function createOptionalAuthMiddleware(db, jwtSecret) {
  const authenticate = createAuthMiddleware(db, jwtSecret);
  return (request, response, next) => {
    if (!request.get('authorization')) {
      next();
      return;
    }
    authenticate(request, response, next);
  };
}
