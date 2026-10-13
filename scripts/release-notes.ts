/** Prints the release notes of the package version (from CHANGELOG.md). Usage: tsx scripts/release-notes.ts */
import { readFileSync } from 'node:fs'
import { releaseNotes } from './lib/release-notes'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
process.stdout.write(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version) + '\n')
