/**
 * HELIOXEN AI — Step 39: System Health, Network Monitoring, and Weather Widgets
 * Shared Domain Types and Contracts.
 * Enforces explicit metric distinction, bounded network testing, and honest weather data modeling.
 */

// ============================================================================
// 1. SYSTEM HEALTH TYPES
// ============================================================================

export type MetricAvailabilityStatus = 'available' | 'sampling' | 'unavailable' | 'unsupported'

export interface HostSystemMetrics {
  readonly totalMemoryBytes: number
  readonly freeMemoryBytes: number
  readonly usedMemoryBytes: number
  readonly memoryUsagePercent: number
  readonly systemUptimeSeconds: number
  readonly cpuUtilizationPercent: number
  readonly logicalCores: number
  readonly platform: string
  readonly release: string
  readonly arch: string
  readonly status: MetricAvailabilityStatus
  readonly error?: string
}

export type ApplicationProcessHealthStatus = 'nominal' | 'elevated' | 'high'

export interface HelioxenProcessMetrics {
  readonly pid: number
  readonly processUptimeSeconds: number
  readonly cpuUtilizationPercent: number
  readonly memoryRssBytes: number
  readonly heapTotalBytes: number
  readonly heapUsedBytes: number
  readonly healthStatus: ApplicationProcessHealthStatus
  readonly healthAssessment: string
  readonly status: MetricAvailabilityStatus
}

export type PowerSourceType = 'ac_power' | 'battery' | 'unknown'
export type ThermalState = 'nominal' | 'fair' | 'serious' | 'critical' | 'unsupported'

export interface PowerAndSensorMetrics {
  readonly powerSource: PowerSourceType
  readonly onBattery: boolean
  readonly isCharging: boolean | null
  readonly batterySupported: boolean
  readonly thermalState: ThermalState
  readonly thermalStateSupported: boolean
  readonly thermalNote: string
  readonly fanSpeedRpm: {
    readonly value: number | null
    readonly status: 'unsupported'
    readonly note: string
  }
  readonly gpuTemperatureCelsius: {
    readonly value: number | null
    readonly status: 'unsupported'
    readonly note: string
  }
}

export interface PrimaryStorageMetric {
  readonly driveOrVolume: string
  readonly totalBytes: number
  readonly availableBytes: number
  readonly usedBytes: number
  readonly usagePercent: number
  readonly status: MetricAvailabilityStatus
  readonly error?: string
}

export interface SystemHealthSnapshot {
  readonly acquiredAt: number
  readonly host: HostSystemMetrics
  readonly helioxenProcess: HelioxenProcessMetrics
  readonly powerAndSensors: PowerAndSensorMetrics
  readonly storage: PrimaryStorageMetric
  readonly samplingIntervalMs: number
}

// ============================================================================
// 2. NETWORK MONITOR TYPES
// ============================================================================

export type DiagnosticResultStatus =
  | 'success'
  | 'http_error'
  | 'timeout'
  | 'dns_or_network_error'
  | 'cancelled'
  | 'unsupported'

export interface LocalConnectivityStatus {
  readonly isOnline: boolean
  readonly checkedAt: number
  readonly networkType: string
}

export interface ApprovedNetworkEndpoint {
  readonly id: string
  readonly name: string
  readonly url: string
  readonly description: string
  readonly isDefault?: boolean
}

export interface NetworkDiagnosticResult {
  readonly testId: string
  readonly targetUrl: string
  readonly targetHost: string
  readonly status: DiagnosticResultStatus
  readonly statusCode: number | null
  readonly roundTripTimeMs: number | null
  readonly startedAt: number
  readonly completedAt: number
  readonly errorMessage: string | null
  readonly diagnosticBasis: string
  readonly disclaimer: string
}

export interface NetworkStatusSnapshot {
  readonly connectivity: LocalConnectivityStatus
  readonly lastDiagnostic: NetworkDiagnosticResult | null
  readonly approvedEndpoints: readonly ApprovedNetworkEndpoint[]
  readonly selectedEndpointUrl: string
  readonly isTesting: boolean
}

// ============================================================================
// 3. WEATHER TYPES
// ============================================================================

export type TemperatureUnit = 'celsius' | 'fahrenheit'
export type WindSpeedUnit = 'kmh' | 'mph'
export type WeatherFreshnessStatus = 'fresh' | 'cached' | 'stale' | 'offline_fallback'

export interface WeatherCoordinates {
  readonly latitude: number
  readonly longitude: number
}

export interface WeatherLocation {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly countryCode: string
  readonly region?: string
  readonly coordinates: WeatherCoordinates
  readonly timezone?: string
}

export interface CurrentWeatherConditions {
  readonly temperature: number
  readonly apparentTemperature: number
  readonly relativeHumidityPercent: number
  readonly precipitationMm: number
  readonly weatherCode: number
  readonly conditionDescription: string
  readonly conditionIcon: string
  readonly windSpeed: number
  readonly windDirectionDegrees: number
  readonly isDay: boolean
  readonly observedAt: string | null
}

export interface HourlyWeatherPoint {
  readonly timeIso: string
  readonly temperature: number
  readonly precipitationProbability: number
  readonly weatherCode: number
  readonly conditionDescription: string
}

export interface DailyWeatherForecast {
  readonly dateIso: string
  readonly maxTemperature: number
  readonly minTemperature: number
  readonly precipitationProbabilityMax: number
  readonly weatherCode: number
  readonly conditionDescription: string
  readonly sunriseIso: string | null
  readonly sunsetIso: string | null
}

export interface WeatherForecastSnapshot {
  readonly location: WeatherLocation
  readonly current: CurrentWeatherConditions
  readonly hourly: readonly HourlyWeatherPoint[]
  readonly daily: readonly DailyWeatherForecast[]
  readonly temperatureUnit: TemperatureUnit
  readonly windSpeedUnit: WindSpeedUnit
  readonly freshnessStatus: WeatherFreshnessStatus
  readonly retrievedAt: number
  readonly cacheExpiresAt: number
  readonly providerId: string
  readonly providerDisplayName: string
  readonly attributionText: string
  readonly licenseSummary: string
  readonly isCommercialKeyConfigured: boolean
}

// ============================================================================
// 4. PREFERENCES & CONFIGURATION TYPES
// ============================================================================

export interface SystemHealthPreferences {
  readonly enabled: boolean
  readonly refreshIntervalMs: number // e.g. 5000, 10000, 30000
  readonly showHelioxenProcessMetrics: boolean
  readonly memoryWarningThresholdPercent: number // e.g. 85
  readonly cpuWarningThresholdPercent: number // e.g. 90
}

export interface NetworkMonitorPreferences {
  readonly enabled: boolean
  readonly selectedEndpointUrl: string
  readonly timeoutMs: number // e.g. 5000
  readonly autoCheckOnWake: boolean
}

export interface WeatherPreferences {
  readonly enabled: boolean
  readonly selectedLocation: WeatherLocation
  readonly temperatureUnit: TemperatureUnit
  readonly windSpeedUnit: WindSpeedUnit
  readonly refreshIntervalMs: number // e.g. 900_000 (15 min)
  readonly apiKey?: string
}

export interface WidgetPreferences {
  readonly systemHealth: SystemHealthPreferences
  readonly networkMonitor: NetworkMonitorPreferences
  readonly weather: WeatherPreferences
  readonly schemaVersion: number
  readonly updatedAt: number
}

