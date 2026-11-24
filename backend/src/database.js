import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('organisateur', 'joueur', 'spectateur', 'arbitre')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sport TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rules TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL CHECK (format IN ('elimination', 'league', 'groups')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'in_progress', 'completed')),
    max_teams INTEGER NOT NULL CHECK (max_teams BETWEEN 2 AND 100)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    owner_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 100),
    UNIQUE (tournament_id, name)
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    PRIMARY KEY (team_id, player_email)
  );

  CREATE TABLE IF NOT EXISTS join_requests (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_pending_join_request
    ON join_requests(team_id, player_email) WHERE status = 'pending';

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    owner_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    referee_email TEXT REFERENCES users(email) ON DELETE SET NULL,
    home_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    location TEXT NOT NULL,
    home_score INTEGER CHECK (home_score IS NULL OR home_score >= 0),
    away_score INTEGER CHECK (away_score IS NULL OR away_score >= 0),
    CHECK (home_team_id <> away_team_id)
  );

  CREATE TABLE IF NOT EXISTS player_points (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points >= 0),
    PRIMARY KEY (match_id, player_email)
  );

  CREATE TABLE IF NOT EXISTS followed_tournaments (
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_email, tournament_id)
  );
`;

export function createDatabase(databasePath = process.env.DATABASE_PATH ?? './data/tournoi-plus.sqlite') {
  const resolvedPath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}
