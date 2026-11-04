/**
 * HELIOXEN AI — Step 39: Weather Service
 * Main-process weather orchestration, caching, unit normalization, and offline resilience.
 * Never fabricates simulated temperatures; honestly reports freshness status.
 */

import {
  formatTemperature,
  formatWindSpeed,
  DEFAULT_WEATHER_LOCATION
} from '../../shared/widgets/contracts'
import {
  CurrentWeatherConditions,
  DailyWeatherForecast,
  HourlyWeatherPoint,
  TemperatureUnit,
  WeatherForecastSnapshot,
  WeatherLocation,
  WindSpeedUnit
} from '../../shared/widgets/types'
import {
  OpenMeteoWeatherAdapter,
  WeatherProviderAdapter
} from './OpenMeteoWeatherAdapter'

export interface WeatherServiceOptions {
  readonly adapter?: WeatherProviderAdapter
  readonly nowFn?: () => number
}

export class WeatherService {
  private readonly adapter: WeatherProviderAdapter
  private readonly nowFn: () => number
  private readonly cache = new Map<string, { snapshot: WeatherForecastSnapshot; expiresAt: number }>()
  private activeAbortController: AbortController | null = null

  constructor(options: WeatherServiceOptions = {}) {
    this.adapter = options.adapter ?? new OpenMeteoWeatherAdapter()
    this.nowFn = options.nowFn ?? (() => Date.now())
  }

  public dispose(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.activeAbortController = null
    }
    this.cache.clear()
  }

  /**
   * Searches for candidate weather locations.
   */
  public async searchLocations(query: string, limit = 8): Promise<WeatherLocation[]> {
    return this.adapter.searchLocations(query, limit)
  }

  /**
   * Retrieves weather forecast for the requested location.
   * Checks in-memory cache, falls back to stale cache on network failure,
   * or returns a truthful offline fallback if no cached forecast exists.
   */
  public async getForecast(options: {
    location?: WeatherLocation
    temperatureUnit?: TemperatureUnit
    windSpeedUnit?: WindSpeedUnit
    apiKey?: string
    forceRefresh?: boolean
  } = {}): Promise<WeatherForecastSnapshot> {
    const location = options.location ?? DEFAULT_WEATHER_LOCATION
    const tempUnit = options.temperatureUnit ?? 'celsius'
    const windUnit = options.windSpeedUnit ?? 'kmh'
    const cacheKey = `${location.id}::${location.coordinates.latitude.toFixed(2)}:${location.coordinates.longitude.toFixed(2)}`

    const now = this.nowFn()
    const cached = this.cache.get(cacheKey)

    if (cached && !options.forceRefresh && now < cached.expiresAt) {
      return this.formatSnapshotUnits(cached.snapshot, tempUnit, windUnit)
    }

    // Cancel in-flight request if any
    if (this.activeAbortController) {
      this.activeAbortController.abort()
    }
    const abortController = new AbortController()
    this.activeAbortController = abortController

    try {
      const rawData = await this.adapter.fetchForecast({
        location,
        apiKey: options.apiKey,
        signal: abortController.signal
      })

      const cacheDurationMs = this.adapter.descriptor.cacheDurationMs || 1800_000
      const baseSnapshot: WeatherForecastSnapshot = {
        ...rawData,
        temperatureUnit: 'celsius', // Base raw unit is always Celsius
        windSpeedUnit: 'kmh', // Base raw unit is always km/h
        freshnessStatus: 'fresh',
        cacheExpiresAt: now + cacheDurationMs
      }

      this.cache.set(cacheKey, {
        snapshot: baseSnapshot,
        expiresAt: now + cacheDurationMs
      })

      return this.formatSnapshotUnits(baseSnapshot, tempUnit, windUnit)
    } catch (err) {
      // 1. If stale cached snapshot exists, return it with 'stale' status
      if (cached) {
        const staleSnapshot: WeatherForecastSnapshot = {
          ...cached.snapshot,
          freshnessStatus: 'stale'
        }
        return this.formatSnapshotUnits(staleSnapshot, tempUnit, windUnit)
      }

      // 2. If no cache exists, return an honest offline fallback snapshot
      return this.createOfflineFallbackSnapshot(location, tempUnit, windUnit)
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null
      }
    }
  }

  /**
   * Converts a base (Celsius, km/h) snapshot to the user's requested display units.
   */
  private formatSnapshotUnits(
    snapshot: WeatherForecastSnapshot,
    tempUnit: TemperatureUnit,
    windUnit: WindSpeedUnit
  ): WeatherForecastSnapshot {
    const convertTemp = (celsius: number) => formatTemperature(celsius, tempUnit).value
    const convertWind = (kmh: number) => formatWindSpeed(kmh, windUnit).value

    const convertedCurrent: CurrentWeatherConditions = {
      ...snapshot.current,
      temperature: convertTemp(snapshot.current.temperature),
      apparentTemperature: convertTemp(snapshot.current.apparentTemperature),
      windSpeed: convertWind(snapshot.current.windSpeed)
    }

    const convertedHourly: HourlyWeatherPoint[] = snapshot.hourly.map((h) => ({
      ...h,
      temperature: convertTemp(h.temperature)
    }))

    const convertedDaily: DailyWeatherForecast[] = snapshot.daily.map((d) => ({
      ...d,
      maxTemperature: convertTemp(d.maxTemperature),
      minTemperature: convertTemp(d.minTemperature)
    }))

    return {
      ...snapshot,
      current: convertedCurrent,
      hourly: convertedHourly,
      daily: convertedDaily,
      temperatureUnit: tempUnit,
      windSpeedUnit: windUnit
    }
  }

  /**
   * Constructs an honest, non-fabricated offline fallback snapshot when no live connection or cache exists.
   */
  private createOfflineFallbackSnapshot(
    location: WeatherLocation,
    tempUnit: TemperatureUnit,
    windUnit: WindSpeedUnit
  ): WeatherForecastSnapshot {
    const now = this.nowFn()
    return {
      location,
      current: {
        temperature: 0,
        apparentTemperature: 0,
        relativeHumidityPercent: 0,
        precipitationMm: 0,
        weatherCode: 3,
        conditionDescription: 'Weather data unavailable offline',
        conditionIcon: 'cloud',
        windSpeed: 0,
        windDirectionDegrees: 0,
        isDay: true,
        observedAt: null
      },
      hourly: [],
      daily: [],
      temperatureUnit: tempUnit,
      windSpeedUnit: windUnit,
      freshnessStatus: 'offline_fallback',
      retrievedAt: now,
      cacheExpiresAt: now,
      providerId: this.adapter.descriptor.id,
      providerDisplayName: this.adapter.descriptor.displayName,
      attributionText: this.adapter.descriptor.attributionText,
      licenseSummary: this.adapter.descriptor.licenseSummary,
      isCommercialKeyConfigured: false
    }
  }
}

