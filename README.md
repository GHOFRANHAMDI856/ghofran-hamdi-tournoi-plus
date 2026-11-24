# Tournoi Plus

Application web de gestion sportive développée avec Angular. Elle permet de créer des tournois, gérer les équipes et les matchs, attribuer des points aux joueurs, suivre les compétitions et proposer une interface adaptée à chaque rôle utilisateur.

## Fonctionnalités

### Compte utilisateur

- Inscription avec nom, adresse e-mail, mot de passe et rôle.
- Connexion et déconnexion.
- Quatre rôles disponibles : organisateur, joueur, arbitre et spectateur.
- Protection de la route `/gestion` pour les utilisateurs non connectés.

### Espace organisateur

- Création, modification et suppression de tournois.
- Configuration du sport, des dates, du lieu, des règles, du format, du statut et du nombre d'équipes.
- Création et gestion des équipes.
- Gestion des demandes d'inscription des joueurs.
- Création, modification et suppression des matchs.
- Affectation d'un arbitre à un match.
- Tableau de bord avec statistiques sur les tournois, les équipes, les matchs et les inscriptions.
- Saisie des scores et des points des joueurs.

Formats de tournoi pris en charge :

- Élimination directe
- Championnat
- Phase de groupes

Sports proposés :

- Basketball
- Football
- Volleyball
- Handball

### Espace joueur

- Consultation des équipes disponibles.
- Envoi de demandes d'inscription.
- Suivi du statut des demandes : en attente, approuvée ou refusée.
- Consultation des équipes rejointes.
- Consultation des matchs associés.
- Suivi des points personnels.

### Espace arbitre

- Consultation des matchs qui lui sont affectés.
- Affichage du calendrier, des équipes, du lieu et du statut des rencontres.
- Consultation des scores enregistrés.

### Espace spectateur

- Recherche et filtrage des tournois.
- Filtres par catégorie, ville et date.
- Suivi ou arrêt du suivi d'un tournoi.
- Consultation des tournois suivis et des matchs en direct.

## Architecture

```text
frontend/
  angular.json
  package.json
  src/
    app/
      app/
        auth.guard.ts
        pages/
          auth/
          dashboard/
            spaces/
        services/
          auth.ts
          tournament.ts
    main.ts
    styles.css
  public/
backend/
  src/
    app.js
    database.js
    routes/
  test/
```

Composants principaux :

- `Auth` : connexion et inscription.
- `Dashboard` : navigation selon le rôle connecté.
- `OrganizerSpace` : gestion des tournois et des compétitions.
- `PlayerSpace` : inscriptions aux équipes et suivi des matchs.
- `RefereeSpace` : consultation des rencontres affectées.
- `SpectatorSpace` : découverte et suivi des tournois.
- `Auth` service : gestion des comptes et de la session.
- `TournamentService` : gestion des tournois, équipes, demandes, matchs, scores, points et suivis.

## Stockage des données

L’application Angular conserve encore ses données dans le navigateur avec `localStorage`. Le backend ajouté est une API autonome qui persiste ses propres données dans SQLite ; il n’est pas encore connecté aux services Angular.

| Clé | Contenu |
| --- | --- |
| `gestion-tournoi-users` | Comptes enregistrés |
| `gestion-tournoi-session` | Session utilisateur active |
| `gestion-tournoi-tournaments` | Tournois |
| `gestion-tournoi-competition` | Équipes, demandes, matchs, scores, points et suivis |

Les données `localStorage` ne sont pas synchronisées avec l’API ni entre plusieurs appareils. Les données créées via l’API sont stockées dans `backend/data/tournoi-plus.sqlite`.

## Technologies utilisées

- Angular 21
- TypeScript 5.9
- Angular Reactive Forms
- Angular Router
- RxJS
- Angular Signals
- Vitest
- jsdom
- CSS
- Node.js, Express et SQLite (API)
- bcryptjs et JWT (authentification de l’API)

## Compétences mises en œuvre

- Création d'une application Angular avec composants autonomes.
- Structuration d'une application par fonctionnalités et services.
- Mise en place d'un guard d'authentification.
- Gestion des formulaires réactifs et de leurs validations.
- Gestion des rôles et affichage dynamique des espaces.
- Modélisation de données pour les tournois, équipes, matchs et utilisateurs.
- Gestion d'état locale avec Angular Signals.
- Persistance des données dans `localStorage`.
- Détection des changements entre onglets via les événements de stockage.
- Tests unitaires des services, composants et espaces utilisateur.
- Construction d'une interface responsive avec plusieurs thèmes visuels.

## Utilisation des compétences Copilot

Pour ce README et les développements associés, aucune compétence spécialisée externe n'a été chargée. Le travail a été réalisé directement avec les outils du projet, l'analyse des composants Angular, des services, des routes, des tests et de la configuration `package.json`.

Les outils et notions utilisés sont principalement :

- Angular CLI
- TypeScript
- Reactive Forms
- Angular Router
- Angular Signals
- Tests Vitest
- Analyse et rédaction technique

## Prérequis

- Node.js 20 ou plus récent
- npm
- Angular CLI

## Installation

```powershell
Set-Location gestion-tournoi
npm run install:all
```

## Démarrage

Depuis la racine du projet, démarrer le frontend et le backend ensemble :

```powershell
npm run start:all
```

Puis ouvrir `http://localhost:4200/`.

La route principale de connexion est `/login`. Après authentification, l'application redirige vers `/gestion`.

Les applications peuvent aussi être démarrées séparément :

```powershell
npm run start:frontend
```

Dans un second terminal :

```powershell
npm run start:backend
```

## Backend API

L’API REST est indépendante du frontend pour le moment. Elle fournit l’authentification, les rôles, la gestion des tournois, des équipes, des demandes d’inscription, des matchs, des scores, des points et des suivis de tournois.

### Installation et démarrage

Dans un second terminal :

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
```

Modifier `JWT_SECRET` dans `.env` avec une valeur aléatoire d’au moins 32 caractères, puis lancer :

```powershell
npm start
```

L’API écoute par défaut sur `http://localhost:3000`. `DATABASE_PATH`, `PORT`, `JWT_EXPIRES_IN` et `CORS_ORIGIN` sont configurables dans `backend/.env`. Le fichier SQLite est créé automatiquement. Pour exécuter les tests backend : `npm test` depuis le dossier `backend`.

### Endpoints principaux

| Méthode | Endpoint | Accès |
| --- | --- | --- |
| `POST` | `/api/auth/register`, `/api/auth/login` | Public, limité en fréquence |
| `GET` | `/api/auth/me`, `/api/auth/referees` | Connecté / organisateur |
| `GET`, `POST` | `/api/tournaments` | Public / organisateur |
| `GET` | `/api/tournaments/mine` | Organisateur |
| `PUT`, `DELETE` | `/api/tournaments/:id` | Propriétaire organisateur |
| `GET`, `POST` | `/api/tournaments/:id/teams` | Propriétaire organisateur |
| `GET`, `POST` | `/api/teams/directory`, `/api/teams/:id/join-requests` | Joueur |
| `GET`, `PATCH` | `/api/tournaments/:id/join-requests`, `/api/join-requests/:id` | Organisateur |
| `GET`, `POST` | `/api/tournaments/:id/matches` | Organisateur |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/matches/:id` et sous-routes | Selon rôle |
| `GET`, `PUT` | `/api/follows`, `/api/tournaments/:id/follow` | Spectateur |

Les routes protégées utilisent `Authorization: Bearer <token>`. Les mots de passe sont hachés avec bcrypt ; les jetons JWT expirent après un jour par défaut. La politique CORS autorise `http://localhost:4200` par défaut.

## Construction

```powershell
Set-Location frontend
npm run build
```

Les fichiers de production sont générés dans `frontend/dist/`.

## Tests

```powershell
Set-Location frontend
npm test
```

Les tests unitaires disponibles couvrent notamment :

- Application principale
- Authentification
- Guard de connexion
- Tableau de bord
- Service des tournois
- Espace organisateur
- Espace arbitre
- Espace spectateur

## Routes

| Route | Composant | Accès |
| --- | --- | --- |
| `/` | Redirection vers `/login` | Public |
| `/login` | Authentification | Public |
| `/gestion` | Tableau de bord selon le rôle | Utilisateur connecté |
| Toute autre route | Redirection vers `/login` | Public |

## Améliorations possibles

- Connecter les services Angular à l’API backend.
- Ajouter les notifications et mises à jour en temps réel.
- Mettre en place des rôles administratifs plus fins.
- Ajouter un tableau de classement automatique.
- Exporter les résultats et calendriers.
- Déployer l'application sur une plateforme d'hébergement.
