import { Texture } from 'pixi.js'

export type MarkerAtlas = {
  // Atlas base texture (TextureSource shared by the ParticleContainer)
  texture: Texture
  // Frame texture per marker kind (same TextureSource, different frames)
  frames: Texture[]
  // Selection highlight ring
  highlight: Texture
}

// Selection highlight ring
export function createHighlightTexture(): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('failed to acquire a 2D canvas context')
  }
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2)
  ctx.lineWidth = 6
  ctx.strokeStyle = '#f8fafc'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 30, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(248,250,252,0.5)'
  ctx.stroke()
  return Texture.from(canvas, true)
}
