import { Container, Particle, ParticleContainer, Rectangle, Sprite } from 'pixi.js'
import type { Camera } from './camera'
import type { MarkerAtlas } from './marker-atlas'
import { compareMarkers } from './marker-order'
import { SpatialHash } from './spatial-hash'
import type { MapMarker } from './types'

// Marker screen size (px) and hit radius (px)
const MARKER_SCREEN_SIZE = 28
const HIT_RADIUS_PX = 22
// Spatial-hash cell size (zoom-0 world px)
const HASH_CELL = 64

// Marker layer: batched ParticleContainer rendering + spatial-hash culling and hit-testing
// (ParticleContainer has no events or bounds; this layer implements interaction and culling itself)
export class MarkerLayer {
  readonly root = new Container()
  private readonly particles = new ParticleContainer({
    dynamicProperties: { position: true, vertex: true },
  })
  private readonly selectionSprite = new Sprite()
  private atlas: MarkerAtlas | undefined
  private markers: MapMarker[] = []
  private markerById = new Map<string, MapMarker>()
  private hash = new SpatialHash<MapMarker>(HASH_CELL)
  private particleById = new Map<string, Particle>()
  private visibleParticles: Particle[] = []
  private frameSize = 64
  private selectedId: string | null = null
  private visibleCount = 0

  constructor() {
    this.selectionSprite.anchor.set(0.5)
    this.selectionSprite.visible = false
    this.root.addChild(this.particles, this.selectionSprite)
  }

  get count(): number {
    return this.markers.length
  }

  get visible(): number {
    return this.visibleCount
  }

  get selectedMarkerId(): string | null {
    return this.selectedId
  }

  // The atlas may arrive after the markers: build particles when it lands
  setAtlas(atlas: MarkerAtlas): void {
    this.atlas = atlas
    this.particles.texture = atlas.texture
    this.frameSize = atlas.frames[0]?.width || 64
    this.selectionSprite.texture = atlas.highlight
    if (this.markers.length > 0) {
      this.buildParticles()
    }
  }

  setMarkers(markers: MapMarker[]): void {
    this.markers = markers
    this.markerById = new Map(markers.map((m) => [m.id, m]))
    this.hash.clear()
    for (const marker of markers) {
      this.hash.insert(marker.x, marker.y, marker)
    }
    if (this.atlas) {
      this.buildParticles()
    } else {
      this.particleById.clear()
      this.visibleParticles = []
      this.particles.particleChildren = this.visibleParticles
      this.visibleCount = 0
    }
  }

  update(camera: Camera): void {
    this.visibleCount = 0
    if (!this.atlas || this.markers.length === 0) {
      this.updateSelection(camera)
      return
    }

    const scale = 2 ** camera.zoom
    // Pad by half a marker so edge markers do not pop in
    const pad = MARKER_SCREEN_SIZE / scale
    const rect = camera.visibleWorldRect()
    const visibleMarkers = this.hash.query({
      left: rect.left - pad,
      top: rect.top - pad,
      right: rect.right + pad,
      bottom: rect.bottom + pad,
    })

    // Constant screen size: markerWorld = MARKER_SCREEN_SIZE / scale
    const particleScale = MARKER_SCREEN_SIZE / scale / this.frameSize

    // Deterministic order: stacking must not depend on the viewport
    visibleMarkers.sort(compareMarkers)
    this.visibleParticles.length = 0
    for (const marker of visibleMarkers) {
      const particle = this.particleById.get(marker.id)
      if (!particle) continue
      // Rescale on every update: particles entering the viewport carry a stale scale
      particle.scaleX = particleScale
      particle.scaleY = particleScale
      this.visibleParticles.push(particle)
    }
    this.visibleCount = this.visibleParticles.length

    // Static attributes upload per GPU slot, so rebuild the buffers whenever the visible set changes
    this.particles.particleChildren = this.visibleParticles
    this.particles.update()
    this.updateSelection(camera)
  }

  // Hit test: screen -> world -> nearest neighbor via the spatial hash
  pickAt(camera: Camera, sx: number, sy: number): MapMarker | undefined {
    const world = camera.screenToWorld(sx, sy)
    const radius = HIT_RADIUS_PX / 2 ** camera.zoom
    return this.hash.queryNearest(world.x, world.y, radius)?.item
  }

  // Collected (checked) markers render translucent
  setCheckedIds(ids: ReadonlySet<string>): void {
    if (ids.size === this.lastCheckedSize && this.sameChecks(ids)) return
    this.checkedIds = new Set(ids)
    for (const [id, particle] of this.particleById) {
      particle.alpha = this.checkedIds.has(id) ? 0.4 : 1
    }
    // color is a static attribute: re-upload after changing it
    this.particles.update()
    this.lastCheckedSize = ids.size
    this.lastCheckedKeys = [...ids].sort().join(',')
  }

  private checkedIds = new Set<string>()
  private lastCheckedSize = -1
  private lastCheckedKeys = ''

  private sameChecks(ids: ReadonlySet<string>): boolean {
    return [...ids].sort().join(',') === this.lastCheckedKeys
  }

  setSelection(id: string | null): void {
    this.selectedId = id
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }

  private buildParticles(): void {
    if (!this.atlas) return
    const frames = this.atlas.frames
    this.particleById.clear()
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const marker of this.markers) {
      this.particleById.set(
        marker.id,
        new Particle({
          texture: frames[marker.kind % frames.length],
          x: marker.x,
          y: marker.y,
          anchorX: 0.5,
          anchorY: 0.5,
          alpha: this.checkedIds.has(marker.id) ? 0.4 : 1,
        }),
      )
      minX = Math.min(minX, marker.x)
      minY = Math.min(minY, marker.y)
      maxX = Math.max(maxX, marker.x)
      maxY = Math.max(maxY, marker.y)
    }
    this.visibleParticles = []
    this.particles.particleChildren = this.visibleParticles
    this.particles.update()
    // boundsArea: ParticleContainer has empty bounds by default; set it explicitly
    if (this.markers.length > 0) {
      this.particles.boundsArea = new Rectangle(minX, minY, maxX - minX, maxY - minY)
    }
    this.visibleCount = 0
  }

  private updateSelection(camera: Camera): void {
    if (!this.selectedId || !this.atlas) {
      this.selectionSprite.visible = false
      return
    }
    const marker = this.markerById.get(this.selectedId)
    if (!marker) {
      this.selectionSprite.visible = false
      return
    }
    const scale = 2 ** camera.zoom
    const worldSize = (MARKER_SCREEN_SIZE * 1.5) / scale
    this.selectionSprite.visible = true
    this.selectionSprite.position.set(marker.x, marker.y)
    this.selectionSprite.scale.set(worldSize / this.selectionSprite.texture.width)
  }
}
