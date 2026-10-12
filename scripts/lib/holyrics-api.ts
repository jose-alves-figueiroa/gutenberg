/**
 * Minimal client for the Holyrics local API (github.com/holyrics/API-Server): POST
 * `http://<ip>:<port>/api/<Action>?token=<token>` with a JSON body; responses are
 * `{ status: 'ok', data }` or `{ status: 'error', error }`. The token is created in Holyrics →
 * API Server, with permission for `GetSongs` and `GetLyrics`.
 */

/** The subset of the `Lyrics` model we read (v2.21+ for `slides`). */
export interface HolyricsLyrics {
  id: string
  title: string
  artist?: string
  author?: string
  note?: string
  copyright?: string
  archived?: boolean
  slides?: { text: string; slide_description?: string }[]
  /** 1-based slide indexes, comma separated (`1,2,3,2,2` repeats the chorus). */
  order?: string
}

export interface HolyricsDump {
  format: 1
  dumpedAt: string
  source: string
  songs: HolyricsLyrics[]
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

export function holyricsClient(baseUrl: string, token: string, fetchImpl: Fetch = fetch) {
  const root = baseUrl.replace(/\/+$/, '')
  return async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
    const res = await fetchImpl(`${root}/api/${action}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`Holyrics ${action}: HTTP ${res.status}`)
    const json = (await res.json()) as { status?: string; data?: T; error?: unknown }
    if (json.status !== 'ok') throw new Error(`Holyrics ${action}: ${JSON.stringify(json.error ?? json)}`)
    return json.data as T
  }
}

/** Lists every song (GetSongs), then fetches each one with its slides (GetLyrics). */
export async function dumpSongs(
  call: ReturnType<typeof holyricsClient>,
  onProgress: (done: number, total: number) => void = () => {}
): Promise<HolyricsLyrics[]> {
  const list = await call<HolyricsLyrics[]>('GetSongs', { fields: 'id,title,archived' })
  const songs: HolyricsLyrics[] = []
  for (const [i, item] of list.entries()) {
    const song = await call<HolyricsLyrics | null>('GetLyrics', { id: item.id })
    if (!song) throw new Error(`Holyrics GetLyrics: song ${item.id} ("${item.title}") not found`)
    songs.push(song)
    onProgress(i + 1, list.length)
  }
  return songs
}
