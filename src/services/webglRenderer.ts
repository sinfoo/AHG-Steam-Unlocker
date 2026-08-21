/**
 * WebGL Renderer for GPU-accelerated game cover display.
 *
 * Replaces <img> decoding with WebGL texture rendering:
 *   image-cache:// URL → fetch() → createImageBitmap() → WebGL texture → <canvas>
 *
 * Features:
 * - GPU-backed texture decode via createImageBitmap (zero-copy to GPU)
 * - LQIP crossfade via dual textures + GLSL mix in fragment shader
 * - sRGB-correct sampling via WEBGL_sRGB extension
 * - Full-screen quad with aspect-ratio-preserving texture coordinates
 * - HiDPI (devicePixelRatio) support
 * - Fallback detection via WebGLRenderer.isSupported()
 * - Complete resource cleanup on destroy()
 */

// ── Shader sources ─────────────────────────────────────────────────────

const VERTEX_SHADER_SOURCE = `#version 100
  attribute vec2 aPosition;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vTexCoord = aTexCoord;
  }
`

const FRAGMENT_SHADER_SOURCE = `#version 100
  precision highp float;

  uniform sampler2D uTexture;
  uniform sampler2D uLqipTexture;
  uniform float uMix;
  uniform bool uHasLqip;

  varying vec2 vTexCoord;

  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);

    if (uHasLqip) {
      vec4 lqip = texture2D(uLqipTexture, vTexCoord);
      color = mix(lqip, color, uMix);
    }

    gl_FragColor = color;
  }
`

// ── Full-screen quad geometry ────────────────────────────────────────
// Two triangles covering [-1, 1] in clip space with texture coords [0, 1]
// (0,0) is bottom-left in WebGL; UNPACK_FLIP_Y_WEBGL handles image orientation

const QUAD_VERTICES = new Float32Array([
  // x, y, u, v
  -1.0, -1.0,  0.0, 0.0,  // bottom-left
   1.0, -1.0,  1.0, 0.0,  // bottom-right
  -1.0,  1.0,  0.0, 1.0,  // top-left
   1.0,  1.0,  1.0, 1.0,  // top-right
])

const QUAD_INDICES = new Uint16Array([
  0, 1, 2,  // first triangle
  2, 1, 3,  // second triangle
])

// ── Renderer class ───────────────────────────────────────────────────

export class WebGLRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private vbo: WebGLBuffer | null = null
  private ibo: WebGLBuffer | null = null
  private texture: WebGLTexture | null = null
  private lqipTexture: WebGLTexture | null = null
  private hasLqip = false
  private mixValue = 1.0
  public contextLost = false
  private destroyed = false
  private textureLoaded = false
  private lqipLoaded = false
  private naturalWidth = 0
  private naturalHeight = 0

  // Uniform locations
  private uTextureLoc: WebGLUniformLocation | null = null
  private uLqipTextureLoc: WebGLUniformLocation | null = null
  private uMixLoc: WebGLUniformLocation | null = null
  private uHasLqipLoc: WebGLUniformLocation | null = null

  // Attribute locations
  private aPositionLoc = -1
  private aTexCoordLoc = -1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.initContext()
  }

  // ── Initialization ────────────────────────────────────────────────

  private initContext(): void {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })

    if (!gl) {
      console.warn('[WebGLRenderer] WebGL not available — caller should use <img> fallback')
      return
    }

    this.gl = gl

    // Enable sRGB extension if available (automatic color-space handling)
    const srgbExt = gl.getExtension('WEBGL_sRGB')
    if (!srgbExt) {
      // Non-fatal — most modern browsers support it; fallback works without
    }

    // Flip image Y-axis so texture coords match clip space
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    // Ensure pixel alignment for RGBA byte data
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)

    this.setupShaders()
    this.setupGeometry()
    this.setupUniforms()

    // Transparent clear for alpha blending with page background
    gl.clearColor(0, 0, 0, 0)
  }

  // ── Shader compilation ────────────────────────────────────────────

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!
    const shader = gl.createShader(type)
    if (!shader) return null

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      console.error(`[WebGLRenderer] Shader compile error: ${log}`)
      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  private setupShaders(): void {
    const gl = this.gl!
    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
    if (!vs || !fs) return

    const program = gl.createProgram()
    if (!program) return

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program)
      console.error(`[WebGLRenderer] Program link error: ${log}`)
      gl.deleteProgram(program)
      return
    }

    // Clean up shader objects after linking
    gl.deleteShader(vs)
    gl.deleteShader(fs)

    this.program = program
  }

  private setupGeometry(): void {
    const gl = this.gl!
    if (!this.program) return

    // Vertex buffer (interleaved: position + texcoord)
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.DYNAMIC_DRAW)
    this.vbo = vbo

    // Index buffer
    const ibo = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW)
    this.ibo = ibo

    // Attribute locations
    this.aPositionLoc = gl.getAttribLocation(this.program, 'aPosition')
    this.aTexCoordLoc = gl.getAttribLocation(this.program, 'aTexCoord')

    // Configure vertex attributes (interleaved: position=2 floats, texcoord=2 floats = 16 bytes stride)
    const stride = 4 * 4  // 4 floats × 4 bytes each
    gl.enableVertexAttribArray(this.aPositionLoc)
    gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, stride, 0)

    gl.enableVertexAttribArray(this.aTexCoordLoc)
    gl.vertexAttribPointer(this.aTexCoordLoc, 2, gl.FLOAT, false, stride, 2 * 4)  // offset after position
  }

  /**
   * Update UV coordinates for `object-fit: cover` behavior.
   * Calculates crop offsets so the image fills the canvas while preserving aspect ratio.
   * Call after texture load or canvas resize.
   */
  private updateUvsForCover(): void {
    const gl = this.gl
    if (!gl || !this.vbo || this.naturalWidth === 0 || this.naturalHeight === 0) return

    const containerAspect = this.canvas.clientWidth / this.canvas.clientHeight
    const imageAspect = this.naturalWidth / this.naturalHeight

    let uMin = 0, uMax = 1, vMin = 0, vMax = 1

    if (imageAspect > containerAspect) {
      const visibleRatio = containerAspect / imageAspect
      const crop = (1 - visibleRatio) / 2
      uMin = crop
      uMax = 1 - crop
    } else if (imageAspect < containerAspect) {
      const visibleRatio = imageAspect / containerAspect
      const crop = (1 - visibleRatio) / 2
      vMin = crop
      vMax = 1 - crop
    }

    const vertices = new Float32Array([
      -1, -1,  uMin, vMin,
       1, -1,  uMax, vMin,
      -1,  1,  uMin, vMax,
       1,  1,  uMax, vMax,
    ])

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices)
  }

  private setupUniforms(): void {
    const gl = this.gl!
    if (!this.program) return

    gl.useProgram(this.program)

    this.uTextureLoc = gl.getUniformLocation(this.program, 'uTexture')
    this.uLqipTextureLoc = gl.getUniformLocation(this.program, 'uLqipTexture')
    this.uMixLoc = gl.getUniformLocation(this.program, 'uMix')
    this.uHasLqipLoc = gl.getUniformLocation(this.program, 'uHasLqip')

    // Set texture unit bindings once
    gl.uniform1i(this.uTextureLoc, 0)      // uTexture → texture unit 0
    gl.uniform1i(this.uLqipTextureLoc, 1)  // uLqipTexture → texture unit 1

    // Default mix = full image (no crossfade)
    gl.uniform1f(this.uMixLoc, this.mixValue)
  }

  // ── Texture loading ───────────────────────────────────────────────

  /**
   * Load the primary full-resolution image as a WebGL texture.
   * Uses createImageBitmap for GPU-backed decode.
   */
  async loadTexture(url: string): Promise<void> {
    if (this.destroyed || this.contextLost || !this.gl) return
    this.textureLoaded = false

    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      if (blob.size < 100) throw new Error('Image too small')

      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: 'default',
      })

      if (this.destroyed || this.contextLost || !this.gl) {
        bitmap.close()
        return
      }

      this.naturalWidth = bitmap.width
      this.naturalHeight = bitmap.height

      if (!this.texture) {
        this.texture = this.gl.createTexture()
      }

      this.gl.activeTexture(this.gl.TEXTURE0)
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bitmap)

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

      bitmap.close()

      this.updateUvsForCover()
      this.textureLoaded = true

      // Set mix to 1.0 (full image) if no LQIP is available
      if (!this.hasLqip) {
        this.setMix(1.0)
      }

      this.render()
    } catch (err) {
      console.error(`[WebGLRenderer] Failed to load texture:`, err)
      this.textureLoaded = false
    }
  }

  /**
   * Load an LQIP (blur placeholder) as a second WebGL texture.
   * The fragment shader crossfades between LQIP and full texture based on uMix.
   */
  async loadLqipTexture(dataUrl: string): Promise<void> {
    if (this.destroyed || this.contextLost || !this.gl) return

    try {
      const resp = await fetch(dataUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: 'default',
      })

      if (this.destroyed || this.contextLost || !this.gl) {
        bitmap.close()
        return
      }

      if (!this.lqipTexture) {
        this.lqipTexture = this.gl.createTexture()
      }

      this.gl.activeTexture(this.gl.TEXTURE1)
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.lqipTexture)
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bitmap)

      // LQIP should also use LINEAR filtering for smooth blur
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

      bitmap.close()
      this.lqipLoaded = true
      this.hasLqip = true

      // Start crossfade: mix starts at 0.0 (LQIP only)
      if (!this.textureLoaded) {
        this.setMix(0.0)
      }

      this.render()
    } catch {
      // LQIP load failure is non-fatal — full image will still display
      this.hasLqip = false
    }
  }

  // ── Control ───────────────────────────────────────────────────────

  /**
   * Set the LQIP-to-full crossfade mix value.
   * @param value 0.0 = LQIP only, 1.0 = full image only
   */
  setMix(value: number): void {
    this.mixValue = Math.max(0, Math.min(1, value))
    if (this.gl && this.uMixLoc) {
      this.gl.useProgram(this.program)
      this.gl.uniform1f(this.uMixLoc, this.mixValue)
    }
  }

  /**
   * Render a single frame. Called automatically after loadTexture / loadLqipTexture,
   * but can be called manually after resize or external state changes.
   */
  render(): void {
    if (this.destroyed || this.contextLost || !this.gl || !this.program) return

    const gl = this.gl
    const canvas = this.canvas

    // Match canvas buffer size to display size (handles DPR)
    const displayWidth = canvas.clientWidth * devicePixelRatio
    const displayHeight = canvas.clientHeight * devicePixelRatio

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth
      canvas.height = displayHeight
      gl.viewport(0, 0, displayWidth, displayHeight)
    }

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    // Bind primary texture to unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // Bind LQIP texture to unit 1 (if available)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.lqipTexture)

    // Update LQIP presence uniform
    if (this.uHasLqipLoc) {
      gl.uniform1i(this.uHasLqipLoc, this.hasLqip ? 1 : 0)
    }

    // Bind buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)

    // Re-apply vertex attributes (buffer binding may have changed)
    const stride = 4 * 4
    gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, stride, 0)
    gl.vertexAttribPointer(this.aTexCoordLoc, 2, gl.FLOAT, false, stride, 2 * 4)

    // Draw quad (6 indices = 2 triangles)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
  }

  // ── Resize ────────────────────────────────────────────────────────

  /**
   * Handle canvas element resize. Updates viewport and re-renders.
   * Call when the container's dimensions change (e.g. window resize, layout shift).
   */
  resize(width?: number, height?: number): void {
    if (this.destroyed || this.contextLost || !this.gl) return
    if (width !== undefined) this.canvas.style.width = `${width}px`
    if (height !== undefined) this.canvas.style.height = `${height}px`
    this.updateUvsForCover()
    this.render()
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  /**
   * Release all GPU resources. Call on component unmount.
   * After destroy(), the renderer is no longer usable.
   */
  destroy(): void {
    this.destroyed = true
    const gl = this.gl
    if (!gl) return

    if (this.texture) gl.deleteTexture(this.texture)
    this.texture = null

    if (this.lqipTexture) gl.deleteTexture(this.lqipTexture)
    this.lqipTexture = null

    if (this.vbo) gl.deleteBuffer(this.vbo)
    this.vbo = null

    if (this.ibo) gl.deleteBuffer(this.ibo)
    this.ibo = null

    if (this.program) gl.deleteProgram(this.program)
    this.program = null

    // Lose the context to free GPU memory
    const loseContextExt = gl.getExtension('WEBGL_lose_context')
    if (loseContextExt) loseContextExt.loseContext()

    this.gl = null
  }

  // ── Static helpers ────────────────────────────────────────────────

  /**
   * Check if WebGL is available in the current browser/environment.
   * Creates a temporary canvas and attempts to get a WebGL context.
   */
  /** Session-stable result — probing creates a real GL context, so cache it.
   *  GameCover calls this once per card; without the cache a large grid would
   *  spin up (and immediately discard) hundreds of WebGL contexts. */
  private static _supportCache: boolean | undefined

  static isSupported(): boolean {
    if (WebGLRenderer._supportCache !== undefined) return WebGLRenderer._supportCache
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl', {
        failIfMajorPerformanceCaveat: true,
      })
      if (!gl) return (WebGLRenderer._supportCache = false)
      // Clean up
      const loseContextExt = gl.getExtension('WEBGL_lose_context')
      if (loseContextExt) loseContextExt.loseContext()
      return (WebGLRenderer._supportCache = true)
    } catch {
      return (WebGLRenderer._supportCache = false)
    }
  }

  /**
   * Returns whether a texture has been successfully loaded and is ready to render.
   */
  get isReady(): boolean {
    return this.textureLoaded && !this.destroyed
  }

  /**
   * Returns whether both LQIP and full textures are loaded.
   */
  get isFullyLoaded(): boolean {
    return this.textureLoaded && !this.destroyed
  }

  /**
   * Current crossfade mix value (0.0–1.0).
   */
  get currentMix(): number {
    return this.mixValue
  }
}
