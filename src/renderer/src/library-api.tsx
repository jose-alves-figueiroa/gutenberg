import { createContext, useContext, type ReactNode } from 'react'
import type { LibraryApi } from '@shared/library-api'

declare global {
  interface Window {
    gutenberg?: { version: string; library: LibraryApi }
  }
}

const LibraryApiContext = createContext<LibraryApi | null>(null)

/** Provides the library API; defaults to the preload bridge (`window.gutenberg.library`). */
export function LibraryApiProvider({ api, children }: { api?: LibraryApi; children: ReactNode }) {
  return <LibraryApiContext.Provider value={api ?? window.gutenberg?.library ?? null}>{children}</LibraryApiContext.Provider>
}

export function useLibraryApi(): LibraryApi {
  const api = useContext(LibraryApiContext)
  if (!api) throw new Error('LibraryApi not available (missing LibraryApiProvider or preload bridge)')
  return api
}
