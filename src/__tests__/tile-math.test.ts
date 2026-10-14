import {
  activeTileZoom,
  clampZoom,
  screenToWorld,
  tileWorldSize,
  visibleTiles,
  worldToScreen,
} from '@/render/tile-math'
import type { TileGeom } from '@/render/types'

// Test geometry: 4x4 base, maxZoom 3
const geom: TileGeom = {
  id: 'test',
  tileSize: 256,
  minZoom: 0,
  maxZoom: 3,
  matrixRange(z) {
    const n = 4 * 2 ** z
    return { minX: 0, minY: 0, maxX: n - 1, maxY: n - 1 }
  },
}

describe('tile-math', () => {
  test('tileWorldSize halves per zoom level', () => {
    expect(tileWorldSize(geom, 0)).toBe(256)
    expect(tileWorldSize(geom, 2)).toBe(64)
  })

  test('clampZoom and activeTileZoom rounding/clamping', () => {
    expect(clampZoom(geom, -3)).toBe(0)
    expect(clampZoom(geom, 9)).toBe(3)
    expect(activeTileZoom(geom, 0.4)).toBe(0)
    expect(activeTileZoom(geom, 0.6)).toBe(1)
    expect(activeTileZoom(geom, 5)).toBe(3)
  })

  test('screenToWorld/worldToScreen round-trip; viewport center equals camera center', () => {
    const camera = { centerX: 512, centerY: 512, zoom: 2 }
    const viewport = { width: 800, height: 600 }

    expect(screenToWorld(camera, viewport, 400, 300)).toEqual({ x: 512, y: 512 })
    expect(worldToScreen(camera, viewport, 512, 512)).toEqual({ x: 400, y: 300 })

    const world = screenToWorld(camera, viewport, 500, 350)
    expect(worldToScreen(camera, viewport, world.x, world.y)).toEqual({ x: 500, y: 350 })
  })

  test('visibleTiles is center-first and clamped to bounds', () => {
    const camera = { centerX: 512, centerY: 512, zoom: 0 }
    const viewport = { width: 800, height: 600 }
    const tiles = visibleTiles(camera, viewport, geom, 0)

    expect(tiles.length).toBeGreaterThan(0)
    // Viewport center (512, 512) / 256 -> the first tile must be the center tile
    expect(tiles[0]).toEqual({ z: 0, x: 2, y: 2 })
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x).toBeLessThanOrEqual(3)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeLessThanOrEqual(3)
    }
  })

  test('visibleTiles is empty when the viewport is off-map', () => {
    const camera = { centerX: -5000, centerY: -5000, zoom: 0 }
    expect(visibleTiles(camera, { width: 100, height: 100 }, geom, 0)).toEqual([])
  })
})
