import type { CapacitorConfig } from '@capacitor/cli'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const servicePath = resolve(__dirname, 'dist/service-config.json')
const service = existsSync(servicePath) ? JSON.parse(readFileSync(servicePath, 'utf8')) as { origin: string } : { origin: '' }

const config: CapacitorConfig = {
  appId: 'com.company.departmentsteward',
  appName: '部门小管家',
  webDir: 'dist',
  // Required only for the validated private-network HTTP build. HTTPS builds keep it disabled.
  android: { allowMixedContent: service.origin.startsWith('http://') },
  server: {
    androidScheme: 'https',
  },
}

export default config
