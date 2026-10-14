import { Application, Container, WebGLRenderer, WebGPURenderer } from 'pixi.js'
import { Camera } from './camera'
import { GestureController } from './gesture-controller'
import type { MarkerAtlas } from './marker-atlas'
import { MarkerLayer } from './marker-layer'
import { TileCache } from './tile-cache'
import { TileLayer } from './tile-layer'
import { scaleOf } from './tile-math'
import type { MapMarker, TileSource } from './types'

export type MapStats = {
  zoom: number
  renderer: 'webgl' | 'webgpu' | 'canvas'
  visibleTiles: number
  visibleMarkers: number
  totalMarkers: number
  loadedTiles: number
  pendingTiles: number
  renderMs: number
}

// Stats publish throttle (HUD refresh rate)
const STATS_INTERVAL_MS = 250

// Map renderer: owns the pixi Application
// - On-demand rendering (autoStart: false + manual app.render(); zero CPU when idle)
// - The world container scale/position express the camera; tiles and markers live in zoom-0 coords
export class MapRenderer {
  readonly camera = new Camera()
  private readonly app = new Application()
  private readonly world = new Container()
  private readonly tileCache: TileCache
  private readonly tileLayer: TileLayer
  private readonly markerLayer = new MarkerLayer()
  private gesture: GestureController | undefined
  private renderQueued = false
  private destroyed = false
  private statsTimer: ReturnType<typeof setTimeout> | undefined
  private lastStatsAt = 0
  private lastRenderMs = 0
  private statsListeners = new Set<(stats: MapStats) => void>()
  private markerTapListeners = new Set<(marker: MapMarker | undefined) => void>()

  private constructor(readonly source: TileSource) {
    this.tileCache = new TileCache(source)
    this.tileLayer = new TileLayer(source, this.tileCache, () => this.requestRender())
  }

  static async create(opts: {
    canvas: HTMLCanvasElement
    container: HTMLElement
    source: TileSource
    initialView?: { x: number; y: number; zoom: number }
  }): Promise<MapRenderer> {
    const renderer = new MapRenderer(opts.source)
    await renderer.init(opts.canvas, opts.container, opts.initialView)
    return renderer
  }

  onStats(fn: (stats: MapStats) => void): () => void {
    this.statsListeners.add(fn)
    return () => this.statsListeners.delete(fn)
  }

  onMarkerTap(fn: (marker: MapMarker | undefined) => void): () => void {
    this.markerTapListeners.add(fn)
    return () => this.markerTapListeners.delete(fn)
  }

  setMarkers(markers: MapMarker[]): void {
    this.markerLayer.setMarkers(markers)
    this.onCameraChange()
  }

  // Hot-swap the marker atlas (real icons arrive after init)
  setMarkerAtlas(atlas: MarkerAtlas): void {
    this.markerLayer.setAtlas(atlas)
    this.onCameraChange()
  }

  // Collected (checked) marker ids -> translucent rendering
  setCheckedIds(ids: ReadonlySet<string>): void {
    this.markerLayer.setCheckedIds(ids)
    this.requestRender()
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.app.renderer.resize(width, height)
    this.camera.setViewport(width, height)
  }

  requestRender(): void {
    if (this.renderQueued || this.destroyed) return
    this.renderQueued = true
    requestAnimationFrame(() => {
      this.renderQueued = false
      if (this.destroyed) return
      const t0 = performance.now()
      this.app.render()
      this.lastRenderMs = performance.now() - t0
      this.emitStats()
    })
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.statsTimer !== undefined) {
      clearTimeout(this.statsTimer)
      this.statsTimer = undefined
    }
    this.gesture?.detach()
    this.gesture = undefined
    this.tileCache.destroy()
    this.markerLayer.destroy()
    this.tileLayer.destroy()
    this.app.destroy(
      { removeView: false, releaseGlobalResources: true },
      { children: true, texture: true, textureSource: true },
    )
  }

  private async init(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    initialView?: { x: number; y: number; zoom: number },
  ): Promise<void> {
    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    await this.app.init({
      canvas,
      width,
      height,
      // v8 prefers webgl by default; kept explicit until WebGPU is verified on real devices
      preference: 'webgl',
      antialias: false,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      autoStart: false,
      background: '#10141f',
    })

    // Destroy if unmounted while awaiting
    if (this.destroyed) {
      this.app.destroy({ removeView: false, releaseGlobalResources: true })
      return
    }

    this.app.stage.addChild(this.world)
    this.world.addChild(this.tileLayer.root, this.markerLayer.root)

    const range = this.source.matrixRange(0)
    this.camera.setGeom(this.source)
    if (initialView) {
      this.camera.zoom = initialView.zoom
      this.camera.centerX = initialView.x
      this.camera.centerY = initialView.y
    } else {
      this.camera.zoom = this.source.minZoom
      this.camera.centerX = ((range.minX + range.maxX + 1) / 2) * this.source.tileSize
      this.camera.centerY = ((range.minY + range.maxY + 1) / 2) * this.source.tileSize
    }
    this.camera.setViewport(width, height)
    this.camera.subscribe(() => this.onCameraChange())

    this.gesture = new GestureController(canvas, this.camera, {
      onTap: (x, y) => this.handleTap(x, y),
      // Double-click is a pure zoom gesture: clear the selection left by the taps
      onDoubleTap: () => this.clearSelection(),
    })
    this.gesture.attach()

    this.onCameraChange()
  }

  // Clear the selection after a double-click (the two taps cancel each other)
  private clearSelection(): void {
    this.markerLayer.setSelection(null)
    for (const fn of this.markerTapListeners) {
      fn(undefined)
    }
    this.requestRender()
  }

  private handleTap(sx: number, sy: number): void {
    const marker = this.markerLayer.pickAt(this.camera, sx, sy)
    this.markerLayer.setSelection(marker?.id ?? null)
    for (const fn of this.markerTapListeners) {
      fn(marker)
    }
    this.requestRender()
  }

  private onCameraChange(): void {
    const scale = scaleOf(this.camera.zoom)
    this.world.scale.set(scale)
    this.world.position.set(
      this.camera.viewport.width / 2 - this.camera.centerX * scale,
      this.camera.viewport.height / 2 - this.camera.centerY * scale,
    )
    this.tileLayer.update(this.camera)
    this.markerLayer.update(this.camera)
    this.requestRender()
  }

  private collectStats(): MapStats {
    const rendererName =
      this.app.renderer instanceof WebGPURenderer
        ? 'webgpu'
        : this.app.renderer instanceof WebGLRenderer
          ? 'webgl'
          : 'canvas'
    return {
      zoom: this.camera.zoom,
      renderer: rendererName,
      visibleTiles: this.tileLayer.visibleCount,
      visibleMarkers: this.markerLayer.visible,
      totalMarkers: this.markerLayer.count,
      loadedTiles: this.tileCache.loadedCount,
      pendingTiles: this.tileCache.pendingCount,
      renderMs: this.lastRenderMs,
    }
  }

  private emitStats(): void {
    if (this.statsListeners.size === 0) return
    const now = performance.now()
    const elapsed = now - this.lastStatsAt
    if (elapsed < STATS_INTERVAL_MS) {
      // Trailing publish so a throttled update is not lost when the window closes
      if (this.statsTimer === undefined) {
        this.statsTimer = setTimeout(() => {
          this.statsTimer = undefined
          if (!this.destroyed) {
            this.publishStats()
          }
        }, STATS_INTERVAL_MS - elapsed)
      }
      return
    }
    this.publishStats()
  }

  private publishStats(): void {
    this.lastStatsAt = performance.now()
    const stats = this.collectStats()
    for (const fn of this.statsListeners) {
      fn(stats)
    }
  }
}
