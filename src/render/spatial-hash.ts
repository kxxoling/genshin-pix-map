type Entry<T> = { x: number; y: number; item: T }

// Uniform-grid spatial index for marker culling and hit queries (ParticleContainer has no bounds/events)
export class SpatialHash<T> {
  private cells = new Map<string, Entry<T>[]>()
  private entries: Entry<T>[] = []

  constructor(readonly cellSize: number) {}

  get size(): number {
    return this.entries.length
  }

  clear(): void {
    this.cells.clear()
    this.entries = []
  }

  insert(x: number, y: number, item: T): void {
    const entry: Entry<T> = { x, y, item }
    this.entries.push(entry)
    const key = this.cellKey(x, y)
    const bucket = this.cells.get(key)
    if (bucket) {
      bucket.push(entry)
    } else {
      this.cells.set(key, [entry])
    }
  }

  // All entries intersecting the rect (deduped)
  query(rect: { left: number; top: number; right: number; bottom: number }): T[] {
    return this.queryEntries(rect).map((e) => e.item)
  }

  // Nearest entry to (x, y) within maxRadius
  queryNearest(
    x: number,
    y: number,
    maxRadius: number,
  ): { item: T; x: number; y: number } | undefined {
    let best: { entry: Entry<T>; distSq: number } | undefined
    for (const entry of this.queryEntries({
      left: x - maxRadius,
      top: y - maxRadius,
      right: x + maxRadius,
      bottom: y + maxRadius,
    })) {
      const distSq = (entry.x - x) ** 2 + (entry.y - y) ** 2
      if (distSq <= maxRadius ** 2 && (!best || distSq < best.distSq)) {
        best = { entry, distSq }
      }
    }
    return best ? { item: best.entry.item, x: best.entry.x, y: best.entry.y } : undefined
  }

  private queryEntries(rect: {
    left: number
    top: number
    right: number
    bottom: number
  }): Entry<T>[] {
    const result: Entry<T>[] = []
    const seen = new Set<Entry<T>>()
    const x0 = Math.floor(rect.left / this.cellSize)
    const x1 = Math.floor(rect.right / this.cellSize)
    const y0 = Math.floor(rect.top / this.cellSize)
    const y1 = Math.floor(rect.bottom / this.cellSize)
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.cells.get(`${cx},${cy}`)
        if (!bucket) continue
        for (const entry of bucket) {
          if (seen.has(entry)) continue
          seen.add(entry)
          result.push(entry)
        }
      }
    }
    return result
  }

  private cellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`
  }
}
