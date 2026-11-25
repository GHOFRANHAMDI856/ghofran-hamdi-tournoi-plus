# Développement et déploiement

## Lancement de l’application complète

1. Installer et démarrer Docker Desktop.
2. À la racine du dépôt, copier `.env.example` vers `.env`.
3. Remplacer le mot de passe PostgreSQL et définir un secret JWT aléatoire d’au moins 32 caractères. Ne jamais committer `.env`.
4. Lancer :

   ```powershell
   docker compose up --build
   ```

Les adresses locales sont `http://localhost:4200` pour Angular, `http://localhost:3000/swagger/` pour Swagger UI et `http://localhost:3000/api/health` pour l’état de l’API.

## Développement hors conteneurs

La base PostgreSQL peut rester dans Docker. Copiez `.env.example` vers `.env` et `backend/.env.example` vers `backend/.env`; utilisez les mêmes identifiants PostgreSQL dans les deux fichiers. Le fichier backend utilise `localhost` comme hôte, tandis que Compose utilise le nom de service `db`.

Dans trois terminaux, depuis la racine :

```powershell
docker compose up -d db
```

```powershell
Set-Location backend
npm ci
npm start
```

```powershell
Set-Location frontend
npm ci
npm start
```

Le proxy Angular de développement transmet `/api` à `http://localhost:3000`.

## Tests

```powershell
Set-Location frontend
npm test -- --watch=false
```

Les tests backend requièrent PostgreSQL :

```powershell
docker compose up -d db
Set-Location backend
npm ci
npm test
```

## Dépannage Docker Desktop sous Windows

Si Docker indique que son moteur ne démarre pas, vérifier dans Windows et le BIOS/UEFI que la virtualisation matérielle est activée et que la fonctionnalité Windows **Virtual Machine Platform** est installée. Pour préparer WSL 2, PowerShell en administrateur peut exécuter :

```powershell
wsl --install --no-distribution
```

Redémarrer Windows, ouvrir Docker Desktop et attendre que son moteur soit prêt avant de lancer Compose. L’extension VS Code **Container Tools** de Microsoft est facultative; elle ne remplace ni Docker Desktop ni son moteur.
