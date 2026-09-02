import initSqlJs, { type Database } from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "branchout.db");

let db: Database;

export async function initializeDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      tech_stack TEXT,
      shared_conventions TEXT,
      github_repo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS teammates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      github_username TEXT NOT NULL,
      task_description TEXT,
      owned_paths TEXT,
      branch_name TEXT,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'done')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS commit_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teammate_id INTEGER NOT NULL,
      commit_count INTEGER NOT NULL DEFAULT 0,
      last_commit_at TEXT,
      pr_status TEXT,
      pr_url TEXT,
      snapshot_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (teammate_id) REFERENCES teammates(id) ON DELETE CASCADE
    );
  `);

  // Persist to disk
  saveDatabase();

  console.log("Database initialized at", DB_PATH);
  return db;
}

export function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export function getDb(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return db;
}

export default { initializeDatabase, saveDatabase, getDb };
