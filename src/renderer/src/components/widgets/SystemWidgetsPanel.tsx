/**
 * HELIOXEN AI — Step 39: System Widgets Panel
 * Consolidated visual workspace presenting System Health, Network Monitor, and Weather widgets.
 */

import React, { useState } from 'react'
import {
  Activity,
  Layers,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Cpu,
  Wifi,
  CloudSun
} from 'lucide-react'
import { Header } from '../layout/Header'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { SystemHealthWidget } from './SystemHealthWidget'
import { NetworkMonitorWidget } from './NetworkMonitorWidget'
import { WeatherWidget } from './WeatherWidget'

export interface SystemWidgetsPanelProps {
  className?: string
}

export const SystemWidgetsPanel: React.FC<SystemWidgetsPanelProps> = ({
  className = ''
}) => {
  const [refreshKey, setRefreshKey] = useState<number>(0)

  const handleRefreshAll = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className={`max-w-7xl w-full mx-auto space-y-6 animate-hx-fade-in ${className}`}>
      {/* Top Banner Card */}
      <Card variant="panel" border="glow" padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-hx-space border border-hx-border-glow shadow-hx-glow-cyan-sm flex items-center justify-center text-hx-cyan shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-semibold text-hx-cyan flex items-center gap-2">
                System Health, Network Diagnostics &amp; Weather Intelligence
              </h2>
              <p className="text-xs text-hx-text-secondary leading-relaxed">
                Local-first machine telemetry, bounded single-endpoint HTTPS diagnostics, and authorized Open-Meteo weather forecasts.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Badge variant="nominal" size="sm" isDot>
              WIDGET ENGINE ACTIVE
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefreshAll}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh All
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Responsive Grid: 3 Independent Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Widget 1: System Health */}
        <SystemHealthWidget key={`health-${refreshKey}`} className="h-full" />

        {/* Widget 2: Network Monitor */}
        <NetworkMonitorWidget key={`network-${refreshKey}`} className="h-full" />

        {/* Widget 3: Weather */}
        <WeatherWidget key={`weather-${refreshKey}`} className="h-full" />
      </div>

      {/* Architectural Guarantee Summary */}
      <Card variant="default" border="subtle" padding="sm" className="bg-hx-surface/40 text-xs text-hx-text-muted">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-hx-cyan shrink-0" />
            <span>
              <strong>Privacy &amp; Safety Guarantees:</strong> System metrics stay strictly local. No silent geolocation. Diagnostics measure request round-trip time only without ICMP scanning.
            </span>
          </div>
          <span className="font-mono text-[10px] shrink-0 text-hx-text-secondary">
            Phase 13 • Step 39 of 48
          </span>
        </div>
      </Card>
    </div>
  )
}

