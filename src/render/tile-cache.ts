import type { Texture } from 'pixi.js'
import { LruCache } from './lru'
import { type TileCoord, type TileSource, tileKey } from './types'

// Max in-flight tile requests (fetch + decode concurrency)
const MAX_CONCURRENT_LOADS = 6
// Failure cooldown: no retry within this window to avoid 404 loops
const FAILURE_COOLDOWN_MS = 5000

type InFlight = {
  controller: AbortController
}

// Tile cache: LRU texture pool + in-flight dedupe + request queue (priority = enqueue order)
export class TileCache {
  private textures: LruCache<string, Texture>
  private inFlight = new Map<string, InFlight>()
  private queue: TileCoord[] = []
  private failures = new Map<string, number>()
  private activeLoads = 0

  onLoaded: ((key: string, texture: Texture) => void) | undefined
  onTextureDestroyed: ((key: string) => void) | undefined

  constructor(
    private readonly source: TileSource,
    readonly capacity = 260,
  ) {
    this.textures = new LruCache<string, Texture>(capacity, (_key, texture) => {
      // destroy(true) also destroys the TextureSource, freeing GPU memory
      texture.destroy(true)
      this.onTextureDestroyed?.(_key)
    })
  }

  get loadedCount(): number {
    return this.textures.size
  }

  get pendingCount(): number {
    return this.queue.length + this.inFlight.size
  }

  peek(key: string): Texture | undefined {
    return this.textures.get(key)
  }

  // Request a tile (skipped when loaded / in-flight / cooling down)
  request(coord: TileCoord): void {
    const key = tileKey(coord)
    if (this.textures.has(key) || this.inFlight.has(key)) return
    const failedAt = this.failures.get(key)
    if (failedAt !== undefined && performance.now() - failedAt < FAILURE_COOLDOWN_MS) return
    this.queue.push(coord)
    this.pump()
  }

  // Called after each viewport update: abort in-flight requests and queued items no longer wanted
  reconcile(wantedKeys: ReadonlySet<string>): void {
    for (const [key, flight] of this.inFlight) {
      if (!wantedKeys.has(key)) flight.controller.abort()
    }
    if (this.queue.length > 0) {
      this.queue = this.queue.filter((c) => wantedKeys.has(tileKey(c)))
    }
  }

  destroy(): void {
    for (const flight of this.inFlight.values()) {
      flight.controller.abort()
    }
    this.inFlight.clear()
    this.queue = []
    for (const key of this.textures.keys()) {
      this.textures.delete(key)
    }
  }

  private pump(): void {
    while (this.activeLoads < MAX_CONCURRENT_LOADS && this.queue.length > 0) {
      const coord = this.queue.shift()
      if (!coord) break
      const key = tileKey(coord)
      if (this.textures.has(key) || this.inFlight.has(key)) continue
      this.startLoad(coord, key)
    }
  }

  private startLoad(coord: TileCoord, key: string): void {
    const controller = new AbortController()
    this.inFlight.set(key, { controller })
    this.activeLoads++

    this.source
      .loadTexture(coord, controller.signal)
      .then((texture) => {
        // Abort raced with decode: just discard the texture
        if (controller.signal.aborted || !texture) {
          texture?.destroy(true)
          return
        }
        if (this.inFlight.has(key)) {
          this.textures.set(key, texture)
          this.onLoaded?.(key, texture)
        } else {
          texture.destroy(true)
        }
      })
      .catch((error: unknown) => {
        // Network failures are expected: record the cooldown, do not rethrow
        if (!controller.signal.aborted) {
          this.failures.set(key, performance.now())
          console.warn(`[tile] failed ${key}:`, error)
        }
      })
      .finally(() => {
        this.inFlight.delete(key)
        this.activeLoads--
        this.pump()
      })
  }
}
