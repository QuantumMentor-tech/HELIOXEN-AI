/**
 * HELIOXEN AI — Step 39: System Health Widget
 * Displays local system resources and HELIOXEN application process health.
 * Distinguishes host metrics from process metrics and honestly reports unsupported sensors.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Cpu,
  HardDrive,
  Activity,
  Battery,
  BatteryCharging,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Thermometer,
  Wind
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { SystemHealthSnapshot } from '../../../../shared/widgets/types'

export interface SystemHealthWidgetProps {
  className?: string
  initialRefreshIntervalMs?: number
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  className = '',
  initialRefreshIntervalMs = 10_000
}) => {
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showProcessDetails, setShowProcessDetails] = useState(true)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(initialRefreshIntervalMs)
  const isMountedRef = useRef(true)

  const fetchHealth = useCallback(async (manual = false) => {
    if (manual) setIsLoading(true)
    setError(null)
    try {
      if (typeof window !== 'undefined' && window.helioxen?.widgets) {
        const data = await window.helioxen.widgets.getSystemHealth()
        if (isMountedRef.current) {
          setSnapshot(data)
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (isMountedRef.current && manual) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchHealth(true)

    if (refreshIntervalMs > 0) {
      const intervalId = setInterval(() => {
        fetchHealth(false)
      }, refreshIntervalMs)
      return () => {
        isMountedRef.current = false
        clearInterval(intervalId)
      }
    }

    return () => {
      isMountedRef.current = false
    }
  }, [fetchHealth, refreshIntervalMs])

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const val = bytes / Math.pow(1024, i)
    return `${val.toFixed(1)} ${units[i]}`
  }

  const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${seconds % 60}s`
  }

  const host = snapshot?.host
  const proc = snapshot?.helioxenProcess
  const power = snapshot?.powerAndSensors
  const storage = snapshot?.storage

  return (
    <Card variant="panel" border="glow" padding="md" className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hx-border-panel/70 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-hx-md bg-hx-surface border border-hx-border-glow text-hx-cyan">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center gap-2">
              System &amp; Process Health
            </h3>
            <p className="text-[11px] text-hx-text-secondary">
              Host resources vs. HELIOXEN application consumption
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Refresh interval selector */}
          <select
            value={refreshIntervalMs}
            onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
            className="text-[10px] font-mono bg-hx-surface text-hx-text-secondary border border-hx-border-subtle rounded px-2 py-1 outline-none focus:border-hx-cyan"
            aria-label="System Health Auto-Refresh Interval"
          >
            <option value={0}>Manual Only</option>
            <option value={5000}>Every 5s</option>
            <option value={10000}>Every 10s</option>
            <option value={30000}>Every 30s</option>
          </select>

          <IconButton
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-hx-cyan' : ''}`} />}
            aria-label="Refresh System Health"
            title="Refresh System Health Metrics"
            size="sm"
            variant="ghost"
            onClick={() => fetchHealth(true)}
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

      {/* Host Operating System Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-hx-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-wider text-hx-cyan font-semibold">
            Host System Resources
          </span>
          {host && (
            <span className="font-mono text-[10px] text-hx-text-muted">
              Uptime: {formatUptime(host.systemUptimeSeconds)} • {host.platform} ({host.arch})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Host Memory Card */}
          <div className="p-3 rounded-hx-md bg-hx-surface/60 border border-hx-border-subtle space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-hx-text-secondary font-medium">System Memory</span>
              <span className="font-mono font-semibold text-hx-text-primary">
                {host ? `${host.memoryUsagePercent}%` : '—'}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-hx-panel overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  (host?.memoryUsagePercent ?? 0) > 85
                    ? 'bg-hx-critical'
                    : (host?.memoryUsagePercent ?? 0) > 70
                      ? 'bg-hx-warning'
                      : 'bg-hx-cyan'
                }`}
                style={{ width: `${Math.min(100, host?.memoryUsagePercent ?? 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-hx-text-muted">
              <span>Used: {host ? formatBytes(host.usedMemoryBytes) : '—'}</span>
              <span>Total: {host ? formatBytes(host.totalMemoryBytes) : '—'}</span>
            </div>
          </div>

          {/* Host CPU Utilization */}
          <div className="p-3 rounded-hx-md bg-hx-surface/60 border border-hx-border-subtle space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-hx-text-secondary font-medium">Host CPU Load</span>
              <span className="font-mono font-semibold text-hx-text-primary">
                {host ? `${host.cpuUtilizationPercent}%` : '—'}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-hx-panel overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  (host?.cpuUtilizationPercent ?? 0) > 85
                    ? 'bg-hx-critical'
                    : (host?.cpuUtilizationPercent ?? 0) > 70
                      ? 'bg-hx-warning'
                      : 'bg-hx-nominal'
                }`}
                style={{ width: `${Math.min(100, host?.cpuUtilizationPercent ?? 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-hx-text-muted">
              <span>{host?.logicalCores ? `${host.logicalCores} Logical Cores` : 'Cores —'}</span>
              <span>Sample: {snapshot?.samplingIntervalMs ?? 100}ms avg</span>
            </div>
          </div>
        </div>

        {/* Primary Storage Capacity */}
        {storage && storage.status === 'available' && (
          <div className="p-2.5 rounded-hx-md bg-hx-surface/40 border border-hx-border-subtle/70 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-3.5 h-3.5 text-hx-text-muted" />
              <span className="text-hx-text-secondary">Primary Volume ({storage.driveOrVolume})</span>
            </div>
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="text-hx-text-muted">
                {formatBytes(storage.availableBytes)} free of {formatBytes(storage.totalBytes)}
              </span>
              <Badge variant={storage.usagePercent > 90 ? 'danger' : 'neutral'} size="sm">
                {storage.usagePercent}%
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* HELIOXEN Application Process Health */}
      <div className="pt-2 border-t border-hx-border-subtle/50 space-y-2">
        <button
          type="button"
          onClick={() => setShowProcessDetails((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs text-hx-text-secondary hover:text-hx-text-primary transition-colors py-1 select-none"
        >
          <span className="flex items-center gap-1.5 font-semibold text-hx-text-primary">
            <Activity className="w-3.5 h-3.5 text-hx-cyan" />
            HELIOXEN Process Status
            {proc && (
              <Badge
                variant={
                  proc.healthStatus === 'nominal'
                    ? 'nominal'
                    : proc.healthStatus === 'elevated'
                      ? 'warning'
                      : 'danger'
                }
                size="sm"
                className="ml-1"
              >
                {proc.healthStatus.toUpperCase()}
              </Badge>
            )}
          </span>
          {showProcessDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showProcessDetails && proc && (
          <div className="p-3 rounded-hx-md bg-hx-panel/50 border border-hx-border-subtle text-xs space-y-2 animate-hx-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-hx-surface/70 border border-hx-border-subtle/50">
                <div className="text-[10px] text-hx-text-muted uppercase font-mono">Process CPU</div>
                <div className="font-mono font-semibold text-hx-text-primary mt-0.5">
                  {proc.cpuUtilizationPercent}%
                </div>
              </div>
              <div className="p-2 rounded bg-hx-surface/70 border border-hx-border-subtle/50">
                <div className="text-[10px] text-hx-text-muted uppercase font-mono">Process RSS</div>
                <div className="font-mono font-semibold text-hx-text-primary mt-0.5">
                  {formatBytes(proc.memoryRssBytes)}
                </div>
              </div>
              <div className="p-2 rounded bg-hx-surface/70 border border-hx-border-subtle/50">
                <div className="text-[10px] text-hx-text-muted uppercase font-mono">Heap Used</div>
                <div className="font-mono font-semibold text-hx-text-primary mt-0.5">
                  {formatBytes(proc.heapUsedBytes)}
                </div>
              </div>
              <div className="p-2 rounded bg-hx-surface/70 border border-hx-border-subtle/50">
                <div className="text-[10px] text-hx-text-muted uppercase font-mono">PID / Uptime</div>
                <div className="font-mono font-semibold text-hx-text-primary mt-0.5">
                  {proc.pid} • {formatUptime(proc.processUptimeSeconds)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-hx-text-muted italic flex items-center gap-1.5">
              <Info className="w-3 h-3 text-hx-cyan shrink-0" />
              {proc.healthAssessment}
            </p>
          </div>
        )}
      </div>

      {/* Power & Hardware Sensors Section */}
      <div className="pt-2 border-t border-hx-border-subtle/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-hx-text-secondary">
        <div className="flex items-center space-x-2">
          {power?.powerSource === 'battery' ? (
            <span className="flex items-center gap-1 text-hx-warning">
              <Battery className="w-3.5 h-3.5" />
              Battery Power
            </span>
          ) : power?.powerSource === 'ac_power' ? (
            <span className="flex items-center gap-1 text-hx-nominal">
              <Zap className="w-3.5 h-3.5" />
              AC Connected
            </span>
          ) : (
            <span className="text-hx-text-muted">Power: AC / Desktop</span>
          )}

          {power?.thermalStateSupported ? (
            <span className="text-hx-text-muted">• Thermal: {power.thermalState}</span>
          ) : (
            <span className="text-hx-text-muted" title={power?.thermalNote}>
              • Thermals: N/A
            </span>
          )}
        </div>

        <div className="text-[10px] text-hx-text-muted font-mono" title="Sensors require unapproved kernel drivers">
          GPU / Fan: Unsupported (honest)
        </div>
      </div>
    </Card>
  )
}

