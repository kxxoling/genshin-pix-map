import { useCallback, useEffect, useMemo } from 'react'
import { isDefaultSelectionNeeded, LayerPanel } from '@/components/map/layer-panel'
import { MapCanvas } from '@/components/map/map-canvas'
import { MapHud } from '@/components/map/map-hud'
import { useOfficialCatalog, useSelectedMarkers } from '@/data/map-data'
import type { MapStats } from '@/render/map-renderer'
import { gameToPixel } from '@/render/official-tiles'
import type { MapMarker } from '@/render/types'
import { useMapUiStore } from '@/state/map-store'

export function App() {
  return <RealMapScene />
}

function RealMapScene() {
  const { data: catalog, isPending, error } = useOfficialCatalog()
  const selectedItemIds = useMapUiStore((s) => s.selectedItemIds)
  const checkedMarkerIds = useMapUiStore((s) => s.checkedMarkerIds)
  const setStats = useMapUiStore((s) => s.setStats)
  const setSelectedMarker = useMapUiStore((s) => s.setSelectedMarker)
  const setItemSelection = useMapUiStore((s) => s.setItemSelection)
  const toggleMarkerCheck = useMapUiStore((s) => s.toggleMarkerCheck)

  const { markers, atlas } = useSelectedMarkers(catalog, selectedItemIds)

  // Default-select the first group (waypoints) when nothing is persisted
  useEffect(() => {
    if (catalog && isDefaultSelectionNeeded(selectedItemIds)) {
      const first = catalog.groups[0]
      if (first && first.items.length > 0) {
        setItemSelection(first.items.map((i) => i.id))
      }
    }
  }, [catalog, selectedItemIds, setItemSelection])

  const checkedIds = useMemo(() => new Set(Object.keys(checkedMarkerIds)), [checkedMarkerIds])
  // Initial view near the game-coord origin (Mondstadt/Liyue border), mid zoom
  const initialView = useMemo(
    () => (catalog ? { ...gameToPixel(catalog.meta, 0, 0), zoom: -2 } : undefined),
    [catalog],
  )

  const handleStats = useCallback((stats: MapStats) => setStats(stats), [setStats])
  // Tap marker = toggle collected (persisted) + show selection in the HUD
  const handleMarkerTap = useCallback(
    (marker: MapMarker | undefined) => {
      setSelectedMarker(marker?.id ?? null)
      if (marker) {
        toggleMarkerCheck(marker.id)
      }
    },
    [setSelectedMarker, toggleMarkerCheck],
  )

  if (isPending) {
    return <StatusOverlay text="Loading map data…" />
  }
  if (error || !catalog) {
    return (
      <StatusOverlay
        text={`Failed to load map data: ${error instanceof Error ? error.message : String(error)}`}
        retry
      />
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#10141f]">
      <MapCanvas
        source={catalog.source}
        markers={markers}
        atlas={atlas}
        checkedIds={checkedIds}
        initialView={initialView}
        onStats={handleStats}
        onMarkerTap={handleMarkerTap}
      />
      <LayerPanel catalog={catalog} />
      {/* The debug HUD is dev-only */}
      {import.meta.env.DEV ? <MapHud /> : null}
    </div>
  )
}

function StatusOverlay({ text, retry }: { text: string; retry?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#10141f] text-neutral-200">
      <p className="text-sm">{text}</p>
      {retry ? (
        <button
          type="button"
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm text-white hover:bg-sky-500"
          onClick={() => globalThis.location.reload()}
        >
          Retry
        </button>
      ) : (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-sky-400" />
      )}
    </div>
  )
}
