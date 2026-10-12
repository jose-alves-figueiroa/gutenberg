/**
 * Opens the operator's database. On first run it is copied from the database shipped with the
 * app (built by `npm run data:build`), so library edits live in the user's copy and survive
 * updates of the app. Pending migrations are applied on every open.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrate } from './schema'

export interface OpenOptions {
  /** The operator's database (e.g. `<userData>/gutenberg.sqlite`). */
  file: string
  /** Database shipped with the app, copied on first run. */
  seed: string
}

export function openAppDatabase({ file, seed }: OpenOptions): DatabaseSync {
  if (!existsSync(file)) {
    if (!existsSync(seed)) throw new Error(`library database not found: ${seed} (run \`npm run data:build\`)`)
    mkdirSync(dirname(file), { recursive: true })
    copyFileSync(seed, file)
  }
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}
