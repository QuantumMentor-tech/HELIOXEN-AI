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
  Loader2
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { AiProviderId, ProviderCredentialStatus, ProviderTestResult } from '../../../../shared/ai/types'

export interface CredentialSettingsPanelProps {
  className?: string
}

export const CredentialSettingsPanel: React.FC<CredentialSettingsPanelProps> = ({
  className = ''
}) => {
  const [statuses, setStatuses] = useState<Record<AiProviderId, ProviderCredentialStatus>>({
    'google-gemini': { provider: 'google-gemini', configured: false },
    openai: { provider: 'openai', configured: false }
  })
  const [isLoading, setIsLoading] = useState(true)

  // Ephemeral inputs (strictly cleared after save)
  const [geminiKey, setGeminiKey] = useState('')
  const [openAiKey, setOpenAiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showOpenAiKey, setShowOpenAiKey] = useState(false)

  // Action status indicators
  const [savingProvider, setSavingProvider] = useState<AiProviderId | null>(null)
  const [testingProvider, setTestingProvider] = useState<AiProviderId | null>(null)
  const [testResults, setTestResults] = useState<Record<AiProviderId, ProviderTestResult | null>>({
    'google-gemini': null,
    openai: null
  })
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  // Load credential status from trusted main process
  const refreshStatus = useCallback(async () => {
    if (typeof window !== 'undefined' && window.helioxen?.credentials) {
      try {
        setIsLoading(true)
        const current = await window.helioxen.credentials.getStatus()
        setStatuses(current)
      } catch (err) {
        console.error('[Settings] Failed to query credential status:', err)
      } finally {
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

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

        // Immediately clear sensitive plaintext input from renderer state
        if (provider === 'google-gemini') setGeminiKey('')
        else setOpenAiKey('')

        setBannerMessage({
          type: 'success',
          text: `Successfully encrypted and saved ${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} API key in Windows DPAPI vault.`
        })

        await refreshStatus()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({ type: 'error', text: `Failed to save credential: ${msg}` })
    } finally {
      setSavingProvider(null)
    }
  }

  const handleDeleteCredential = async (provider: AiProviderId) => {
    try {
      setSavingProvider(provider)
      if (window.helioxen?.credentials) {
        await window.helioxen.credentials.delete(provider)
        setTestResults((prev) => ({ ...prev, [provider]: null }))
        setBannerMessage({
          type: 'info',
          text: `Removed ${provider === 'google-gemini' ? 'Google Gemini' : 'OpenAI'} key from vault.`
        })
        await refreshStatus()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({ type: 'error', text: `Failed to delete credential: ${msg}` })
    } finally {
      setSavingProvider(null)
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
            text: `Connection test succeeded! ${provider} responded in ${result.latencyMs}ms using model ${result.model}.`
          })
        } else {
          setBannerMessage({
            type: 'error',
            text: `Connection test failed: ${result.errorMessage || 'Unknown error'}`
          })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBannerMessage({ type: 'error', text: `Connection test error: ${msg}` })
    } finally {
      setTestingProvider(null)
    }
  }

  return (
    <div className={`max-w-4xl w-full mx-auto space-y-6 animate-hx-fade-in ${className}`}>
      {/* Settings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hx-border-panel pb-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-hx-text-primary flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-hx-cyan" />
            AI Provider Credential Vault
          </h2>
          <p className="text-xs text-hx-text-secondary mt-1">
            Configure secure API keys for approved LLM providers. Stored with Windows DPAPI encryption in the trusted main process.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="nominal" size="sm" isDot>
            DPAPI PROTECTED
          </Badge>
          <Badge variant="info" size="sm">
            Phase 6 • Step 16
          </Badge>
        </div>
      </div>

      {/* Security Guarantee Notice */}
      <div className="p-3.5 rounded-hx-lg bg-hx-cyan/5 border border-hx-border-glow flex items-start gap-3 text-xs text-hx-text-secondary">
        <ShieldCheck className="w-4 h-4 text-hx-cyan shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-hx-text-primary">Zero Plaintext Persistence Guarantee:</span>
          <p className="leading-relaxed">
            API keys submitted here are immediately encrypted via native Windows DPAPI (Electron <code className="text-hx-cyan font-mono text-[11px]">safeStorage</code>) and saved to the application data vault. Plaintext keys are never sent back to the renderer, printed in logs, or synced to cloud backends.
          </p>
        </div>
      </div>

      {/* Status Alert Banner */}
      {bannerMessage && (
        <div
          role="alert"
          className={`p-3 rounded-hx-md text-xs font-mono flex items-center justify-between border ${
            bannerMessage.type === 'success'
              ? 'bg-hx-nominal/10 border-hx-nominal/40 text-hx-nominal'
              : bannerMessage.type === 'error'
              ? 'bg-hx-danger/10 border-hx-danger/40 text-hx-danger'
              : 'bg-hx-cyan/10 border-hx-border-glow text-hx-cyan'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Gemini Card (Primary Provider) */}
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-hx-space border border-hx-border-glow flex items-center justify-center text-hx-cyan">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-display font-semibold text-hx-text-primary">
                  Google Gemini
                </h3>
                <span className="text-[10px] font-mono text-hx-cyan uppercase tracking-wider">
                  Primary Assistant Provider
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

          <p className="text-xs text-hx-text-secondary leading-relaxed">
            Powers the orbital AI core reasoning and conversational intelligence using <code className="text-hx-cyan font-mono">gemini-3.8-flash</code> via the official <code className="text-hx-cyan font-mono">@google/genai</code> SDK.
          </p>

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

        {/* OpenAI Card (Secondary Provider) */}
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-hx-space border border-hx-border-subtle flex items-center justify-center text-hx-text-primary">
                <Sparkles className="w-4 h-4 text-hx-purple" />
              </div>
              <div>
                <h3 className="text-sm font-display font-semibold text-hx-text-primary">
                  OpenAI
                </h3>
                <span className="text-[10px] font-mono text-hx-purple uppercase tracking-wider">
                  Secondary Reasoning Provider
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

          <p className="text-xs text-hx-text-secondary leading-relaxed">
            Provides fallback and multi-provider reasoning via <code className="text-hx-purple font-mono">gpt-4o-mini</code> using the official <code className="text-hx-purple font-mono">openai</code> SDK.
          </p>

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
  )
}
