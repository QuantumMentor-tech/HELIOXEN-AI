/**
 * HELIOXEN AI — Step 39: Widget Preferences Manager
 * Persists user configuration for System Health, Network Monitor, and Weather widgets.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  DEFAULT_WIDGET_PREFERENCES,
  UpdateWidgetPreferencesRequestSchema,
  WIDGETS_SCHEMA_VERSION
} from '../../shared/widgets/contracts'
import { WidgetPreferences } from '../../shared/widgets/types'

export class WidgetPreferencesManager {
  private readonly storePath: string
  private preferences: WidgetPreferences
  private readonly nowFn: () => number

  constructor(options: { storageDir: string; nowFn?: () => number }) {
    this.nowFn = options.nowFn ?? (() => Date.now())
    const baseDir = path.resolve(options.storageDir, 'widgets')
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    this.storePath = path.join(baseDir, 'widgets_preferences.json')
    this.preferences = this.loadPreferencesFromDisk()
  }

  private loadPreferencesFromDisk(): WidgetPreferences {
    try {
      if (!fs.existsSync(this.storePath)) {
        return {
          ...DEFAULT_WIDGET_PREFERENCES,
          updatedAt: this.nowFn()
        }
      }

      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<WidgetPreferences>
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Malformed preferences file')
      }

      return {
        systemHealth: {
          ...DEFAULT_WIDGET_PREFERENCES.systemHealth,
          ...(parsed.systemHealth ?? {})
        },
        networkMonitor: {
          ...DEFAULT_WIDGET_PREFERENCES.networkMonitor,
          ...(parsed.networkMonitor ?? {})
        },
        weather: {
          ...DEFAULT_WIDGET_PREFERENCES.weather,
          ...(parsed.weather ?? {})
        },
        schemaVersion: WIDGETS_SCHEMA_VERSION,
        updatedAt: parsed.updatedAt ?? this.nowFn()
      }
    } catch {
      return {
        ...DEFAULT_WIDGET_PREFERENCES,
        updatedAt: this.nowFn()
      }
    }
  }

  public getPreferences(): WidgetPreferences {
    return { ...this.preferences }
  }

  public updatePreferences(patch: unknown): WidgetPreferences {
    const validated = UpdateWidgetPreferencesRequestSchema.parse(patch)
    const now = this.nowFn()

    const updated: WidgetPreferences = {
      systemHealth: {
        ...this.preferences.systemHealth,
        ...(validated.systemHealth ?? {})
      },
      networkMonitor: {
        ...this.preferences.networkMonitor,
        ...(validated.networkMonitor ?? {})
      },
      weather: {
        ...this.preferences.weather,
        ...(validated.weather ?? {})
      },
      schemaVersion: WIDGETS_SCHEMA_VERSION,
      updatedAt: now
    }

    // Atomic write to disk
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), 'utf-8')
      try {
        fs.renameSync(tmpPath, this.storePath)
      } catch {
        try {
          fs.copyFileSync(tmpPath, this.storePath)
          fs.unlinkSync(tmpPath)
        } catch {
          fs.writeFileSync(this.storePath, JSON.stringify(updated, null, 2), 'utf-8')
        }
      }
      this.preferences = updated
    } catch (err) {
      // Keep memory copy intact
      this.preferences = updated
    }

    return { ...this.preferences }
  }
}

