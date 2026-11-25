# Frontend Angular

L’application Angular se trouve dans ce dossier.

## Développement local

```powershell
npm ci
npm start
```

Le serveur Angular écoute sur `http://localhost:4200` et proxyfie les requêtes `/api` vers l’API locale sur le port 3000.

## Docker

Le `Dockerfile` construit Angular avec Node.js, puis sert les fichiers compilés avec Nginx. La configuration Nginx transmet `/api` et `/swagger` au service backend défini dans le `docker-compose.yml` racine.
