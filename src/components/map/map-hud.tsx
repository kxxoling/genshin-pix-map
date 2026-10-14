import { useMapUiStore } from '@/state/map-store'

// Debug HUD (top-right): zoom / backend / tile & marker counts / frame time
export function MapHud() {
  const stats = useMapUiStore((s) => s.stats)
  const selectedMarkerId = useMapUiStore((s) => s.selectedMarkerId)

  if (!stats) return null
  return (
    <div className="pointer-events-none absolute top-3 right-3 space-y-0.5 rounded-md bg-black/50 px-3 py-2 text-right font-mono text-xs leading-relaxed text-neutral-100 backdrop-blur-sm">
      <div>
        zoom {stats.zoom.toFixed(2)} · {stats.renderer}
      </div>
      <div>
        tiles {stats.visibleTiles} shown / {stats.loadedTiles} cached / {stats.pendingTiles} pending
      </div>
      <div>
        markers {stats.visibleMarkers} / {stats.totalMarkers} · render {stats.renderMs.toFixed(1)}ms
      </div>
      {selectedMarkerId ? <div className="text-amber-300">selected {selectedMarkerId}</div> : null}
    </div>
  )
}
