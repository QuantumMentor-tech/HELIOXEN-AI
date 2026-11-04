import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Sparkles,
  GitBranch,
  Image as ImageIcon,
  FolderOpen,
  Play,
  Save,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Sliders,
  Plus
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { NavDestinationId } from '../navigation/types'
import {
  DiagramDocumentRecord,
  DiagramExportFormat,
  ImageGenerationAspectRatio,
  ImageGenerationBackground,
  ImageGenerationOutputFormat,
  ImageGenerationQuality,
  ImageGenerationResolution,
  ImageModelCapabilityDescriptor,
  MermaidDiagramTemplate,
  MermaidRenderResult,
  TemporaryGeneratedImageCandidate,
  VisualHubOverviewSnapshot
} from '../../../../shared/visual/types'
import { AiProviderId } from '../../../../shared/ai/types'

type VisualHubTabId = 'diagram_studio' | 'image_studio' | 'saved_diagrams'

export interface VisualHubPanelProps {
  onNavigate?: (destination: NavDestinationId) => void
}

export const VisualHubPanel: React.FC<VisualHubPanelProps> = ({ onNavigate }) => {
  const [overview, setOverview] = useState<VisualHubOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<VisualHubTabId>('diagram_studio')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Diagram Studio State
  const [activeDiagramId, setActiveDiagramId] = useState<string | undefined>(undefined)
  const [diagramTitle, setDiagramTitle] = useState<string>('System Architecture Flowchart')
  const [diagramDescription, setDiagramDescription] = useState<string>('')
  const [diagramTagsInput, setDiagramTagsInput] = useState<string>('architecture, mermaid')
  const [diagramSource, setDiagramSource] = useState<string>(
    `flowchart TD\n  User["User Request"] --> Core["HELIOXEN Core"]\n  Core --> VisualHub["VisualHub Workspace"]\n  VisualHub --> Mermaid["Mermaid Diagram Studio"]\n  VisualHub --> ImageGen["AI Image Studio"]`
  )
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [autoRender, setAutoRender] = useState<boolean>(true)
  const [renderResult, setRenderResult] = useState<MermaidRenderResult | null>(null)
  const [zoomScale, setZoomScale] = useState<number>(1)

  // Image Studio State
  const [selectedProviderId, setSelectedProviderId] = useState<AiProviderId>('google-gemini')
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-nano-banana-2.1')
  const [imagePrompt, setImagePrompt] = useState<string>('')
  const [aspectRatio, setAspectRatio] = useState<ImageGenerationAspectRatio>('1:1')
  const [resolution, setResolution] = useState<ImageGenerationResolution>('1K')
  const [quality, setQuality] = useState<ImageGenerationQuality>('auto')
  const [outputFormat, setOutputFormat] = useState<ImageGenerationOutputFormat>('image/png')
  const [background, setBackground] = useState<ImageGenerationBackground>('auto')
  const [externalConsent, setExternalConsent] = useState<boolean>(true)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  // Save to Gallery naming state
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(null)
  const [customGalleryName, setCustomGalleryName] = useState<string>('')
  const [customGalleryTags, setCustomGalleryTags] = useState<string>('ai-generated, visualhub')

  const refreshOverview = useCallback(async () => {
    if (!window.helioxen?.visual) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const snap = await window.helioxen.visual.getOverview()
      setOverview(snap)
      setAutoRender(snap.preferences.autoPreviewMermaid)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load VisualHub workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshOverview()
  }, [refreshOverview])

  const executeMermaidRender = useCallback(async (source: string) => {
    if (!window.helioxen?.visual) return
    try {
      const res = await window.helioxen.visual.renderMermaid({
        source
      })
      setRenderResult(res)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Mermaid validation failed')
    }
  }, [])

  // Debounced auto-render when editing Mermaid source
  useEffect(() => {
    if (!autoRender) return
    const handle = setTimeout(() => {
      void executeMermaidRender(diagramSource)
    }, 220)
    return () => clearTimeout(handle)
  }, [diagramSource, autoRender, executeMermaidRender])

  const selectedModelCapability: ImageModelCapabilityDescriptor | undefined = useMemo(() => {
    if (!overview) return undefined
    return (
      overview.eligibleImageModels.find(
        (m) => m.providerId === selectedProviderId && m.modelId === selectedModelId
      ) ?? overview.eligibleImageModels.find((m) => m.providerId === selectedProviderId)
    )
  }, [overview, selectedProviderId, selectedModelId])

  // Sync valid model & parameter defaults when provider or model changes
  useEffect(() => {
    if (!selectedModelCapability) return
    if (selectedModelCapability.modelId !== selectedModelId) {
      setSelectedModelId(selectedModelCapability.modelId)
    }
    if (!selectedModelCapability.supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(selectedModelCapability.supportedAspectRatios[0] ?? '1:1')
    }
    if (
      selectedModelCapability.supportedResolutions.length > 0 &&
      !selectedModelCapability.supportedResolutions.includes(resolution)
    ) {
      setResolution(selectedModelCapability.supportedResolutions[0] ?? '1K')
    }
    if (
      selectedModelCapability.supportedQualities.length > 0 &&
      !selectedModelCapability.supportedQualities.includes(quality)
    ) {
      setQuality(selectedModelCapability.supportedQualities[0] ?? 'auto')
    }
    if (!selectedModelCapability.supportedOutputFormats.includes(outputFormat)) {
      setOutputFormat(selectedModelCapability.supportedOutputFormats[0] ?? 'image/png')
    }
    if (!selectedModelCapability.supportsTransparentBackground && background === 'transparent') {
      setBackground('auto')
    }
  }, [
    selectedModelCapability,
    selectedModelId,
    aspectRatio,
    resolution,
    quality,
    outputFormat,
    background
  ])

  const handleSelectTemplate = (template: MermaidDiagramTemplate) => {
    if (hasUnsavedChanges) {
      const proceed = window.confirm(
        `Replace current unsaved diagram changes with the "${template.name}" starter template?`
      )
      if (!proceed) return
    }
    setActiveDiagramId(undefined)
    setDiagramTitle(template.name)
    setDiagramDescription(template.description)
    setDiagramSource(template.source)
    setHasUnsavedChanges(false)
    setStatusMessage(`Loaded "${template.name}" template.`)
    void executeMermaidRender(template.source)
  }

  const handleSaveDiagram = async () => {
    if (!window.helioxen?.visual) return
    try {
      setErrorMessage(null)
      const tags = diagramTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const saved = await window.helioxen.visual.saveDiagram({
        id: activeDiagramId,
        title: diagramTitle.trim() || 'Untitled Diagram',
        description: diagramDescription.trim() || undefined,
        source: diagramSource,
        tags
      })
      setActiveDiagramId(saved.id)
      setHasUnsavedChanges(false)
      setStatusMessage(`Saved diagram "${saved.title}" to VisualHub.`)
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save diagram')
    }
  }

  const handleExportDiagram = async (format: DiagramExportFormat) => {
    if (!window.helioxen?.visual) return
    try {
      setErrorMessage(null)
      const res = await window.helioxen.visual.exportDiagram({
        source: diagramSource,
        format,
        suggestedFileName: diagramTitle.trim() || 'diagram',
        promptSaveDialog: true
      })
      if (res && res.exported) {
        setStatusMessage(`Exported (${res.byteSize} bytes) to ${res.filePath}`)
      } else if (res && !res.exported) {
        setErrorMessage(res.errorMessage ?? `Failed to export .${format} diagram`)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `Failed to export .${format} diagram`)
    }
  }

  const handleSaveDiagramToGallery = async () => {
    if (!window.helioxen?.visual) return
    try {
      setErrorMessage(null)
      const tags = diagramTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const asset = await window.helioxen.visual.saveDiagramToGallery({
        displayName: diagramTitle.trim() || 'Exported Diagram',
        source: diagramSource,
        tags
      })
      setStatusMessage(
        `Saved diagram PNG "${asset.displayName}" into Media Gallery (ID: ${asset.id}).`
      )
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save diagram to Media Gallery')
    }
  }

  const handleLoadSavedDiagram = (doc: DiagramDocumentRecord) => {
    if (hasUnsavedChanges) {
      const proceed = window.confirm(`Discard unsaved changes and open "${doc.title}"?`)
      if (!proceed) return
    }
    setActiveDiagramId(doc.id)
    setDiagramTitle(doc.title)
    setDiagramDescription(doc.description ?? '')
    setDiagramTagsInput(doc.tags.join(', '))
    setDiagramSource(doc.source)
    setHasUnsavedChanges(false)
    setActiveTab('diagram_studio')
    setStatusMessage(`Opened saved diagram "${doc.title}".`)
    void executeMermaidRender(doc.source)
  }

  const handleDeleteSavedDiagram = async (id: string, title: string) => {
    if (!window.helioxen?.visual) return
    try {
      setErrorMessage(null)
      await window.helioxen.visual.deleteDiagram({ id })
      if (activeDiagramId === id) {
        setActiveDiagramId(undefined)
      }
      setStatusMessage(`Deleted diagram "${title}".`)
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete diagram')
    }
  }

  const handleGenerateImage = async () => {
    if (!window.helioxen?.visual) return
    if (!imagePrompt.trim()) {
      setErrorMessage('Please enter a descriptive prompt before generating an image.')
      return
    }
    try {
      setErrorMessage(null)
      setStatusMessage(null)
      setIsGenerating(true)
      const job = await window.helioxen.visual.generateImage({
        providerId: selectedProviderId,
        modelId: selectedModelId,
        prompt: imagePrompt.trim(),
        aspectRatio,
        resolution:
          selectedModelCapability && selectedModelCapability.supportedResolutions.length > 0
            ? resolution
            : undefined,
        quality:
          selectedModelCapability && selectedModelCapability.supportedQualities.length > 0
            ? quality
            : undefined,
        outputFormat,
        background: selectedModelCapability?.supportsTransparentBackground ? background : 'auto',
        numberOfImages: 1,
        referenceAssetIds: [],
        externalTransmissionConfirmed: externalConsent
      })
      setActiveJobId(job.jobId)
      if (job.state === 'completed') {
        setStatusMessage(
          `Generated ${job.candidates.length} image candidate(s) with ${job.modelId}. Review and click "Save to Media Gallery" to persist.`
        )
      } else if (job.state === 'cancelled') {
        setStatusMessage('Image generation was cancelled.')
      } else {
        setErrorMessage(job.errorMessage ?? `Image generation ended with status: ${job.state}`)
      }
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Image generation failed')
      await refreshOverview()
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCancelGeneration = async () => {
    if (!window.helioxen?.visual || !activeJobId) return
    try {
      const res = await window.helioxen.visual.cancelImageGeneration({ jobId: activeJobId })
      setStatusMessage(res.message)
      setIsGenerating(false)
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to cancel image generation')
    }
  }

  const handleSaveCandidateToGallery = async (candidate: TemporaryGeneratedImageCandidate) => {
    if (!window.helioxen?.visual) return
    try {
      setErrorMessage(null)
      const tags = customGalleryTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const displayName =
        savingCandidateId === candidate.candidateId && customGalleryName.trim()
          ? customGalleryName.trim()
          : candidate.promptSummary.slice(0, 60) || 'AI Generated Image'
      const res = await window.helioxen.visual.saveImageToGallery({
        candidateId: candidate.candidateId,
        displayName,
        tags,
        favorite: false
      })
      setSavingCandidateId(null)
      setCustomGalleryName('')
      setStatusMessage(
        `Saved "${res.asset.displayName}" to Media Gallery (Asset ID: ${res.asset.id}).`
      )
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save image to Media Gallery')
    }
  }

  const handleDiscardCandidate = async (candidateId: string) => {
    if (!window.helioxen?.visual) return
    try {
      setErrorMessage(null)
      await window.helioxen.visual.discardImageCandidate({ candidateId })
      setStatusMessage('Discarded temporary image candidate.')
      await refreshOverview()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to discard image candidate')
    }
  }

  if (loading && !overview) {
    return (
      <Card variant="panel" border="panel" padding="lg">
        <div className="flex items-center space-x-3 text-hx-text-secondary text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-hx-cyan" />
          <span>Initializing VisualHub Workspace...</span>
        </div>
      </Card>
    )
  }

  const activeProviderModels =
    overview?.eligibleImageModels.filter((m) => m.providerId === selectedProviderId) ?? []

  return (
    <div className="space-y-6 animate-hx-fade-in">
      {/* Top Workspace Header & Sub-Navigation */}
      <Card variant="panel" border="glow" padding="md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-hx-md bg-hx-space border border-hx-border-glow flex items-center justify-center text-hx-cyan shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-display font-semibold text-hx-text-primary">
                  VisualHub — Mermaid Diagram Studio &amp; AI Image Studio
                </h2>
                <Badge variant="nominal" size="sm">
                  Strict SVG Sandbox
                </Badge>
              </div>
              <p className="text-xs text-hx-text-secondary mt-0.5">
                Author, validate, preview, and export Mermaid diagrams (.mmd, .svg, .png), or generate capability-verified AI images and save approved assets into the Media Gallery.
              </p>
            </div>
          </div>

          {/* Sub-workspace Tabs */}
          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant={activeTab === 'diagram_studio' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('diagram_studio')}
              leftIcon={<GitBranch className="w-3.5 h-3.5" />}
            >
              Diagram Studio
            </Button>
            <Button
              variant={activeTab === 'image_studio' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('image_studio')}
              leftIcon={<ImageIcon className="w-3.5 h-3.5" />}
            >
              Image Studio
            </Button>
            <Button
              variant={activeTab === 'saved_diagrams' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('saved_diagrams')}
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            >
              Saved Diagrams ({overview?.savedDiagrams.length ?? 0})
            </Button>
          </div>
        </div>
      </Card>

      {/* Banners for Errors & Status */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between px-4 py-3 rounded-hx-md bg-hx-danger/10 border border-hx-danger/40 text-xs text-hx-danger"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-hx-text-secondary hover:text-hx-text-primary ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-hx-md bg-hx-cyan/10 border border-hx-border-glow text-xs text-hx-cyan">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <div className="flex items-center space-x-3">
            {onNavigate && statusMessage.includes('Media Gallery') && (
              <button
                type="button"
                onClick={() => onNavigate('memory')}
                className="underline font-medium hover:text-hx-text-primary"
              >
                Open Media Gallery
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-hx-text-secondary hover:text-hx-text-primary"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: DIAGRAM STUDIO */}
      {activeTab === 'diagram_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Templates & Mermaid Source Editor */}
          <div className="lg:col-span-6 space-y-4">
            <Card variant="panel" border="panel" padding="md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-cyan">
                  Starter Diagram Templates
                </h3>
                <Badge variant="neutral" size="sm">
                  7 Supported Types
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overview?.templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    title={tpl.description}
                    className="px-2.5 py-1 rounded-hx-sm text-[11px] bg-hx-space border border-hx-border-panel text-hx-text-secondary hover:text-hx-cyan hover:border-hx-border-glow transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </Card>

            <Card variant="panel" border="panel" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-text-primary">
                    Mermaid Source Editor
                  </h3>
                  {hasUnsavedChanges && (
                    <Badge variant="warning" size="sm">
                      Unsaved Edits
                    </Badge>
                  )}
                </div>
                <label className="flex items-center space-x-1.5 text-[11px] text-hx-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRender}
                    onChange={(e) => setAutoRender(e.target.checked)}
                    className="rounded border-hx-border-panel bg-hx-space text-hx-cyan"
                  />
                  <span>Live Preview</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-hx-text-secondary mb-1">
                    Diagram Title
                  </label>
                  <input
                    type="text"
                    value={diagramTitle}
                    onChange={(e) => {
                      setDiagramTitle(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="Diagram Title"
                    className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-hx-text-secondary mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={diagramTagsInput}
                    onChange={(e) => {
                      setDiagramTagsInput(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="architecture, sequence, erd"
                    className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-hx-text-secondary">
                    Mermaid Definition (strict security mode)
                  </label>
                  <span className="text-[11px] font-mono text-hx-text-muted">
                    {diagramSource.length.toLocaleString()} / 50,000 chars
                  </span>
                </div>
                <textarea
                  value={diagramSource}
                  onChange={(e) => {
                    setDiagramSource(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  rows={13}
                  spellCheck={false}
                  placeholder="Enter Mermaid diagram syntax..."
                  className="w-full p-3 rounded-hx-sm bg-hx-space border border-hx-border-panel font-mono text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void executeMermaidRender(diagramSource)}
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                  >
                    Validate &amp; Render
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleSaveDiagram()}
                    disabled={!renderResult?.valid}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Save Diagram
                  </Button>
                </div>

                <div className="flex items-center space-x-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!renderResult?.valid}
                    onClick={() => void handleExportDiagram('mmd')}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    .mmd
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!renderResult?.valid}
                    onClick={() => void handleExportDiagram('svg')}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    .svg
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!renderResult?.valid}
                    onClick={() => void handleExportDiagram('png')}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    .png
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!renderResult?.valid}
                    onClick={() => void handleSaveDiagramToGallery()}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    To Gallery
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Sanitized SVG Preview & Diagnostics */}
          <div className="lg:col-span-6 space-y-4">
            <Card variant="panel" border="panel" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-text-primary">
                    Sanitized Diagram Preview
                  </h3>
                  {renderResult && (
                    <Badge variant={renderResult.valid ? 'nominal' : 'danger'} size="sm">
                      {renderResult.valid ? `${renderResult.diagramType} • Valid` : 'Validation Error'}
                    </Badge>
                  )}
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setZoomScale((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                    title="Zoom Out"
                    className="p-1.5 rounded bg-hx-space border border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-hx-text-secondary px-1.5">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomScale((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                    title="Zoom In"
                    className="p-1.5 rounded bg-hx-space border border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomScale(1)}
                    title="Reset Zoom"
                    className="p-1.5 rounded bg-hx-space border border-hx-border-panel text-hx-text-secondary hover:text-hx-text-primary"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Canvas */}
              <div className="min-h-[340px] max-h-[460px] overflow-auto rounded-hx-md bg-hx-space border border-hx-border-panel flex items-center justify-center p-4">
                {renderResult?.valid && renderResult.svgMarkup ? (
                  <div
                    style={{
                      transform: `scale(${zoomScale})`,
                      transformOrigin: 'center center',
                      transition: 'transform 150ms ease'
                    }}
                    className="w-full flex items-center justify-center"
                  >
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(renderResult.svgMarkup)}`}
                      alt={diagramTitle || 'Mermaid Diagram Preview'}
                      className="max-w-full h-auto rounded"
                    />
                  </div>
                ) : (
                  <div className="text-center max-w-sm space-y-2 py-8">
                    <XCircle className="w-8 h-8 text-hx-danger mx-auto" />
                    <p className="text-xs font-semibold text-hx-text-primary">
                      Diagram Cannot Be Rendered
                    </p>
                    <p className="text-[11px] text-hx-text-secondary">
                      Fix the syntax or security policy diagnostics below while your source text remains intact in the editor.
                    </p>
                  </div>
                )}
              </div>

              {/* Metrics & Diagnostics */}
              {renderResult && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-hx-text-secondary">
                    <span>
                      Nodes: <strong className="text-hx-text-primary">{renderResult.nodeCount}</strong> / 150 • Edges:{' '}
                      <strong className="text-hx-text-primary">{renderResult.edgeCount}</strong> / 250
                    </span>
                    <span className="flex items-center space-x-1 text-hx-cyan">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>securityLevel: strict</span>
                    </span>
                  </div>

                  {renderResult.diagnostics.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {renderResult.diagnostics.map((diag, idx) => (
                        <div
                          key={`${diag.code}-${idx}`}
                          className="p-2 rounded text-[11px] border bg-hx-danger/10 border-hx-danger/40 text-hx-danger"
                        >
                          <div className="font-mono font-semibold">
                            [{diag.code}] {diag.line ? `Line ${diag.line}: ` : ''}
                            {diag.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: IMAGE STUDIO */}
      {activeTab === 'image_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Capability-Aware Controls & Prompt Composer */}
          <div className="lg:col-span-5 space-y-4">
            <Card variant="panel" border="panel" padding="md" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-cyan flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Provider &amp; Verified Image Model
                </h3>
                <Badge variant="nominal" size="sm">
                  Capability-Driven
                </Badge>
              </div>

              {/* Provider & Model Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-hx-text-secondary mb-1">
                    AI Provider
                  </label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value as AiProviderId)}
                    disabled={isGenerating}
                    className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
                  >
                    <option value="google-gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-hx-text-secondary mb-1">
                    Verified Image Model
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={isGenerating}
                    className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
                  >
                    {activeProviderModels.map((m) => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedModelCapability && (
                <div className="space-y-1">
                  <p className="text-[11px] text-hx-text-secondary bg-hx-space/70 px-3 py-2 rounded border border-hx-border-panel">
                    {selectedModelCapability.description}
                  </p>
                  {!selectedModelCapability.isEligible && selectedModelCapability.unavailabilityReason && (
                    <p className="text-[11px] text-hx-warning px-1">
                      Note: {selectedModelCapability.unavailabilityReason}
                    </p>
                  )}
                </div>
              )}

              {/* Dynamic Model-Specific Parameters */}
              {selectedModelCapability && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-hx-text-secondary mb-1">
                      Aspect Ratio
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as ImageGenerationAspectRatio)}
                      disabled={isGenerating}
                      className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
                    >
                      {selectedModelCapability.supportedAspectRatios.map((ar) => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedModelCapability.supportedResolutions.length > 0 && (
                    <div>
                      <label className="block text-[11px] text-hx-text-secondary mb-1">
                        Resolution / Dimensions
                      </label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value as ImageGenerationResolution)}
                        disabled={isGenerating}
                        className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
                      >
                        {selectedModelCapability.supportedResolutions.map((res) => (
                          <option key={res} value={res}>
                            {res}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedModelCapability.supportedQualities.length > 0 && (
                    <div>
                      <label className="block text-[11px] text-hx-text-secondary mb-1">
                        Rendering Quality
                      </label>
                      <select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value as ImageGenerationQuality)}
                        disabled={isGenerating}
                        className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
                      >
                        {selectedModelCapability.supportedQualities.map((q) => (
                          <option key={q} value={q}>
                            {q.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] text-hx-text-secondary mb-1">
                      Output Format
                    </label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value as ImageGenerationOutputFormat)}
                      disabled={isGenerating}
                      className="w-full px-2.5 py-1.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary"
                    >
                      {selectedModelCapability.supportedOutputFormats.map((fmt) => (
                        <option key={fmt} value={fmt}>
                          {fmt.replace('image/', '').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedModelCapability?.supportsTransparentBackground && (
                <label className="flex items-center space-x-2 text-xs text-hx-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={background === 'transparent'}
                    onChange={(e) => setBackground(e.target.checked ? 'transparent' : 'auto')}
                    disabled={isGenerating}
                    className="rounded border-hx-border-panel bg-hx-space text-hx-cyan"
                  />
                  <span>Request Transparent Background (PNG/WebP)</span>
                </label>
              )}

              {/* Prompt Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-hx-text-secondary">
                    Image Generation Prompt
                  </label>
                  <span className="text-[11px] font-mono text-hx-text-muted">
                    {imagePrompt.length} / 4,000
                  </span>
                </div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  disabled={isGenerating}
                  rows={4}
                  placeholder="Describe the subject, lighting, composition, and visual style..."
                  className="w-full p-2.5 rounded-hx-sm bg-hx-space border border-hx-border-panel text-xs text-hx-text-primary focus:outline-none focus:border-hx-cyan"
                />
              </div>

              {/* External Provider Transmission Disclosure */}
              <div className="p-2.5 rounded bg-hx-space border border-hx-border-panel space-y-1.5">
                <label className="flex items-start space-x-2 text-[11px] text-hx-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={externalConsent}
                    onChange={(e) => setExternalConsent(e.target.checked)}
                    disabled={isGenerating}
                    className="mt-0.5 rounded border-hx-border-panel bg-hx-space text-hx-cyan"
                  />
                  <span>
                    Authorize external transmission of this prompt to{' '}
                    <strong className="text-hx-text-primary">
                      {selectedProviderId === 'google-gemini' ? 'Google Gemini' : 'OpenAI'}
                    </strong>{' '}
                    ({selectedModelId}).
                  </span>
                </label>
              </div>

              {/* Generate / Cancel Actions */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleGenerateImage()}
                  disabled={isGenerating || !imagePrompt.trim() || !externalConsent}
                  leftIcon={
                    isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )
                  }
                  className="flex-1"
                >
                  {isGenerating ? 'Generating Image...' : 'Generate Image'}
                </Button>
                {isGenerating && activeJobId && (
                  <Button
                    variant="danger"
                    size="md"
                    onClick={() => void handleCancelGeneration()}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Generated Image Candidates & Explicit Save to Media Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <Card variant="panel" border="panel" padding="md" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-text-primary">
                    Generated Image Previews (Transient Session Candidates)
                  </h3>
                  <p className="text-[11px] text-hx-text-secondary">
                    Candidates are held in memory until you explicitly save them to the Media Gallery or discard them.
                  </p>
                </div>
                <Badge variant="info" size="sm">
                  {overview?.transientCandidates.length ?? 0} Candidate(s)
                </Badge>
              </div>

              {!overview?.transientCandidates.length ? (
                <div className="min-h-[300px] rounded-hx-md bg-hx-space border border-hx-border-panel flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <ImageIcon className="w-8 h-8 text-hx-text-muted" />
                  <p className="text-xs font-semibold text-hx-text-primary">
                    No Generated Image Candidates Yet
                  </p>
                  <p className="text-[11px] text-hx-text-secondary max-w-sm">
                    Select a verified image model, enter a prompt, and click Generate Image to preview results here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overview.transientCandidates.map((cand) => (
                    <div
                      key={cand.candidateId}
                      className="rounded-hx-md bg-hx-space border border-hx-border-panel overflow-hidden flex flex-col justify-between"
                    >
                      <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden p-2">
                        <img
                          src={cand.dataUrl}
                          alt={cand.promptSummary}
                          className="max-w-full max-h-full object-contain rounded"
                        />
                      </div>

                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="neutral" size="sm">
                            {cand.modelId}
                          </Badge>
                          <span className="text-[10px] font-mono text-hx-text-muted">
                            {cand.width}×{cand.height} • {cand.aspectRatio ?? '1:1'}
                          </span>
                        </div>

                        <p
                          className="text-xs text-hx-text-primary line-clamp-2"
                          title={cand.promptSummary}
                        >
                          {cand.promptSummary}
                        </p>

                        {savingCandidateId === cand.candidateId && !cand.savedAssetId && (
                          <div className="space-y-1.5 pt-1">
                            <input
                              type="text"
                              value={customGalleryName}
                              onChange={(e) => setCustomGalleryName(e.target.value)}
                              placeholder="Optional custom title in Media Gallery..."
                              className="w-full px-2 py-1 rounded bg-hx-panel border border-hx-border-panel text-xs text-hx-text-primary"
                            />
                            <input
                              type="text"
                              value={customGalleryTags}
                              onChange={(e) => setCustomGalleryTags(e.target.value)}
                              placeholder="Tags (comma-separated)..."
                              className="w-full px-2 py-1 rounded bg-hx-panel border border-hx-border-panel text-xs text-hx-text-primary"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          {cand.savedAssetId ? (
                            <Badge variant="nominal" size="sm">
                              Saved to Media Gallery
                            </Badge>
                          ) : savingCandidateId === cand.candidateId ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void handleSaveCandidateToGallery(cand)}
                              leftIcon={<Save className="w-3.5 h-3.5" />}
                            >
                              Confirm Save
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSavingCandidateId(cand.candidateId)
                                setCustomGalleryName(cand.promptSummary.slice(0, 50))
                              }}
                              leftIcon={<Save className="w-3.5 h-3.5" />}
                            >
                              Save to Media Gallery
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleDiscardCandidate(cand.candidateId)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                          >
                            Discard
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: SAVED DIAGRAMS */}
      {activeTab === 'saved_diagrams' && (
        <Card variant="panel" border="panel" padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-hx-text-primary">
                Saved Mermaid Diagrams
              </h3>
              <p className="text-[11px] text-hx-text-secondary">
                Reopen saved diagrams in Diagram Studio to continue editing or export in .mmd, .svg, or .png formats.
              </p>
            </div>
            <Badge variant="info" size="sm">
              {overview?.savedDiagrams.length ?? 0} Diagram(s)
            </Badge>
          </div>

          {!overview?.savedDiagrams.length ? (
            <div className="py-12 text-center space-y-2">
              <GitBranch className="w-8 h-8 text-hx-text-muted mx-auto" />
              <p className="text-xs font-semibold text-hx-text-primary">
                No Saved Diagrams Yet
              </p>
              <p className="text-[11px] text-hx-text-secondary">
                Create or customize a diagram in Diagram Studio and click &ldquo;Save Diagram&rdquo; to store it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overview.savedDiagrams.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-hx-md bg-hx-space border border-hx-border-panel flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="nominal" size="sm">
                        {doc.diagramType}
                      </Badge>
                      <span className="text-[10px] font-mono text-hx-text-muted">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-hx-text-primary truncate">
                      {doc.title}
                    </h4>
                    {doc.description && (
                      <p className="text-[11px] text-hx-text-secondary line-clamp-2">
                        {doc.description}
                      </p>
                    )}
                    <pre className="p-2 rounded bg-hx-panel text-[10px] font-mono text-hx-text-secondary max-h-24 overflow-hidden">
                      {doc.source}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-hx-border-panel">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLoadSavedDiagram(doc)}
                    >
                      Open in Studio
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDeleteSavedDiagram(doc.id, doc.title)}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
