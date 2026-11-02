/**
 * MediaCaptureModal.tsx
 *
 * Explicit user-initiated camera and screen capture modal dialog.
 *
 * Principles:
 * - Never captures automatically or in the background.
 * - Displays truthful privacy indicators.
 * - Live camera/screen stream is previewed locally only.
 * - Captures a single still image upon explicit user confirmation.
 * - Hardware streams are terminated immediately when capture or cancellation occurs.
 * - Discarding cleans up in-memory image immediately.
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  Camera,
  Monitor,
  X,
  RotateCcw,
  Check,
  AlertCircle,
  Shield,
  Layers,
  Sparkles,
  Info
} from 'lucide-react'
import {
  CapturedStillImage,
  CameraDeviceInfo,
  DesktopDisplaySource,
  CaptureSessionStatus
} from '../../../../shared/capture'
import { MediaCaptureCoordinator } from '../../services/capture'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/IconButton'

export interface MediaCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onAttachImage: (image: CapturedStillImage) => void
  initialMode?: 'camera' | 'screen'
}

export const MediaCaptureModal: React.FC<MediaCaptureModalProps> = ({
  isOpen,
  onClose,
  onAttachImage,
  initialMode = 'screen'
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'screen'>(initialMode)
  const [status, setStatus] = useState<CaptureSessionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Camera state
  const [cameras, setCameras] = useState<CameraDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')

  // Screen state
  const [screenSources, setScreenSources] = useState<DesktopDisplaySource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  // Staged still snapshot
  const [stagedImage, setStagedImage] = useState<CapturedStillImage | null>(null)

  // Video element ref for live preview
  const videoRef = useRef<HTMLVideoElement>(null)
  const coordinatorRef = useRef<MediaCaptureCoordinator | null>(null)

  // Initialize coordinator
  useEffect(() => {
    const coordinator = new MediaCaptureCoordinator({
      onStatusChange: (newStatus) => setStatus(newStatus),
      onError: (err) => setErrorMessage(err.message),
      onImageCaptured: (img) => setStagedImage(img)
    })
    coordinatorRef.current = coordinator

    return () => {
      coordinator.dispose()
      coordinatorRef.current = null
    }
  }, [])

  // When modal opens/closes or activeTab changes
  useEffect(() => {
    if (!isOpen) {
      handleFullCancel()
      return
    }

    setErrorMessage(null)
    setStagedImage(null)

    if (activeTab === 'camera') {
      initializeCameraTab()
    } else {
      initializeScreenTab()
    }
  }, [isOpen, activeTab])

  // Attach live stream to video element when previewing
  const attachStreamToVideo = (stream: MediaStream | null) => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch((err) => {
        console.warn('[MediaCaptureModal] Video play error:', err)
      })
    }
  }

  // Camera tab setup
  const initializeCameraTab = async () => {
    if (!coordinatorRef.current) return
    setErrorMessage(null)

    const devices = await coordinatorRef.current.getCameraDevices()
    setCameras(devices)

    const defaultDevId = devices.length > 0 ? devices[0].deviceId : ''
    setSelectedCameraId(defaultDevId)

    const stream = await coordinatorRef.current.startCamera(defaultDevId)
    if (stream) {
      attachStreamToVideo(stream)
    }
  }

  // Screen tab setup
  const initializeScreenTab = async () => {
    if (!coordinatorRef.current) return
    setErrorMessage(null)
    setSelectedSourceId(null)

    const sources = await coordinatorRef.current.getDesktopSources(['screen', 'window'])
    setScreenSources(sources)

    // If sources exist, pre-select the primary screen
    if (sources.length > 0) {
      const primary = sources.find((s) => s.id.startsWith('screen:')) || sources[0]
      setSelectedSourceId(primary.id)
      const stream = await coordinatorRef.current.startScreenStream(primary.id)
      if (stream) {
        attachStreamToVideo(stream)
      }
    }
  }

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId)
    if (!coordinatorRef.current) return
    const stream = await coordinatorRef.current.startCamera(deviceId)
    if (stream) {
      attachStreamToVideo(stream)
    }
  }

  const handleSourceSelect = async (source: DesktopDisplaySource) => {
    setSelectedSourceId(source.id)
    if (!coordinatorRef.current) return
    const stream = await coordinatorRef.current.startScreenStream(source.id)
    if (stream) {
      attachStreamToVideo(stream)
    }
  }

  const handleCaptureSnapshot = async () => {
    if (!coordinatorRef.current) return
    setErrorMessage(null)
    const arg = activeTab === 'camera' && videoRef.current ? videoRef.current : selectedSourceId || undefined
    const still = await coordinatorRef.current.captureStill(arg)
    if (still) {
      setStagedImage(still)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }

  const handleRetake = () => {
    setStagedImage(null)
    if (coordinatorRef.current) {
      coordinatorRef.current.discardStagedImage()
    }
    if (activeTab === 'camera') {
      initializeCameraTab()
    } else {
      if (selectedSourceId && coordinatorRef.current) {
        coordinatorRef.current.startScreenStream(selectedSourceId).then((stream) => {
          attachStreamToVideo(stream)
        })
      } else {
        initializeScreenTab()
      }
    }
  }

  const handleFullCancel = () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (coordinatorRef.current) {
      coordinatorRef.current.cancelCapture()
    }
    setStagedImage(null)
    setErrorMessage(null)
    onClose()
  }

  const handleConfirmAttach = () => {
    if (stagedImage) {
      onAttachImage(stagedImage)
      handleFullCancel()
    }
  }

  // Keyboard accessibility: Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleFullCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-hx-space/85 backdrop-blur-md animate-hx-fade-in"
    >
      <div className="relative w-full max-w-3xl rounded-hx-lg border border-hx-border-glow/60 bg-hx-panel shadow-hx-glow-cyan-md flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-hx-border-panel bg-hx-surface/70 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-hx-space border border-hx-border-glow flex items-center justify-center text-hx-cyan shadow-hx-glow-cyan-sm">
              {activeTab === 'camera' ? (
                <Camera className="w-3.5 h-3.5" />
              ) : (
                <Monitor className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <h3
                id="capture-modal-title"
                className="text-sm font-display font-semibold text-hx-text-primary uppercase tracking-wider"
              >
                Visual Input Capture
              </h3>
              <p className="text-[10px] font-mono text-hx-text-muted">
                Step 22 • Camera &amp; Display Still Snapshot
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="nominal" size="sm" isDot>
              LOCAL PREVIEW ONLY
            </Badge>
            <IconButton
              icon={<X className="w-4 h-4" />}
              aria-label="Close visual capture"
              title="Close visual capture"
              size="sm"
              variant="ghost"
              onClick={handleFullCancel}
            />
          </div>
        </div>

        {/* Source Navigation Tabs (only shown before snapshot confirmation) */}
        {!stagedImage && (
          <div className="flex items-center px-5 py-2.5 border-b border-hx-border-subtle bg-hx-panel/90 space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('screen')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-md text-xs font-mono transition-all duration-fast ${
                activeTab === 'screen'
                  ? 'bg-hx-hover text-hx-cyan border border-hx-border-glow shadow-hx-glow-cyan-sm font-semibold'
                  : 'bg-hx-surface text-hx-text-secondary hover:text-hx-text-primary border border-transparent'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Screen &amp; Windows</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-hx-md text-xs font-mono transition-all duration-fast ${
                activeTab === 'camera'
                  ? 'bg-hx-hover text-hx-cyan border border-hx-border-glow shadow-hx-glow-cyan-sm font-semibold'
                  : 'bg-hx-surface text-hx-text-secondary hover:text-hx-text-primary border border-transparent'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="flex items-start space-x-2.5 p-3 rounded-hx-md bg-hx-danger/10 border border-hx-danger/40 text-xs text-hx-danger animate-hx-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Capture Notice: </span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Still Image Confirmation View */}
          {stagedImage ? (
            <div className="space-y-4 animate-hx-fade-in">
              <div className="flex items-center justify-between text-xs font-mono text-hx-text-muted pb-1 border-b border-hx-border-subtle">
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-hx-nominal" />
                  <span className="text-hx-text-primary font-semibold">Still Image Staged</span>
                  <span>•</span>
                  <span>{stagedImage.sourceType === 'camera' ? 'Camera Snapshot' : 'Display Snapshot'}</span>
                </div>
                <span>
                  {stagedImage.width} × {stagedImage.height} • {Math.round(stagedImage.byteSize / 1024)} KB
                </span>
              </div>

              {/* Snapshot Preview Box */}
              <div className="relative rounded-hx-md overflow-hidden border border-hx-border-panel bg-hx-space flex items-center justify-center max-h-[380px]">
                <img
                  src={stagedImage.dataUrl}
                  alt="Captured still snapshot preview"
                  className="max-h-[380px] w-auto object-contain"
                />
              </div>

              {/* Privacy and Transmission Notice */}
              <div className="flex items-start space-x-2.5 p-3 rounded-hx-md bg-hx-surface/60 border border-hx-border-subtle text-[11px] font-mono text-hx-text-secondary">
                <Shield className="w-4 h-4 text-hx-cyan shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-hx-text-primary">Explicit Privacy Boundary: </span>
                  <span>
                    This snapshot is held ephemerally in renderer memory. It will never be written to disk or transmitted to an AI provider until you explicitly send your message in the conversation composer.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Live Stream / Source Selection View */
            <div className="space-y-4">
              {activeTab === 'screen' ? (
                /* Screen / Window Sources Grid */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-hx-text-secondary uppercase">
                      Select Display or Window to Capture:
                    </span>
                    <span className="text-[10px] font-mono text-hx-text-muted">
                      {screenSources.length} Sources Found
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {screenSources.map((source) => {
                      const isSelected = selectedSourceId === source.id
                      return (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => handleSourceSelect(source)}
                          className={`flex flex-col text-left p-2 rounded-hx-md border transition-all duration-fast ${
                            isSelected
                              ? 'border-hx-border-glow bg-hx-hover shadow-hx-glow-cyan-sm'
                              : 'border-hx-border-subtle bg-hx-surface/60 hover:bg-hx-surface'
                          }`}
                        >
                          <div className="w-full h-20 bg-hx-space rounded overflow-hidden mb-1.5 flex items-center justify-center border border-hx-border-subtle/50">
                            {source.thumbnailDataUrl ? (
                              <img
                                src={source.thumbnailDataUrl}
                                alt={source.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Monitor className="w-6 h-6 text-hx-text-muted" />
                            )}
                          </div>
                          <span
                            className="text-[11px] font-mono font-medium text-hx-text-primary truncate"
                            title={source.name}
                          >
                            {source.name}
                          </span>
                          <span className="text-[9px] font-mono text-hx-text-muted capitalize">
                            {source.id.startsWith('screen:') ? 'Screen' : 'Window'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* Camera Device Selector */
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="camera-select"
                    className="text-xs font-mono text-hx-text-secondary uppercase"
                  >
                    Active Camera Device:
                  </label>
                  <select
                    id="camera-select"
                    value={selectedCameraId}
                    onChange={(e) => handleCameraChange(e.target.value)}
                    className="bg-hx-surface border border-hx-border-panel rounded-hx-sm px-2.5 py-1 text-xs text-hx-text-primary font-mono focus:border-hx-border-glow focus:outline-none"
                  >
                    {cameras.length === 0 && <option value="">No cameras detected</option>}
                    {cameras.map((cam) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Live Video Preview Box */}
              <div className="relative rounded-hx-md overflow-hidden border border-hx-border-panel bg-hx-space flex items-center justify-center min-h-[220px] max-h-[320px]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full max-h-[320px] object-contain"
                />

                {status === 'previewing' && (
                  <div className="absolute top-2.5 left-2.5">
                    <Badge variant="warning" size="sm" isDot>
                      {activeTab === 'camera' ? 'CAMERA ACTIVE' : 'DISPLAY STREAM ACTIVE'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-hx-border-panel bg-hx-surface/70 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullCancel}
          >
            Cancel
          </Button>

          <div className="flex items-center space-x-2">
            {stagedImage ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRetake}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Retake
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmAttach}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Attach to Message
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCaptureSnapshot}
                disabled={status === 'error' || status === 'capturing'}
                isLoading={status === 'capturing'}
                leftIcon={activeTab === 'camera' ? <Camera className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              >
                Capture Snapshot
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
