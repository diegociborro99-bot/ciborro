import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE_FILE=1 npm run build  ->  dist/index.html autocontenido (para subir a cualquier sitio)
// npm run build                ->  build normal con assets separados
const single = process.env.SINGLE_FILE === '1'

// A dónde mandar /api y /fotos mientras desarrollas. El backend levanta en el
// 3000; si no está en marcha, el sitio tira del contenido de src/data/content.js.
const api = process.env.API_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  server: {
    proxy: {
      '/api': { target: api, changeOrigin: true },
      '/fotos': { target: api, changeOrigin: true },
    },
  },
})
