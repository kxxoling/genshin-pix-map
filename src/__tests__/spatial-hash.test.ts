import { SpatialHash } from '@/render/spatial-hash'

describe('SpatialHash', () => {
  test('rect query spans cells and dedupes', () => {
    const hash = new SpatialHash<string>(10)
    hash.insert(5, 5, 'a')
    hash.insert(15, 5, 'b')
    hash.insert(5, 15, 'c')

    const found = hash.query({ left: 0, top: 0, right: 20, bottom: 20 })
    expect(found.sort()).toEqual(['a', 'b', 'c'])

    const corner = hash.query({ left: 0, top: 0, right: 9, bottom: 9 })
    expect(corner).toEqual(['a'])
  })

  test('negative coords work', () => {
    const hash = new SpatialHash<string>(10)
    hash.insert(-15, -25, 'neg')
    const found = hash.query({ left: -30, top: -30, right: 0, bottom: 0 })
    expect(found).toEqual(['neg'])
  })

  test('queryNearest returns the nearest within radius, undefined beyond', () => {
    const hash = new SpatialHash<string>(10)
    hash.insert(10, 10, 'near')
    hash.insert(100, 100, 'far')

    expect(hash.queryNearest(12, 10, 5)?.item).toBe('near')
    expect(hash.queryNearest(50, 50, 5)).toBeUndefined()
    expect(hash.queryNearest(98, 100, 4)?.item).toBe('far')
  })
})
