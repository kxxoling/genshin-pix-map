// Pure logic of the official tile pyramid (no pixi; unit-testable).
// Tile URL: {mapId}/{mapVersion}/{x}_{y}_{N|P|z|}.webp, N = negative zoom, P = non-negative.
// Coords: pixel = (x_pos + origin[0], y_pos + origin[1]); tile index = floor(pixel * 2^z / 256)

export type OfficialMeta = {
  mapId: number
  mapVersion: string
  /** Game version (e.g. "5.5.0") from the HoYoPlay launcher API; absent when the probe failed */
  gameVersion?: string
  origin: [number, number]
  totalSize: [number, number]
  minZoom: number
  maxZoom: number
  tileUrlTemplate: string
}

// zoom -> URL suffix: -3->N3, -1->N1, 0->P0
export function zoomSuffix(z: number): string {
  return `${z < 0 ? 'N' : 'P'}${Math.abs(z)}`
}

export function officialTileUrl(meta: OfficialMeta, x: number, y: number, z: number): string {
  return meta.tileUrlTemplate
    .replace(/\{mapId\}/g, String(meta.mapId))
    .replace(/\{mapVersion\}/g, meta.mapVersion)
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y))
    .replace(/\{suffix\}/g, zoomSuffix(z))
}

// Game coords -> full-res canvas pixels (zoom-0 world coords)
export function gameToPixel(meta: OfficialMeta, x: number, y: number): { x: number; y: number } {
  return { x: x + meta.origin[0], y: y + meta.origin[1] }
}

// Grid size (cols/rows) at a zoom; each level down halves the canvas
export function tileGridSize(meta: OfficialMeta, z: number): { cols: number; rows: number } {
  // Each level down halves the canvas: grid = totalSize * 2^z / 256
  const scale = 2 ** z
  return {
    cols: Math.floor((meta.totalSize[0] * scale) / 256),
    rows: Math.floor((meta.totalSize[1] * scale) / 256),
  }
}
