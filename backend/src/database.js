import pg from 'pg';

const { Pool } = pg;

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('organisateur', 'joueur', 'spectateur', 'arbitre')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 100)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS unique_team_name_per_tournament
    ON teams(tournament_id, LOWER(name));

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
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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

function createQueryInterface(query) {
  function prepare(sql) {
    const postgresSql = sql.replace(/\?/g, (_, offset) => {
      const previousPlaceholders = sql.slice(0, offset).match(/\?/g);
      return `$${(previousPlaceholders?.length ?? 0) + 1}`;
    });

    return {
      async get(...values) {
        const result = await query(postgresSql, values);
        return result.rows[0];
      },
      async all(...values) {
        const result = await query(postgresSql, values);
        return result.rows;
      },
      async run(...values) {
        const result = await query(postgresSql, values);
        return { changes: result.rowCount };
      },
    };
  }

  return { prepare };
}

export async function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL doit pointer vers une base PostgreSQL.');
  }

  const pool = new Pool({ connectionString });
  const db = createQueryInterface((sql, values) => pool.query(sql, values));
  db.transaction = async (callback) => {
    const client = await pool.connect();
    const transactionDb = createQueryInterface((sql, values) => client.query(sql, values));

    try {
      await client.query('BEGIN');
      const result = await callback(transactionDb);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  db.close = () => pool.end();

  await pool.query(schema);
  return db;
}
