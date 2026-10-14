import type { Camera } from './camera'

type Point = { x: number; y: number }
type PinchState = { distance: number; mid: Point }

// Inertia tuning: velocity decay and stop threshold (screen px/s)
const INERTIA_DECAY = 3.2
const INERTIA_MIN_SPEED = 24
const DRAG_SPEED_THRESHOLD = 240
// Tap detection: max distance and duration
const TAP_MAX_DISTANCE = 6
const TAP_MAX_DURATION_MS = 300

// Gesture controller: drag / pinch / wheel zoom / inertia / tap
// Pure DOM events -> Camera calls; never touches pixi
export class GestureController {
  private pointers = new Map<number, Point>()
  private velocitySamples: { t: number; dx: number; dy: number }[] = []
  private dragStartTime = 0
  private dragDistance = 0
  private inertiaRaf = 0
  private inertiaVelocity = { x: 0, y: 0 }
  private lastPinch: PinchState | undefined

  constructor(
    private readonly target: HTMLElement,
    private readonly camera: Camera,
    private readonly opts: {
      onTap?: (x: number, y: number) => void
      onDoubleTap?: () => void
    } = {},
  ) {}

  attach(): void {
    const el = this.target
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('pointercancel', this.onPointerUp)
    el.addEventListener('wheel', this.onWheel, { passive: false })
    el.addEventListener('contextmenu', this.onContextMenu)
    el.addEventListener('dblclick', this.onDoubleClick)
  }

  detach(): void {
    const el = this.target
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerup', this.onPointerUp)
    el.removeEventListener('pointercancel', this.onPointerUp)
    el.removeEventListener('wheel', this.onWheel)
    el.removeEventListener('contextmenu', this.onContextMenu)
    el.removeEventListener('dblclick', this.onDoubleClick)
    this.stopInertia()
    this.pointers.clear()
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.target.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, this.toLocal(e.clientX, e.clientY))
    this.stopInertia()
    this.velocitySamples = []
    this.dragStartTime = performance.now()
    this.dragDistance = 0
    this.lastPinch = undefined
    this.syncPinchState()
  }

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId)
    if (!prev) return
    const cur = this.toLocal(e.clientX, e.clientY)
    this.pointers.set(e.pointerId, cur)

    if (this.pointers.size === 1) {
      const dx = cur.x - prev.x
      const dy = cur.y - prev.y
      this.dragDistance += Math.hypot(dx, dy)
      this.camera.panBy(dx, dy)
      const now = performance.now()
      this.velocitySamples.push({ t: now, dx, dy })
      const cutoff = now - 100
      while (this.velocitySamples.length > 0 && this.velocitySamples[0].t < cutoff) {
        this.velocitySamples.shift()
      }
      return
    }

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (this.lastPinch && this.lastPinch.distance > 0 && distance > 0) {
        // Distance ratio -> zoom; midpoint delta -> pan
        this.camera.zoomAround(mid.x, mid.y, Math.log2(distance / this.lastPinch.distance))
        this.camera.panBy(this.lastPinch.mid.x - mid.x, this.lastPinch.mid.y - mid.y)
      }
      this.lastPinch = { distance, mid }
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.delete(e.pointerId)
    if (this.target.hasPointerCapture(e.pointerId)) {
      this.target.releasePointerCapture(e.pointerId)
    }
    if (this.pointers.size < 2) {
      this.lastPinch = undefined
    }

    const elapsed = performance.now() - this.dragStartTime
    if (
      this.pointers.size === 0 &&
      this.dragDistance <= TAP_MAX_DISTANCE &&
      elapsed <= TAP_MAX_DURATION_MS
    ) {
      const local = this.toLocal(e.clientX, e.clientY)
      this.opts.onTap?.(local.x, local.y)
      return
    }

    if (this.pointers.size === 0) {
      this.maybeStartInertia()
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.stopInertia()
    // Normalize deltaMode to pixels, then to a zoom delta (trackpad pinch sends ctrlKey through the same path)
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.target.clientHeight : 1
    const local = this.toLocal(e.clientX, e.clientY)
    this.camera.zoomAround(local.x, local.y, -e.deltaY * unit * 0.0022)
  }

  private onDoubleClick = (e: MouseEvent): void => {
    // Double-click means pure zoom: clear the selection left by the two taps
    // (the two check toggles already cancel each other)
    this.opts.onDoubleTap?.()
    const local = this.toLocal(e.clientX, e.clientY)
    this.camera.zoomAround(local.x, local.y, 1)
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  private maybeStartInertia(): void {
    if (this.velocitySamples.length === 0) return
    const now = performance.now()
    const first = this.velocitySamples[0]
    const dt = (now - first.t) / 1000
    let vx = 0
    let vy = 0
    for (const s of this.velocitySamples) {
      vx += s.dx
      vy += s.dy
    }
    if (dt > 0.016) {
      vx /= dt
      vy /= dt
    }
    if (Math.hypot(vx, vy) > DRAG_SPEED_THRESHOLD) {
      this.startInertia(vx, vy)
    }
  }

  private startInertia(vx: number, vy: number): void {
    this.inertiaVelocity = { x: vx, y: vy }
    let last = performance.now()
    const step = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      this.camera.panBy(this.inertiaVelocity.x * dt, this.inertiaVelocity.y * dt)
      const decay = Math.exp(-INERTIA_DECAY * dt)
      this.inertiaVelocity.x *= decay
      this.inertiaVelocity.y *= decay
      if (Math.hypot(this.inertiaVelocity.x, this.inertiaVelocity.y) > INERTIA_MIN_SPEED) {
        this.inertiaRaf = requestAnimationFrame(step)
      } else {
        this.inertiaRaf = 0
      }
    }
    this.inertiaRaf = requestAnimationFrame(step)
  }

  private stopInertia(): void {
    if (this.inertiaRaf !== 0) {
      cancelAnimationFrame(this.inertiaRaf)
      this.inertiaRaf = 0
    }
    this.inertiaVelocity = { x: 0, y: 0 }
  }

  private syncPinchState(): void {
    if (this.pointers.size !== 2) return
    const [a, b] = [...this.pointers.values()]
    this.lastPinch = {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  private toLocal(clientX: number, clientY: number): Point {
    const rect = this.target.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }
}
