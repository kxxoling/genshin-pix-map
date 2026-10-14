import { Container, Sprite, type Texture } from 'pixi.js'
import type { Camera } from './camera'
import type { TileCache } from './tile-cache'
import { activeTileZoom, tileWorldSize, visibleTiles } from './tile-math'
import { type TileCoord, type TileSource, tileKey } from './types'

// Tile layer: crisp tiles at the active zoom over a blurry z-1 parent fallback
// The parent is upscaled 2x until crisp tiles arrive, which then draw over it
export class TileLayer {
  readonly root = new Container()
  private readonly parentRoot = new Container()
  private readonly mainRoot = new Container()
  private parentSprites = new Map<string, Sprite>()
  private mainSprites = new Map<string, Sprite>()

  constructor(
    private readonly source: TileSource,
    private readonly cache: TileCache,
    private readonly onRequestRender: () => void,
  ) {
    this.root.addChild(this.parentRoot, this.mainRoot)
    cache.onLoaded = (key, texture) => this.applyTexture(key, texture)
  }

  get visibleCount(): number {
    return this.mainSprites.size + this.parentSprites.size
  }

  update(camera: Camera): void {
    const z = activeTileZoom(this.source, camera.zoom)
    const mainTiles = visibleTiles(camera.snapshot(), camera.viewport, this.source, z)
    const parentZoom = Math.max(this.source.minZoom, z - 1)
    // No parent fallback below the minimum zoom level
    const parentTiles =
      parentZoom < z
        ? visibleTiles(camera.snapshot(), camera.viewport, this.source, parentZoom)
        : []

    this.syncSprites(this.mainSprites, this.mainRoot, mainTiles)
    this.syncSprites(this.parentSprites, this.parentRoot, parentTiles)

    // Enqueue order = priority: visibleTiles is center-sorted (main zoom before parent)
    const wanted = new Set<string>()
    for (const t of mainTiles) {
      const key = tileKey(t)
      wanted.add(key)
      this.cache.request(t)
    }
    for (const t of parentTiles) {
      const key = tileKey(t)
      wanted.add(key)
      this.cache.request(t)
    }
    this.cache.reconcile(wanted)
  }

  destroy(): void {
    for (const sprite of this.mainSprites.values()) sprite.destroy()
    for (const sprite of this.parentSprites.values()) sprite.destroy()
    this.mainSprites.clear()
    this.parentSprites.clear()
    this.root.destroy({ children: true })
  }

  // Tile texture arrived (cache callback): attach it to its sprite
  private applyTexture(key: string, texture: Texture): void {
    const sprite = this.mainSprites.get(key) ?? this.parentSprites.get(key)
    if (!sprite) return
    this.attachTexture(sprite, key, texture)
    this.onRequestRender()
  }

  private syncSprites(
    sprites: Map<string, Sprite>,
    container: Container,
    tiles: TileCoord[],
  ): void {
    const need = new Set(tiles.map((t) => tileKey(t)))
    for (const [key, sprite] of sprites) {
      if (!need.has(key)) {
        sprites.delete(key)
        sprite.destroy()
      }
    }
    for (const coord of tiles) {
      const key = tileKey(coord)
      let sprite = sprites.get(key)
      if (!sprite) {
        sprite = new Sprite()
        // Position in zoom-0 world coords: x * tileSize / 2^z
        const s = 1 / 2 ** coord.z
        sprite.position.set(coord.x * this.source.tileSize * s, coord.y * this.source.tileSize * s)
        sprites.set(key, sprite)
        container.addChild(sprite)
      }
      const texture = this.cache.peek(key)
      if (texture) {
        this.attachTexture(sprite, key, texture)
      }
    }
  }

  private attachTexture(sprite: Sprite, key: string, texture: Texture): void {
    if (sprite.texture === texture) return
    sprite.texture = texture
    const z = Number(key.split('/')[0])
    // Texture width may differ from tileSize; derive world scale from the actual width
    const worldSize = tileWorldSize(this.source, z)
    sprite.scale.set(worldSize / texture.width, worldSize / texture.height)
  }
}
