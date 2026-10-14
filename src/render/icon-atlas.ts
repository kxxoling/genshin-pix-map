import { Rectangle, Texture } from 'pixi.js'
import { createHighlightTexture, type MarkerAtlas } from './marker-atlas'

const CELL = 64
const COLS = 16
// Safe area for icon drawing (padding avoids bleeding into neighbor frames)
const SAFE = 56

export type IconAtlas = {
  atlas: MarkerAtlas
  // Icon URL -> frame index (marker.kind)
  kindByUrl: Map<string, number>
}

// Builds a runtime atlas from icon URLs: one shared TextureSource so ParticleContainer can batch
// A failed icon just leaves an empty cell; it never blocks the atlas
export async function buildIconAtlas(urls: string[]): Promise<IconAtlas> {
  const rows = Math.max(1, Math.ceil(urls.length / COLS))
  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL
  canvas.height = rows * CELL
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('failed to acquire a 2D canvas context')
  }

  const kindByUrl = new Map<string, number>()
  await Promise.all(
    urls.map(async (url, i) => {
      kindByUrl.set(url, i)
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const bitmap = await createImageBitmap(await res.blob())
        const scale = Math.min(SAFE / bitmap.width, SAFE / bitmap.height)
        const w = bitmap.width * scale
        const h = bitmap.height * scale
        const cx = (i % COLS) * CELL + (CELL - w) / 2
        const cy = Math.floor(i / COLS) * CELL + (CELL - h) / 2
        ctx.drawImage(bitmap, cx, cy, w, h)
        bitmap.close()
      } catch {
        // leave the cell empty
      }
    }),
  )

  const base = Texture.from(canvas, true)
  const frames = urls.map(
    (_, i) =>
      new Texture({
        source: base.source,
        frame: new Rectangle((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL),
      }),
  )
  return { atlas: { texture: base, frames, highlight: createHighlightTexture() }, kindByUrl }
}
