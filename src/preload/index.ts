import { contextBridge } from 'electron'

// Minimal, intentionally narrow preload bridge for development bootstrap
// Formal typed IPC contracts and tool dispatchers will be integrated in Steps 13 & 14.
const helioxenApi = {
  platform: process.platform,
  environment: process.env.NODE_ENV || 'development',
  version: '0.1.0-alpha.1'
}

try {
  contextBridge.exposeInMainWorld('helioxen', helioxenApi)
} catch (error) {
  console.error('Failed to expose helioxen context bridge:', error)
}
