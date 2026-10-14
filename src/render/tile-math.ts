import type { TileCoord, TileGeom } from './types'

// Camera snapshot (centerX/centerY in zoom-0 world px)
export type CameraSnapshot = { centerX: number; centerY: number; zoom: number }
export type ViewportSize = { width: number; height: number }
export type WorldRect = { left: number; top: number; right: number; bottom: number }

// Zoom level -> world scale (each +1 doubles pixel density)
export function scaleOf(zoom: number): number {
  return 2 ** zoom
}

export function clampZoom(geom: TileGeom, zoom: number): number {
  return Math.min(geom.maxZoom, Math.max(geom.minZoom, zoom))
}

// Active integer tile zoom (rounded to avoid flip-flopping near .5)
export function activeTileZoom(geom: TileGeom, zoom: number): number {
  return Math.round(clampZoom(geom, zoom))
}

// Edge length of a tile in zoom-0 world units
export function tileWorldSize(geom: TileGeom, z: number): number {
  return geom.tileSize / 2 ** z
}

export function screenToWorld(
  camera: CameraSnapshot,
  viewport: ViewportSize,
  sx: number,
  sy: number,
) {
  const scale = scaleOf(camera.zoom)
  return {
    x: camera.centerX + (sx - viewport.width / 2) / scale,
    y: camera.centerY + (sy - viewport.height / 2) / scale,
  }
}

export function worldToScreen(
  camera: CameraSnapshot,
  viewport: ViewportSize,
  wx: number,
  wy: number,
) {
  const scale = scaleOf(camera.zoom)
  return {
    x: (wx - camera.centerX) * scale + viewport.width / 2,
    y: (wy - camera.centerY) * scale + viewport.height / 2,
  }
}

// World rect (zoom-0 units) covered by the viewport at a tile zoom
export function visibleWorldRect(camera: CameraSnapshot, viewport: ViewportSize): WorldRect {
  const halfW = viewport.width / 2 / scaleOf(camera.zoom)
  const halfH = viewport.height / 2 / scaleOf(camera.zoom)
  return {
    left: camera.centerX - halfW,
    top: camera.centerY - halfH,
    right: camera.centerX + halfW,
    bottom: camera.centerY + halfH,
  }
}

// Tiles needed for the viewport, sorted nearest-to-center first (load priority)
export function visibleTiles(
  camera: CameraSnapshot,
  viewport: ViewportSize,
  geom: TileGeom,
  z: number,
): TileCoord[] {
  const rect = visibleWorldRect(camera, viewport)
  const tw = tileWorldSize(geom, z)
  if (tw <= 0) return []

  const range = geom.matrixRange(z)
  const x0 = Math.max(range.minX, Math.floor(rect.left / tw))
  const x1 = Math.min(range.maxX, Math.floor(rect.right / tw))
  const y0 = Math.max(range.minY, Math.floor(rect.top / tw))
  const y1 = Math.min(range.maxY, Math.floor(rect.bottom / tw))
  if (x1 < x0 || y1 < y0) return []

  const centerX = (rect.left + rect.right) / 2 / tw
  const centerY = (rect.top + rect.bottom) / 2 / tw

  const tiles: TileCoord[] = []
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      tiles.push({ z, x, y })
    }
  }
  tiles.sort((a, b) => {
    const da = (a.x - centerX) ** 2 + (a.y - centerY) ** 2
    const db = (b.x - centerX) ** 2 + (b.y - centerY) ** 2
    return da - db
  })
  return tiles
}
