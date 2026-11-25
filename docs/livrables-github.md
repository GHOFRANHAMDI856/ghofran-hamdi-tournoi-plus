# Checklist de dépôt et de soutenance

## Dépôt GitHub

- Créer le dépôt dans l’organisation du cours après avoir accepté l’invitation.
- Respecter la convention `nom-prenom-projet-angular` et ajouter l’enseignant comme collaborateur.
- Garder les sources Angular dans `frontend/` et l’API dans `backend/`.
- Ne jamais ajouter `.env`, `node_modules/`, `dist/`, les caches ou des mots de passe au dépôt.
- Travailler sur des branches courtes, par exemple `feature/swagger` ou `feature/docker-compose`, et utiliser des commits explicites.

## GitHub Projects et issues

Créer un projet nommé `Suivi du projet - Tournoi Plus`, avec les colonnes Backlog, À faire, En cours, En revue et Terminé. Ajouter des issues distinctes pour le cahier des charges, les maquettes, la conception, les fonctionnalités, les tests, le déploiement Docker, le rapport et la présentation. Assigner un responsable, une description et une échéance à chaque issue.

## Livrables à compléter

- Vérifier sur une machine Docker fonctionnelle que `docker compose up --build` démarre les trois services.
- Garder la capture Swagger à jour dans `docs/swagger-ui.png`.
- Rédiger le rapport final et l’exporter en PDF dans `rapport/`.
- Préparer les diapositives de soutenance dans `presentation/`.
- Faire une démonstration de l’inscription/connexion, du CRUD des tournois et équipes, et de Swagger UI.
