import { useQuery } from '@tanstack/react-query'
import type { OfficialMeta } from '@/render/official-tiles'

// Data snapshot submodule (public/map-data, frozen per release; upgrading = bump the pointer).
// Relative (no leading slash) so it resolves against the document base — required for
// subpath hosting such as GitHub Pages project sites; safe here since the app is a
// single page with no client-side navigation.
const BASE = 'map-data/data/teyvat'

export type OfficialLabel = {
  id: number
  name: string
  icon: string
  children?: OfficialLabel[]
}

export type OfficialPoint = {
  id: number
  labelId: number
  x: number
  y: number
  z?: number
}

// Resolve snapshot-relative asset paths (icons/..., tiles/...) against BASE
export function resolveSnapshotPath(path: string): string {
  if (path.startsWith('icons/') || path.startsWith('tiles/')) {
    return `${BASE}/${path}`
  }
  return path
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`snapshot ${path} failed to load: HTTP ${res.status}`)
  return (await res.json()) as T
}

// Snapshots ship with the code and never change -> Infinity staleTime
export function useOfficialMeta() {
  return useQuery({
    queryKey: ['official', 'meta'],
    queryFn: () => fetchJson<OfficialMeta>('meta.json'),
    staleTime: Infinity,
  })
}

export function useOfficialLabels() {
  return useQuery({
    queryKey: ['official', 'labels'],
    queryFn: () => fetchJson<OfficialLabel[]>('labels.json'),
    staleTime: Infinity,
  })
}

export function useOfficialPoints() {
  return useQuery({
    queryKey: ['official', 'points'],
    queryFn: () => fetchJson<OfficialPoint[]>('points.json'),
    staleTime: Infinity,
  })
}
