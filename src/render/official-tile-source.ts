import { Texture } from 'pixi.js'
import { resolveSnapshotPath } from '@/data/official-data'
import { type OfficialMeta, officialTileUrl, tileGridSize } from './official-tiles'
import type { TileCoord, TileSource } from './types'

// Official tile source: standard 256px pyramid (act-webstatic CDN)
// Missing/ocean tiles 404 into transparent placeholders; see official-tiles.ts header for coordinates
export function createOfficialTileSource(meta: OfficialMeta): TileSource {
  return {
    id: `official-${meta.mapVersion}`,
    tileSize: 256,
    minZoom: meta.minZoom,
    maxZoom: meta.maxZoom,
    matrixRange(z: number) {
      const { cols, rows } = tileGridSize(meta, z)
      return { minX: 0, minY: 0, maxX: cols - 1, maxY: rows - 1 }
    },
    async loadTexture(coord: TileCoord, signal: AbortSignal): Promise<Texture> {
      // meta.tileUrlTemplate is snapshot-relative (tiles/...) and needs the mount prefix;
      // absolute/CDN templates from older snapshots pass through resolveSnapshotPath unchanged
      const res = await fetch(
        resolveSnapshotPath(officialTileUrl(meta, coord.x, coord.y, coord.z)),
        { signal },
      )
      if (res.status === 404) {
        return createTransparentTexture()
      }
      if (!res.ok) {
        throw new Error(`tile ${coord.z}/${coord.x}/${coord.y} HTTP ${res.status}`)
      }
      const bitmap = await createImageBitmap(await res.blob())
      if (signal.aborted) {
        bitmap.close()
        throw new DOMException('aborted', 'AbortError')
      }
      // skipCache = true keeps tile textures out of the global pixi Cache
      return Texture.from(bitmap, true)
    },
  }
}

// Created per call (never shared: LRU eviction destroys it)
function createTransparentTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return Texture.from(canvas, true)
}
