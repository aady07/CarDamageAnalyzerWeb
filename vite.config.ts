import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow external connections
    https: {
      key: fs.readFileSync('./192.168.0.110+1-key.pem'),
      cert: fs.readFileSync('./192.168.0.110+1.pem'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
