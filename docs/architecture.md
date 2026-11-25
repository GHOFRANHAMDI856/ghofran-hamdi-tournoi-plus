# Architecture de Tournoi Plus

## Arborescence

- `frontend/` : application Angular, tests, configuration Nginx et Dockerfile multi-étapes.
- `backend/` : API REST Express, accès PostgreSQL, documentation OpenAPI, tests et Dockerfile.
- `docker-compose.yml` : services PostgreSQL, API et frontend.
- `.env.example` : noms des variables requises, sans identifiants réels.
- `docs/` : documentation technique et capture de Swagger UI.
- `rapport/` et `presentation/` : emplacements des livrables de soutenance.

## Flux d’exécution

```text
Navigateur
    │
    ├── http://localhost:4200 ──> Nginx ──> fichiers Angular
    │                                  ├── /api/* ──> API Express
    │                                  └── /swagger/* ──> Swagger UI
    │
    └── API Express ──> PostgreSQL (service db)
```

Compose attend que PostgreSQL soit sain avant de démarrer l’API, puis attend que l’API réponde à `/api/health` avant de démarrer Nginx.

## Frontend Angular

- `Auth` envoie l’inscription et la connexion à l’API. Le JWT et l’utilisateur courant sont gardés dans `sessionStorage`; aucun mot de passe n’est enregistré dans le navigateur.
- `authInterceptor` ajoute le jeton aux requêtes `/api/`.
- `TournamentApi` fournit les opérations HTTP pour les tournois et équipes.
- L’écran organisateur `/gestion/tournois-api` réalise le CRUD PostgreSQL de ces deux entités.
- `TournamentList` reçoit ses données avec `@Input` et remonte sélection, modification et suppression avec `@Output`.
- `TournamentStatusPipe` traduit les statuts de tournoi.
- Le formulaire contrôle notamment l’ordre des dates avec un validateur personnalisé.

Les autres espaces du tableau de bord conservent leurs données historiques dans `localStorage`; ils ne sont pas encore synchronisés avec les opérations API.

## API et données

L’API est construite avec Express et le pilote `pg`. Les tables et contraintes PostgreSQL sont initialisées au démarrage. Les mots de passe sont hachés avec bcrypt et les routes protégées valident des jetons JWT.

La spécification OpenAPI 3 et l’interface interactive Swagger sont servies par l’API sur `/swagger/`. Le document JSON est sur `/swagger/openapi.json`. Les routes et leurs entrées/sorties sont documentées dans cette spécification.
