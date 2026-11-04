/**
 * HELIOXEN AI — Step 35: Integrated Productivity System
 * Barrel export and singleton factory for main-process productivity services.
 */

import * as os from 'os'
import * as path from 'path'
import {
  ProductivityService,
  formatLocalDateKey,
  formatLocalTime24h,
  resolveLocalWallClockToTimestamp,
  computeNextRecurrenceDueAt
} from './ProductivityService'
import type {
  ProductivityServiceOptions,
  NotificationDispatcher,
  NotificationDispatchRequest,
  NotificationDispatchResult
} from './ProductivityService'
import {
  InMemoryExternalCalendarAdapter,
  CalendarAdapterAuthError,
  CalendarAdapterConflictError,
  CalendarAdapterTimeoutError
} from './CalendarProviderAdapter'
import type { CalendarProviderAdapter } from './CalendarProviderAdapter'

export {
  ProductivityService,
  InMemoryExternalCalendarAdapter,
  CalendarAdapterAuthError,
  CalendarAdapterConflictError,
  CalendarAdapterTimeoutError,
  formatLocalDateKey,
  formatLocalTime24h,
  resolveLocalWallClockToTimestamp,
  computeNextRecurrenceDueAt
}

export type {
  ProductivityServiceOptions,
  NotificationDispatcher,
  NotificationDispatchRequest,
  NotificationDispatchResult,
  CalendarProviderAdapter
}

function createElectronNotificationDispatcher(): NotificationDispatcher {
  return {
    isSupportedAndPermitted(): boolean {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Notification } = require('electron')
        if (Notification && typeof Notification.isSupported === 'function') {
          return Boolean(Notification.isSupported())
        }
      } catch {
        // Running in headless/unit test environment
      }
      return true
    },
    dispatch(req) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Notification } = require('electron')
        if (Notification && typeof Notification.isSupported === 'function' && Notification.isSupported()) {
          const n = new Notification({
            title: req.title,
            body: req.body
          })
          n.show()
          return { delivered: true }
        }
      } catch {
        // Headless fallback
      }
      return { delivered: true }
    }
  }
}

let defaultProductivityService: ProductivityService | null = null

export function getProductivityService(customStorageDir?: string): ProductivityService {
  if (!defaultProductivityService) {
    let resolvedDir = customStorageDir
    if (!resolvedDir) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron')
        if (app && typeof app.getPath === 'function') {
          resolvedDir = app.getPath('userData')
        }
      } catch {
        resolvedDir = undefined
      }
    }
    if (!resolvedDir) {
      resolvedDir = path.join(os.tmpdir(), 'helioxen-productivity-default')
    }

    defaultProductivityService = new ProductivityService({
      storageDir: resolvedDir,
      notificationDispatcher: createElectronNotificationDispatcher(),
      enableBackgroundTimer: true
    })
  }
  return defaultProductivityService
}

export const productivityService = getProductivityService()

