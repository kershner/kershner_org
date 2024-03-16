import { reactAppsUrl } from '../utils/consts'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const url = `${reactAppsUrl}musicPlayer/dist`
const devMode = false

// https://vitejs.dev/config/
export default defineConfig({
  base: url,
  plugins: [react()],
  build: {
    minify: devMode ? false : true,
    terserOptions: {
      mangle: devMode ? false : true,
    },
    rollupOptions: {
      output: {
        entryFileNames: `kershPlayer.js`,
        chunkFileNames: `kershPlayer.js`,
        assetFileNames: `kershPlayer.[ext]`,
      },
    },
  },
})
