// Generic LRU cache for tile textures (onEvict destroys them)
export class LruCache<K, V> {
  private entries = new Map<K, V>()
  private evicting = false

  constructor(
    readonly capacity: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.entries.size
  }

  has(key: K): boolean {
    return this.entries.has(key)
  }

  // Read and refresh recency
  get(key: K): V | undefined {
    const value = this.entries.get(key)
    if (value !== undefined) {
      this.entries.delete(key)
      this.entries.set(key, value)
    }
    return value
  }

  // Read without refreshing recency
  peek(key: K): V | undefined {
    return this.entries.get(key)
  }

  set(key: K, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key)
    }
    this.entries.set(key, value)
    this.evictToCapacity()
  }

  delete(key: K): void {
    const value = this.entries.get(key)
    if (value === undefined) return
    this.entries.delete(key)
    this.emitEvict(key, value)
  }

  keys(): K[] {
    return [...this.entries.keys()]
  }

  private evictToCapacity(): void {
    if (this.evicting) return
    this.evicting = true
    try {
      while (this.entries.size > this.capacity) {
        const oldest = this.entries.keys().next()
        if (oldest.done) break
        const key = oldest.value
        const value = this.entries.get(key)
        this.entries.delete(key)
        if (value !== undefined) this.emitEvict(key, value)
      }
    } finally {
      this.evicting = false
    }
  }

  private emitEvict(key: K, value: V): void {
    this.onEvict?.(key, value)
  }
}
