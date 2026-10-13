/** The CHANGELOG.md section of one version, used as the GitHub Release notes. */
export function releaseNotes(changelog: string, version: string): string {
  const lines = changelog.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`))
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}: close "[Não lançado]" as "## [${version}] — YYYY-MM-DD" first`)
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  const body = lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim()
  if (!body) throw new Error(`CHANGELOG.md section ${version} is empty`)
  return body
}
