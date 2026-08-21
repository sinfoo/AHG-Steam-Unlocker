import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

async function getVisualizerPlugin(): Promise<PluginOption | null> {
  if (process.env.ANALYZE !== 'true') return null
  try {
    const { visualizer } = await import('rollup-plugin-visualizer')
    return visualizer({ filename: 'bundle-report.html', open: false })
  } catch {
    console.warn('[vite] rollup-plugin-visualizer not available — skipping bundle report')
    return null
  }
}

/** Vite plugin: remove `crossorigin` from local asset tags for Electron file:// loading.
 *  The `crossorigin` attribute on local assets causes opaque-origin CORS failures
 *  when loaded from file:// — Chromium silently blocks the resource.
 *  External CDN links (Google Fonts preconnect, etc.) retain `crossorigin`.
 */
function removeElectronCrossOrigin(): PluginOption {
  return {
    name: 'remove-electron-crossorigin',
    transformIndexHtml(html) {
      html = html.replace(/(?<=<script(?: type="module")?)\s*crossorigin(?=[^>]*src="\.\/assets\/[^"]*"[^>]*>)/g, '')
      html = html.replace(/(?<=<link rel="modulepreload")\s*crossorigin(?=[^>]*href="\.\/assets\/[^"]*"[^>]*>)/g, '')
      html = html.replace(/(?<=<link rel="stylesheet")\s*crossorigin(?=[^>]*>)/g, '')
      return html
    },
  }
}

export default defineConfig(async () => {
  const visualizerPlugin = await getVisualizerPlugin()
  return {
    plugins: [
      react(),
      removeElectronCrossOrigin(),
      ...(visualizerPlugin ? [visualizerPlugin] : []),
    ],
    base: './',
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      sourcemap: 'hidden',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
      cssCodeSplit: true,
      modulePreload: { polyfill: false },
      esbuild: {
        pure: ['console.warn', 'debugger'],
        legalComments: 'none',
        keepNames: false,
      },
      rollupOptions: {
        output: {
          hoistTransitiveImports: true,
          manualChunks(id: string) {
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'vendor-react'
            if (id.includes('/node_modules/@tailwindcss/')) return 'vendor-tw'
            if (id.includes('/node_modules/framer-motion/')) return 'vendor-motion'
            if (id.includes('/node_modules/lucide-react/')) return 'vendor-ui'
            if (id.includes('/node_modules/zustand/') || id.includes('/node_modules/use-sync-external-store/')) return 'vendor-state'
            if (id.includes('/node_modules/@tanstack/react-virtual/')) return 'vendor-virtual'
            if (id.includes('/node_modules/sql.js/')) return 'vendor-sqljs'
          },
        },
      },
    },
    worker: {
      format: 'es',
    },
  }
})
