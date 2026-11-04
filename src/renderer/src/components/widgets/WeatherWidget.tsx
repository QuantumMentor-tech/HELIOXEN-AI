/**
 * HELIOXEN AI — Step 39: Weather Widget
 * Current weather conditions, 24h hourly strip, and 7-day forecast.
 * Powered by Open-Meteo with offline gazetteer disambiguation, truthful freshness,
 * and zero silent device geolocation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Cloud,
  CloudSun,
  Sun,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  MapPin,
  Search,
  RefreshCw,
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import {
  DEFAULT_WEATHER_LOCATION
} from '../../../../shared/widgets/contracts'
import {
  TemperatureUnit,
  WeatherForecastSnapshot,
  WeatherLocation,
  WindSpeedUnit
} from '../../../../shared/widgets/types'

export interface WeatherWidgetProps {
  className?: string
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  className = ''
}) => {
  const [forecast, setForecast] = useState<WeatherForecastSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>('celsius')
  const [windUnit, setWindUnit] = useState<WindSpeedUnit>('kmh')
  const [activeLocation, setActiveLocation] = useState<WeatherLocation>(DEFAULT_WEATHER_LOCATION)

  // Location search state
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const isMountedRef = useRef<boolean>(true)

  const fetchForecast = useCallback(
    async (loc: WeatherLocation = activeLocation, force = false) => {
      setIsLoading(true)
      setError(null)
      try {
        if (typeof window !== 'undefined' && window.helioxen?.widgets) {
          const data = await window.helioxen.widgets.getWeatherForecast({
            location: loc,
            temperatureUnit: tempUnit,
            windSpeedUnit: windUnit,
            forceRefresh: force
          })
          if (isMountedRef.current) {
            setForecast(data)
          }
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    },
    [activeLocation, tempUnit, windUnit]
  )

  useEffect(() => {
    isMountedRef.current = true
    fetchForecast(activeLocation, false)
    return () => {
      isMountedRef.current = false
    }
  }, [fetchForecast, activeLocation, tempUnit, windUnit])

  // Search locations with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        if (typeof window !== 'undefined' && window.helioxen?.widgets) {
          const candidates = await window.helioxen.widgets.searchWeatherLocations(searchQuery, 6)
          if (isMountedRef.current) {
            setSearchResults(candidates)
          }
        }
      } catch {
        // Ignore search errors
      } finally {
        if (isMountedRef.current) {
          setIsSearching(false)
        }
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const getWeatherIcon = (iconName: string, className = 'w-6 h-6') => {
    switch (iconName) {
      case 'sun':
      case 'sun-dim':
        return <Sun className={`${className} text-hx-warning`} />
      case 'cloud-sun':
        return <CloudSun className={`${className} text-hx-cyan`} />
      case 'cloud-rain':
        return <CloudRain className={`${className} text-hx-cyan`} />
      case 'cloud-drizzle':
        return <CloudDrizzle className={`${className} text-hx-cyan`} />
      case 'cloud-snow':
      case 'snowflake':
        return <Snowflake className={`${className} text-hx-nominal`} />
      case 'cloud-lightning':
        return <CloudLightning className={`${className} text-hx-critical`} />
      case 'cloud-fog':
        return <CloudFog className={`${className} text-hx-text-muted`} />
      default:
        return <Cloud className={`${className} text-hx-text-secondary`} />
    }
  }

  const handleSelectLocation = (loc: WeatherLocation) => {
    setActiveLocation(loc)
    setIsSearchingLocation(false)
    setSearchQuery('')
    setSearchResults([])
    fetchForecast(loc, true)
  }

  const current = forecast?.current
  const loc = forecast?.location ?? activeLocation

  return (
    <Card variant="panel" border="glow" padding="md" className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hx-border-panel/70 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-hx-md bg-hx-surface border border-hx-border-glow text-hx-cyan">
            <CloudSun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center gap-2">
              Weather Intelligence
            </h3>
            <p className="text-[11px] text-hx-text-secondary">
              Open-Meteo forecasts and local observation metrics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Unit Toggle */}
          <div className="flex items-center bg-hx-surface rounded border border-hx-border-subtle p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setTempUnit('celsius')}
              className={`px-1.5 py-0.5 rounded ${tempUnit === 'celsius' ? 'bg-hx-panel text-hx-cyan font-bold' : 'text-hx-text-muted'}`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setTempUnit('fahrenheit')}
              className={`px-1.5 py-0.5 rounded ${tempUnit === 'fahrenheit' ? 'bg-hx-panel text-hx-cyan font-bold' : 'text-hx-text-muted'}`}
            >
              °F
            </button>
          </div>

          <IconButton
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-hx-cyan' : ''}`} />}
            aria-label="Refresh Weather Forecast"
            title="Refresh Forecast"
            size="sm"
            variant="ghost"
            onClick={() => fetchForecast(activeLocation, true)}
            disabled={isLoading}
          />
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-hx-md bg-hx-critical/10 border border-hx-critical/30 text-hx-critical text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Location Selector Bar */}
      <div className="flex items-center justify-between bg-hx-surface/60 border border-hx-border-subtle rounded-hx-md px-3 py-2 text-xs">
        <div className="flex items-center space-x-2 truncate">
          <MapPin className="w-3.5 h-3.5 text-hx-cyan shrink-0" />
          <span className="font-semibold text-hx-text-primary truncate">
            {loc.name}, {loc.country}
          </span>
          {loc.region && <span className="text-[10px] text-hx-text-muted truncate">({loc.region})</span>}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsSearchingLocation((prev) => !prev)}
          leftIcon={<Search className="w-3 h-3" />}
        >
          {isSearchingLocation ? 'Close' : 'Change City'}
        </Button>
      </div>

      {/* Location Search Dropdown Panel */}
      {isSearchingLocation && (
        <div className="p-3 rounded-hx-md bg-hx-panel border border-hx-border-subtle space-y-2 animate-hx-fade-in">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city or country (e.g. Paris, Tokyo, New York)..."
              className="w-full text-xs bg-hx-surface text-hx-text-primary border border-hx-border-subtle rounded-hx-md pl-8 pr-3 py-2 outline-none focus:border-hx-cyan"
              autoFocus
            />
            <Search className="w-3.5 h-3.5 text-hx-text-muted absolute left-2.5 top-2.5" />
          </div>

          {isSearching && (
            <div className="text-[11px] text-hx-text-muted italic py-1 text-center">
              Searching cities and gazetteer...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-hx-border-subtle/40 rounded border border-hx-border-subtle/50">
              {searchResults.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => handleSelectLocation(cand)}
                  className="w-full text-left px-3 py-2 hover:bg-hx-surface/80 flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <span className="font-medium text-hx-text-primary">{cand.name}</span>
                    <span className="text-hx-text-muted ml-1.5 text-[11px]">
                      {cand.region ? `${cand.region}, ` : ''}{cand.country}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-hx-text-muted">
                    {cand.coordinates.latitude.toFixed(1)}°, {cand.coordinates.longitude.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="text-[10px] text-hx-text-muted italic flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-hx-cyan shrink-0" />
            Location is strictly user-selected. HELIOXEN never uses hidden device geolocation.
          </p>
        </div>
      )}

      {/* Current Conditions Card */}
      {current && (
        <div className="p-4 rounded-hx-md bg-hx-panel/70 border border-hx-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getWeatherIcon(current.conditionIcon, 'w-10 h-10')}
              <div>
                <div className="text-3xl font-display font-bold text-hx-text-primary">
                  {Math.round(current.temperature)}°{tempUnit === 'celsius' ? 'C' : 'F'}
                </div>
                <div className="text-xs text-hx-text-secondary capitalize font-medium">
                  {current.conditionDescription}
                </div>
              </div>
            </div>

            <div className="text-right text-xs space-y-1">
              <div className="text-hx-text-secondary font-mono">
                Feels like: <span className="font-bold text-hx-text-primary">{Math.round(current.apparentTemperature)}°</span>
              </div>
              {forecast?.daily?.[0] && (
                <div className="text-[11px] font-mono text-hx-text-muted">
                  H: {Math.round(forecast.daily[0].maxTemperature)}° • L: {Math.round(forecast.daily[0].minTemperature)}°
                </div>
              )}
            </div>
          </div>

          {/* Condition Details Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-hx-border-subtle/50">
            <div className="p-1.5 rounded bg-hx-surface/50">
              <span className="text-[10px] text-hx-text-muted uppercase font-mono block">Humidity</span>
              <span className="font-semibold text-hx-text-primary mt-0.5 inline-flex items-center gap-1">
                <Droplets className="w-3 h-3 text-hx-cyan" />
                {current.relativeHumidityPercent}%
              </span>
            </div>
            <div className="p-1.5 rounded bg-hx-surface/50">
              <span className="text-[10px] text-hx-text-muted uppercase font-mono block">Wind</span>
              <span className="font-semibold text-hx-text-primary mt-0.5 inline-flex items-center gap-1">
                <Wind className="w-3 h-3 text-hx-cyan" />
                {current.windSpeed} {windUnit}
              </span>
            </div>
            <div className="p-1.5 rounded bg-hx-surface/50">
              <span className="text-[10px] text-hx-text-muted uppercase font-mono block">Precipitation</span>
              <span className="font-semibold text-hx-text-primary mt-0.5">
                {current.precipitationMm} mm
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 24-Hour Hourly Forecast Strip */}
      {forecast && forecast.hourly.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-hx-cyan font-semibold block">
            Hourly Forecast (Next 24h)
          </span>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
            {forecast.hourly.slice(0, 14).map((hour, idx) => {
              const timeLabel = hour.timeIso.includes('T')
                ? hour.timeIso.split('T')[1].slice(0, 5)
                : `${idx}:00`
              return (
                <div
                  key={hour.timeIso}
                  className="shrink-0 w-14 p-2 rounded-hx-sm bg-hx-surface/60 border border-hx-border-subtle/70 text-center text-xs space-y-1"
                >
                  <span className="text-[10px] font-mono text-hx-text-muted block">{timeLabel}</span>
                  <div className="flex justify-center">{getWeatherIcon(hour.conditionDescription.toLowerCase().includes('rain') ? 'cloud-rain' : 'cloud-sun', 'w-4 h-4')}</div>
                  <span className="font-mono font-semibold text-hx-text-primary text-[11px] block">
                    {Math.round(hour.temperature)}°
                  </span>
                  {hour.precipitationProbability > 0 && (
                    <span className="text-[9px] text-hx-cyan font-mono block">
                      {hour.precipitationProbability}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 7-Day Forecast List */}
      {forecast && forecast.daily.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-hx-border-subtle/50">
          <span className="text-[10px] font-mono uppercase tracking-wider text-hx-cyan font-semibold block">
            7-Day Outlook
          </span>
          <div className="space-y-1 divide-y divide-hx-border-subtle/30 text-xs">
            {forecast.daily.map((day) => {
              const dateObj = new Date(day.dateIso)
              const dayName = isNaN(dateObj.getTime())
                ? day.dateIso
                : dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={day.dateIso} className="flex items-center justify-between py-1.5">
                  <span className="font-medium text-hx-text-primary w-28 truncate">{dayName}</span>
                  <div className="flex items-center space-x-1.5 flex-1 justify-center">
                    {getWeatherIcon(day.conditionDescription.toLowerCase().includes('rain') ? 'cloud-rain' : 'sun', 'w-3.5 h-3.5')}
                    <span className="text-[11px] text-hx-text-secondary truncate max-w-[120px]">
                      {day.conditionDescription}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] space-x-2 text-right">
                    <span className="text-hx-text-primary font-semibold">{Math.round(day.maxTemperature)}°</span>
                    <span className="text-hx-text-muted">{Math.round(day.minTemperature)}°</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Freshness & Attribution Footer */}
      <div className="pt-2 border-t border-hx-border-subtle/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-hx-text-muted">
        <span>{forecast?.attributionText || 'Open-Meteo Weather API'}</span>
        <Badge
          variant={
            forecast?.freshnessStatus === 'fresh'
              ? 'nominal'
              : forecast?.freshnessStatus === 'cached'
                ? 'info'
                : 'warning'
          }
          size="sm"
        >
          {forecast?.freshnessStatus ? forecast.freshnessStatus.toUpperCase() : 'UNKNOWN'}
        </Badge>
      </div>
    </Card>
  )
}

