import 'dotenv/config';
import { createApp } from './app.js';
import { createDatabase } from './database.js';

const db = createDatabase();
const app = createApp({ db });
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT doit être un port TCP valide.');
}

const server = app.listen(port, () => {
  console.log(`Tournoi Plus API disponible sur http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
