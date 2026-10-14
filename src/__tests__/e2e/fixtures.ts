import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test as base, expect } from '@playwright/test'

// Shared E2E fixtures: import test/expect from here, never from @playwright/test directly
export const test = base.extend({})
export { expect }

// Perf sampling contract: perf.spec parks its promise on window.__perfDone
declare global {
  interface Window {
    __perfDone?: Promise<{ frames: number; ms: number }>
  }
}

// ---- Snapshot-derived expectations (auto-follow snapshot updates) ----

const SNAPSHOT_DIR = resolve(import.meta.dirname, '../../../public/map-data/data/teyvat')

type SnapshotLabel = { id: number; name: string; children?: SnapshotLabel[] }
type SnapshotPoint = { labelId: number; z?: number }

function loadSnapshot() {
  const labels = JSON.parse(
    readFileSync(resolve(SNAPSHOT_DIR, 'labels.json'), 'utf8'),
  ) as SnapshotLabel[]
  const points = JSON.parse(
    readFileSync(resolve(SNAPSHOT_DIR, 'points.json'), 'utf8'),
  ) as SnapshotPoint[]
  return { labels, points }
}

// Expected count for the default selection (all leaves of the first group)
export function expectedDefaultMarkerCount(): number {
  const { labels, points } = loadSnapshot()
  const first = labels.find((l) => (l.children ?? []).length > 0)
  const ids = new Set(first?.children?.map((c) => c.id) ?? [])
  // Mirror the app: filter out underground-floor points
  return points.filter((p) => ids.has(p.labelId) && !p.z).length
}

// Point count for a label name (leaf names are globally unique)
export function labelPointCount(labelName: string): number {
  const { labels, points } = loadSnapshot()
  for (const top of labels) {
    const leaf = (top.children ?? []).find((c) => c.name === labelName)
    if (leaf) {
      return points.filter((p) => p.labelId === leaf.id && !p.z).length
    }
  }
  return 0
}
