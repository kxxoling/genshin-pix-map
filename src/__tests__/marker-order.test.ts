import { compareMarkers } from '@/render/marker-order'

describe('deterministic marker ordering (stacking)', () => {
  test('kind first, then id', () => {
    const a = { id: 'b', kind: 1, x: 0, y: 0 }
    const b = { id: 'a', kind: 1, x: 0, y: 0 }
    const c = { id: 'z', kind: 0, x: 0, y: 0 }
    const sorted = [a, b, c].sort(compareMarkers)
    expect(sorted).toEqual([c, b, a])
  })

  test('viewport-independent: any subset keeps the full-order relative sequence', () => {
    const all = [
      { id: 'ky-3', kind: 2, x: 0, y: 0 },
      { id: 'ky-1', kind: 1, x: 0, y: 0 },
      { id: 'ky-2', kind: 1, x: 5, y: 5 },
      { id: 'off-9', kind: 0, x: 9, y: 9 },
      { id: 'off-4', kind: 2, x: 1, y: 1 },
    ]
    const full = [...all].sort(compareMarkers)
    // after panning only a subset remains; relative order is unchanged
    const subset = [all[2], all[0], all[4]].sort(compareMarkers)
    const subsetInFull = full.filter((m) => subset.includes(m))
    expect(subset).toEqual(subsetInFull)
  })
})
