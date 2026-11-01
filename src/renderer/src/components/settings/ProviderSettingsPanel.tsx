import React, { useState, useEffect, useCallback } from 'react'
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Trash2,
  Play,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Cpu,
  Layers,
  Sliders,
  Check,
  Info,
  Activity,
  GitFork,
  ShieldAlert,
  Network
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  RoutingMode,
  ProviderHealthRecord,
  ProviderHealthStatus
} from '../../../../shared/ai/routing'
import {
  AiProviderId,
  ProviderCredentialStatus,
  ProviderTestResult
} from '../../../../shared/ai/types'
import {
  ProviderDefinition,
  ModelDefinition,
  UserAiPreferences,
  DEFAULT_AI_PREFERENCES,
  CURATED_PROVIDERS
} from '../../../../shared/ai/models'

export interface ProviderSettingsPanelProps {
  className?: string
}

export const ProviderSettingsPanel: React.FC<ProviderSettingsPanelProps> = ({
  className = ''
}) => {
  // Provider credential statuses
  const [statuses, setStatuses] = useState<Record<AiProviderId, ProviderCredentialStatus>>({
    'google-gemini': { provider: 'google-gemini', configured: false },
    openai: { provider: 'openai', configured: false }
  })

  // Full model catalog
  const [catalog, setCatalog] = useState<ProviderDefinition[]>(CURATED_PROVIDERS)

  // Persisted user preferences
  const [preferences, setPreferences] = useState<UserAiPreferences>(DEFAULT_AI_PREFERENCES)

  // Provider health tracking state
  const [health, setHealth] = useState<Record<AiProviderId, ProviderHealthRecord>>({
    'google-gemini': { provider: 'google-gemini', status: 'unknown', consecutiveFailures: 0 },
    openai: { provider: 'openai', status: 'unknown', consecutiveFailures: 0 }
  })

  // Local ephemeral preference edits
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>(
    DEFAULT_AI_PREFERENCES.activeProvider
  )
  const [selectedModelId, setSelectedModelId] = useState<string>(
    DEFAULT_AI_PREFERENCES.activeModel
  )
  const [temperature, setTemperature] = useState<number>(
    DEFAULT_AI_PREFERENCES.temperature ?? 0.7
  )
  const [stream, setStream] = useState<boolean>(DEFAULT_AI_PREFERENCES.stream)
  const [routingMode, setRoutingMode] = useState<RoutingMode>(
    DEFAULT_AI_PREFERENCES.routingMode ?? 'manual'
  )
  const [allowSameProviderFallback, setAllowSameProviderFallback] = useState<boolean>(
    DEFAULT_AI_PREFERENCES.allowSameProviderFallback ?? true
  )
  const [allowCrossProviderFallback, setAllowCrossProviderFallback] = useState<boolean>(
    DEFAULT_AI_PREFERENCES.allowCrossProviderFallback ?? false
  )

  // Ephemeral inputs (strictly cleared after save)
  const [geminiKey, setGeminiKey] = useState('')
  const [openAiKey, setOpenAiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showOpenAiKey, setShowOpenAiKey] = useState(false)

  // Loading & action flags
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false)
  const [savingProvider, setSavingProvider] = useState<AiProviderId | null>(null)
  const [testingProvider, setTestingProvider] = useState<AiProviderId | null>(null)
  const [testResults, setTestResults] = useState<Record<AiProviderId, ProviderTestResult | null>>({
    'google-gemini': null,
    openai: null
  })

  // Feedback notifications
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  // Refresh data from trusted main process
  const refreshAllData = useCallback(async () => {
    try {
      setIsLoading(true)

      // 1. Load credentials status
      if (window.helioxen?.credentials) {
        const creds = await window.helioxen.credentials.getStatus()
        setStatuses(creds)
      }

      // 2. Load model catalog
      if (window.helioxen?.models) {
        const cat = await window.helioxen.models.getCatalog()
        if (cat && cat.length > 0) {
          setCatalog(cat)
        }
      }

      // 3. Load user preferences
      if (window.helioxen?.preferences) {
        const prefs = await window.helioxen.preferences.get()
        if (prefs) {
          setPreferences(prefs)
          setSelectedProvider(prefs.activeProvider)
          setSelectedModelId(prefs.activeModel)
          setTemperature(prefs.temperature ?? 0.7)
          setStream(prefs.stream)
          setRoutingMode(prefs.routingMode ?? 'manual')
          setAllowSameProviderFallback(prefs.allowSameProviderFallback ?? true)
          setAllowCrossProviderFallback(prefs.allowCrossProviderFallback ?? false)
        }
      }

      // 4. Load evidence-based provider health
      if (window.helioxen?.health) {
        const healthStatus = await window.helioxen.health.getStatus()
        if (healthStatus) {
          setHealth(healthStatus)
        }
      }
    } catch (err) {
      console.error('[ProviderSettings] Failed to query state:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshAllData()
  }, [refreshAllData])

  // Active provider definition
  const currentProviderDef = catalog.find((p) => p.id === selectedProvider) || catalog[0]

  // Available models for active provider
  const availableModels = currentProviderDef?.models || []

  // Ensure selected model belongs to current provider
  useEffect(() => {
    if (availableModels.length > 0) {
      const exists = availableModels.some((m) => m.id === selectedModelId)
      if (!exists) {
        setSelectedModelId(availableModels[0].id)
      }
    }
  }, [selectedProvider, availableModels, selectedModelId])

  // Currently selected model definition
  const selectedModelDef: ModelDefinition | undefined = availableModels.find(
    (m) => m.id === selectedModelId
  )

  // Save AI preferences handler
  const handleSavePreferences = async () => {
    try {
      setIsSavingPrefs(true)
      setBannerMessage(null)

      if (window.helioxen?.preferences) {
        const saved = await window.helioxen.preferences.set({
          activeProvider: selectedProvider,
          activeModel: selectedModelId,
          temperature,
          stream,
          routingMode,
          allowSameProviderFallback,
          allowCrossProviderFallback
        })
        setPreferences(saved)
        setBannerMessage({
          type: 'success',
          text: `Active model updated to '${saved.activeModel}', routing mode '${saved.routingMode}'. Preferences saved.`
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({
        type: 'error',
        text: `Failed to save preferences: ${msg}`
      })
    } finally {
      setIsSavingPrefs(false)
    }
  }

  // Refresh model catalog handler (explicit user action)
  const handleRefreshCatalog = async () => {
    const isCredConfigured = statuses[selectedProvider]?.configured
    if (!isCredConfigured) {
      setBannerMessage({
        type: 'error',
        text: `Cannot refresh ${selectedProvider} catalog without a configured API key. Please save your key in the vault below first.`
      })
      return
    }

    try {
      setIsRefreshingCatalog(true)
      setBannerMessage(null)

      if (window.helioxen?.models) {
        const updated = await window.helioxen.models.refresh(selectedProvider)
        setCatalog((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        )
        setBannerMessage({
          type: 'success',
          text: `Discovered and verified ${updated.models.length} models for ${updated.displayName} from official catalog.`
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({
        type: 'error',
        text: `Catalog discovery failed: ${msg}. Previous cached and curated models remain active.`
      })
    } finally {
      setIsRefreshingCatalog(false)
    }
  }

  // Credential management handlers
  const handleSaveCredential = async (provider: AiProviderId) => {
    const key = provider === 'google-gemini' ? geminiKey : openAiKey
    if (!key.trim()) {
      setBannerMessage({ type: 'error', text: 'Please enter a valid API key before saving.' })
      return
    }

    try {
      setSavingProvider(provider)
      setBannerMessage(null)

      if (window.helioxen?.credentials) {
        await window.helioxen.credentials.set({
          provider,
          apiKey: key.trim(),
          label: `${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} Primary Key`
        })

        // Immediately clear plaintext input from memory
        if (provider === 'google-gemini') setGeminiKey('')
        else setOpenAiKey('')

        setBannerMessage({
          type: 'success',
          text: `Encrypted and saved ${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} key in Windows DPAPI vault.`
        })

        await refreshAllData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({
        type: 'error',
        text: `Failed to save credential: ${msg}`
      })
    } finally {
      setSavingProvider(null)
    }
  }

  const handleDeleteCredential = async (provider: AiProviderId) => {
    try {
      setBannerMessage(null)
      if (window.helioxen?.credentials) {
        await window.helioxen.credentials.delete(provider)
        setBannerMessage({
          type: 'info',
          text: `Removed ${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} credential from vault.`
        })
        await refreshAllData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({
        type: 'error',
        text: `Failed to delete credential: ${msg}`
      })
    }
  }

  const handleTestConnection = async (provider: AiProviderId) => {
    try {
      setTestingProvider(provider)
      setBannerMessage(null)
      if (window.helioxen?.credentials) {
        const result = await window.helioxen.credentials.test(provider)
        setTestResults((prev) => ({ ...prev, [provider]: result }))

        if (result.success) {
          setBannerMessage({
            type: 'success',
            text: `Connection verified! ${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} responded in ${result.latencyMs}ms using ${result.model}.`
          })
        } else {
          setBannerMessage({
            type: 'error',
            text: `Connection test rejected: ${result.errorMessage || 'Authentication failed'}`
          })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({
        type: 'error',
        text: `Connection test error: ${msg}`
      })
    } finally {
      setTestingProvider(null)
    }
  }

  const renderHealthBadge = (h?: ProviderHealthRecord) => {
    const status = h?.status || 'unknown'
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-hx-nominal bg-hx-nominal/10 px-1.5 py-0.5 rounded border border-hx-nominal/30">
            <span className="w-1.5 h-1.5 rounded-full bg-hx-nominal animate-pulse" />
            Healthy
          </span>
        )
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-hx-warning bg-hx-warning/10 px-1.5 py-0.5 rounded border border-hx-warning/30">
            <span className="w-1.5 h-1.5 rounded-full bg-hx-warning" />
            Degraded
          </span>
        )
      case 'rate-limited':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-hx-danger bg-hx-danger/10 px-1.5 py-0.5 rounded border border-hx-danger/30">
            <span className="w-1.5 h-1.5 rounded-full bg-hx-danger" />
            Rate Limited
          </span>
        )
      case 'auth-failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-hx-danger bg-hx-danger/10 px-1.5 py-0.5 rounded border border-hx-danger/30">
            <span className="w-1.5 h-1.5 rounded-full bg-hx-danger" />
            Auth Failed
          </span>
        )
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-hx-danger bg-hx-danger/10 px-1.5 py-0.5 rounded border border-hx-danger/30">
            <span className="w-1.5 h-1.5 rounded-full bg-hx-danger" />
            Unavailable
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-hx-text-muted bg-hx-space/50 px-1.5 py-0.5 rounded border border-hx-border-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-hx-text-muted" />
            Untested
          </span>
        )
    }
  }

  return (
    <div className={`space-y-8 max-w-5xl mx-auto pb-8 ${className}`}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-hx-border-subtle">
        <div>
          <div className="flex items-center space-x-2.5">
            <Cpu className="w-5 h-5 text-hx-cyan" />
            <h2 className="text-lg font-display font-semibold text-hx-text-primary tracking-wide">
              Model Registry, Intelligent Routing &amp; Provider Health
            </h2>
          </div>
          <p className="text-xs text-hx-text-secondary mt-1">
            Task-based model routing, controlled fallback gates, evidence-based health tracking, and Windows DPAPI credential vault.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="nominal" size="sm" isDot>
            Step 18 Active
          </Badge>
          <Badge variant="info" size="sm">
            Phase 6
          </Badge>
        </div>
      </div>

      {/* Status / Alert Banner */}
      {bannerMessage && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-3 rounded-hx-md border text-xs flex items-center justify-between transition-all animate-hx-fade-in ${
            bannerMessage.type === 'success'
              ? 'bg-hx-nominal/10 border-hx-nominal/40 text-hx-nominal'
              : bannerMessage.type === 'error'
              ? 'bg-hx-danger/10 border-hx-danger/40 text-hx-danger'
              : 'bg-hx-cyan/10 border-hx-border-glow text-hx-cyan'
          }`}
        >
          <div className="flex items-center space-x-2">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : bannerMessage.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION 1: MODEL REGISTRY & CAPABILITY PROFILES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-hx-cyan" />
            <h3 className="text-sm font-display font-semibold text-hx-text-primary uppercase tracking-wider">
              Active Provider &amp; Model Selection
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefreshCatalog}
              isLoading={isRefreshingCatalog}
              disabled={!statuses[selectedProvider]?.configured}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Performs explicit user-initiated discovery of available models from the provider"
            >
              Refresh Catalog
            </Button>
          </div>
        </div>

        {/* Provider Switcher Tabs */}
        <div className="flex space-x-2 border-b border-hx-border-subtle pb-2">
          {catalog.map((provider) => {
            const isSelected = provider.id === selectedProvider
            const isConfigured = statuses[provider.id]?.configured

            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProvider(provider.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-hx-md text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-hx-space border border-hx-border-glow text-hx-cyan shadow-hx-glow-cyan-sm'
                    : 'text-hx-text-secondary hover:text-hx-text-primary hover:bg-hx-space/40'
                }`}
              >
                <span>{provider.displayName}</span>
                {isConfigured ? (
                  <span className="w-2 h-2 rounded-full bg-hx-nominal" title="API Key Stored" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-hx-text-muted" title="Key Missing" />
                )}
                <span className="ml-1.5">{renderHealthBadge(health[provider.id])}</span>
              </button>
            )
          })}
        </div>

        {/* Model Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableModels.map((model) => {
            const isSelected = model.id === selectedModelId
            const isSavedActive =
              preferences.activeProvider === selectedProvider &&
              preferences.activeModel === model.id

            return (
              <div
                key={model.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelectedModelId(model.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setSelectedModelId(model.id)
                  }
                }}
                className={`p-4 rounded-hx-md border cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-hx-cyan ${
                  isSelected
                    ? 'bg-hx-space border-hx-border-glow shadow-hx-glow-cyan-sm'
                    : 'bg-hx-space/40 border-hx-border-subtle hover:border-hx-border-glow/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-display font-semibold text-hx-text-primary">
                      {model.displayName}
                    </h4>
                    <span className="text-[10px] font-mono text-hx-text-muted block truncate mt-0.5">
                      {model.id}
                    </span>
                  </div>
                  {isSavedActive ? (
                    <Badge variant="nominal" size="sm">
                      ACTIVE
                    </Badge>
                  ) : model.isDefault ? (
                    <Badge variant="info" size="sm">
                      DEFAULT
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      {model.capabilities.tier || 'STANDARD'}
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-hx-text-secondary mt-2 line-clamp-2 leading-relaxed">
                  {model.description}
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono text-hx-text-muted mt-3 pt-2 border-t border-hx-border-subtle">
                  <span>
                    Context: {(model.capabilities.contextWindow ?? 0).toLocaleString()} tokens
                  </span>
                  <span className="capitalize">{model.source}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected Model Capability Profile Detail */}
        {selectedModelDef && (
          <Card variant="panel" border="panel" padding="md" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-hx-cyan" />
                <h4 className="text-xs font-display font-semibold text-hx-text-primary">
                  Capability Profile: {selectedModelDef.displayName} ({selectedModelDef.id})
                </h4>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-hx-text-muted">
                <span>Output Limit: {selectedModelDef.capabilities.maxOutputTokens?.toLocaleString()} tokens</span>
                <span>•</span>
                <span>Context: {selectedModelDef.capabilities.contextWindow?.toLocaleString()} tokens</span>
              </div>
            </div>

            {/* Three-Level Capability Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-hx-border-subtle text-hx-text-muted text-[10px] uppercase">
                    <th className="py-1.5 px-2">Capability Dimension</th>
                    <th className="py-1.5 px-2">Model-Level Support</th>
                    <th className="py-1.5 px-2">HELIOXEN Runtime Status</th>
                    <th className="py-1.5 px-2">Notes / Roadmap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hx-border-subtle/50 text-[11px]">
                  <tr>
                    <td className="py-1.5 px-2 text-hx-text-primary">Text Generation</td>
                    <td className="py-1.5 px-2 text-hx-nominal">Supported</td>
                    <td className="py-1.5 px-2 text-hx-nominal">Active (Step 16)</td>
                    <td className="py-1.5 px-2 text-hx-text-secondary">Core synthesis prompt path</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-hx-text-primary">Streaming Delivery</td>
                    <td className="py-1.5 px-2 text-hx-nominal">Supported</td>
                    <td className="py-1.5 px-2 text-hx-nominal">Active (Step 16)</td>
                    <td className="py-1.5 px-2 text-hx-text-secondary">Real-time incremental chunks</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-hx-text-primary">Structured Output</td>
                    <td className="py-1.5 px-2 text-hx-nominal">Supported</td>
                    <td className="py-1.5 px-2 text-hx-nominal">Active (Step 16)</td>
                    <td className="py-1.5 px-2 text-hx-text-secondary">JSON schema validation</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-hx-text-primary">Multimodal Vision</td>
                    <td className="py-1.5 px-2 text-hx-cyan">
                      {selectedModelDef.capabilities.modelLevel.imageInput === 'supported'
                        ? 'Supported'
                        : 'Unsupported'}
                    </td>
                    <td className="py-1.5 px-2 text-hx-warning">Roadmap Phase 8</td>
                    <td className="py-1.5 px-2 text-hx-text-muted">Desktop capture not yet enabled</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-hx-text-primary">Native Audio / Voice</td>
                    <td className="py-1.5 px-2 text-hx-cyan">
                      {selectedModelDef.capabilities.modelLevel.audioInput === 'supported'
                        ? 'Supported'
                        : 'Unsupported'}
                    </td>
                    <td className="py-1.5 px-2 text-hx-warning">Roadmap Phase 7</td>
                    <td className="py-1.5 px-2 text-hx-text-muted">Audio capture hardware gate</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 text-hx-text-primary">Tool / Function Calling</td>
                    <td className="py-1.5 px-2 text-hx-cyan">
                      {selectedModelDef.capabilities.modelLevel.toolCalling === 'supported'
                        ? 'Supported'
                        : 'Unsupported'}
                    </td>
                    <td className="py-1.5 px-2 text-hx-warning">Roadmap Phase 9</td>
                    <td className="py-1.5 px-2 text-hx-text-muted">Agent execution approval gate</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-hx-text-muted leading-relaxed">
              <span className="text-hx-warning font-semibold">Security Boundary:</span> Documented model capabilities do not authorize desktop execution until HELIOXEN activates the corresponding runtime phase.
            </p>

            {/* Generation Parameters Controls */}
            <div className="pt-3 border-t border-hx-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-hx-text-muted block mb-1">
                  Temperature: <span className="text-hx-cyan font-bold">{temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-hx-cyan bg-hx-space h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <input
                  type="checkbox"
                  id="stream-toggle"
                  checked={stream}
                  onChange={(e) => setStream(e.target.checked)}
                  className="accent-hx-cyan w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="stream-toggle" className="text-xs font-mono text-hx-text-primary cursor-pointer">
                  Enable Incremental Streaming
                </label>
              </div>
            </div>

            {/* Save Preferences Button */}
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePreferences}
                isLoading={isSavingPrefs}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Save Active Model &amp; Preferences
              </Button>
            </div>
          </Card>
        )}

        {/* Task-Based Model Routing & Fallback Policy Card */}
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <GitFork className="w-4 h-4 text-hx-cyan" />
              <h4 className="text-xs font-display font-semibold text-hx-text-primary">
                Task-Based Model Routing &amp; Fallback Rules
              </h4>
            </div>
            <Badge variant={routingMode === 'task-based' ? 'nominal' : 'info'} size="sm">
              {routingMode === 'task-based' ? 'INTELLIGENT ROUTING' : 'MANUAL SELECTION'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Routing Mode Selectors */}
            <div
              role="radio"
              aria-checked={routingMode === 'manual'}
              tabIndex={0}
              onClick={() => setRoutingMode('manual')}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setRoutingMode('manual')
                }
              }}
              className={`p-3 rounded-hx-md border cursor-pointer transition-all ${
                routingMode === 'manual'
                  ? 'bg-hx-space border-hx-border-glow shadow-hx-glow-cyan-sm'
                  : 'bg-hx-space/40 border-hx-border-subtle hover:border-hx-border-glow/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="routing-manual"
                  name="routing-mode"
                  checked={routingMode === 'manual'}
                  onChange={() => setRoutingMode('manual')}
                  className="accent-hx-cyan"
                />
                <label htmlFor="routing-manual" className="text-xs font-display font-semibold text-hx-text-primary cursor-pointer">
                  Manual Explicit Selection
                </label>
              </div>
              <p className="text-[11px] text-hx-text-secondary mt-1.5 leading-relaxed">
                Strictly route all generation tasks to the active model selected above ({selectedModelId}). Failovers only execute if explicit fallbacks below are enabled.
              </p>
            </div>

            <div
              role="radio"
              aria-checked={routingMode === 'task-based'}
              tabIndex={0}
              onClick={() => setRoutingMode('task-based')}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setRoutingMode('task-based')
                }
              }}
              className={`p-3 rounded-hx-md border cursor-pointer transition-all ${
                routingMode === 'task-based'
                  ? 'bg-hx-space border-hx-border-glow shadow-hx-glow-cyan-sm'
                  : 'bg-hx-space/40 border-hx-border-subtle hover:border-hx-border-glow/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="routing-task"
                  name="routing-mode"
                  checked={routingMode === 'task-based'}
                  onChange={() => setRoutingMode('task-based')}
                  className="accent-hx-cyan"
                />
                <label htmlFor="routing-task" className="text-xs font-display font-semibold text-hx-text-primary cursor-pointer">
                  Task-Based Intelligent Selection
                </label>
              </div>
              <p className="text-[11px] text-hx-text-secondary mt-1.5 leading-relaxed">
                Dynamically classify each prompt (e.g. conversational, rapid latency, complex reasoning, structured extraction) and select the highest-performing registered model.
              </p>
            </div>
          </div>

          {/* Fallback Rules */}
          <div className="pt-3 border-t border-hx-border-subtle space-y-3">
            <h5 className="text-[11px] font-mono text-hx-text-muted uppercase tracking-wider">
              Controlled Failure Recovery &amp; Fallback Gates
            </h5>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="same-provider-fallback"
                checked={allowSameProviderFallback}
                onChange={(e) => setAllowSameProviderFallback(e.target.checked)}
                className="accent-hx-cyan w-4 h-4 rounded cursor-pointer mt-0.5"
              />
              <div>
                <label htmlFor="same-provider-fallback" className="text-xs font-mono text-hx-text-primary cursor-pointer font-medium">
                  Allow Same-Provider Fallback
                </label>
                <p className="text-[11px] text-hx-text-secondary mt-0.5 leading-relaxed">
                  If the active model experiences rate limits or server overload, retry with a secondary eligible model on the same provider without cross-network privacy risk.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="cross-provider-fallback"
                checked={allowCrossProviderFallback}
                onChange={(e) => setAllowCrossProviderFallback(e.target.checked)}
                className="accent-hx-cyan w-4 h-4 rounded cursor-pointer mt-0.5"
              />
              <div>
                <label htmlFor="cross-provider-fallback" className="text-xs font-mono text-hx-text-primary cursor-pointer font-medium">
                  Allow Cross-Provider Fallback (Multi-Vendor Failover)
                </label>
                <p className="text-[11px] text-hx-text-secondary mt-0.5 leading-relaxed">
                  If primary provider is unavailable or trips the circuit breaker, fallback to alternative configured providers (e.g., Gemini &harr; OpenAI).
                </p>
              </div>
            </div>

            {allowCrossProviderFallback && (
              <div className="p-2.5 rounded-hx-md bg-hx-warning/10 border border-hx-warning/30 flex items-start space-x-2 text-xs text-hx-warning">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-hx-warning" />
                <div className="leading-relaxed text-[11px]">
                  <span className="font-semibold">Privacy Notice:</span> Enabling cross-provider fallback sends conversation context across different vendor cloud boundaries if failover occurs. Ensure you have authorized data handling across all configured providers.
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex justify-end pt-2 border-t border-hx-border-subtle">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSavePreferences}
              isLoading={isSavingPrefs}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Save Model &amp; Routing Preferences
            </Button>
          </div>
        </Card>
      </div>

      {/* SECTION 2: SECURE CREDENTIAL VAULT */}
      <div className="space-y-4 pt-4 border-t border-hx-border-subtle">
        <div className="flex items-center space-x-2">
          <KeyRound className="w-4 h-4 text-hx-purple" />
          <h3 className="text-sm font-display font-semibold text-hx-text-primary uppercase tracking-wider">
            Secure DPAPI Credential Vault
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Gemini Key Card */}
          <Card variant="panel" border="panel" padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-hx-space border border-hx-border-glow flex items-center justify-center text-hx-cyan">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-display font-semibold text-hx-text-primary">
                    Google Gemini
                  </h4>
                  <span className="text-[10px] font-mono text-hx-cyan uppercase tracking-wider">
                    Primary Provider
                  </span>
                </div>
              </div>
              {statuses['google-gemini'].configured ? (
                <Badge variant="nominal" size="sm" isDot>
                  CONFIGURED
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  NOT CONFIGURED
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-hx-text-muted flex justify-between">
                <span>Gemini API Key</span>
                {statuses['google-gemini'].configured && (
                  <span className="text-hx-nominal flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Stored in Vault
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder={statuses['google-gemini'].configured ? '••••••••••••••••••••••••' : 'AIzaSy...'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="font-mono pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-hx-text-muted hover:text-hx-cyan focus:outline-none"
                  title={showGeminiKey ? 'Mask key' : 'Show key'}
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveCredential('google-gemini')}
                isLoading={savingProvider === 'google-gemini'}
                disabled={!geminiKey.trim()}
              >
                {statuses['google-gemini'].configured ? 'Update Key' : 'Save Key'}
              </Button>

              {statuses['google-gemini'].configured && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTestConnection('google-gemini')}
                    isLoading={testingProvider === 'google-gemini'}
                    leftIcon={<Play className="w-3 h-3" />}
                    title="Sends an explicit minimal ping request to Google Gemini API"
                  >
                    Test Connection
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCredential('google-gemini')}
                    className="text-hx-danger hover:text-hx-danger ml-auto"
                    title="Delete key from DPAPI vault"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            {testResults['google-gemini'] && (
              <div className="p-2.5 rounded-hx-md bg-hx-space/80 border border-hx-border-subtle text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-hx-text-muted">Test Result:</span>
                  <span className={testResults['google-gemini'].success ? 'text-hx-nominal' : 'text-hx-danger'}>
                    {testResults['google-gemini'].success ? 'OK (200)' : 'FAILED'}
                  </span>
                </div>
                <div className="text-[10px] text-hx-text-secondary mt-1">
                  Latency: {testResults['google-gemini'].latencyMs}ms • Model: {testResults['google-gemini'].model}
                </div>
              </div>
            )}
          </Card>

          {/* OpenAI Key Card */}
          <Card variant="panel" border="panel" padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-hx-space border border-hx-border-subtle flex items-center justify-center text-hx-text-primary">
                  <Sparkles className="w-4 h-4 text-hx-purple" />
                </div>
                <div>
                  <h4 className="text-sm font-display font-semibold text-hx-text-primary">
                    OpenAI
                  </h4>
                  <span className="text-[10px] font-mono text-hx-purple uppercase tracking-wider">
                    Secondary Provider
                  </span>
                </div>
              </div>
              {statuses['openai'].configured ? (
                <Badge variant="nominal" size="sm" isDot>
                  CONFIGURED
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  NOT CONFIGURED
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-hx-text-muted flex justify-between">
                <span>OpenAI API Key</span>
                {statuses['openai'].configured && (
                  <span className="text-hx-nominal flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Stored in Vault
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showOpenAiKey ? 'text' : 'password'}
                  placeholder={statuses['openai'].configured ? '••••••••••••••••••••••••' : 'sk-proj-...'}
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  className="font-mono pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-hx-text-muted hover:text-hx-cyan focus:outline-none"
                  title={showOpenAiKey ? 'Mask key' : 'Show key'}
                >
                  {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveCredential('openai')}
                isLoading={savingProvider === 'openai'}
                disabled={!openAiKey.trim()}
              >
                {statuses['openai'].configured ? 'Update Key' : 'Save Key'}
              </Button>

              {statuses['openai'].configured && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTestConnection('openai')}
                    isLoading={testingProvider === 'openai'}
                    leftIcon={<Play className="w-3 h-3" />}
                    title="Sends an explicit minimal ping request to OpenAI API"
                  >
                    Test Connection
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCredential('openai')}
                    className="text-hx-danger hover:text-hx-danger ml-auto"
                    title="Delete key from DPAPI vault"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            {testResults['openai'] && (
              <div className="p-2.5 rounded-hx-md bg-hx-space/80 border border-hx-border-subtle text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-hx-text-muted">Test Result:</span>
                  <span className={testResults['openai'].success ? 'text-hx-nominal' : 'text-hx-danger'}>
                    {testResults['openai'].success ? 'OK (200)' : 'FAILED'}
                  </span>
                </div>
                <div className="text-[10px] text-hx-text-secondary mt-1">
                  Latency: {testResults['openai'].latencyMs}ms • Model: {testResults['openai'].model}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
