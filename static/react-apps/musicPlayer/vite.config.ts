import { reactAppsUrl } from '../utils/consts'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

const url = `${reactAppsUrl}musicPlayer/dist`

// https://vitejs.dev/config/
export default defineConfig({
  base: url,
  plugins: [svgr(), react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
})
