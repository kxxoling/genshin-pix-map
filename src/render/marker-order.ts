import type { MapMarker } from './types'

// Deterministic marker ordering: stacking order for overlaps (later in the array = drawn on top)
// Rule: kind (icon/layer order) first, then id — fully independent of viewport and pan direction
// Never use spatial-hash iteration order (viewport-dependent: stacking flips and flickers while panning)
export function compareMarkers(a: MapMarker, b: MapMarker): number {
  if (a.kind !== b.kind) {
    return a.kind - b.kind
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
