import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDevelopment = command === 'serve'
  
  // Check if certificate files exist for local development
  const certKeyPath = './192.168.0.110+1-key.pem'
  const certPath = './192.168.0.110+1.pem'
  const certsExist = fs.existsSync(certKeyPath) && fs.existsSync(certPath)
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0', // Allow external connections
      ...(isDevelopment && certsExist && {
        // Only use HTTPS for local development if certificates exist
        https: {
          key: fs.readFileSync(certKeyPath),
          cert: fs.readFileSync(certPath),
        }
      })
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  }
})
