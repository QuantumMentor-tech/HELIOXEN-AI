/**
 * HELIOXEN AI — Step 39: Network Monitor Widget
 * Local network connectivity indication and bounded HTTPS endpoint diagnostics.
 * Strictly prevents SSRF, measures request round-trip time, and clearly states limitations.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Wifi,
  WifiOff,
  Globe,
  Play,
  XCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import {
  APPROVED_NETWORK_ENDPOINTS,
  validateDiagnosticTargetUrl
} from '../../../../shared/widgets/contracts'
import {
  NetworkDiagnosticResult,
  NetworkStatusSnapshot
} from '../../../../shared/widgets/types'

export interface NetworkMonitorWidgetProps {
  className?: string
}

export const NetworkMonitorWidget: React.FC<NetworkMonitorWidgetProps> = ({
  className = ''
}) => {
  const [snapshot, setSnapshot] = useState<NetworkStatusSnapshot | null>(null)
  const [selectedUrl, setSelectedUrl] = useState<string>(APPROVED_NETWORK_ENDPOINTS[0].url)
  const [customUrl, setCustomUrl] = useState<string>('')
  const [isCustom, setIsCustom] = useState<boolean>(false)
  const [timeoutMs, setTimeoutMs] = useState<number>(5000)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [latestResult, setLatestResult] = useState<NetworkDiagnosticResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const fetchStatus = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.helioxen?.widgets) {
        const data = await window.helioxen.widgets.getNetworkStatus()
        if (isMountedRef.current) {
          setSnapshot(data)
          if (data.lastDiagnostic) {
            setLatestResult(data.lastDiagnostic)
          }
        }
      }
    } catch {
      // Ignore background status polling errors
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchStatus()

    const handleOnline = () => fetchStatus()
    const handleOffline = () => fetchStatus()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      isMountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [fetchStatus])

  const handleRunDiagnostic = async () => {
    const targetUrl = isCustom ? customUrl.trim() : selectedUrl
    const check = validateDiagnosticTargetUrl(targetUrl)

    if (!check.valid || !check.normalizedUrl) {
      setValidationError(check.error || 'Invalid diagnostic target URL.')
      return
    }

    setValidationError(null)
    setIsRunning(true)

    try {
      if (typeof window !== 'undefined' && window.helioxen?.widgets) {
        const result = await window.helioxen.widgets.runNetworkDiagnostic({
          targetUrl: check.normalizedUrl,
          timeoutMs
        })
        if (isMountedRef.current) {
          setLatestResult(result)
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setValidationError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (isMountedRef.current) {
        setIsRunning(false)
        fetchStatus()
      }
    }
  };

  const handleCancel = async () => {
    try {
      if (typeof window !== 'undefined' && window.helioxen?.widgets) {
        await window.helioxen.widgets.cancelNetworkDiagnostic()
      }
    } catch {
      // Ignore cancel errors
    } finally {
      setIsRunning(false)
    }
  }

  const isOnline = snapshot?.connectivity.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)

  return (
    <Card variant="panel" border="glow" padding="md" className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hx-border-panel/70 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-hx-md bg-hx-surface border border-hx-border-glow text-hx-cyan">
            {isOnline ? <Wifi className="w-4 h-4 text-hx-nominal" /> : <WifiOff className="w-4 h-4 text-hx-critical" />}
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-hx-text-primary flex items-center gap-2">
              Network Monitor &amp; Diagnostics
            </h3>
            <p className="text-[11px] text-hx-text-secondary">
              Local interface status and bounded HTTPS diagnostics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant={isOnline ? 'nominal' : 'danger'} size="sm" isDot>
            {isOnline ? 'LOCAL LINK ONLINE' : 'DISCONNECTED'}
          </Badge>
          <IconButton
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            aria-label="Refresh Network Status"
            title="Refresh Network Status"
            size="sm"
            variant="ghost"
            onClick={fetchStatus}
          />
        </div>
      </div>

      {/* Target Selection & Diagnostic Controls */}
      <div className="space-y-2.5">
        <label className="block text-xs font-medium text-hx-text-secondary">
          Approved Diagnostic Endpoint
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          {!isCustom ? (
            <select
              value={selectedUrl}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustom(true)
                } else {
                  setSelectedUrl(e.target.value)
                }
              }}
              className="flex-1 text-xs bg-hx-surface text-hx-text-primary border border-hx-border-subtle rounded-hx-md px-3 py-1.5 outline-none focus:border-hx-cyan"
              aria-label="Select Approved Diagnostic Endpoint"
            >
              {APPROVED_NETWORK_ENDPOINTS.map((ep) => (
                <option key={ep.id} value={ep.url}>
                  {ep.name}
                </option>
              ))}
              <option value="__custom__">Custom HTTPS URL...</option>
            </select>
          ) : (
            <div className="flex-1 flex items-center space-x-1.5">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value)
                  setValidationError(null)
                }}
                placeholder="https://example.com/health"
                className="flex-1 text-xs bg-hx-surface text-hx-text-primary border border-hx-border-subtle rounded-hx-md px-3 py-1.5 outline-none focus:border-hx-cyan"
                aria-label="Custom HTTPS Target URL"
              />
              <button
                type="button"
                onClick={() => {
                  setIsCustom(false)
                  setValidationError(null)
                }}
                className="text-[10px] font-mono text-hx-text-secondary hover:text-hx-text-primary px-2 py-1 rounded bg-hx-panel"
              >
                Presets
              </button>
            </div>
          )}

          {/* Timeout Selector */}
          <select
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value))}
            className="text-xs bg-hx-surface text-hx-text-secondary border border-hx-border-subtle rounded-hx-md px-2 py-1.5 outline-none focus:border-hx-cyan shrink-0"
            aria-label="Diagnostic Timeout in Milliseconds"
          >
            <option value={3000}>3s Timeout</option>
            <option value={5000}>5s Timeout</option>
            <option value={10000}>10s Timeout</option>
          </select>

          {/* Action Buttons */}
          {isRunning ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
            >
              Cancel Test
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunDiagnostic}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Run Test
            </Button>
          )}
        </div>

        {validationError && (
          <div className="p-2 rounded bg-hx-critical/10 border border-hx-critical/30 text-hx-critical text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Latest Diagnostic Result Card */}
      {latestResult && (
        <div className="p-3.5 rounded-hx-md bg-hx-panel/60 border border-hx-border-subtle space-y-2.5 animate-hx-fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Globe className="w-3.5 h-3.5 text-hx-cyan" />
              <span className="font-semibold text-hx-text-primary truncate max-w-[200px]">
                {latestResult.targetHost}
              </span>
            </div>
            <Badge
              variant={
                latestResult.status === 'success'
                  ? 'nominal'
                  : latestResult.status === 'timeout' || latestResult.status === 'cancelled'
                    ? 'warning'
                    : 'danger'
              }
              size="sm"
            >
              {latestResult.status.toUpperCase()}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-hx-surface/70 border border-hx-border-subtle/50">
              <div className="text-[10px] text-hx-text-muted font-mono uppercase">Request Round-Trip</div>
              <div className="font-mono font-semibold text-hx-text-primary mt-0.5">
                {latestResult.roundTripTimeMs !== null ? `${latestResult.roundTripTimeMs} ms` : '—'}
              </div>
            </div>
            <div className="p-2 rounded bg-hx-surface/70 border border-hx-border-subtle/50">
              <div className="text-[10px] text-hx-text-muted font-mono uppercase">HTTP Status</div>
              <div className="font-mono font-semibold text-hx-text-primary mt-0.5">
                {latestResult.statusCode ? `HTTP ${latestResult.statusCode}` : 'No Response'}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-hx-text-secondary leading-relaxed">
            {latestResult.diagnosticBasis}
          </p>

          <p className="text-[10px] text-hx-text-muted italic border-t border-hx-border-subtle/40 pt-2 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-hx-cyan shrink-0 mt-0.5" />
            <span>{latestResult.disclaimer}</span>
          </p>
        </div>
      )}

      {/* Footer / Transparency Note */}
      <div className="pt-2 border-t border-hx-border-subtle/50 text-[10px] text-hx-text-muted flex items-center justify-between">
        <span>SSRF &amp; Loopback Protection Active</span>
        <span>Bounded Plaintext Check Only</span>
      </div>
    </Card>
  )
}

