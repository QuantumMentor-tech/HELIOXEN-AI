/**
 * HELIOXEN AI — Step 39: Widget Validation Contracts & Pure Utilities
 * Enforces strict runtime validation for system health, bounded network diagnostics,
 * and authorized weather provider normalization.
 */

import { z } from 'zod'
import {
  ApprovedNetworkEndpoint,
  CurrentWeatherConditions,
  TemperatureUnit,
  WeatherLocation,
  WidgetPreferences,
  WindSpeedUnit
} from './types'

export const WIDGETS_SCHEMA_VERSION = 1

// ============================================================================
// 1. APPROVED NETWORK ENDPOINTS & VALIDATION
// ============================================================================

export const APPROVED_NETWORK_ENDPOINTS: readonly ApprovedNetworkEndpoint[] = [
  {
    id: 'cloudflare-trace',
    name: 'Cloudflare Edge CDN Trace',
    url: 'https://cloudflare.com/cdn-cgi/trace',
    description: 'High-availability global edge endpoint; lightweight plain-text diagnostic response.',
    isDefault: true
  },
  {
    id: 'cloudflare-dns-trace',
    name: 'Cloudflare 1.1.1.1 Trace',
    url: 'https://1.1.1.1/cdn-cgi/trace',
    description: 'Direct anycast IP endpoint verifying public HTTPS routing.',
    isDefault: false
  },
  {
    id: 'google-generate-204',
    name: 'Google Connectivity Check (204 No Content)',
    url: 'https://www.google.com/generate_204',
    description: 'Standard zero-byte HTTP 204 connectivity verification endpoint.',
    isDefault: false
  },
  {
    id: 'httpbin-status-200',
    name: 'Httpbin Public Status Endpoint',
    url: 'https://httpbin.org/status/200',
    description: 'Independent public HTTP testing service returning HTTP 200 OK.',
    isDefault: false
  }
] as const

/**
 * Validates a candidate network diagnostic URL.
 * Strictly enforces HTTPS protocol and blocks local/loopback/private IP/SSRF addresses.
 */
export function validateDiagnosticTargetUrl(rawUrl: unknown): {
  valid: boolean
  normalizedUrl: string | null
  host: string | null
  error?: string
} {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, normalizedUrl: null, host: null, error: 'Target URL is missing or empty.' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { valid: false, normalizedUrl: null, host: null, error: 'Malformed URL provided.' }
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: null,
      host: null,
      error: `Unsupported scheme "${parsed.protocol}". Diagnostic endpoints must strictly use HTTPS.`
    }
  }

  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  ) {
    return {
      valid: false,
      normalizedUrl: null,
      host: null,
      error: 'Prohibited target: local, loopback, private-network, or link-local hosts are strictly barred.'
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    host: parsed.hostname
  }
}

// ============================================================================
// 2. WEATHER WMO CODE MAPPING & UNIT UTILITIES
// ============================================================================

export interface WmoCodeInterpretation {
  readonly description: string
  readonly iconName: string
}

/**
 * Maps standard World Meteorological Organization (WMO) weather interpretation codes (0–99).
 * Preserves truthfulness; never fabricates a condition description for unrecognized codes.
 */
export function interpretWmoWeatherCode(code: number): WmoCodeInterpretation {
  switch (code) {
    case 0:
      return { description: 'Clear sky', iconName: 'sun' }
    case 1:
      return { description: 'Mainly clear', iconName: 'sun-dim' }
    case 2:
      return { description: 'Partly cloudy', iconName: 'cloud-sun' }
    case 3:
      return { description: 'Overcast', iconName: 'cloud' }
    case 45:
      return { description: 'Fog', iconName: 'cloud-fog' }
    case 48:
      return { description: 'Depositing rime fog', iconName: 'cloud-fog' }
    case 51:
      return { description: 'Light drizzle', iconName: 'cloud-drizzle' }
    case 53:
      return { description: 'Moderate drizzle', iconName: 'cloud-drizzle' }
    case 55:
      return { description: 'Dense drizzle', iconName: 'cloud-drizzle' }
    case 56:
    case 57:
      return { description: 'Freezing drizzle', iconName: 'cloud-snow' }
    case 61:
      return { description: 'Slight rain', iconName: 'cloud-rain' }
    case 63:
      return { description: 'Moderate rain', iconName: 'cloud-rain' }
    case 65:
      return { description: 'Heavy rain', iconName: 'cloud-rain' }
    case 66:
    case 67:
      return { description: 'Freezing rain', iconName: 'cloud-snow' }
    case 71:
      return { description: 'Slight snow fall', iconName: 'snowflake' }
    case 73:
      return { description: 'Moderate snow fall', iconName: 'snowflake' }
    case 75:
      return { description: 'Heavy snow fall', iconName: 'snowflake' }
    case 77:
      return { description: 'Snow grains', iconName: 'snowflake' }
    case 80:
      return { description: 'Slight rain showers', iconName: 'cloud-rain' }
    case 81:
      return { description: 'Moderate rain showers', iconName: 'cloud-rain' }
    case 82:
      return { description: 'Violent rain showers', iconName: 'cloud-rain' }
    case 85:
      return { description: 'Slight snow showers', iconName: 'snowflake' }
    case 86:
      return { description: 'Heavy snow showers', iconName: 'snowflake' }
    case 95:
      return { description: 'Thunderstorm', iconName: 'cloud-lightning' }
    case 96:
    case 99:
      return { description: 'Thunderstorm with hail', iconName: 'cloud-lightning' }
    default:
      return { description: `Atmospheric condition (WMO code ${code})`, iconName: 'cloud' }
  }
}

/**
 * Converts Celsius to Fahrenheit.
 */
export function celsiusToFahrenheit(celsius: number): number {
  return Number(((celsius * 9) / 5 + 32).toFixed(1))
}

/**
 * Converts km/h to mph.
 */
export function kmhToMph(kmh: number): number {
  return Number((kmh * 0.621371).toFixed(1))
}

/**
 * Formats temperature according to preferred unit.
 */
export function formatTemperature(
  tempCelsius: number,
  unit: TemperatureUnit = 'celsius'
): { value: number; formatted: string } {
  if (unit === 'fahrenheit') {
    const f = celsiusToFahrenheit(tempCelsius)
    return { value: f, formatted: `${Math.round(f)}°F` }
  }
  return { value: Number(tempCelsius.toFixed(1)), formatted: `${Math.round(tempCelsius)}°C` }
}

/**
 * Formats wind speed according to preferred unit.
 */
export function formatWindSpeed(
  speedKmh: number,
  unit: WindSpeedUnit = 'kmh'
): { value: number; formatted: string } {
  if (unit === 'mph') {
    const m = kmhToMph(speedKmh)
    return { value: m, formatted: `${m} mph` }
  }
  return { value: Number(speedKmh.toFixed(1)), formatted: `${speedKmh} km/h` }
}

// ============================================================================
// 3. DEFAULT PREFERENCES
// ============================================================================

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  id: 'loc_london_uk',
  name: 'London',
  country: 'United Kingdom',
  countryCode: 'GB',
  region: 'England',
  coordinates: {
    latitude: 51.5074,
    longitude: -0.1278
  },
  timezone: 'Europe/London'
}

export const DEFAULT_WIDGET_PREFERENCES: WidgetPreferences = {
  systemHealth: {
    enabled: true,
    refreshIntervalMs: 10_000,
    showHelioxenProcessMetrics: true,
    memoryWarningThresholdPercent: 85,
    cpuWarningThresholdPercent: 90
  },
  networkMonitor: {
    enabled: true,
    selectedEndpointUrl: APPROVED_NETWORK_ENDPOINTS[0].url,
    timeoutMs: 5000,
    autoCheckOnWake: true
  },
  weather: {
    enabled: true,
    selectedLocation: DEFAULT_WEATHER_LOCATION,
    temperatureUnit: 'celsius',
    windSpeedUnit: 'kmh',
    refreshIntervalMs: 900_000 // 15 minutes
  },
  schemaVersion: WIDGETS_SCHEMA_VERSION,
  updatedAt: Date.now()
}

// ============================================================================
// 4. ZOD VALIDATION SCHEMAS
// ============================================================================

export const WeatherCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
})

export const WeatherLocationSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
  countryCode: z.string().min(1).max(10),
  region: z.string().max(120).optional(),
  coordinates: WeatherCoordinatesSchema,
  timezone: z.string().max(80).optional()
})

export const SystemHealthRequestSchema = z.object({
  sampleDurationMs: z.number().min(50).max(2000).optional()
})

export const RunNetworkDiagnosticRequestSchema = z.object({
  targetUrl: z.string().min(1).max(500).optional(),
  timeoutMs: z.number().min(1000).max(30000).optional()
})

export const SearchWeatherLocationsRequestSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().min(1).max(20).optional()
})

export const GetWeatherForecastRequestSchema = z.object({
  location: WeatherLocationSchema.optional(),
  temperatureUnit: z.enum(['celsius', 'fahrenheit']).optional(),
  windSpeedUnit: z.enum(['kmh', 'mph']).optional(),
  forceRefresh: z.boolean().optional()
})

export const UpdateWidgetPreferencesRequestSchema = z.object({
  systemHealth: z
    .object({
      enabled: z.boolean().optional(),
      refreshIntervalMs: z.number().min(2000).max(60000).optional(),
      showHelioxenProcessMetrics: z.boolean().optional(),
      memoryWarningThresholdPercent: z.number().min(50).max(99).optional(),
      cpuWarningThresholdPercent: z.number().min(50).max(99).optional()
    })
    .optional(),
  networkMonitor: z
    .object({
      enabled: z.boolean().optional(),
      selectedEndpointUrl: z.string().url().max(500).optional(),
      timeoutMs: z.number().min(1000).max(30000).optional(),
      autoCheckOnWake: z.boolean().optional()
    })
    .optional(),
  weather: z
    .object({
      enabled: z.boolean().optional(),
      selectedLocation: WeatherLocationSchema.optional(),
      temperatureUnit: z.enum(['celsius', 'fahrenheit']).optional(),
      windSpeedUnit: z.enum(['kmh', 'mph']).optional(),
      refreshIntervalMs: z.number().min(60000).max(86400000).optional(),
      apiKey: z.string().max(200).optional()
    })
    .optional()
})

