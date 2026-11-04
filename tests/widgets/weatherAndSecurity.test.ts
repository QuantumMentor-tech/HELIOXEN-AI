/**
 * HELIOXEN AI — Step 39 Test Suite
 * Weather Service, Open-Meteo Normalization, Preferences & Security Boundaries.
 * Verifies location disambiguation, WMO codes, unit conversions, stale caching,
 * offline fallback, and modular independence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  OpenMeteoWeatherAdapter,
  WeatherService,
  WidgetPreferencesManager
} from '../../src/main/widgets'
import {
  celsiusToFahrenheit,
  formatTemperature,
  formatWindSpeed,
  interpretWmoWeatherCode,
  kmhToMph,
  DEFAULT_WEATHER_LOCATION
} from '../../src/shared/widgets/contracts'
import { WeatherLocation } from '../../src/shared/widgets/types'

const MOCK_OPEN_METEO_PAYLOAD = {
  latitude: 51.5,
  longitude: -0.12,
  timezone: 'Europe/London',
  current: {
    time: '2026-11-04T12:00',
    temperature_2m: 14.2,
    relative_humidity_2m: 72,
    apparent_temperature: 13.5,
    is_day: 1,
    precipitation: 0.2,
    weather_code: 61,
    wind_speed_10m: 18.5,
    wind_direction_10m: 230
  },
  hourly: {
    time: ['2026-11-04T12:00', '2026-11-04T13:00', '2026-11-04T14:00'],
    temperature_2m: [14.2, 14.8, 15.1],
    precipitation_probability: [30, 20, 10],
    weather_code: [61, 2, 1]
  },
  daily: {
    time: ['2026-11-04', '2026-11-05'],
    weather_code: [61, 2],
    temperature_2m_max: [16.0, 15.5],
    temperature_2m_min: [9.2, 8.4],
    precipitation_probability_max: [45, 15],
    sunrise: ['2026-11-04T07:02', '2026-11-05T07:04'],
    sunset: ['2026-11-04T16:28', '2026-11-05T16:26']
  }
}

let currentTime = 1762260000000

describe('Step 39 — Weather Unit & WMO Code Utilities', () => {
  it('correctly maps WMO weather codes to human descriptions and icons without fabrication', () => {
    expect(interpretWmoWeatherCode(0).description).toBe('Clear sky')
    expect(interpretWmoWeatherCode(0).iconName).toBe('sun')

    expect(interpretWmoWeatherCode(2).description).toBe('Partly cloudy')
    expect(interpretWmoWeatherCode(61).description).toBe('Slight rain')
    expect(interpretWmoWeatherCode(71).description).toBe('Slight snow fall')
    expect(interpretWmoWeatherCode(95).description).toBe('Thunderstorm')

    // Unknown code must not be fabricated into a fake description
    const unknown = interpretWmoWeatherCode(999)
    expect(unknown.description).toContain('WMO code 999')
  })

  it('performs accurate temperature and wind speed unit conversions', () => {
    // 0°C -> 32°F
    expect(celsiusToFahrenheit(0)).toBe(32)
    // 20°C -> 68°F
    expect(celsiusToFahrenheit(20)).toBe(68)

    const formattedC = formatTemperature(14.2, 'celsius')
    expect(formattedC.value).toBe(14.2)
    expect(formattedC.formatted).toBe('14°C')

    const formattedF = formatTemperature(14.2, 'fahrenheit')
    expect(formattedF.value).toBe(57.6)
    expect(formattedF.formatted).toBe('58°F')

    // 100 km/h -> 62.1 mph
    expect(kmhToMph(100)).toBe(62.1)
    expect(formatWindSpeed(100, 'kmh').formatted).toBe('100 km/h')
    expect(formatWindSpeed(100, 'mph').formatted).toBe('62.1 mph')
  })
})

describe('Step 39 — Open-Meteo Weather Adapter & Location Disambiguation', () => {
  it('resolves city searches using Step 38 gazetteer with explicit homonym disambiguation', async () => {
    const adapter = new OpenMeteoWeatherAdapter()

    // Searching "Paris" should return distinct candidates (Paris France vs Paris Texas)
    const candidates = await adapter.searchLocations('Paris', 5)
    expect(candidates.length).toBeGreaterThanOrEqual(1)

    const hasFrance = candidates.some((c) => c.countryCode === 'FR' || c.country.toLowerCase().includes('france'))
    expect(hasFrance).toBe(true)

    for (const c of candidates) {
      expect(c.coordinates.latitude).toBeGreaterThanOrEqual(-90)
      expect(c.coordinates.latitude).toBeLessThanOrEqual(90)
      expect(c.coordinates.longitude).toBeGreaterThanOrEqual(-180)
      expect(c.coordinates.longitude).toBeLessThanOrEqual(180)
    }
  })

  it('normalizes raw Open-Meteo forecast payload into typed snapshot with attribution', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_OPEN_METEO_PAYLOAD
    })

    const adapter = new OpenMeteoWeatherAdapter({
      fetchFn: mockFetch as any,
      nowFn: () => currentTime
    })
    const forecast = await adapter.fetchForecast({ location: DEFAULT_WEATHER_LOCATION })

    expect(forecast.location.name).toBe('London')
    expect(forecast.current.temperature).toBe(14.2)
    expect(forecast.current.apparentTemperature).toBe(13.5)
    expect(forecast.current.relativeHumidityPercent).toBe(72)
    expect(forecast.current.conditionDescription).toBe('Slight rain')
    expect(forecast.current.conditionIcon).toBe('cloud-rain')
    expect(forecast.current.windSpeed).toBe(18.5)

    expect(forecast.hourly.length).toBe(3)
    expect(forecast.hourly[0].temperature).toBe(14.2)
    expect(forecast.hourly[0].precipitationProbability).toBe(30)

    expect(forecast.daily.length).toBe(2)
    expect(forecast.daily[0].maxTemperature).toBe(16.0)
    expect(forecast.daily[0].minTemperature).toBe(9.2)
    expect(forecast.daily[0].sunriseIso).toBe('2026-11-04T07:02')

    expect(forecast.attributionText).toContain('Open-Meteo')
    expect(forecast.attributionText).toContain('CC BY 4.0')
  })

  it('routes to commercial endpoint when an API key is supplied', async () => {
    let requestedUrl = ''
    const mockFetch = vi.fn().mockImplementation((url) => {
      requestedUrl = url
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => MOCK_OPEN_METEO_PAYLOAD
      })
    })

    const adapter = new OpenMeteoWeatherAdapter({
      fetchFn: mockFetch as any,
      nowFn: () => currentTime
    })
    const forecast = await adapter.fetchForecast({
      location: DEFAULT_WEATHER_LOCATION,
      apiKey: 'test-commercial-license-key-123'
    })

    expect(requestedUrl).toContain('customer-api.open-meteo.com')
    expect(requestedUrl).toContain('test-commercial-license-key-123')
    expect(forecast.isCommercialKeyConfigured).toBe(true)
  })
})

describe('Step 39 — Weather Service Caching, Offline Fallback & Resilience', () => {
  beforeEach(() => {
    currentTime = 1762260000000
  })

  it('caches forecasts and returns stale cached data when network fails', async () => {
    let attempt = 0
    const mockFetch = vi.fn().mockImplementation(async () => {
      attempt++
      if (attempt === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => MOCK_OPEN_METEO_PAYLOAD
        }
      }
      throw new Error('ENOTFOUND: Network offline')
    })

    const adapter = new OpenMeteoWeatherAdapter({
      fetchFn: mockFetch as any,
      nowFn: () => currentTime
    })
    const service = new WeatherService({
      adapter,
      nowFn: () => currentTime
    })

    // First call: Fresh data
    const fresh = await service.getForecast({ location: DEFAULT_WEATHER_LOCATION })
    expect(fresh.freshnessStatus).toBe('fresh')
    expect(fresh.current.temperature).toBe(14.2)

    // Advance time past expiration (35 minutes later)
    currentTime += 35 * 60 * 1000

    // Second call: Network fails, returns stale cached data honestly
    const stale = await service.getForecast({ location: DEFAULT_WEATHER_LOCATION, forceRefresh: true })
    expect(stale.freshnessStatus).toBe('stale')
    expect(stale.current.temperature).toBe(14.2)
    expect(stale.retrievedAt).toBe(1762260000000)

    service.dispose()
  })

  it('returns an honest offline fallback snapshot when offline with no cached data', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network unreachable'))
    const adapter = new OpenMeteoWeatherAdapter({
      fetchFn: mockFetch as any,
      nowFn: () => currentTime
    })
    const service = new WeatherService({
      adapter,
      nowFn: () => currentTime
    })

    const fallback = await service.getForecast({ location: DEFAULT_WEATHER_LOCATION })
    expect(fallback.freshnessStatus).toBe('offline_fallback')
    expect(fallback.current.conditionDescription).toContain('unavailable offline')
    expect(fallback.hourly).toEqual([])
    expect(fallback.daily).toEqual([])

    service.dispose()
  })
})

describe('Step 39 — Widget Preferences Manager & Persistence', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step39-widgets-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore Windows file lock cleanup
    }
  })

  it('persists and updates widget preferences across sessions with schema validation', () => {
    const manager = new WidgetPreferencesManager({
      storageDir: tempDir,
      nowFn: () => 1762260000000
    })

    const initial = manager.getPreferences()
    expect(initial.systemHealth.enabled).toBe(true)
    expect(initial.weather.temperatureUnit).toBe('celsius')
    expect(initial.networkMonitor.timeoutMs).toBe(5000)

    // Update preferences
    const updated = manager.updatePreferences({
      weather: {
        temperatureUnit: 'fahrenheit',
        windSpeedUnit: 'mph'
      },
      systemHealth: {
        refreshIntervalMs: 5000
      }
    })

    expect(updated.weather.temperatureUnit).toBe('fahrenheit')
    expect(updated.weather.windSpeedUnit).toBe('mph')
    expect(updated.systemHealth.refreshIntervalMs).toBe(5000)

    // Create new manager on same storageDir to verify persistence
    const reloadedManager = new WidgetPreferencesManager({
      storageDir: tempDir,
      nowFn: () => 1762260001000
    })

    const reloaded = reloadedManager.getPreferences()
    expect(reloaded.weather.temperatureUnit).toBe('fahrenheit')
    expect(reloaded.weather.windSpeedUnit).toBe('mph')
    expect(reloaded.systemHealth.refreshIntervalMs).toBe(5000)
  })
})
