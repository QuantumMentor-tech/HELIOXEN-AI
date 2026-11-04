import React, { useState, useEffect, useCallback } from 'react'
import {
  Brain,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  Sparkles,
  Lock,
  Unlock,
  Sliders,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  MemoryStateOverview,
  MemoryRecord,
  MemoryCategory,
  ResponseTonePreference,
  FormattingPreference,
  DEFAULT_PROFILE_ID,
  DEFAULT_PERSONALIZATION_PREFERENCES,
  DEFAULT_MEMORY_CONSENT_SETTINGS
} from '../../../../shared/memory/types'

export interface MemoryVaultPanelProps {
  className?: string
  profileId?: string
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preferences: 'Preferences',
  projects: 'Projects',
  workflows: 'Workflows',
  reference_facts: 'Reference Facts',
  personalization_settings: 'Personalization Settings'
}

export const MemoryVaultPanel: React.FC<MemoryVaultPanelProps> = ({
  className = '',
  profileId = DEFAULT_PROFILE_ID
}) => {
  const [overview, setOverview] = useState<MemoryStateOverview>({
    profile: {
      profileId,
      displayName: 'Primary User',
      personalization: { ...DEFAULT_PERSONALIZATION_PREFERENCES },
      consent: { ...DEFAULT_MEMORY_CONSENT_SETTINGS },
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    activeMemoryCount: 0,
    supersededMemoryCount: 0,
    expiredMemoryCount: 0,
    pendingSuggestions: [],
    encryptionAvailable: false,
    storageHealthy: true
  })

  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')

  // Create memory form state
  const [newContent, setNewContent] = useState<string>('')
  const [newCategory, setNewCategory] = useState<MemoryCategory>('preferences')
  const [newProjectScope, setNewProjectScope] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<string>('')
  const [editCategory, setEditCategory] = useState<MemoryCategory>('preferences')
  const [editProjectScope, setEditProjectScope] = useState<string>('')

  // Profile personalization editor state
  const [displayName, setDisplayName] = useState<string>('Primary User')
  const [responseTone, setResponseTone] = useState<ResponseTonePreference>('balanced')
  const [preferredFormatting, setPreferredFormatting] = useState<FormattingPreference>('markdown')
  const [languagesInput, setLanguagesInput] = useState<string>('')
  const [workingConventions, setWorkingConventions] = useState<string>('')
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false)

  // Clear-all confirmation modal state
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false)
  const [resetPersonalizationOnClear, setResetPersonalizationOnClear] = useState<boolean>(false)
  const [isClearing, setIsClearing] = useState<boolean>(false)

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true)
      if (window.helioxen?.memory) {
        const state = await window.helioxen.memory.getState(profileId)
        setOverview(state)
        setDisplayName(state.profile.displayName)
        setResponseTone(state.profile.personalization.responseTone)
        setPreferredFormatting(state.profile.personalization.preferredFormatting)
        setLanguagesInput(state.profile.personalization.primaryLanguages.join(', '))
        setWorkingConventions(state.profile.personalization.customWorkingConventions)

        const list = await window.helioxen.memory.list({
          profileId,
          status: statusFilter,
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          searchQuery: searchQuery.trim() || undefined
        })
        setMemories(list)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to load memory state: ${msg}` })
    } finally {
      setIsLoading(false)
    }
  }, [profileId, statusFilter, selectedCategory, searchQuery])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  const handleToggleMemoryEnabled = async (nextEnabled: boolean) => {
    try {
      setBanner(null)
      if (window.helioxen?.memory) {
        const updatedProfile = await window.helioxen.memory.setConsent({
          profileId,
          memoryEnabled: nextEnabled
        })
        setOverview((prev) => ({ ...prev, profile: updatedProfile }))
        setBanner({
          type: 'info',
          text: nextEnabled
            ? 'Long-term memory enabled. HELIOXEN can now retain explicitly approved memories across conversations.'
            : 'Long-term memory disabled. No new persistent memories will be saved or retrieved for AI requests. Existing records remain available below for review or deletion.'
        })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to update memory consent: ${msg}` })
    }
  }

  const handleToggleCloudDisclosure = async (nextAllowCloud: boolean) => {
    try {
      setBanner(null)
      if (window.helioxen?.memory) {
        const updatedProfile = await window.helioxen.memory.setConsent({
          profileId,
          memoryEnabled: overview.profile.consent.memoryEnabled,
          allowMemoryInCloudRequests: nextAllowCloud
        })
        setOverview((prev) => ({ ...prev, profile: updatedProfile }))
        setBanner({
          type: 'info',
          text: nextAllowCloud
            ? 'Cloud AI provider memory transmission enabled for relevant active memories.'
            : 'Cloud AI provider memory transmission disabled. Stored memories will remain strictly local.'
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to update cloud disclosure setting: ${msg}` })
    }
  }

  const handleToggleSuggestions = async (nextAllowSuggestions: boolean) => {
    try {
      setBanner(null)
      if (window.helioxen?.memory) {
        const updatedProfile = await window.helioxen.memory.setConsent({
          profileId,
          memoryEnabled: overview.profile.consent.memoryEnabled,
          allowMemorySuggestions: nextAllowSuggestions
        })
        setOverview((prev) => ({ ...prev, profile: updatedProfile }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to update suggestion setting: ${msg}` })
    }
  }

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true)
      setBanner(null)
      const langs = languagesInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 15)

      if (window.helioxen?.memory) {
        const updated = await window.helioxen.memory.updateProfile({
          profileId,
          displayName: displayName.trim() || 'Primary User',
          personalization: {
            responseTone,
            preferredFormatting,
            primaryLanguages: langs,
            customWorkingConventions: workingConventions.trim()
          }
        })
        setOverview((prev) => ({ ...prev, profile: updated }))
        setBanner({
          type: 'success',
          text: 'User profile and personalization preferences saved.'
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to save profile preferences: ${msg}` })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleResetProfile = async () => {
    try {
      setIsSavingProfile(true)
      setBanner(null)
      if (window.helioxen?.memory) {
        await window.helioxen.memory.updateProfile({
          profileId,
          resetToDefaults: true
        })
        setBanner({
          type: 'info',
          text: 'Profile personalization preferences reset to defaults.'
        })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to reset profile: ${msg}` })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) {
      setBanner({ type: 'error', text: 'Memory content cannot be empty.' })
      return
    }

    try {
      setIsCreating(true)
      setBanner(null)
      if (window.helioxen?.memory) {
        const res = await window.helioxen.memory.create({
          profileId,
          content: newContent.trim(),
          category: newCategory,
          sourceType: 'explicit_user_request',
          projectScope: newProjectScope.trim() || undefined,
          consentBasis: 'explicit_save_command'
        })
        setNewContent('')
        setNewProjectScope('')
        setBanner({
          type: 'success',
          text: res.message
        })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: msg })
    } finally {
      setIsCreating(false)
    }
  }

  const handleStartEdit = (rec: MemoryRecord) => {
    setEditingId(rec.id)
    setEditContent(rec.content)
    setEditCategory(rec.category)
    setEditProjectScope(rec.projectScope || '')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) {
      setBanner({ type: 'error', text: 'Edited memory content cannot be empty.' })
      return
    }
    try {
      setBanner(null)
      if (window.helioxen?.memory) {
        const res = await window.helioxen.memory.update({
          id,
          profileId,
          content: editContent.trim(),
          category: editCategory,
          projectScope: editProjectScope.trim()
        })
        setEditingId(null)
        setBanner({ type: 'success', text: res.message })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: msg })
    }
  }

  const handleDeleteMemory = async (id: string) => {
    try {
      setBanner(null)
      if (window.helioxen?.memory) {
        const res = await window.helioxen.memory.delete({ id, profileId })
        if (editingId === id) setEditingId(null)
        setBanner({ type: 'info', text: res.message })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to delete memory: ${msg}` })
    }
  }

  const handleResolveSuggestion = async (suggestionId: string, action: 'approve' | 'dismiss') => {
    try {
      setBanner(null)
      if (window.helioxen?.memory) {
        const res = await window.helioxen.memory.resolveSuggestion({
          suggestionId,
          action,
          profileId
        })
        setBanner({
          type: action === 'approve' ? 'success' : 'info',
          text: res.message
        })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to resolve suggestion: ${msg}` })
    }
  }

  const handleConfirmClearAll = async () => {
    try {
      setIsClearing(true)
      setBanner(null)
      if (window.helioxen?.memory) {
        const res = await window.helioxen.memory.clearAll({
          profileId,
          confirmClearAll: true,
          resetPersonalization: resetPersonalizationOnClear
        })
        setShowClearConfirm(false)
        setResetPersonalizationOnClear(false)
        setBanner({ type: 'info', text: res.message })
        await refreshData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBanner({ type: 'error', text: `Failed to clear memories: ${msg}` })
    } finally {
      setIsClearing(false)
    }
  }

  const isMemoryEnabled = overview.profile.consent.memoryEnabled

  return (
    <div
      aria-label="Long-Term Memory and Personalization Vault"
      className={`max-w-5xl w-full mx-auto space-y-6 animate-hx-fade-in ${className}`}
    >
      {/* Top Status & Consent Disclosure Card */}
      <Card variant="panel" border="glow" padding="md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-hx-md bg-hx-space border border-hx-border-glow text-hx-cyan shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-display font-semibold text-hx-text-primary">
                  Consent-Based Long-Term Memory &amp; User Profile
                </h2>
                <Badge variant={isMemoryEnabled ? 'nominal' : 'warning'} size="sm" isDot>
                  {isMemoryEnabled ? 'MEMORY ENABLED (OPT-IN)' : 'MEMORY DISABLED (DEFAULT)'}
                </Badge>
                <Badge variant={overview.encryptionAvailable ? 'info' : 'neutral'} size="sm">
                  {overview.encryptionAvailable ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" /> OS SafeStorage Encrypted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Local Storage (SafeStorage Unavailable)
                    </span>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-hx-text-secondary leading-relaxed">
                HELIOXEN retains durable preferences, project constraints, and approved facts across conversations{' '}
                <strong>only when explicitly enabled</strong>. Temporary attachments, screenshots, microphone audio,
                passwords, API keys, and sensitive personal traits are excluded by default.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant={isMemoryEnabled ? 'outline' : 'primary'}
              size="sm"
              aria-pressed={isMemoryEnabled}
              onClick={() => handleToggleMemoryEnabled(!isMemoryEnabled)}
            >
              {isMemoryEnabled ? 'Disable Long-Term Memory' : 'Enable Long-Term Memory'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh Memory Vault"
              onClick={refreshData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Consent & Privacy Sub-Controls */}
        <div className="mt-4 pt-4 border-t border-hx-border-subtle grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle flex items-center justify-between gap-2">
            <div>
              <div className="font-medium text-hx-text-primary">Cloud Provider Disclosure</div>
              <div className="text-[11px] text-hx-text-muted">
                Allow relevant active memories to be included in external AI provider prompts.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={overview.profile.consent.allowMemoryInCloudRequests}
              aria-label="Allow Memory in Cloud Provider Requests"
              onClick={() =>
                handleToggleCloudDisclosure(!overview.profile.consent.allowMemoryInCloudRequests)
              }
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase transition-colors ${
                overview.profile.consent.allowMemoryInCloudRequests
                  ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40'
                  : 'bg-hx-space text-hx-text-muted border border-hx-border-subtle'
              }`}
            >
              {overview.profile.consent.allowMemoryInCloudRequests ? 'Allowed' : 'Local Only'}
            </button>
          </div>

          <div className="p-3 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle flex items-center justify-between gap-2">
            <div>
              <div className="font-medium text-hx-text-primary">Memory Save Suggestions</div>
              <div className="text-[11px] text-hx-text-muted">
                Allow transient proposals that require your approval before saving.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={overview.profile.consent.allowMemorySuggestions}
              aria-label="Allow Memory Save Suggestions"
              onClick={() =>
                handleToggleSuggestions(!overview.profile.consent.allowMemorySuggestions)
              }
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase transition-colors ${
                overview.profile.consent.allowMemorySuggestions
                  ? 'bg-hx-cyan/20 text-hx-cyan border border-hx-cyan/40'
                  : 'bg-hx-space text-hx-text-muted border border-hx-border-subtle'
              }`}
            >
              {overview.profile.consent.allowMemorySuggestions ? 'Enabled' : 'Muted'}
            </button>
          </div>

          <div className="p-3 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle flex items-center justify-between">
            <div>
              <div className="font-medium text-hx-text-primary">Vault Inventory</div>
              <div className="text-[11px] text-hx-text-muted">
                {overview.activeMemoryCount} Active • {overview.supersededMemoryCount} Superseded
              </div>
            </div>
            <Badge variant="neutral" size="sm">
              v{overview.profile.schemaVersion}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Status Notification Banner */}
      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-hx-md border flex items-center justify-between text-xs ${
            banner.type === 'success'
              ? 'bg-hx-nominal/10 border-hx-nominal/40 text-hx-nominal'
              : banner.type === 'error'
                ? 'bg-hx-critical/10 border-hx-critical/40 text-hx-critical'
                : 'bg-hx-cyan/10 border-hx-cyan/40 text-hx-cyan'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : banner.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setBanner(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Suggestions Section */}
      {overview.pendingSuggestions.length > 0 && (
        <Card variant="default" border="glow" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-display font-semibold text-hx-cyan uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Pending Memory Suggestions ({overview.pendingSuggestions.length})
            </h3>
            <span className="text-[11px] text-hx-text-muted">
              Transient until you approve or dismiss
            </span>
          </div>
          <div className="space-y-2">
            {overview.pendingSuggestions.map((sug) => (
              <div
                key={sug.id}
                className="p-3 rounded-hx-sm bg-hx-surface/70 border border-hx-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" size="sm">
                      {CATEGORY_LABELS[sug.category]}
                    </Badge>
                    {sug.projectScope && (
                      <Badge variant="neutral" size="sm">
                        Project: {sug.projectScope}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-medium text-hx-text-primary">{sug.proposedContent}</p>
                  <p className="text-[11px] text-hx-text-muted">Reason: {sug.reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleResolveSuggestion(sug.id, 'approve')}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Approve &amp; Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolveSuggestion(sug.id, 'dismiss')}
                    leftIcon={<X className="w-3.5 h-3.5" />}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Two-Column Grid: Profile Personalization & Create Memory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile Personalization Card */}
        <Card variant="default" border="subtle" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-display font-semibold text-hx-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-hx-cyan" />
              User Profile &amp; Personalization
            </h3>
            <Badge variant="neutral" size="sm">
              {overview.profile.profileId}
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label
                htmlFor="profile-display-name"
                className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
              >
                Display Name
              </label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Primary User"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="profile-response-tone"
                  className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
                >
                  Response Tone
                </label>
                <select
                  id="profile-response-tone"
                  value={responseTone}
                  onChange={(e) => setResponseTone(e.target.value as ResponseTonePreference)}
                  className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                >
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="profile-formatting"
                  className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
                >
                  Preferred Formatting
                </label>
                <select
                  id="profile-formatting"
                  value={preferredFormatting}
                  onChange={(e) => setPreferredFormatting(e.target.value as FormattingPreference)}
                  className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                >
                  <option value="markdown">Structured Markdown</option>
                  <option value="bullet_points">Bullet Points</option>
                  <option value="prose">Narrative Prose</option>
                  <option value="code_first">Code First</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-languages"
                className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
              >
                Primary Programming / Working Languages (Comma-separated)
              </label>
              <Input
                id="profile-languages"
                value={languagesInput}
                onChange={(e) => setLanguagesInput(e.target.value)}
                placeholder="e.g. TypeScript, Python, Rust"
              />
            </div>

            <div>
              <label
                htmlFor="profile-conventions"
                className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
              >
                Recurring Working Conventions
              </label>
              <textarea
                id="profile-conventions"
                rows={2}
                maxLength={500}
                value={workingConventions}
                onChange={(e) => setWorkingConventions(e.target.value)}
                placeholder="e.g. Prefer strict TypeScript types and minimal external dependencies."
                className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetProfile}
                disabled={isSavingProfile}
              >
                Reset Profile Defaults
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
              >
                Save Profile Preferences
              </Button>
            </div>
          </div>
        </Card>

        {/* Explicit Memory Creation Card */}
        <Card variant="default" border="subtle" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-display font-semibold text-hx-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-hx-cyan" />
              Add Explicit Memory Record
            </h3>
            <Badge variant={isMemoryEnabled ? 'nominal' : 'warning'} size="sm">
              {isMemoryEnabled ? 'Ready to Save' : 'Requires Opt-In'}
            </Badge>
          </div>

          <form onSubmit={handleCreateMemory} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-memory-category"
                  className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
                >
                  Category
                </label>
                <select
                  id="new-memory-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                  className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                >
                  <option value="preferences">Preferences</option>
                  <option value="projects">Projects</option>
                  <option value="workflows">Workflows</option>
                  <option value="reference_facts">Reference Facts</option>
                  <option value="personalization_settings">Personalization Settings</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-memory-project"
                  className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
                >
                  Project Scope (Optional)
                </label>
                <Input
                  id="new-memory-project"
                  value={newProjectScope}
                  onChange={(e) => setNewProjectScope(e.target.value)}
                  placeholder="e.g. helioxen-desktop"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="new-memory-content"
                className="block text-[11px] font-mono text-hx-text-muted uppercase mb-1"
              >
                Memory Fact or Preference
              </label>
              <textarea
                id="new-memory-content"
                rows={3}
                maxLength={2000}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                disabled={!isMemoryEnabled}
                placeholder={
                  isMemoryEnabled
                    ? 'e.g. Prefer step-by-step verification reports with clickable file links.'
                    : 'Enable Long-Term Memory above to save new persistent memories.'
                }
                className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan resize-none disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-hx-text-muted flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-hx-nominal shrink-0" />
                Secrets &amp; API keys are automatically blocked
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!isMemoryEnabled || isCreating || !newContent.trim()}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Save Memory
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Stored Memories Inspection, Editing, and Deletion List */}
      <Card variant="default" border="subtle" padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-display font-semibold text-hx-text-primary uppercase tracking-wider">
              Stored Long-Term Memories ({memories.length})
            </h3>
            <p className="text-[11px] text-hx-text-secondary">
              Stored memories are treated strictly as contextual reference data and never grant system or tool permissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-hx-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search stored memories"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter memories..."
                className="pl-8 pr-3 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
              />
            </div>

            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as MemoryCategory | 'all')}
              className="px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
            >
              <option value="all">All Categories</option>
              <option value="preferences">Preferences</option>
              <option value="projects">Projects</option>
              <option value="workflows">Workflows</option>
              <option value="reference_facts">Reference Facts</option>
              <option value="personalization_settings">Personalization</option>
            </select>

            <select
              aria-label="Filter by lifecycle status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all')}
              className="px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
            >
              <option value="active">Active Only</option>
              <option value="all">Include Superseded</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              className="text-hx-critical border-hx-critical/30 hover:bg-hx-critical/10"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear All Memories
            </Button>
          </div>
        </div>

        {/* Two-Step Bulk Clear Confirmation Dialog */}
        {showClearConfirm && (
          <div
            role="alertdialog"
            aria-labelledby="clear-memories-title"
            className="mb-4 p-4 rounded-hx-md bg-hx-critical/10 border border-hx-critical/40 space-y-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-hx-critical shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 id="clear-memories-title" className="font-semibold text-hx-text-primary">
                  Confirm Bulk Deletion of Stored Memories
                </h4>
                <p className="text-hx-text-secondary leading-relaxed">
                  This action permanently deletes all stored memory records and pending suggestions for profile{' '}
                  <code className="font-mono text-hx-cyan">{profileId}</code> and invalidates retrieval caches.
                  Unrelated data—including API credentials, AI provider configurations, conversation history, and
                  local project files—will <strong>not</strong> be affected.
                </p>
                <label className="inline-flex items-center gap-2 pt-1 cursor-pointer text-hx-text-primary">
                  <input
                    type="checkbox"
                    checked={resetPersonalizationOnClear}
                    onChange={(e) => setResetPersonalizationOnClear(e.target.checked)}
                    className="rounded border-hx-border-subtle"
                  />
                  <span>Also reset profile personalization preferences to defaults</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowClearConfirm(false)
                  setResetPersonalizationOnClear(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isClearing}
                onClick={handleConfirmClearAll}
                className="bg-hx-critical hover:bg-hx-critical/90 text-white"
              >
                Confirm Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Memory List or Empty State */}
        {memories.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-hx-border-subtle rounded-hx-md">
            <Brain className="w-8 h-8 text-hx-text-muted mx-auto opacity-60" />
            <p className="text-xs font-medium text-hx-text-primary">
              No stored memory records match the current view.
            </p>
            <p className="text-[11px] text-hx-text-muted max-w-md mx-auto">
              {isMemoryEnabled
                ? 'Add a durable preference, project constraint, or reference fact above, or ask HELIOXEN to remember specific approved context.'
                : 'Long-term memory is currently disabled. Enable Long-Term Memory at the top of this panel to start retaining approved preferences across conversations.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {memories.map((rec) => {
              const isEditing = editingId === rec.id
              return (
                <div
                  key={rec.id}
                  className={`p-3 rounded-hx-sm border transition-all text-xs ${
                    rec.status === 'active'
                      ? 'bg-hx-surface/60 border-hx-border-subtle'
                      : 'bg-hx-space/40 border-hx-border-subtle opacity-65'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          aria-label="Edit memory category"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                          className="px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                        >
                          <option value="preferences">Preferences</option>
                          <option value="projects">Projects</option>
                          <option value="workflows">Workflows</option>
                          <option value="reference_facts">Reference Facts</option>
                          <option value="personalization_settings">Personalization Settings</option>
                        </select>
                        <Input
                          aria-label="Edit project scope"
                          value={editProjectScope}
                          onChange={(e) => setEditProjectScope(e.target.value)}
                          placeholder="Project scope (optional)"
                        />
                      </div>
                      <textarea
                        aria-label="Edit memory content"
                        rows={2}
                        maxLength={2000}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 rounded-hx-sm bg-hx-space border border-hx-border-subtle text-xs text-hx-text-primary"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveEdit(rec.id)}
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="info" size="sm">
                            {CATEGORY_LABELS[rec.category]}
                          </Badge>
                          <Badge
                            variant={rec.status === 'active' ? 'nominal' : 'warning'}
                            size="sm"
                          >
                            {rec.status.toUpperCase()}
                          </Badge>
                          {rec.projectScope && (
                            <Badge variant="neutral" size="sm">
                              Project: {rec.projectScope}
                            </Badge>
                          )}
                          <span className="text-[10px] font-mono text-hx-text-muted">
                            Source: {rec.sourceType.replace(/_/g, ' ')} • Updated{' '}
                            {new Date(rec.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-hx-text-primary leading-relaxed break-words">
                          {rec.content}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Edit memory ${rec.id}`}
                          onClick={() => handleStartEdit(rec)}
                          className="p-1.5 rounded text-hx-text-muted hover:text-hx-cyan hover:bg-hx-space transition-colors"
                          title="Edit memory"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete memory ${rec.id}`}
                          onClick={() => handleDeleteMemory(rec.id)}
                          className="p-1.5 rounded text-hx-text-muted hover:text-hx-critical hover:bg-hx-space transition-colors"
                          title="Delete memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

