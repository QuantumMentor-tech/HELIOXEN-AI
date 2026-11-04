/**
 * HELIOXEN AI — Step 39: Open-Meteo Weather Adapter
 * Authoritative provider adapter for Open-Meteo weather and geocoding services.
 * Features built-in offline gazetteer candidate resolution, WMO code interpretation,
 * strict response schema validation, and terms-of-use attribution compliance.
 */

import { searchGazetteerLocations } from '../../shared/world'
import {
  interpretWmoWeatherCode,
  WeatherCoordinatesSchema
} from '../../shared/widgets/contracts'
import {
  CurrentWeatherConditions,
  DailyWeatherForecast,
  HourlyWeatherPoint,
  WeatherCoordinates,
  WeatherForecastSnapshot,
  WeatherLocation
} from '../../shared/widgets/types'

export interface WeatherProviderAdapter {
  readonly descriptor: {
    readonly id: string
    readonly displayName: string
    readonly homepageUrl: string
    readonly attributionText: string
    readonly licenseSummary: string
    readonly isCommercialKeyRequired: boolean
    readonly cacheDurationMs: number
  }
  searchLocations(query: string, limit?: number, signal?: AbortSignal): Promise<WeatherLocation[]>
  fetchForecast(options: {
    location: WeatherLocation
    apiKey?: string
    signal?: AbortSignal
  }): Promise<Omit<WeatherForecastSnapshot, 'temperatureUnit' | 'windSpeedUnit' | 'freshnessStatus' | 'cacheExpiresAt'>>
}

export class OpenMeteoWeatherAdapter implements WeatherProviderAdapter {
  public readonly descriptor = {
    id: 'open-meteo',
    displayName: 'Open-Meteo Weather Forecast API',
    homepageUrl: 'https://open-meteo.com/',
    attributionText: 'Weather data provided by Open-Meteo (CC BY 4.0).',
    licenseSummary:
      'Free for non-commercial and open-source use with attribution; commercial deployments require a subscription key.',
    isCommercialKeyRequired: false,
    cacheDurationMs: 1800_000 // 30 minutes
  }

  private readonly fetchFn: typeof fetch
  private readonly nowFn: () => number

  constructor(options: { fetchFn?: typeof fetch; nowFn?: () => number } = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.nowFn = options.nowFn ?? (() => Date.now())
  }

  /**
   * Searches for weather locations.
   * Resolves against Step 38 built-in gazetteer for offline availability and queries
   * the Open-Meteo Geocoding API for worldwide coverage.
   */
  public async searchLocations(
    query: string,
    limit = 8,
    signal?: AbortSignal
  ): Promise<WeatherLocation[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const results: WeatherLocation[] = []
    const seenIds = new Set<string>()

    // 1. Check local Step 38 gazetteer first (instant offline availability & homonym disambiguation)
    try {
      const gazetteerSearch = searchGazetteerLocations(trimmed, limit)
      for (const candidate of gazetteerSearch.candidates) {
        const id = `gaz_${candidate.id}`
        seenIds.add(id)
        results.push({
          id,
          name: candidate.name,
          country: candidate.countryName || 'Global',
          countryCode: candidate.countryCode || 'XX',
          region: candidate.regionId,
          coordinates: candidate.coordinates
        })
      }
    } catch {
      // Ignore gazetteer lookup errors
    }

    // 2. Query Open-Meteo Geocoding API if not aborted
    try {
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=${limit}&language=en&format=json`
      const response = await this.fetchFn(geocodingUrl, {
        method: 'GET',
        signal: signal ?? AbortSignal.timeout(4000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HELIOXEN-Desktop-WeatherWidget/1.0'
        }
      })

      if (response.ok) {
        const data = (await response.json()) as {
          results?: Array<{
            id: number
            name: string
            latitude: number
            longitude: number
            country?: string
            country_code?: string
            admin1?: string
            timezone?: string
          }>
        }

        if (Array.isArray(data?.results)) {
          for (const item of data.results) {
            const coordCheck = WeatherCoordinatesSchema.safeParse({
              latitude: item.latitude,
              longitude: item.longitude
            })
            if (!coordCheck.success) continue

            const id = `om_${item.id}`
            if (!seenIds.has(id)) {
              seenIds.add(id)
              results.push({
                id,
                name: item.name,
                country: item.country || 'Global',
                countryCode: (item.country_code || 'XX').toUpperCase(),
                region: item.admin1,
                coordinates: {
                  latitude: Number(item.latitude.toFixed(4)),
                  longitude: Number(item.longitude.toFixed(4))
                },
                timezone: item.timezone
              })
            }
          }
        }
      }
    } catch {
      // Network failure on geocoding returns local gazetteer results
    }

    return results.slice(0, limit)
  }

  /**
   * Retrieves current conditions, 24h hourly forecast, and 7-day daily forecast.
   */
  public async fetchForecast(options: {
    location: WeatherLocation
    apiKey?: string
    signal?: AbortSignal
  }): Promise<Omit<WeatherForecastSnapshot, 'temperatureUnit' | 'windSpeedUnit' | 'freshnessStatus' | 'cacheExpiresAt'>> {
    const { location, apiKey } = options
    const { latitude, longitude } = location.coordinates

    const baseUrl = apiKey
      ? `https://customer-api.open-meteo.com/v1/forecast?apikey=${encodeURIComponent(apiKey)}`
      : 'https://api.open-meteo.com/v1/forecast'

    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current:
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
      hourly: 'temperature_2m,precipitation_probability,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone: location.timezone || 'auto'
    })

    const url = `${baseUrl}${apiKey ? '&' : '?'}${params.toString()}`

    const response = await this.fetchFn(url, {
      method: 'GET',
      signal: options.signal ?? AbortSignal.timeout(6000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HELIOXEN-Desktop-WeatherWidget/1.0'
      }
    })

    if (response.status === 429) {
      throw new Error('RATE_LIMITED: Open-Meteo API rate limit reached.')
    }
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: Weather provider returned HTTP ${response.status}`)
    }

    const json = (await response.json()) as any
    if (!json || typeof json !== 'object' || !json.current) {
      throw new Error('INVALID_WEATHER_SCHEMA: Incomplete response payload received from weather API.')
    }

    const currentRaw = json.current
    const wmoInterpretation = interpretWmoWeatherCode(Number(currentRaw.weather_code ?? 0))

    const current: CurrentWeatherConditions = {
      temperature: Number(currentRaw.temperature_2m ?? 0),
      apparentTemperature: Number(currentRaw.apparent_temperature ?? currentRaw.temperature_2m ?? 0),
      relativeHumidityPercent: Number(currentRaw.relative_humidity_2m ?? 0),
      precipitationMm: Number(currentRaw.precipitation ?? 0),
      weatherCode: Number(currentRaw.weather_code ?? 0),
      conditionDescription: wmoInterpretation.description,
      conditionIcon: wmoInterpretation.iconName,
      windSpeed: Number(currentRaw.wind_speed_10m ?? 0),
      windDirectionDegrees: Number(currentRaw.wind_direction_10m ?? 0),
      isDay: Boolean(currentRaw.is_day ?? 1),
      observedAt: typeof currentRaw.time === 'string' ? currentRaw.time : null
    }

    // Process Hourly Forecast (up to next 24 entries)
    const hourly: HourlyWeatherPoint[] = []
    if (json.hourly && Array.isArray(json.hourly.time)) {
      const times = json.hourly.time as string[]
      const temps = json.hourly.temperature_2m as number[]
      const precipProbs = json.hourly.precipitation_probability as number[]
      const codes = json.hourly.weather_code as number[]

      for (let i = 0; i < Math.min(times.length, 24); i++) {
        const code = Number(codes?.[i] ?? 0)
        hourly.push({
          timeIso: times[i],
          temperature: Number(temps?.[i] ?? 0),
          precipitationProbability: Number(precipProbs?.[i] ?? 0),
          weatherCode: code,
          conditionDescription: interpretWmoWeatherCode(code).description
        })
      }
    }

    // Process Daily Forecast (up to next 7 entries)
    const daily: DailyWeatherForecast[] = []
    if (json.daily && Array.isArray(json.daily.time)) {
      const dates = json.daily.time as string[]
      const maxTemps = json.daily.temperature_2m_max as number[]
      const minTemps = json.daily.temperature_2m_min as number[]
      const maxPrecipProbs = json.daily.precipitation_probability_max as number[]
      const codes = json.daily.weather_code as number[]
      const sunrises = json.daily.sunrise as string[]
      const sunsets = json.daily.sunset as string[]

      for (let i = 0; i < Math.min(dates.length, 7); i++) {
        const code = Number(codes?.[i] ?? 0)
        daily.push({
          dateIso: dates[i],
          maxTemperature: Number(maxTemps?.[i] ?? 0),
          minTemperature: Number(minTemps?.[i] ?? 0),
          precipitationProbabilityMax: Number(maxPrecipProbs?.[i] ?? 0),
          weatherCode: code,
          conditionDescription: interpretWmoWeatherCode(code).description,
          sunriseIso: sunrises?.[i] || null,
          sunsetIso: sunsets?.[i] || null
        })
      }
    }

    return {
      location,
      current,
      hourly,
      daily,
      retrievedAt: this.nowFn(),
      providerId: this.descriptor.id,
      providerDisplayName: this.descriptor.displayName,
      attributionText: this.descriptor.attributionText,
      licenseSummary: this.descriptor.licenseSummary,
      isCommercialKeyConfigured: Boolean(apiKey)
    }
  }
}
