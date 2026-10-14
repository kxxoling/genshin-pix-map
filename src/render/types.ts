import type { Texture } from 'pixi.js'

// Tile coord (negative indices are legal: the origin sits at the map center)
export type TileCoord = { z: number; x: number; y: number }

// Geometry of a tile pyramid (pure data; the key to decoupling render from data)
export type TileGeom = {
  readonly id: string
  readonly tileSize: number
  readonly minZoom: number
  readonly maxZoom: number
  // Valid tile index range (inclusive) at a zoom level
  matrixRange(z: number): { minX: number; minY: number; maxX: number; maxY: number }
}

// Tile source: implement loadTexture to swap the whole data source
export type TileSource = TileGeom & {
  loadTexture(coord: TileCoord, signal: AbortSignal): Promise<Texture>
}

// Map marker (zoom-0 world px; converted per map source)
export type MapMarker = {
  readonly id: string
  readonly kind: number
  readonly x: number
  readonly y: number
}

export function tileKey(c: TileCoord): string {
  return `${c.z}/${c.x}/${c.y}`
}
