import { LruCache } from '@/render/lru'

describe('LruCache', () => {
  test('evicts the oldest past capacity and fires onEvict', () => {
    const evicted: string[] = []
    const cache = new LruCache<string, number>(2, (k) => evicted.push(k))

    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(cache.size).toBe(2)
    expect(evicted).toEqual(['a'])
    expect(cache.has('b')).toBe(true)
    expect(cache.has('c')).toBe(true)
  })

  test('get refreshes recency, peek does not', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)

    cache.get('a')
    cache.set('c', 3)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)

    // Order is now [a, c]: peek('a') does not refresh recency, so 'a' is evicted on overflow
    cache.peek('a')
    cache.set('d', 4)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('c')).toBe(true)
    expect(cache.has('d')).toBe(true)
  })
})
