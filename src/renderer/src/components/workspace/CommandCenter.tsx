import React, { useState, useEffect } from 'react'
import { WorkspaceLayout } from './WorkspaceLayout'
import { PrimaryWorkspacePanel } from './PrimaryWorkspacePanel'
import { ContextPanel } from './ContextPanel'
import { NavRail } from '../navigation/NavRail'
import { useNavigation } from '../navigation/useNavigation'
import { PersistentVoiceDock } from '../voice/PersistentVoiceDock'
import { AiCoreState } from '../core/types'
import { ConversationMessage } from '../conversation/types'
import { UserAiPreferences, DEFAULT_AI_PREFERENCES } from '../../../../shared/ai/models'
import { TranscriptSegment, VoiceSessionStatus } from '../../../../shared/voice/types'

export interface CommandCenterProps {
  className?: string
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  className = ''
}) => {
  const {
    currentDestination,
    currentDestinationMeta,
    isExpanded,
    navigateTo,
    toggleExpanded
  } = useNavigation('core', false)

  // Context panel open state (default open on standard/wide desktop viewports)
  const [isContextOpen, setIsContextOpen] = useState(true)

  // AI Core presentation state (default 'idle' - truthful production presentation)
  const [aiCoreState, setAiCoreState] = useState<AiCoreState>('idle')

  // Local ephemeral conversation thread state (buffered in session memory)
  const [messages, setMessages] = useState<ConversationMessage[]>([])

  // User AI preferences (active provider and model selection)
  const [aiPreferences, setAiPreferences] = useState<UserAiPreferences>(DEFAULT_AI_PREFERENCES)

  // Load preferences from preload bridge on mount and when returning from Settings
  useEffect(() => {
    if (typeof window !== 'undefined' && window.helioxen?.preferences) {
      window.helioxen.preferences
        .get()
        .then((prefs) => {
          if (prefs) setAiPreferences(prefs)
        })
        .catch((err) => {
          console.error('[CommandCenter] Failed to load preferences:', err)
        })
    }
  }, [currentDestination])

  // Responsive adaptation: collapse context panel if initial window is constrained (< 1120px)
  useEffect(() => {
    const checkViewportBounds = () => {
      if (typeof window !== 'undefined') {
        if (window.innerWidth < 1120) {
          setIsContextOpen(false)
        }
      }
    }

    checkViewportBounds()

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkViewportBounds)
      return () => window.removeEventListener('resize', checkViewportBounds)
    }
    return undefined
  }, [])

  const handleToggleContext = () => {
    setIsContextOpen((prev) => !prev)
  }

  // Handle message submission from ConversationComposer
  const handleSendMessage = async (content: string) => {
    const userMsg: ConversationMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'delivered'
    }

    if (!window.helioxen?.ai) {
      // Running in headless or browser-only preview without Electron IPC bridge
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: 'Electron IPC bridge unavailable. Please run HELIOXEN inside the Electron runtime.',
          timestamp: Date.now(),
          status: 'error'
        }
      ])
      return
    }

    const assistantMsgId = `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const assistantPlaceholder: ConversationMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending',
      model: aiPreferences.activeModel
    }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
    setAiCoreState('thinking')

    let accumulatedText = ''
    let unsubscribeStream: (() => void) | null = null

    try {
      unsubscribeStream = window.helioxen.ai.onStreamChunk((chunk) => {
        if (chunk.textDelta) {
          accumulatedText += chunk.textDelta
          setAiCoreState('speaking')
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedText, status: 'pending' }
                : msg
            )
          )
        }
        if (chunk.isDone) {
          setAiCoreState('idle')
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedText, status: 'delivered' }
                : msg
            )
          )
        }
      })

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content
      }))

      const response = await window.helioxen.ai.generateText({
        provider: aiPreferences.activeProvider,
        model: aiPreferences.activeModel,
        messages: history,
        temperature: aiPreferences.temperature,
        stream: aiPreferences.stream,
        taskType: 'conversation'
      })

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: response.text || accumulatedText,
                status: 'delivered',
                model: response.model
              }
            : msg
        )
      )
      setAiCoreState('idle')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      let userFriendlyError = errMsg

      if (/not configured|MISSING_CREDENTIAL/i.test(errMsg)) {
        userFriendlyError =
          '⚠️ AI Provider Key Required: Please open Settings in the left navigation rail to configure your Google Gemini or OpenAI API Key.'
      } else if (/AUTHENTICATION_FAILED/i.test(errMsg)) {
        userFriendlyError =
          '⚠️ Authentication Rejected: The stored API key was rejected by the provider. Please verify your key in Settings.'
      } else if (/RATE_LIMIT_EXCEEDED/i.test(errMsg)) {
        userFriendlyError =
          '⚠️ Rate Limit Exceeded: The AI provider quota or rate limit was reached. Please wait before retrying.'
      } else if (/VALIDATION_ERROR|does not belong to provider/i.test(errMsg)) {
        userFriendlyError =
          `⚠️ Model Selection Invalid: ${errMsg}. Please select a valid model in Settings.`
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: userFriendlyError,
                status: 'error'
              }
            : msg
        )
      )
      setAiCoreState('error')
      setTimeout(() => setAiCoreState('idle'), 3000)
    } finally {
      if (unsubscribeStream) {
        unsubscribeStream()
      }
    }
  }

  const handleClearMessages = () => {
    setMessages([])
    setAiCoreState('idle')
  }

  const handleVoiceTranscript = (segment: TranscriptSegment) => {
    const newMsg: ConversationMessage = {
      id: segment.id,
      role: segment.speaker === 'user' ? 'user' : 'assistant',
      content: segment.text,
      timestamp: segment.timestamp,
      status: segment.wasInterrupted ? 'error' : 'delivered',
      model: segment.speaker === 'assistant' ? aiPreferences.activeModel : undefined
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === segment.id)) {
        return prev.map((m) => (m.id === segment.id ? newMsg : m))
      }
      return [...prev, newMsg]
    })
  }

  const handleVoiceStateChange = (state: VoiceSessionStatus) => {
    if (state === 'generating-response') {
      setAiCoreState('thinking')
    } else if (state === 'playing-audio') {
      setAiCoreState('speaking')
    } else if (state === 'idle' || state === 'completed' || state === 'interrupted') {
      setAiCoreState('idle')
    }
  }

  return (
    <WorkspaceLayout
      className={className}
      navigation={
        <NavRail
          currentDestination={currentDestination}
          onSelectDestination={navigateTo}
          isExpanded={isExpanded}
          onToggleExpanded={toggleExpanded}
        />
      }
      workspace={
        <PrimaryWorkspacePanel
          currentDestination={currentDestination}
          currentDestinationMeta={currentDestinationMeta}
          onNavigate={navigateTo}
          isContextOpen={isContextOpen}
          onToggleContext={handleToggleContext}
          aiCoreState={aiCoreState}
          onSetAiCoreState={setAiCoreState}
          messages={messages}
          onSendMessage={handleSendMessage}
          onClearMessages={handleClearMessages}
        />
      }
      context={
        isContextOpen ? (
          <ContextPanel
            isOpen={isContextOpen}
            onToggle={handleToggleContext}
          />
        ) : null
      }
      voiceDock={
        <PersistentVoiceDock
          status="idle"
          isAudioConnected={false}
          activeProvider={aiPreferences.activeProvider}
          activeModel={aiPreferences.activeModel}
          onSessionTranscript={handleVoiceTranscript}
          onSessionStateChange={handleVoiceStateChange}
        />
      }
    />
  )
}
