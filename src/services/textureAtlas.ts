/**
 * TextureAtlas — batches multiple game cover images into a single WebGL texture.
 *
 * Approach: Each registered cover image is loaded, drawn onto an OffscreenCanvas slot,
 * and the entire canvas is uploaded as one WebGL texture. This reduces draw calls from
 * N (one per cover) to 1 for the visible grid.
 *
 * The atlas uses a simple row-based layout since game covers have roughly similar sizes
 * (portrait 600×900, landscape 460×215, square 200×200).
 */

const ATLAS_SIZE = 2048
const SLOT_ROWS = 8
const SLOT_COLS = 8
const SLOT_COUNT = SLOT_ROWS * SLOT_COLS // 64
const SLOT_WIDTH = ATLAS_SIZE / SLOT_COLS  // 256
const SLOT_HEIGHT = ATLAS_SIZE / SLOT_ROWS // 256
const SLOT_PADDING = 2 // pixels between slots to prevent bleeding

export interface AtlasSlot {
  /** 0-based slot index (0–63) */
  index: number
  /** Normalized UV coordinates within the atlas texture */
  u: number
  v: number
  u2: number
  v2: number
  /** Pixel dimensions of the slot */
  pixelX: number
  pixelY: number
  pixelWidth: number
  pixelHeight: number
}

export interface AtlasEntry {
  appid: string
  slot: AtlasSlot
  loaded: boolean
}

export class TextureAtlas {
  private canvas: OffscreenCanvas
  private ctx: OffscreenCanvasRenderingContext2D
  private entries = new Map<string, AtlasEntry>()
  private nextSlot = 0
  private glTexture: WebGLTexture | null = null
  private gl: WebGLRenderingContext | null = null
  private dirty = false

  constructor() {
    this.canvas = new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE)
    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    })
    if (!ctx) throw new Error('Failed to create 2D context for TextureAtlas')
    this.ctx = ctx

    // Fill with a neutral dark color (matches loading placeholder aesthetic)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
  }

  /**
   * Register a cover image in the atlas.
   * Returns the atlas slot with UV coordinates, or null if the atlas is full.
   */
  async register(appid: string, url: string): Promise<AtlasSlot | null> {
    if (this.entries.has(appid)) {
      return this.entries.get(appid)!.slot
    }
    if (this.nextSlot >= SLOT_COUNT) {
      console.warn('[TextureAtlas] Atlas full — caller should use individual texture fallback')
      return null
    }

    const slotIndex = this.nextSlot++
    const slot = this.computeSlot(slotIndex)
    const entry: AtlasEntry = { appid, slot, loaded: false }
    this.entries.set(appid, entry)

    // Load image into this slot
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: 'default',
        resizeWidth: SLOT_WIDTH - SLOT_PADDING * 2,
        resizeHeight: SLOT_HEIGHT - SLOT_PADDING * 2,
        resizeQuality: 'medium',
      })

      this.ctx.drawImage(bitmap, slot.pixelX + SLOT_PADDING, slot.pixelY + SLOT_PADDING)
      bitmap.close()
      entry.loaded = true
      this.dirty = true

      return slot
    } catch (err) {
      console.error(`[TextureAtlas] Failed to load image for ${appid}:`, err)
      this.entries.delete(appid)
      this.nextSlot--
      return null
    }
  }

  /**
   * Remove a cover from the atlas and reclaim its slot.
   */
  unregister(appid: string): void {
    if (!this.entries.has(appid)) return
    this.entries.delete(appid)
    // Slot reuse would require repacking — for simplicity, slots are append-only this session.
    // On scroll/unmount, the atlas should be rebuilt fresh.
    // Mark dirty so the next rebuild call re-creates the texture.
    this.dirty = true
  }

  /**
   * Unregister all entries and reset the atlas.
   */
  clear(): void {
    this.entries.clear()
    this.nextSlot = 0
    this.ctx.fillStyle = '#1a1a2e'
    this.ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
    this.dirty = true
  }

  /**
   * Upload the atlas canvas as a WebGL texture.
   * Must be called after at least one successful register() call, and
   * after any rebuild() where the atlas content changed.
   */
  uploadToWebGL(gl: WebGLRenderingContext): WebGLTexture | null {
    if (!this.dirty && this.glTexture) return this.glTexture

    const texture = gl.createTexture()
    if (!texture) return null

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.canvas as unknown as ImageData,
    )

    // At 2048×2048, trilinear mipmapping costs GPU memory for minimal quality gain in a grid
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // Delete previous texture if replacing
    if (this.glTexture) {
      gl.deleteTexture(this.glTexture)
    }

    this.glTexture = texture
    this.gl = gl
    this.dirty = false

    return texture
  }

  /**
   * Get UV coordinates for a registered appid.
   */
  getSlot(appid: string): AtlasSlot | null {
    const entry = this.entries.get(appid)
    return entry?.slot ?? null
  }

  /**
   * Check if a specific entry is loaded.
   */
  isLoaded(appid: string): boolean {
    return this.entries.get(appid)?.loaded ?? false
  }

  /**
   * Number of registered entries.
   */
  get size(): number {
    return this.entries.size
  }

  /**
   * Whether the atlas has any loaded content.
   */
  get hasContent(): boolean {
    return this.nextSlot > 0
  }

  /**
   * Destroy WebGL texture and release canvas memory.
   */
  destroy(): void {
    if (this.glTexture && this.gl) {
      this.gl.deleteTexture(this.glTexture)
    }
    this.glTexture = null
    this.gl = null
    this.entries.clear()
    this.nextSlot = 0
    this.dirty = false
    // OffscreenCanvas may be garbage-collected
  }

  // ── Private helpers ────────────────────────

  private computeSlot(index: number): AtlasSlot {
    const row = Math.floor(index / SLOT_COLS)
    const col = index % SLOT_COLS
    const pixelX = col * SLOT_WIDTH
    const pixelY = row * SLOT_HEIGHT

    return {
      index,
      u: pixelX / ATLAS_SIZE,
      v: pixelY / ATLAS_SIZE,
      u2: (pixelX + SLOT_WIDTH) / ATLAS_SIZE,
      v2: (pixelY + SLOT_HEIGHT) / ATLAS_SIZE,
      pixelX,
      pixelY,
      pixelWidth: SLOT_WIDTH,
      pixelHeight: SLOT_HEIGHT,
    }
  }
}
