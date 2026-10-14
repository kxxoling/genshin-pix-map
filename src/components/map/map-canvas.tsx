import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { MapRenderer, type MapStats } from '@/render/map-renderer'
import type { MarkerAtlas } from '@/render/marker-atlas'
import type { MapMarker, TileSource } from '@/render/types'

type MapCanvasProps = {
  source: TileSource
  markers?: MapMarker[]
  atlas?: MarkerAtlas
  checkedIds?: ReadonlySet<string>
  initialView?: { x: number; y: number; zoom: number }
  className?: string
  onStats?: (stats: MapStats) => void
  onMarkerTap?: (marker: MapMarker | undefined) => void
}

// Map canvas: React owns the container and lifecycle; the render core lives in MapRenderer.
// The canvas is created per renderer instance inside the effect and never reused.
export function MapCanvas({
  source,
  markers,
  atlas,
  checkedIds,
  initialView,
  className,
  onStats,
  onMarkerTap,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MapRenderer | null>(null)
  // Callbacks go through refs: registered once, they survive renderer rebuilds
  const onStatsRef = useRef(onStats)
  const onMarkerTapRef = useRef(onMarkerTap)

  useEffect(() => {
    onStatsRef.current = onStats
    onMarkerTapRef.current = onMarkerTap
  })

  // The atlas hot-swaps through a ref (like markers): as a lifecycle dep it would rebuild the renderer
  const atlasRef = useRef(atlas)

  // markers/checkedIds also go through refs so the create callback can re-apply
  // whatever arrived while the renderer was still initializing
  const markersRef = useRef<MapMarker[]>(markers ?? [])
  const checkedIdsRef = useRef(checkedIds)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.className = 'block h-full w-full touch-none select-none'
    container.appendChild(canvas)

    let disposed = false
    MapRenderer.create({ canvas, container, source, initialView })
      .then((renderer) => {
        // Destroy if unmounted while awaiting
        if (disposed) {
          renderer.destroy()
          return
        }
        rendererRef.current = renderer
        renderer.onStats((stats) => onStatsRef.current?.(stats))
        renderer.onMarkerTap((marker) => onMarkerTapRef.current?.(marker))
        renderer.setMarkers(markersRef.current)
        if (atlasRef.current) {
          renderer.setMarkerAtlas(atlasRef.current)
        }
        if (checkedIdsRef.current) {
          renderer.setCheckedIds(checkedIdsRef.current)
        }
      })
      .catch((error: unknown) => {
        canvas.remove()
        console.error('[MapCanvas] renderer init failed:', error)
      })

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        rendererRef.current?.resize(rect.width, rect.height)
      }
    })
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      rendererRef.current?.destroy()
      rendererRef.current = null
      canvas.remove()
    }
  }, [source, initialView])

  // markers changes sync data only; the renderer is never rebuilt
  useEffect(() => {
    markersRef.current = markers ?? []
    rendererRef.current?.setMarkers(markersRef.current)
  }, [markers])

  // Atlas changes hot-swap (layer add/remove changes the icon set)
  useEffect(() => {
    atlasRef.current = atlas
    if (atlas) {
      rendererRef.current?.setMarkerAtlas(atlas)
    }
  }, [atlas])

  // Checked-set changes -> collected markers translucent
  useEffect(() => {
    checkedIdsRef.current = checkedIds
    if (checkedIds) {
      rendererRef.current?.setCheckedIds(checkedIds)
    }
  }, [checkedIds])

  return <div ref={containerRef} className={cn('relative h-full w-full', className)} />
}
