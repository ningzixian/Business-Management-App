import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { serviceConfig } from './src/service-config.ts'
import { readFileSync } from 'node:fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const service = serviceConfig(process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || '/api/v1', mode === 'mobile')
  return {
  // Company Android devices include WebView 99. Keep media queries compatible;
  // the default modern CSS target can emit range syntax those devices ignore.
  build: { target: 'chrome99', cssTarget: 'chrome99' },
  // Do not embed the company's downloadable APKs (or a browser service worker) inside the mobile APK.
  publicDir: mode === 'mobile' ? false : 'public',
  plugins: [react(), { name: 'shared-business-service', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'service-config.json', source: JSON.stringify(service) })
    if (mode === 'mobile') for (const fileName of ['app-icon.svg', 'manifest.webmanifest']) this.emitFile({ type: 'asset', fileName, source: readFileSync(`public/${fileName}`) })
  } }],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  }
})
