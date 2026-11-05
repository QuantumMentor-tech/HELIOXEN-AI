import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Share2,
  Mail,
  MessageSquare,
  Music,
  Radio,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Search,
  Shield,
  ShieldAlert,
  Clock,
  Sparkles,
  Check,
  X,
  Tv,
  ListMusic,
  Smartphone,
  Home,
  Battery,
  BatteryCharging,
  Lock,
  Unlock,
  Thermometer,
  Lightbulb,
  Sliders,
  Power,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input } from '../ui/Input'
import {
  IntegrationDescriptor,
  IntegrationConnectionStatus,
  ConnectIntegrationRequest
} from '../../../../shared/integrations/types'
import {
  CommunicationChannelType,
  CommunicationMessage,
  MessageDraft,
  MessageRecipient,
  SendConfirmationRequest
} from '../../../../shared/communication/types'
import {
  validateRecipientAddress,
  detectUnresolvedPlaceholders
} from '../../../../shared/communication/contracts'
import {
  MediaItem,
  MediaPlaylist,
  MediaPlaybackDevice,
  MediaPlaybackState,
  PlaybackActionName
} from '../../../../shared/media-integrations/types'
import {
  AndroidDevice,
  AndroidActionType
} from '../../../../shared/devices/types'
import {
  SmartHomeEntity,
  SmartHomeHubDescriptor,
  SmartHomeSecurityConfirmationRequest,
  SmartHomeEntityDomain
} from '../../../../shared/smart-home/types'
import { isHighRiskPhysicalAction } from '../../../../shared/smart-home/contracts'

type HubTab = 'connectors' | 'communication' | 'media' | 'devices' | 'smart_home'

export const IntegrationsHubPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HubTab>('connectors')
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // --------------------------------------------------------------------------
  // Connectors State
  // --------------------------------------------------------------------------
  const [integrations, setIntegrations] = useState<readonly IntegrationDescriptor[]>([])
  const [loadingIntegrations, setLoadingIntegrations] = useState<boolean>(false)
  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false)
  const [selectedIntegrationForConnect, setSelectedIntegrationForConnect] = useState<IntegrationDescriptor | null>(null)
  const [connectCredentials, setConnectCredentials] = useState<Record<string, string>>({})
  const [healthStatusMap, setHealthStatusMap] = useState<Record<string, { status: IntegrationConnectionStatus; latencyMs?: number; error?: string }>>({})

  // --------------------------------------------------------------------------
  // Communication State
  // --------------------------------------------------------------------------
  const [messages, setMessages] = useState<CommunicationMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMessage | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'team_chat' | 'webhook_messaging'>('all')

  // Draft Compose State
  const [draftRecipientInput, setDraftRecipientInput] = useState<string>('team-alerts@helioxen.internal')
  const [draftSubject, setDraftSubject] = useState<string>('Executive Update: Project Milestones')
  const [draftBody, setDraftBody] = useState<string>(
    'Hello [name],\n\nPlease find the attached weekly briefing. Note that TODO items must be closed before Friday.\n\nBest regards,\nHelioxen System'
  )
  const [draftChannel, setDraftChannel] = useState<CommunicationChannelType>('email')
  const [activeDraft, setActiveDraft] = useState<MessageDraft | null>(null)

  // AI Draft Assistance State
  const [aiDraftPrompt, setAiDraftPrompt] = useState<string>('')
  const [isAiDrafting, setIsAiDrafting] = useState<boolean>(false)
  const [aiDraftProposal, setAiDraftProposal] = useState<{ suggestedSubject?: string; draftBody: string; explanation: string } | null>(null)

  // Mandatory Two-Tier Human Confirmation Modal State
  const [confirmationModalOpen, setConfirmationModalOpen] = useState<boolean>(false)
  const [activeConfirmation, setActiveConfirmation] = useState<SendConfirmationRequest | null>(null)
  const [confirmationTimeRemaining, setConfirmationTimeRemaining] = useState<number>(60)
  const [isSending, setIsSending] = useState<boolean>(false)

  // --------------------------------------------------------------------------
  // Media Integrations State
  // --------------------------------------------------------------------------
  const [playbackState, setPlaybackState] = useState<MediaPlaybackState>({
    integrationId: 'integration_spotify_streaming',
    isPlaying: false,
    volumePercent: 75,
    repeatMode: 'off',
    shuffleState: false,
    progressMs: 65000,
    durationMs: 240000,
    activeDevice: { id: 'dev-desktop-01', name: 'Workstation High-Res Audio', type: 'computer', isActive: true, volumePercent: 75 },
    supportedActions: ['play', 'pause', 'skip_next', 'skip_previous', 'seek', 'set_volume', 'select_device'],
    currentItem: {
      id: 'trk-01',
      providerItemId: 'spotify:track:01',
      integrationId: 'integration_spotify_streaming',
      title: 'Solar Wind Echoes',
      artistOrCreator: 'Stellar Soundscapes',
      albumOrCollection: 'Orbital Resonance Vol. 1',
      durationMs: 240000,
      isPlayable: true
    }
  })
  const [devices, setDevices] = useState<readonly MediaPlaybackDevice[]>([
    { id: 'dev-desktop-01', name: 'Workstation High-Res Audio', type: 'computer', isActive: true, volumePercent: 75 },
    { id: 'dev-speakers-02', name: 'Living Room Studio Monitors', type: 'speaker', isActive: false, volumePercent: 60 }
  ])
  const [playlists, setPlaylists] = useState<readonly MediaPlaylist[]>([])
  const [mediaSearchQuery, setMediaSearchQuery] = useState<string>('')
  const [mediaSearchResults, setMediaSearchResults] = useState<readonly MediaItem[]>([])
  const [isSearchingMedia, setIsSearchingMedia] = useState<boolean>(false)

  // --------------------------------------------------------------------------
  // Android Devices State (Step 45)
  // --------------------------------------------------------------------------
  const [androidDevices, setAndroidDevices] = useState<AndroidDevice[]>([])
  const [selectedAndroidDevice, setSelectedAndroidDevice] = useState<AndroidDevice | null>(null)
  const [pairingModalOpen, setPairingModalOpen] = useState<boolean>(false)
  const [pairingCodeInput, setPairingCodeInput] = useState<string>('')
  const [isExecutingDeviceAction, setIsExecutingDeviceAction] = useState<boolean>(false)

  // --------------------------------------------------------------------------
  // Smart-Home State (Step 45)
  // --------------------------------------------------------------------------
  const [smartHomeHub, setSmartHomeHub] = useState<SmartHomeHubDescriptor | null>(null)
  const [smartHomeEntities, setSmartHomeEntities] = useState<SmartHomeEntity[]>([])
  const [domainFilter, setDomainFilter] = useState<'all' | SmartHomeEntityDomain>('all')
  const [smartHomeConfirmModalOpen, setSmartHomeConfirmModalOpen] = useState<boolean>(false)
  const [activeSmartHomeConfirmation, setActiveSmartHomeConfirmation] = useState<SmartHomeSecurityConfirmationRequest | null>(null)
  const [smartHomeConfirmTimeRemaining, setSmartHomeConfirmTimeRemaining] = useState<number>(60)
  const [isActuating, setIsActuating] = useState<boolean>(false)

  // --------------------------------------------------------------------------
  // Data Fetching & Sync
  // --------------------------------------------------------------------------
  const loadIntegrations = useCallback(async () => {
    try {
      setLoadingIntegrations(true)
      if (window.helioxen?.integrations) {
        const list = await window.helioxen.integrations.listIntegrations()
        setIntegrations(list)
      }
    } catch (err: unknown) {
      console.error('Failed to load integrations:', err)
    } finally {
      setLoadingIntegrations(false)
    }
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      if (window.helioxen?.communication) {
        const query: any = {}
        if (channelFilter !== 'all') query.channelType = channelFilter
        if (searchQuery.trim()) query.query = searchQuery.trim()
        const msgs = await window.helioxen.communication.listMessages(query)
        setMessages(msgs)
        if (msgs.length > 0 && !selectedMessage) {
          setSelectedMessage(msgs[0])
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load messages:', err)
    }
  }, [channelFilter, searchQuery, selectedMessage])

  const loadMediaData = useCallback(async () => {
    try {
      if (window.helioxen?.mediaIntegration) {
        const state = await window.helioxen.mediaIntegration.getPlaybackState()
        setPlaybackState(state)
        const devs = await window.helioxen.mediaIntegration.listDevices()
        setDevices(devs)
        const pls = await window.helioxen.mediaIntegration.listPlaylists()
        setPlaylists(pls)
      }
    } catch (err: unknown) {
      console.error('Failed to load media state:', err)
    }
  }, [])

  const loadAndroidData = useCallback(async () => {
    try {
      if (window.helioxen?.devices) {
        const list = await window.helioxen.devices.listAndroid()
        setAndroidDevices(list)
        if (list.length > 0 && !selectedAndroidDevice) {
          setSelectedAndroidDevice(list[0])
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load android devices:', err)
    }
  }, [selectedAndroidDevice])

  const loadSmartHomeData = useCallback(async () => {
    try {
      if (window.helioxen?.smartHome) {
        const hub = await window.helioxen.smartHome.getHubStatus('hub_home_assistant_local')
        setSmartHomeHub(hub)
        const ents = await window.helioxen.smartHome.listEntities()
        setSmartHomeEntities(ents)
      }
    } catch (err: unknown) {
      console.error('Failed to load smart home data:', err)
    }
  }, [])

  useEffect(() => {
    loadIntegrations()
    loadMessages()
    loadMediaData()
    loadAndroidData()
    loadSmartHomeData()
  }, [loadIntegrations, loadMessages, loadMediaData, loadAndroidData, loadSmartHomeData])

  // Countdown timer for communication send confirmation TTL
  useEffect(() => {
    if (!confirmationModalOpen || !activeConfirmation) return

    const targetTime = activeConfirmation.expiresAt
    const timer = setInterval(() => {
      const now = Date.now()
      const diffSecs = Math.max(0, Math.floor((targetTime - now) / 1000))
      setConfirmationTimeRemaining(diffSecs)
      if (diffSecs <= 0) {
        clearInterval(timer)
        setStatusMessage({ text: 'Send authorization token expired. You must re-authorize.', type: 'error' })
        setConfirmationModalOpen(false)
        setActiveConfirmation(null)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [confirmationModalOpen, activeConfirmation])

  // Countdown timer for smart-home physical security confirmation TTL
  useEffect(() => {
    if (!smartHomeConfirmModalOpen || !activeSmartHomeConfirmation) return

    const targetTime = activeSmartHomeConfirmation.expiresAt
    const timer = setInterval(() => {
      const now = Date.now()
      const diffSecs = Math.max(0, Math.floor((targetTime - now) / 1000))
      setSmartHomeConfirmTimeRemaining(diffSecs)
      if (diffSecs <= 0) {
        clearInterval(timer)
        setStatusMessage({ text: 'Physical security confirmation token expired.', type: 'error' })
        setSmartHomeConfirmModalOpen(false)
        setActiveSmartHomeConfirmation(null)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [smartHomeConfirmModalOpen, activeSmartHomeConfirmation])

  // Unresolved placeholder detection
  const detectedPlaceholders = useMemo(() => {
    return detectUnresolvedPlaceholders(draftBody)
  }, [draftBody])

  // Recipient address validation
  const recipientValidation = useMemo(() => {
    return validateRecipientAddress(draftRecipientInput.trim(), draftChannel)
  }, [draftRecipientInput, draftChannel])

  // Filtered smart home entities
  const filteredEntities = useMemo(() => {
    if (domainFilter === 'all') return smartHomeEntities
    return smartHomeEntities.filter((e) => e.domain === domainFilter)
  }, [smartHomeEntities, domainFilter])

  // --------------------------------------------------------------------------
  // Integration Actions
  // --------------------------------------------------------------------------
  const handleTestHealth = async (integrationId: string) => {
    if (!window.helioxen?.integrations) return
    try {
      const result = await window.helioxen.integrations.checkHealth(integrationId)
      setHealthStatusMap((prev) => ({ ...prev, [integrationId]: result }))
      setStatusMessage({
        text: `Health check for ${integrationId}: ${result.status.toUpperCase()} (${result.latencyMs ?? 0}ms)`,
        type: result.status === 'connected' ? 'success' : 'error'
      })
    } catch (err: any) {
      setStatusMessage({ text: `Health check failed: ${err.message}`, type: 'error' })
    }
  }

  const handleOpenConnectModal = (item: IntegrationDescriptor) => {
    setSelectedIntegrationForConnect(item)
    setConnectCredentials({})
    setConnectModalOpen(true)
  }

  const handleConnectIntegration = async () => {
    if (!selectedIntegrationForConnect || !window.helioxen?.integrations) return
    try {
      const req: ConnectIntegrationRequest = {
        integrationId: selectedIntegrationForConnect.id,
        credentials: connectCredentials
      }
      const res = await window.helioxen.integrations.connectIntegration(req)
      if (res.success) {
        setStatusMessage({ text: `Successfully connected ${res.integrationId}`, type: 'success' })
        setConnectModalOpen(false)
        await loadIntegrations()
        await loadAndroidData()
        await loadSmartHomeData()
      } else {
        setStatusMessage({ text: 'Connection was not completed', type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Connection error: ${err.message}`, type: 'error' })
    }
  }

  const handleDisconnectIntegration = async (integrationId: string) => {
    if (!window.helioxen?.integrations) return
    try {
      const res = await window.helioxen.integrations.disconnectIntegration({ integrationId, revokeRemote: true })
      if (res.success) {
        setStatusMessage({ text: `Disconnected ${integrationId} and purged DPAPI credentials`, type: 'info' })
        await loadIntegrations()
      } else {
        setStatusMessage({ text: 'Disconnect failed', type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Disconnect error: ${err.message}`, type: 'error' })
    }
  }

  // --------------------------------------------------------------------------
  // Communication Actions
  // --------------------------------------------------------------------------
  const handleCreateOrUpdateDraft = async (): Promise<MessageDraft | null> => {
    if (!window.helioxen?.communication) return null
    if (!recipientValidation.valid) {
      setStatusMessage({ text: `Cannot save draft: ${recipientValidation.reason}`, type: 'error' })
      return null
    }

    try {
      const recipients: readonly MessageRecipient[] = [{ address: draftRecipientInput.trim(), type: 'to' }]
      const draft = await window.helioxen.communication.createDraft({
        channelType: draftChannel,
        recipients,
        subject: draftSubject,
        body: draftBody
      })
      setActiveDraft(draft)
      setStatusMessage({ text: `Draft saved securely (Hash: ${draft.contentHash.substring(0, 10)}...)`, type: 'success' })
      return draft
    } catch (err: any) {
      setStatusMessage({ text: `Failed to save draft: ${err.message}`, type: 'error' })
      return null
    }
  }

  const handleGenerateAiDraft = async () => {
    if (!aiDraftPrompt.trim() || !window.helioxen?.communication) return
    try {
      setIsAiDrafting(true)
      const proposal = await window.helioxen.communication.generateAiDraft({
        prompt: aiDraftPrompt,
        instruction: draftSubject,
        tone: 'formal'
      })
      setAiDraftProposal({
        suggestedSubject: proposal.subject,
        draftBody: proposal.body,
        explanation: proposal.summary
      })
      setStatusMessage({ text: 'AI proposal generated in quarantine. Review before applying.', type: 'info' })
    } catch (err: any) {
      setStatusMessage({ text: `AI draft failed: ${err.message}`, type: 'error' })
    } finally {
      setIsAiDrafting(false)
    }
  }

  const handleAcceptAiProposal = () => {
    if (!aiDraftProposal) return
    if (aiDraftProposal.suggestedSubject) {
      setDraftSubject(aiDraftProposal.suggestedSubject)
    }
    setDraftBody(aiDraftProposal.draftBody)
    setAiDraftProposal(null)
    setStatusMessage({ text: 'AI proposal applied to draft editor. Review placeholders before sending.', type: 'success' })
  }

  const handleInitiateSendFlow = async () => {
    if (!recipientValidation.valid) {
      setStatusMessage({ text: `Cannot send: ${recipientValidation.reason}`, type: 'error' })
      return
    }
    if (detectedPlaceholders.length > 0) {
      setStatusMessage({
        text: `Cannot send: Unresolved placeholders detected (${detectedPlaceholders.join(', ')}). Replace them first.`,
        type: 'error'
      })
      return
    }

    const draft = await handleCreateOrUpdateDraft()
    if (!draft || !window.helioxen?.communication) return

    try {
      const confReq = await window.helioxen.communication.requestSendConfirmation({
        draftId: draft.id
      })
      setActiveConfirmation(confReq)
      setConfirmationModalOpen(true)
    } catch (err: any) {
      setStatusMessage({ text: `Failed to initiate confirmation: ${err.message}`, type: 'error' })
    }
  }

  const handleFinalAuthorizeAndSend = async () => {
    if (!activeDraft || !activeConfirmation || !window.helioxen?.communication) return
    try {
      setIsSending(true)
      const idempotencyKey = `user-send-${activeDraft.id}-${Date.now()}`
      const result = await window.helioxen.communication.confirmAndSend({
        confirmationId: activeConfirmation.confirmationId,
        draftId: activeDraft.id,
        approvedDraftHash: activeConfirmation.draftHash,
        idempotencyKey
      })

      if (result.success) {
        setStatusMessage({
          text: `Message successfully dispatched! Delivery status: ${result.deliveryStatus} (ID: ${result.messageId})`,
          type: 'success'
        })
        setConfirmationModalOpen(false)
        setActiveConfirmation(null)
        setActiveDraft(null)
        setDraftSubject('')
        setDraftBody('')
        await loadMessages()
      } else {
        setStatusMessage({ text: `Send rejected: ${result.error}`, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Transmission failed: ${err.message}`, type: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  // --------------------------------------------------------------------------
  // Media Playback Actions
  // --------------------------------------------------------------------------
  const handleMediaControl = async (action: PlaybackActionName, volumePercent?: number, targetDeviceId?: string) => {
    if (!window.helioxen?.mediaIntegration) return
    try {
      const res = await window.helioxen.mediaIntegration.executeControl({
        action,
        integrationId: playbackState.integrationId,
        volumePercent,
        targetDeviceId
      })
      if (res.success && res.updatedPlaybackState) {
        setPlaybackState(res.updatedPlaybackState)
        setStatusMessage({ text: `Media action executed: ${action}`, type: 'success' })
      } else {
        setStatusMessage({ text: `Media control failed: ${res.error || res.message}`, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Media control error: ${err.message}`, type: 'error' })
    }
  }

  const handleSearchMediaCatalog = async () => {
    if (!mediaSearchQuery.trim() || !window.helioxen?.mediaIntegration) return
    try {
      setIsSearchingMedia(true)
      const result = await window.helioxen.mediaIntegration.searchCatalog({
        query: mediaSearchQuery.trim(),
        limit: 10
      })
      setMediaSearchResults(result.items)
    } catch (err: any) {
      setStatusMessage({ text: `Media search failed: ${err.message}`, type: 'error' })
    } finally {
      setIsSearchingMedia(false)
    }
  }

  // --------------------------------------------------------------------------
  // Android Device Actions (Step 45)
  // --------------------------------------------------------------------------
  const handleExecuteAndroidAction = async (action: AndroidActionType, parameters?: Record<string, unknown>) => {
    if (!selectedAndroidDevice || !window.helioxen?.devices) return
    try {
      setIsExecutingDeviceAction(true)
      const res = await window.helioxen.devices.executeAndroidAction({
        deviceId: selectedAndroidDevice.id,
        action,
        parameters
      })
      if (res.success) {
        setStatusMessage({ text: `${res.message} (Data: ${JSON.stringify(res.data)})`, type: 'success' })
        await loadAndroidData()
      } else {
        setStatusMessage({ text: `Device action failed: ${res.error || res.message}`, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Android action error: ${err.message}`, type: 'error' })
    } finally {
      setIsExecutingDeviceAction(false)
    }
  }

  const handlePairAndroidDevice = async () => {
    if (!selectedAndroidDevice || !window.helioxen?.devices) return
    try {
      const res = await window.helioxen.devices.pairAndroid({
        deviceId: selectedAndroidDevice.id,
        pairingMethod: selectedAndroidDevice.connectionType === 'wifi_pairing' ? 'wireless_pair_code' : 'adb_usb',
        pairingCode: pairingCodeInput.trim() || undefined
      })
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' })
        setPairingModalOpen(false)
        setPairingCodeInput('')
        await loadAndroidData()
      } else {
        setStatusMessage({ text: `Pairing failed: ${res.error || res.message}`, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Pairing error: ${err.message}`, type: 'error' })
    }
  }

  const handleDisconnectAndroidDevice = async (deviceId: string) => {
    if (!window.helioxen?.devices) return
    try {
      const success = await window.helioxen.devices.disconnectAndroid(deviceId)
      if (success) {
        setStatusMessage({ text: `Device ${deviceId} disconnected and authorization revoked.`, type: 'info' })
        await loadAndroidData()
      }
    } catch (err: any) {
      setStatusMessage({ text: `Disconnect error: ${err.message}`, type: 'error' })
    }
  }

  // --------------------------------------------------------------------------
  // Smart-Home Actions (Step 45)
  // --------------------------------------------------------------------------
  const handleSmartHomeAction = async (entity: SmartHomeEntity, command: string, parameters?: Record<string, unknown>) => {
    if (!smartHomeHub || !window.helioxen?.smartHome) return

    const isPhysical = isHighRiskPhysicalAction(entity.domain, command)

    // If it's a physical security action (lock, alarm, cover), request explicit confirmation first!
    if (isPhysical) {
      try {
        const conf = await window.helioxen.smartHome.requestSecurityConfirmation({
          hubId: smartHomeHub.hubId,
          entityId: entity.entityId,
          command
        })
        setActiveSmartHomeConfirmation(conf)
        setSmartHomeConfirmModalOpen(true)
        return
      } catch (err: any) {
        setStatusMessage({ text: `Failed to initiate security confirmation: ${err.message}`, type: 'error' })
        return
      }
    }

    // Ordinary reversible action execution
    try {
      setIsActuating(true)
      const res = await window.helioxen.smartHome.executeAction({
        hubId: smartHomeHub.hubId,
        entityId: entity.entityId,
        command,
        parameters
      })
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' })
        await loadSmartHomeData()
      } else {
        setStatusMessage({ text: `Action rejected: ${res.error || res.message}`, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Smart home error: ${err.message}`, type: 'error' })
    } finally {
      setIsActuating(false)
    }
  }

  const handleAuthorizePhysicalSmartHomeAction = async () => {
    if (!activeSmartHomeConfirmation || !smartHomeHub || !window.helioxen?.smartHome) return
    try {
      setIsActuating(true)
      const res = await window.helioxen.smartHome.executeAction({
        hubId: smartHomeHub.hubId,
        entityId: activeSmartHomeConfirmation.entityId,
        command: activeSmartHomeConfirmation.command,
        confirmationToken: activeSmartHomeConfirmation.token
      })

      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' })
        setSmartHomeConfirmModalOpen(false)
        setActiveSmartHomeConfirmation(null)
        await loadSmartHomeData()
      } else {
        setStatusMessage({ text: `Action rejected: ${res.error || res.message}`, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Physical action failed: ${err.message}`, type: 'error' })
    } finally {
      setIsActuating(false)
    }
  }

  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="flex flex-col h-full bg-hx-space text-hx-text-primary overflow-hidden">
      {/* Top Hub Navigation Bar */}
      <div className="flex items-center justify-between border-b border-hx-border-panel px-6 py-3 bg-hx-panel/40">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-hx-space border border-hx-border-glow text-hx-cyan">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide">INTEGRATION &amp; WORKFLOW HUB</h1>
            <p className="text-xs text-hx-text-secondary">
              Communication, Media, Android Devices &amp; Smart-Home Automation
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-hx-space/80 p-1 rounded-lg border border-hx-border-panel space-x-1">
          <button
            onClick={() => setActiveTab('connectors')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'connectors'
                ? 'bg-hx-panel text-hx-cyan border border-hx-border-glow shadow-sm'
                : 'text-hx-text-secondary hover:text-hx-text-primary'
            }`}
          >
            Connected Services
          </button>
          <button
            onClick={() => setActiveTab('communication')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'communication'
                ? 'bg-hx-panel text-hx-cyan border border-hx-border-glow shadow-sm'
                : 'text-hx-text-secondary hover:text-hx-text-primary'
            }`}
          >
            Communication
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'media'
                ? 'bg-hx-panel text-hx-cyan border border-hx-border-glow shadow-sm'
                : 'text-hx-text-secondary hover:text-hx-text-primary'
            }`}
          >
            Media Player
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1 ${
              activeTab === 'devices'
                ? 'bg-hx-panel text-hx-cyan border border-hx-border-glow shadow-sm'
                : 'text-hx-text-secondary hover:text-hx-text-primary'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Devices</span>
          </button>
          <button
            onClick={() => setActiveTab('smart_home')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1 ${
              activeTab === 'smart_home'
                ? 'bg-hx-panel text-hx-cyan border border-hx-border-glow shadow-sm'
                : 'text-hx-text-secondary hover:text-hx-text-primary'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Smart Home</span>
          </button>
        </div>
      </div>

      {/* Global Status Toast / Alert Bar */}
      {statusMessage && (
        <div
          className={`px-6 py-2 text-xs flex items-center justify-between transition-all ${
            statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-b border-rose-800 text-rose-200'
              : statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-b border-emerald-800 text-emerald-200'
              : 'bg-cyan-950/80 border-b border-cyan-800 text-cyan-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Shield className="w-4 h-4 text-cyan-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab 1: Connectors & Services Management */}
      {activeTab === 'connectors' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Authorized Integration Adapters</h2>
              <p className="text-xs text-hx-text-secondary">
                Securely connected external communication channels, media services, Android devices, and smart-home hubs with DPAPI credential encryption.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadIntegrations}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingIntegrations ? 'animate-spin' : ''}`} />}
            >
              Refresh Services
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((item) => {
              const health = healthStatusMap[item.id]
              const isConnected = item.status === 'connected'

              return (
                <Card key={item.id} variant="panel" border="panel" padding="md" className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-lg bg-hx-space border border-hx-border-panel text-hx-cyan">
                        {item.category === 'communication' ? (
                          item.id.includes('email') ? <Mail className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />
                        ) : item.category === 'media' ? (
                          item.id.includes('spotify') ? <Music className="w-5 h-5" /> : <Radio className="w-5 h-5" />
                        ) : item.category === 'device' ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Home className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-semibold">{item.displayName}</h3>
                          <Badge
                            variant={isConnected ? 'nominal' : item.status === 'limited_permissions' ? 'warning' : 'neutral'}
                            size="sm"
                            isDot
                          >
                            {item.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-hx-text-secondary line-clamp-1">{item.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Protocols & Scopes */}
                  <div className="space-y-1.5 pt-2 border-t border-hx-border-panel/50 text-xs">
                    <div className="flex items-center justify-between text-hx-text-secondary">
                      <span>Protocols:</span>
                      <span className="font-mono text-hx-text-primary capitalize">{item.supportedProtocols.join(', ')}</span>
                    </div>
                    {item.connectedAccountLabel && (
                      <div className="flex items-center justify-between text-hx-text-secondary">
                        <span>Connected Account:</span>
                        <span className="font-mono text-hx-cyan truncate max-w-[200px]">{item.connectedAccountLabel}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.grantedScopes.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-hx-space/80 border border-hx-border-panel text-[10px] font-mono text-hx-text-secondary">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Health Check & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-hx-border-panel/50">
                    <div className="text-[11px] text-hx-text-secondary">
                      {health ? (
                        <span>Ping: {health.latencyMs}ms</span>
                      ) : item.lastHealthCheckAt ? (
                        <span>Synced: {new Date(item.lastHealthCheckAt).toLocaleTimeString()}</span>
                      ) : (
                        <span>Status: {item.isHealthy ? 'Healthy' : 'Not configured'}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestHealth(item.id)}
                      >
                        Test Ping
                      </Button>
                      {isConnected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnectIntegration(item.id)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenConnectModal(item)}
                        >
                          Connect Account
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Communication & Messaging */}
      {activeTab === 'communication' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Inbox / Message Search */}
          <div className="w-1/3 min-w-[320px] max-w-[420px] border-r border-hx-border-panel flex flex-col bg-hx-space/40">
            <div className="p-3 border-b border-hx-border-panel space-y-2">
              <div className="flex items-center space-x-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inbound messages..."
                  leftIcon={<Search className="w-3.5 h-3.5 text-hx-text-secondary" />}
                />
                <Button variant="secondary" size="sm" onClick={loadMessages}>
                  Filter
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setChannelFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      channelFilter === 'all' ? 'bg-hx-cyan/20 text-hx-cyan font-medium' : 'text-hx-text-secondary'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setChannelFilter('email')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      channelFilter === 'email' ? 'bg-hx-cyan/20 text-hx-cyan font-medium' : 'text-hx-text-secondary'
                    }`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => setChannelFilter('webhook_messaging')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      channelFilter === 'webhook_messaging' ? 'bg-hx-cyan/20 text-hx-cyan font-medium' : 'text-hx-text-secondary'
                    }`}
                  >
                    Webhooks
                  </button>
                </div>
              </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto divide-y divide-hx-border-panel/40">
              {messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-hx-text-secondary">
                  No communication messages match query.
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id
                  return (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`w-full text-left p-3 transition-colors ${
                        isSelected ? 'bg-hx-panel/90 border-l-2 border-hx-cyan' : 'hover:bg-hx-panel/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="text-xs font-semibold truncate">{msg.sender.name || msg.sender.address}</span>
                          {msg.isUntrusted && (
                            <span className="px-1 py-0.2 rounded bg-amber-950/80 border border-amber-800 text-amber-300 text-[9px] font-mono">
                              UNTRUSTED
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-hx-text-secondary shrink-0">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-hx-text-primary font-medium truncate mb-1">
                        {msg.subject || '(No Subject)'}
                      </div>
                      <div className="text-[11px] text-hx-text-secondary line-clamp-2">
                        {msg.body.text}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Message Detail & Draft Composer */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
            {selectedMessage && (
              <Card variant="panel" border="panel" padding="md" className="space-y-3 bg-hx-space/60">
                <div className="flex items-center justify-between border-b border-hx-border-panel pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">
                      INBOUND EXTERNAL CONTENT (QUARANTINED)
                    </span>
                  </div>
                  <Badge variant="warning" size="sm">
                    Prompt Injection Isolated
                  </Badge>
                </div>
                <div className="text-xs space-y-1">
                  <div><span className="text-hx-text-secondary">From:</span> {selectedMessage.sender.name} &lt;{selectedMessage.sender.address}&gt;</div>
                  <div><span className="text-hx-text-secondary">Subject:</span> <span className="font-semibold">{selectedMessage.subject}</span></div>
                  <div><span className="text-hx-text-secondary">Received:</span> {new Date(selectedMessage.timestamp).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-hx-border-panel/60 text-xs font-mono whitespace-pre-wrap text-hx-text-primary">
                  {selectedMessage.body.text}
                </div>
                <div className="flex items-center justify-end space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDraftRecipientInput(selectedMessage.sender.address)
                      setDraftSubject(`Re: ${selectedMessage.subject ?? ''}`)
                      setDraftBody(`\n\n--- On ${new Date(selectedMessage.timestamp).toLocaleString()}, ${selectedMessage.sender.address} wrote ---\n> ${selectedMessage.body.text.slice(0, 150)}`)
                    }}
                  >
                    Reply to Message
                  </Button>
                </div>
              </Card>
            )}

            {/* Outbound Draft Composer */}
            <Card variant="panel" border="panel" padding="md" className="space-y-4">
              <div className="flex items-center justify-between border-b border-hx-border-panel pb-3">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-hx-cyan" />
                  <h2 className="text-sm font-semibold">Validated Outbound Message Composer</h2>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={draftChannel}
                    onChange={(e: any) => setDraftChannel(e.target.value)}
                    className="bg-hx-space border border-hx-border-panel rounded px-2 py-1 text-xs text-hx-text-primary"
                  >
                    <option value="email">Email Channel (SMTP)</option>
                    <option value="webhook_messaging">Team Chat Webhook</option>
                  </select>
                </div>
              </div>

              {/* Recipient Input with validation */}
              <div className="space-y-1">
                <label className="text-xs text-hx-text-secondary flex items-center justify-between">
                  <span>Recipient Address ({draftChannel === 'email' ? 'RFC-5322 Email' : 'Webhook URL'}):</span>
                  {recipientValidation.valid ? (
                    <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                      <Check className="w-3 h-3" /> <span>Valid format</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-rose-400 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" /> <span>{recipientValidation.reason}</span>
                    </span>
                  )}
                </label>
                <Input
                  value={draftRecipientInput}
                  onChange={(e) => setDraftRecipientInput(e.target.value)}
                  placeholder={draftChannel === 'email' ? 'colleague@enterprise.com' : 'https://discord.com/api/webhooks/...'}
                />
              </div>

              {/* Subject Input */}
              <div className="space-y-1">
                <label className="text-xs text-hx-text-secondary">Subject Header:</label>
                <Input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  placeholder="Subject title..."
                />
              </div>

              {/* Body Input with Placeholder Detection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-hx-text-secondary">
                  <span>Message Body:</span>
                  {detectedPlaceholders.length > 0 && (
                    <span className="text-rose-400 font-medium flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{detectedPlaceholders.length} unresolved placeholder(s)</span>
                    </span>
                  )}
                </div>
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={6}
                  className="w-full bg-hx-space border border-hx-border-panel rounded-lg p-3 text-xs text-hx-text-primary font-mono focus:border-hx-cyan focus:outline-none resize-y"
                  placeholder="Compose message body..."
                />
              </div>

              {/* Unresolved Placeholders Warning Banner */}
              {detectedPlaceholders.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-200 text-xs space-y-1">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Unresolved Placeholders Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90">
                    The following placeholders were detected and must be replaced before authorization:
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {detectedPlaceholders.map((p, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-black/40 border border-amber-700 text-[10px] font-mono text-amber-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Draft Proposal Preview if available */}
              {aiDraftProposal && (
                <div className="p-3 rounded-lg bg-hx-space border border-hx-border-glow space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-hx-cyan flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Quarantined AI Draft Proposal</span>
                    </span>
                    <Button variant="primary" size="sm" onClick={handleAcceptAiProposal}>
                      Accept &amp; Apply to Draft
                    </Button>
                  </div>
                  {aiDraftProposal.suggestedSubject && (
                    <div className="text-xs"><span className="text-hx-text-secondary">Proposed Subject:</span> {aiDraftProposal.suggestedSubject}</div>
                  )}
                  <div className="p-2 rounded bg-black/40 border border-hx-border-panel text-xs font-mono whitespace-pre-wrap">
                    {aiDraftProposal.draftBody}
                  </div>
                  <div className="text-[11px] text-hx-text-secondary italic">
                    Reasoning: {aiDraftProposal.explanation}
                  </div>
                </div>
              )}

              {/* AI Drafting Bar */}
              <div className="p-3 rounded-lg bg-hx-space/80 border border-hx-border-panel flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-hx-cyan shrink-0" />
                <input
                  type="text"
                  value={aiDraftPrompt}
                  onChange={(e) => setAiDraftPrompt(e.target.value)}
                  placeholder="Ask AI to compose draft: 'Draft a polite follow-up on contract terms...'"
                  className="flex-1 bg-transparent text-xs text-hx-text-primary focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateAiDraft}
                  disabled={isAiDrafting || !aiDraftPrompt.trim()}
                  leftIcon={<Sparkles className={`w-3 h-3 ${isAiDrafting ? 'animate-spin' : ''}`} />}
                >
                  Generate AI Draft
                </Button>
              </div>

              {/* Bottom Actions: Save Draft & Mandatory Confirmation Send */}
              <div className="flex items-center justify-between pt-3 border-t border-hx-border-panel">
                <Button variant="secondary" size="sm" onClick={handleCreateOrUpdateDraft}>
                  Save Local Draft
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleInitiateSendFlow}
                  disabled={!recipientValidation.valid || detectedPlaceholders.length > 0}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Authorize &amp; Send...
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Media Integrations & Playback */}
      {activeTab === 'media' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Card variant="panel" border="panel" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between border-b border-hx-border-panel pb-3">
              <div className="flex items-center space-x-2">
                <Music className="w-5 h-5 text-hx-cyan" />
                <h2 className="text-sm font-semibold">Active Playback Controller</h2>
              </div>
              <div className="flex items-center space-x-2">
                <Tv className="w-4 h-4 text-hx-text-secondary" />
                <select
                  value={playbackState.activeDevice?.id ?? ''}
                  onChange={(e) => handleMediaControl('select_device', undefined, e.target.value)}
                  className="bg-hx-space border border-hx-border-panel rounded px-2 py-1 text-xs text-hx-text-primary"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-hx-border-glow flex items-center justify-center text-hx-cyan shrink-0 shadow-md">
                <Music className="w-10 h-10" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <Badge variant="nominal" size="sm">
                  STREAMING
                </Badge>
                <h3 className="text-base font-semibold truncate">
                  {playbackState.currentItem?.title ?? 'No Track Playing'}
                </h3>
                <p className="text-xs text-hx-text-secondary truncate">
                  {playbackState.currentItem?.artistOrCreator ?? 'Unknown Artist'} • {playbackState.currentItem?.albumOrCollection ?? 'Single'}
                </p>
                <div className="text-[11px] text-hx-text-secondary font-mono pt-1">
                  {formatMs(playbackState.progressMs)} / {formatMs(playbackState.durationMs)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={playbackState.durationMs || 100}
                value={playbackState.progressMs}
                readOnly
                className="w-full h-1.5 bg-hx-space rounded-lg appearance-none cursor-pointer accent-hx-cyan"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMediaControl('skip_previous')}
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleMediaControl(playbackState.isPlaying ? 'pause' : 'play')}
                >
                  {playbackState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMediaControl('skip_next')}
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2 w-48">
                <Volume2 className="w-4 h-4 text-hx-text-secondary shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playbackState.volumePercent}
                  onChange={(e) => handleMediaControl('set_volume', Number(e.target.value))}
                  className="w-full h-1.5 bg-hx-space rounded-lg appearance-none cursor-pointer accent-hx-cyan"
                />
                <span className="text-xs font-mono text-hx-text-secondary w-8 text-right">{playbackState.volumePercent}%</span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="panel" border="panel" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider">Search Streaming Catalog</h3>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  value={mediaSearchQuery}
                  onChange={(e) => setMediaSearchQuery(e.target.value)}
                  placeholder="Search tracks, artists, albums..."
                  leftIcon={<Search className="w-3.5 h-3.5 text-hx-text-secondary" />}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSearchMediaCatalog}
                  disabled={isSearchingMedia}
                >
                  Search
                </Button>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pt-2 divide-y divide-hx-border-panel/40">
                {mediaSearchResults.length === 0 ? (
                  <p className="text-xs text-hx-text-secondary text-center py-4">Search tracks across Spotify or local media.</p>
                ) : (
                  mediaSearchResults.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="truncate mr-2">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-[11px] text-hx-text-secondary truncate">{item.artistOrCreator}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPlaybackState((prev) => ({
                            ...prev,
                            isPlaying: true,
                            currentItem: item
                          }))
                        }}
                        className="text-hx-cyan hover:text-cyan-300"
                      >
                        Play
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card variant="panel" border="panel" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                  <ListMusic className="w-4 h-4 text-hx-cyan" />
                  <span>Curated Playlists</span>
                </h3>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {playlists.length === 0 ? (
                  <p className="text-xs text-hx-text-secondary text-center py-4">No playlists discovered.</p>
                ) : (
                  playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="p-2.5 rounded-lg bg-hx-space border border-hx-border-panel/60 flex items-center justify-between text-xs hover:border-hx-border-glow transition-all"
                    >
                      <div>
                        <div className="font-semibold">{pl.title}</div>
                        <div className="text-[11px] text-hx-text-secondary">{pl.trackCount} tracks {pl.ownerName ? `• ${pl.ownerName}` : ''}</div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMediaControl('play')}
                      >
                        Start Playlist
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 4: Android Device Manager (Step 45) */}
      {activeTab === 'devices' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Device Selector */}
          <div className="w-1/3 min-w-[300px] max-w-[380px] border-r border-hx-border-panel flex flex-col bg-hx-space/40">
            <div className="p-3 border-b border-hx-border-panel flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-hx-cyan" />
                <h2 className="text-xs font-semibold uppercase tracking-wider">Detected Devices</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={loadAndroidData}>
                Refresh
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-hx-border-panel/40">
              {androidDevices.length === 0 ? (
                <div className="p-6 text-center text-xs text-hx-text-secondary">
                  No Android devices detected via USB or local pairing.
                </div>
              ) : (
                androidDevices.map((dev) => {
                  const isSelected = selectedAndroidDevice?.id === dev.id
                  return (
                    <button
                      key={dev.id}
                      onClick={() => setSelectedAndroidDevice(dev)}
                      className={`w-full text-left p-3.5 transition-colors ${
                        isSelected ? 'bg-hx-panel/90 border-l-2 border-hx-cyan' : 'hover:bg-hx-panel/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{dev.model}</span>
                        <Badge
                          variant={dev.status === 'connected' ? 'nominal' : dev.status === 'pairing_required' ? 'warning' : 'neutral'}
                          size="sm"
                          isDot
                        >
                          {dev.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-hx-text-secondary flex items-center space-x-2 font-mono">
                        <span>{dev.manufacturer}</span>
                        <span>•</span>
                        <span>Android {dev.androidVersion}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-hx-text-secondary pt-1">
                        <span className="capitalize">{dev.connectionType.replace('_', ' ')}</span>
                        <span className="flex items-center space-x-1">
                          {dev.isCharging ? <BatteryCharging className="w-3 h-3 text-emerald-400" /> : <Battery className="w-3 h-3" />}
                          <span>{dev.batteryPercent}%</span>
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Device Detail & Allowlisted Actions */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedAndroidDevice ? (
              <>
                {/* Device Info Header */}
                <Card variant="panel" border="panel" padding="lg" className="space-y-4">
                  <div className="flex items-start justify-between border-b border-hx-border-panel pb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded-xl bg-hx-space border border-hx-border-glow flex items-center justify-center text-hx-cyan shadow-sm">
                        <Smartphone className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-base font-semibold">{selectedAndroidDevice.model}</h2>
                          <Badge
                            variant={selectedAndroidDevice.isAuthorized ? 'nominal' : 'warning'}
                            size="sm"
                          >
                            {selectedAndroidDevice.isAuthorized ? 'AUTHORIZED' : 'PAIRING REQUIRED'}
                          </Badge>
                        </div>
                        <p className="text-xs text-hx-text-secondary font-mono">
                          Serial: {selectedAndroidDevice.serialNumber} • OS: Android {selectedAndroidDevice.androidVersion} (API {selectedAndroidDevice.sdkLevel})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {selectedAndroidDevice.isAuthorized ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnectAndroidDevice(selectedAndroidDevice.id)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Revoke Access
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setPairingModalOpen(true)}
                        >
                          Pair Device
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Device Metrics Grid */}
                  <div className="grid grid-cols-3 gap-4 text-xs pt-1">
                    <div className="p-3 rounded-lg bg-hx-space border border-hx-border-panel/60 space-y-1">
                      <span className="text-hx-text-secondary text-[11px]">Battery &amp; Power</span>
                      <div className="flex items-center space-x-2">
                        {selectedAndroidDevice.isCharging ? (
                          <BatteryCharging className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Battery className="w-4 h-4 text-hx-cyan" />
                        )}
                        <span className="font-semibold text-sm">{selectedAndroidDevice.batteryPercent}%</span>
                        <span className="text-[10px] text-hx-text-secondary">({selectedAndroidDevice.isCharging ? 'Charging' : 'Discharging'})</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-hx-space border border-hx-border-panel/60 space-y-1">
                      <span className="text-hx-text-secondary text-[11px]">Transport &amp; Connection</span>
                      <div className="font-semibold text-sm capitalize">
                        {selectedAndroidDevice.connectionType.replace('_', ' ')}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-hx-space border border-hx-border-panel/60 space-y-1">
                      <span className="text-hx-text-secondary text-[11px]">Last Synchronization</span>
                      <div className="font-mono text-xs text-hx-text-primary pt-0.5">
                        {new Date(selectedAndroidDevice.lastSeenAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Allowlisted Actions Grid */}
                <Card variant="panel" border="panel" padding="md" className="space-y-3">
                  <div className="flex items-center justify-between border-b border-hx-border-panel pb-2">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-hx-cyan" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider">Approved Diagnostic Actions</h3>
                    </div>
                    <Badge variant="neutral" size="sm">
                      Zero Arbitrary Shell Access
                    </Badge>
                  </div>

                  <p className="text-xs text-hx-text-secondary">
                    All actions execute strictly through allowlisted, typed ADB and platform command arrays with zero shell interpolation.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExecuteAndroidAction('ping')}
                      disabled={isExecutingDeviceAction || !selectedAndroidDevice.isAuthorized}
                    >
                      Ping Connection (Latency)
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExecuteAndroidAction('get_battery_status')}
                      disabled={isExecutingDeviceAction || !selectedAndroidDevice.isAuthorized}
                    >
                      Read Battery Voltage &amp; Health
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExecuteAndroidAction('get_device_properties')}
                      disabled={isExecutingDeviceAction || !selectedAndroidDevice.isAuthorized}
                    >
                      Inspect Hardware Properties
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExecuteAndroidAction('get_screen_state')}
                      disabled={isExecutingDeviceAction || !selectedAndroidDevice.isAuthorized}
                    >
                      Query Screen &amp; Keyguard State
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExecuteAndroidAction('send_test_intent', { intentAction: 'org.helioxen.PING' })}
                      disabled={isExecutingDeviceAction || !selectedAndroidDevice.isAuthorized}
                      className="col-span-2"
                    >
                      Dispatch Test Companion Intent
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-hx-text-secondary">
                Select an Android device from the left panel to inspect properties or execute actions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Smart-Home Controller (Step 45) */}
      {activeTab === 'smart_home' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Smart-Home Hub Status Header */}
          <Card variant="panel" border="panel" padding="md" className="space-y-3">
            <div className="flex items-center justify-between border-b border-hx-border-panel pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-hx-space border border-hx-border-panel text-hx-cyan">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-semibold">{smartHomeHub?.displayName ?? 'Smart Home Hub'}</h2>
                    <Badge variant={smartHomeHub?.isConnected ? 'nominal' : 'neutral'} size="sm" isDot>
                      {smartHomeHub?.isConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                    </Badge>
                  </div>
                  <p className="text-xs text-hx-text-secondary font-mono">
                    Gateway: {smartHomeHub?.endpointUrl ?? 'http://homeassistant.local:8123/api'} • {smartHomeEntities.length} Registered Entities
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="secondary" size="sm" onClick={loadSmartHomeData}>
                  Refresh States
                </Button>
              </div>
            </div>

            {/* Filter by Domain */}
            <div className="flex items-center space-x-1 text-xs pt-1">
              <span className="text-hx-text-secondary mr-2">Filter:</span>
              {(['all', 'light', 'climate', 'sensor', 'lock', 'cover', 'alarm'] as const).map((dom) => (
                <button
                  key={dom}
                  onClick={() => setDomainFilter(dom)}
                  className={`px-2.5 py-1 rounded text-[11px] capitalize transition-all ${
                    domainFilter === dom
                      ? 'bg-hx-cyan/20 text-hx-cyan font-medium border border-hx-border-glow'
                      : 'text-hx-text-secondary hover:text-hx-text-primary'
                  }`}
                >
                  {dom}
                </button>
              ))}
            </div>
          </Card>

          {/* Entities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map((ent) => {
              const isPhysical = isHighRiskPhysicalAction(ent.domain, ent.supportedCommands[0] || '')
              const isLock = ent.domain === 'lock'
              const isLight = ent.domain === 'light'
              const isClimate = ent.domain === 'climate'
              const isSensor = ent.domain === 'sensor'

              return (
                <Card key={ent.entityId} variant="panel" border="panel" padding="md" className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-hx-space border border-hx-border-panel text-hx-cyan">
                        {isLock ? (
                          ent.state === 'locked' ? <Lock className="w-4 h-4 text-emerald-400" /> : <Unlock className="w-4 h-4 text-amber-400" />
                        ) : isLight ? (
                          <Lightbulb className={`w-4 h-4 ${ent.state === 'on' ? 'text-amber-300' : 'text-hx-text-secondary'}`} />
                        ) : isClimate ? (
                          <Thermometer className="w-4 h-4 text-hx-cyan" />
                        ) : (
                          <Power className="w-4 h-4 text-hx-text-secondary" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold line-clamp-1">{ent.friendlyName}</h4>
                        <span className="text-[10px] text-hx-text-secondary font-mono">{ent.entityId}</span>
                      </div>
                    </div>

                    <Badge
                      variant={
                        ent.riskClass === 'physical_security_consequential'
                          ? 'danger'
                          : ent.riskClass === 'reversible_action'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {ent.riskClass === 'physical_security_consequential'
                        ? 'PHYSICAL'
                        : ent.riskClass === 'reversible_action'
                        ? 'REVERSIBLE'
                        : 'SENSOR'}
                    </Badge>
                  </div>

                  {/* Current State Indicator */}
                  <div className="p-2 rounded bg-hx-space/80 border border-hx-border-panel/60 flex items-center justify-between text-xs">
                    <span className="text-hx-text-secondary">Current State:</span>
                    <span className="font-mono font-semibold uppercase text-hx-cyan">{ent.state}</span>
                  </div>

                  {/* Attributes snippet */}
                  {Object.keys(ent.attributes).length > 0 && (
                    <div className="text-[11px] text-hx-text-secondary font-mono truncate">
                      {Object.entries(ent.attributes)
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' • ')}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-hx-border-panel/40 flex items-center justify-end space-x-2">
                    {isLight && (
                      <>
                        <Button
                          variant={ent.state === 'on' ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => handleSmartHomeAction(ent, ent.state === 'on' ? 'turn_off' : 'turn_on')}
                          disabled={isActuating}
                        >
                          {ent.state === 'on' ? 'Turn Off' : 'Turn On'}
                        </Button>
                      </>
                    )}

                    {isClimate && (
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSmartHomeAction(ent, 'set_temperature', { temperature: (ent.attributes.target_temperature as number || 21) - 0.5 })}
                          disabled={isActuating}
                        >
                          -0.5°C
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSmartHomeAction(ent, 'set_temperature', { temperature: (ent.attributes.target_temperature as number || 21) + 0.5 })}
                          disabled={isActuating}
                        >
                          +0.5°C
                        </Button>
                      </div>
                    )}

                    {isLock && (
                      <Button
                        variant={ent.state === 'locked' ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => handleSmartHomeAction(ent, ent.state === 'locked' ? 'unlock' : 'lock')}
                        disabled={isActuating}
                        leftIcon={ent.state === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      >
                        {ent.state === 'locked' ? 'Unlock...' : 'Lock'}
                      </Button>
                    )}

                    {ent.domain === 'cover' && (
                      <Button
                        variant={ent.state === 'open' ? 'secondary' : 'danger'}
                        size="sm"
                        onClick={() => handleSmartHomeAction(ent, ent.state === 'open' ? 'close' : 'open')}
                        disabled={isActuating}
                      >
                        {ent.state === 'open' ? 'Close Door' : 'Open Door...'}
                      </Button>
                    )}

                    {ent.domain === 'alarm' && (
                      <Button
                        variant={ent.state.includes('armed') ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => handleSmartHomeAction(ent, ent.state.includes('armed') ? 'disarm' : 'arm_home')}
                        disabled={isActuating}
                      >
                        {ent.state.includes('armed') ? 'Disarm...' : 'Arm Home'}
                      </Button>
                    )}

                    {isSensor && (
                      <span className="text-[11px] text-hx-text-secondary italic">Read-only Telemetry</span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: Connect Integration Modal */}
      {connectModalOpen && selectedIntegrationForConnect && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card variant="panel" border="panel" padding="lg" className="max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hx-border-panel pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-hx-cyan" />
                <h3 className="text-sm font-semibold">Connect {selectedIntegrationForConnect.displayName}</h3>
              </div>
              <button onClick={() => setConnectModalOpen(false)} className="text-hx-text-secondary hover:text-hx-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-hx-text-secondary">
              Credentials are encrypted using native Electron DPAPI safeStorage before being stored on disk.
            </p>

            <div className="space-y-3 text-xs">
              {selectedIntegrationForConnect.id.includes('smart_home') ? (
                <>
                  <div className="space-y-1">
                    <label className="text-hx-text-secondary">Hub Gateway URL:</label>
                    <Input
                      value={connectCredentials.endpointUrl ?? ''}
                      onChange={(e) => setConnectCredentials((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                      placeholder="http://homeassistant.local:8123/api"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-hx-text-secondary">Long-Lived Access Token:</label>
                    <Input
                      type="password"
                      value={connectCredentials.accessToken ?? ''}
                      onChange={(e) => setConnectCredentials((prev) => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="eyJhbGciOi..."
                    />
                  </div>
                </>
              ) : selectedIntegrationForConnect.id.includes('android') ? (
                <div className="space-y-1">
                  <label className="text-hx-text-secondary">Device Serial / Wireless IP:Port:</label>
                  <Input
                    value={connectCredentials.deviceId ?? ''}
                    onChange={(e) => setConnectCredentials((prev) => ({ ...prev, deviceId: e.target.value }))}
                    placeholder="192.168.1.150:5555"
                  />
                </div>
              ) : selectedIntegrationForConnect.id.includes('email') ? (
                <>
                  <div className="space-y-1">
                    <label className="text-hx-text-secondary">Account Username / Email:</label>
                    <Input
                      value={connectCredentials.username ?? ''}
                      onChange={(e) => setConnectCredentials((prev) => ({ ...prev, username: e.target.value }))}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-hx-text-secondary">Account Password / App Secret:</label>
                    <Input
                      type="password"
                      value={connectCredentials.password ?? ''}
                      onChange={(e) => setConnectCredentials((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••••••"
                    />
                  </div>
                </>
              ) : selectedIntegrationForConnect.id.includes('webhook') ? (
                <div className="space-y-1">
                  <label className="text-hx-text-secondary">Incoming Webhook URL:</label>
                  <Input
                    value={connectCredentials.webhookUrl ?? ''}
                    onChange={(e) => setConnectCredentials((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-hx-text-secondary">Client ID:</label>
                    <Input
                      value={connectCredentials.clientId ?? ''}
                      onChange={(e) => setConnectCredentials((prev) => ({ ...prev, clientId: e.target.value }))}
                      placeholder="Client ID"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-hx-text-secondary">Client Secret / Token:</label>
                    <Input
                      type="password"
                      value={connectCredentials.clientSecret ?? ''}
                      onChange={(e) => setConnectCredentials((prev) => ({ ...prev, clientSecret: e.target.value }))}
                      placeholder="••••••••••••"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-hx-border-panel">
              <Button variant="ghost" size="sm" onClick={() => setConnectModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConnectIntegration}>
                Authorize &amp; Save Encrypted
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: Mandatory Two-Tier Human Confirmation Modal (Communication) */}
      {confirmationModalOpen && activeConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card variant="panel" border="panel" padding="lg" className="max-w-lg w-full space-y-4 shadow-2xl border-rose-800/80">
            <div className="flex items-center justify-between border-b border-rose-800/60 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-semibold text-rose-300">
                  MANDATORY HUMAN AUTHORIZATION REQUIRED
                </h3>
              </div>
              <button onClick={() => setConfirmationModalOpen(false)} className="text-hx-text-secondary hover:text-hx-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-hx-text-secondary">
              In accordance with Helioxen security policy, external communications cannot be dispatched autonomously. You must explicitly review and authorize this transmission.
            </p>

            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 flex items-center justify-between text-xs text-rose-200">
              <div className="flex items-center space-x-1.5 font-mono">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Authorization Token TTL: {confirmationTimeRemaining}s</span>
              </div>
              <span className="text-[11px] text-rose-400 font-mono">ID: {activeConfirmation.confirmationId.substring(0, 14)}...</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded bg-hx-space border border-hx-border-panel space-y-1">
                <div><span className="text-hx-text-secondary">Target Account:</span> <span className="font-semibold text-hx-text-primary">{activeConfirmation.targetAccountDescription}</span></div>
                <div><span className="text-hx-text-secondary">Recipients:</span> <span className="font-semibold text-hx-text-primary">{activeConfirmation.recipientSummary.join(', ')}</span></div>
                <div><span className="text-hx-text-secondary">Subject:</span> <span className="font-semibold text-hx-text-primary">{activeConfirmation.subject || '(No subject)'}</span></div>
                <div><span className="text-hx-text-secondary">Draft SHA-256 Hash:</span> <span className="font-mono text-[10px] text-hx-text-secondary">{activeConfirmation.draftHash}</span></div>
              </div>

              <div>
                <span className="text-hx-text-secondary text-[11px]">Exact Message Payload:</span>
                <div className="p-2.5 rounded bg-black/60 border border-hx-border-panel text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {draftBody}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-hx-border-panel">
              <Button variant="ghost" size="sm" onClick={() => setConfirmationModalOpen(false)}>
                Cancel / Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinalAuthorizeAndSend}
                disabled={isSending || confirmationTimeRemaining <= 0}
                className="bg-rose-600 hover:bg-rose-500 text-white"
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                {isSending ? 'Transmitting...' : 'Authorize & Dispatched Now'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: Android Device Pairing Modal (Step 45) */}
      {pairingModalOpen && selectedAndroidDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card variant="panel" border="panel" padding="lg" className="max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hx-border-panel pb-3">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-hx-cyan" />
                <h3 className="text-sm font-semibold">Pair {selectedAndroidDevice.model}</h3>
              </div>
              <button onClick={() => setPairingModalOpen(false)} className="text-hx-text-secondary hover:text-hx-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-hx-text-secondary">
              Verify device authorization on the Android handset. If connecting wirelessly, enter the 6-digit wireless pairing code from Developer Options &gt; Wireless Debugging.
            </p>

            <div className="p-3 rounded-lg bg-hx-space border border-hx-border-panel text-xs space-y-1">
              <div><span className="text-hx-text-secondary">Device:</span> <span className="font-semibold">{selectedAndroidDevice.model}</span></div>
              <div><span className="text-hx-text-secondary">Serial / Address:</span> <span className="font-mono">{selectedAndroidDevice.serialNumber}</span></div>
              <div><span className="text-hx-text-secondary">Transport:</span> <span className="capitalize">{selectedAndroidDevice.connectionType.replace('_', ' ')}</span></div>
            </div>

            {selectedAndroidDevice.connectionType === 'wifi_pairing' && (
              <div className="space-y-1">
                <label className="text-xs text-hx-text-secondary">6-Digit Wireless Pairing Code:</label>
                <Input
                  value={pairingCodeInput}
                  onChange={(e) => setPairingCodeInput(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-hx-border-panel">
              <Button variant="ghost" size="sm" onClick={() => setPairingModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handlePairAndroidDevice}>
                Confirm Pairing &amp; Authorize
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 4: Mandatory Physical Security Action Confirmation (Smart Home - Step 45) */}
      {smartHomeConfirmModalOpen && activeSmartHomeConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <Card variant="panel" border="panel" padding="lg" className="max-w-md w-full space-y-4 shadow-2xl border-rose-800">
            <div className="flex items-center justify-between border-b border-rose-800/60 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-semibold text-rose-300">
                  PHYSICAL SECURITY ACTION CONFIRMATION
                </h3>
              </div>
              <button onClick={() => setSmartHomeConfirmModalOpen(false)} className="text-hx-text-secondary hover:text-hx-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-hx-text-secondary">
              Physical access controls (door locks, garage doors, alarms) cannot be actuated automatically. You must explicitly confirm this physical action.
            </p>

            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 flex items-center justify-between text-xs text-rose-200">
              <div className="flex items-center space-x-1.5 font-mono">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Confirmation TTL: {smartHomeConfirmTimeRemaining}s</span>
              </div>
              <span className="text-[11px] text-rose-400 font-mono">ID: {activeSmartHomeConfirmation.confirmationId.substring(0, 12)}</span>
            </div>

            <div className="p-3 rounded-lg bg-hx-space border border-hx-border-panel text-xs space-y-1.5">
              <div><span className="text-hx-text-secondary">Target Device:</span> <span className="font-semibold text-hx-text-primary">{activeSmartHomeConfirmation.friendlyName}</span></div>
              <div><span className="text-hx-text-secondary">Entity ID:</span> <span className="font-mono text-hx-cyan">{activeSmartHomeConfirmation.entityId}</span></div>
              <div><span className="text-hx-text-secondary">Requested Operation:</span> <span className="font-bold uppercase text-rose-400">{activeSmartHomeConfirmation.command}</span></div>
              <div className="pt-1 text-[11px] text-hx-text-secondary italic">
                {activeSmartHomeConfirmation.riskDescription}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-hx-border-panel">
              <Button variant="ghost" size="sm" onClick={() => setSmartHomeConfirmModalOpen(false)}>
                Cancel / Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAuthorizePhysicalSmartHomeAction}
                disabled={isActuating || smartHomeConfirmTimeRemaining <= 0}
                className="bg-rose-600 hover:bg-rose-500 text-white"
                leftIcon={<Lock className="w-3.5 h-3.5" />}
              >
                {isActuating ? 'Actuating...' : `Authorize ${activeSmartHomeConfirmation.command.toUpperCase()} Now`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
