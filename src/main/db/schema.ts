/**
 * App database schema (docs/DATA.md → "Schema SQLite do app"). Migrations are applied in order
 * and tracked with `PRAGMA user_version`, so an existing operator database can be upgraded.
 */

/** The subset of node:sqlite / better-sqlite3 the app needs, so either driver works. */
export interface SqlDatabase {
  exec(sql: string): void
  prepare(sql: string): {
    run(...params: (string | number | null)[]): unknown
    get(...params: (string | number | null)[]): unknown
    all(...params: (string | number | null)[]): unknown[]
  }
}

export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE bible_versions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    copyright TEXT NOT NULL,
    source TEXT NOT NULL
  );
  CREATE TABLE bible_verses (
    version TEXT NOT NULL REFERENCES bible_versions(code),
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (version, book, chapter, verse)
  ) WITHOUT ROWID;

  CREATE TABLE songbooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_title TEXT NOT NULL,
    prefix TEXT NOT NULL,
    item_label TEXT NOT NULL,
    source TEXT NOT NULL
  );
  CREATE TABLE songs (
    id TEXT PRIMARY KEY,
    songbook_id TEXT NOT NULL REFERENCES songbooks(id),
    number TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    versification TEXT NOT NULL,
    author TEXT NOT NULL,
    artist TEXT NOT NULL,
    copyright TEXT NOT NULL,
    lyrics TEXT NOT NULL,
    source TEXT NOT NULL,
    UNIQUE (songbook_id, number, version, title)
  );

  CREATE TABLE confessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_title TEXT NOT NULL,
    prefix TEXT NOT NULL,
    source TEXT NOT NULL
  );
  CREATE TABLE confession_sections (
    confession_id TEXT NOT NULL REFERENCES confessions(id),
    position INTEGER NOT NULL,
    chapter TEXT NOT NULL,
    chapter_title TEXT NOT NULL,
    section TEXT NOT NULL,
    section_title TEXT NOT NULL,
    text TEXT NOT NULL,
    refs TEXT NOT NULL,
    PRIMARY KEY (confession_id, position),
    UNIQUE (confession_id, chapter, section)
  );

  CREATE TABLE catechisms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_title TEXT NOT NULL,
    prefix TEXT NOT NULL,
    source TEXT NOT NULL
  );
  CREATE TABLE catechism_questions (
    catechism_id TEXT NOT NULL REFERENCES catechisms(id),
    number INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    refs TEXT NOT NULL,
    PRIMARY KEY (catechism_id, number)
  );

  CREATE TABLE creeds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL
  );

  CREATE TABLE services (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE liturgy_items (
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    moment TEXT NOT NULL,
    collection TEXT NOT NULL,
    item_ref TEXT NOT NULL,
    PRIMARY KEY (service_id, position)
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 2: sections and questions changed by the operator survive content updates (E8).
  `
  ALTER TABLE confession_sections ADD COLUMN edited INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE catechism_questions ADD COLUMN edited INTEGER NOT NULL DEFAULT 0;
  `
]

/** Applies pending migrations; returns the resulting schema version. */
export function migrate(db: SqlDatabase): number {
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  return MIGRATIONS.length
}
