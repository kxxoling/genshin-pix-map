import {
  type CameraSnapshot,
  clampZoom,
  scaleOf,
  screenToWorld,
  type ViewportSize,
  visibleWorldRect,
  type WorldRect,
} from './tile-math'
import type { TileGeom } from './types'

// Camera: center (zoom-0 world px) + zoom level; every gesture reduces to these two states
export class Camera {
  centerX = 0
  centerY = 0
  zoom = 0
  viewport: ViewportSize = { width: 1, height: 1 }

  private geom: TileGeom | undefined
  private listeners = new Set<() => void>()

  snapshot(): CameraSnapshot {
    return { centerX: this.centerX, centerY: this.centerY, zoom: this.zoom }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // Content bounds come from the tile source (zoom-0 units)
  setGeom(geom: TileGeom): void {
    this.geom = geom
    this.zoom = clampZoom(geom, this.zoom)
    this.applyConstraints()
    this.emit()
  }

  setViewport(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.viewport = { width, height }
    this.applyConstraints()
    this.emit()
  }

  // Screen-pixel delta -> camera pan (shared by drag and inertia)
  panBy(dxScreen: number, dyScreen: number): void {
    const scale = scaleOf(this.zoom)
    this.centerX -= dxScreen / scale
    this.centerY -= dyScreen / scale
    this.applyConstraints()
    this.emit()
  }

  // Zoom anchored at screen point (sx, sy); the world under it stays put
  zoomAround(sx: number, sy: number, zoomDelta: number): void {
    if (!this.geom || zoomDelta === 0) return
    const before = screenToWorld(this.snapshot(), this.viewport, sx, sy)
    this.zoom = clampZoom(this.geom, this.zoom + zoomDelta)
    const scale = scaleOf(this.zoom)
    this.centerX = before.x - (sx - this.viewport.width / 2) / scale
    this.centerY = before.y - (sy - this.viewport.height / 2) / scale
    this.applyConstraints()
    this.emit()
  }

  screenToWorld(sx: number, sy: number) {
    return screenToWorld(this.snapshot(), this.viewport, sx, sy)
  }

  visibleWorldRect(): WorldRect {
    return visibleWorldRect(this.snapshot(), this.viewport)
  }

  // Clamp the center to the content: the viewport never leaves the content edges (centered when content is smaller)
  private applyConstraints(): void {
    if (!this.geom) return
    const zr = this.geom.matrixRange(0)
    if (zr.maxX < zr.minX || zr.maxY < zr.minY) return
    const t = this.geom.tileSize
    const left = zr.minX * t
    const right = (zr.maxX + 1) * t
    const top = zr.minY * t
    const bottom = (zr.maxY + 1) * t
    const scale = scaleOf(this.zoom)
    const halfW = this.viewport.width / 2 / scale
    const halfH = this.viewport.height / 2 / scale

    if (right - left >= halfW * 2) {
      this.centerX = Math.min(right - halfW, Math.max(left + halfW, this.centerX))
    } else {
      this.centerX = (left + right) / 2
    }
    if (bottom - top >= halfH * 2) {
      this.centerY = Math.min(bottom - halfH, Math.max(top + halfH, this.centerY))
    } else {
      this.centerY = (top + bottom) / 2
    }
  }

  private emit(): void {
    for (const fn of this.listeners) {
      fn()
    }
  }
}
