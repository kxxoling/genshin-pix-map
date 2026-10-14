import {
  gameToPixel,
  type OfficialMeta,
  officialTileUrl,
  tileGridSize,
  zoomSuffix,
} from '@/render/official-tiles'

// Meta shaped like the snapshot meta.json (real, verified values)
const meta: OfficialMeta = {
  mapId: 2,
  mapVersion: 'eea752b746ae1f2e0c1988a574f2b7b0',
  origin: [24206, 8918],
  totalSize: [36864, 18432],
  minZoom: -3,
  maxZoom: 0,
  tileUrlTemplate:
    'https://act-webstatic.mihoyo.com/ys-map-op/map/{mapId}/{mapVersion}/{x}_{y}_{suffix}.webp',
}

describe('official tile scheme', () => {
  test('zoomSuffix: N for negative zoom, P for non-negative', () => {
    expect(zoomSuffix(-3)).toBe('N3')
    expect(zoomSuffix(-1)).toBe('N1')
    expect(zoomSuffix(0)).toBe('P0')
  })

  test('officialTileUrl template substitution', () => {
    expect(officialTileUrl(meta, 23, 8, -2)).toBe(
      'https://act-webstatic.mihoyo.com/ys-map-op/map/2/eea752b746ae1f2e0c1988a574f2b7b0/23_8_N2.webp',
    )
  })

  test('gameToPixel: game coords + origin', () => {
    const p = gameToPixel(meta, -7318.5, -5640.6)
    expect(p.x).toBeCloseTo(16887.5, 6)
    expect(p.y).toBeCloseTo(3277.4, 6)
  })

  test('tileGridSize halves per level (measured: N3=18x9, N2=36x18)', () => {
    expect(tileGridSize(meta, -3)).toEqual({ cols: 18, rows: 9 })
    expect(tileGridSize(meta, -2)).toEqual({ cols: 36, rows: 18 })
    expect(tileGridSize(meta, -1)).toEqual({ cols: 72, rows: 36 })
    expect(tileGridSize(meta, 0)).toEqual({ cols: 144, rows: 72 })
  })
})
