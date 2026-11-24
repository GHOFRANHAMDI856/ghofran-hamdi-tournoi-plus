export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'Le corps JSON de la requête est invalide.' });
    return;
  }

  if (error?.type === 'entity.too.large') {
    response.status(413).json({ error: 'La requête est trop volumineuse.' });
    return;
  }

  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    response.status(409).json({ error: 'Cette donnée existe déjà.' });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Une erreur interne est survenue.' });
}

export function requireRole(...roles) {
  return (request, _response, next) => {
    if (!request.user) {
      next(new ApiError(401, 'Authentification requise.'));
      return;
    }

    if (!roles.includes(request.user.role)) {
      next(new ApiError(403, 'Accès interdit pour ce rôle.'));
      return;
    }

    next();
  };
}

export function requireEntity(entity, message = 'Ressource introuvable.') {
  if (!entity) {
    throw new ApiError(404, message);
  }
  return entity;
}

export function requireText(value, field, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new ApiError(400, `Le champ ${field} est invalide.`);
  }
  return value.trim();
}
