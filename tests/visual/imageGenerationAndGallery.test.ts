/**
 * HELIOXEN AI — Step 37 Test Suite
 * Capability-Aware AI Image Generation, Cancellation, Error Handling, Gallery Integration & E2E Workflow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  BUILTIN_MERMAID_TEMPLATES,
  renderBoundedPngBuffer,
  VERIFIED_IMAGE_MODEL_CAPABILITIES
} from '../../src/shared/visual'
import { AiProviderImageGenerationRequest, AiProviderImageGenerationResponse } from '../../src/shared/ai/types'
import { AiProviderException } from '../../src/main/ai/errors'
import { MediaLibraryService } from '../../src/main/media/MediaLibraryService'
import { VisualHubService } from '../../src/main/visual/VisualHubService'
import { ProviderService } from '../../src/main/ai/ProviderService'

function createFakeProviderService(overrides?: {
  geminiConfigured?: boolean
  openaiConfigured?: boolean
  geminiHealthy?: boolean
  openaiHealthy?: boolean
  generateImageImpl?: (
    req: AiProviderImageGenerationRequest,
    signal?: AbortSignal
  ) => Promise<AiProviderImageGenerationResponse>
}): ProviderService {
  const geminiConfigured = overrides?.geminiConfigured ?? true
  const openaiConfigured = overrides?.openaiConfigured ?? true
  const geminiHealthy = overrides?.geminiHealthy ?? true
  const openaiHealthy = overrides?.openaiHealthy ?? true

  const defaultPngBase64 = renderBoundedPngBuffer(256, 256).toString('base64')

  const mock = {
    getCredentialStatus: async () => ({
      'google-gemini': {
        provider: 'google-gemini' as const,
        configured: geminiConfigured,
        updatedAt: Date.now()
      },
      openai: {
        provider: 'openai' as const,
        configured: openaiConfigured,
        updatedAt: Date.now()
      }
    }),
    getHealthStatus: () => ({
      'google-gemini': {
        providerId: 'google-gemini' as const,
        status: geminiHealthy ? ('healthy' as const) : ('unavailable' as const),
        consecutiveFailures: geminiHealthy ? 0 : 3
      },
      openai: {
        providerId: 'openai' as const,
        status: openaiHealthy ? ('healthy' as const) : ('unavailable' as const),
        consecutiveFailures: openaiHealthy ? 0 : 3
      }
    }),
    generateImage: async (
      req: AiProviderImageGenerationRequest,
      signal?: AbortSignal
    ): Promise<AiProviderImageGenerationResponse> => {
      if (overrides?.generateImageImpl) {
        return overrides.generateImageImpl(req, signal)
      }
      return {
        provider: req.provider,
        model: req.model,
        images: [
          {
            base64Data: defaultPngBase64,
            mimeType: req.outputFormat ?? 'image/png',
            revisedPrompt: req.prompt
          }
        ],
        latencyMs: 42
      }
    }
  }

  return mock as unknown as ProviderService
}

describe('Step 37 — Capability-Aware AI Image Generation, Gallery Save & E2E Workflow', () => {
  let tempDir: string
  let mediaService: MediaLibraryService
  let currentProviderService: ProviderService
  let visualHubService: VisualHubService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helioxen-step37-image-'))
    mediaService = new MediaLibraryService({ storageDir: tempDir })
    currentProviderService = createFakeProviderService()
    visualHubService = new VisualHubService({
      storageDir: tempDir,
      mediaLibraryService: mediaService,
      providerServiceGetter: () => currentProviderService
    })
  })

  afterEach(() => {
    visualHubService.dispose()
    mediaService.dispose()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors on Windows
    }
  })

  describe('1. Capability Detection & Eligibility Filtering (Section 17.3)', () => {
    it('returns verified image model capability descriptors and marks unconfigured providers as ineligible', async () => {
      currentProviderService = createFakeProviderService({
        geminiConfigured: true,
        openaiConfigured: false
      })

      const models = await visualHubService.getEligibleImageModels()
      expect(models.length).toBe(Object.keys(VERIFIED_IMAGE_MODEL_CAPABILITIES).length)

      const geminiDefault = models.find((m) => m.modelId === 'gemini-nano-banana-2.1')
      expect(geminiDefault).toBeDefined()
      expect(geminiDefault?.isProviderConfigured).toBe(true)
      expect(geminiDefault?.isEligible).toBe(true)

      const openaiSunburst = models.find((m) => m.modelId === 'gpt-image-2.5-sunburst')
      expect(openaiSunburst).toBeDefined()
      expect(openaiSunburst?.isProviderConfigured).toBe(false)
      expect(openaiSunburst?.isEligible).toBe(false)
      expect(openaiSunburst?.unavailabilityReason).toContain('not configured')
    })

    it('rejects text-only models and unsupported model parameters before provider dispatch', async () => {
      // Text-only model must be rejected
      await expect(
        visualHubService.generateImage({
          providerId: 'google-gemini',
          modelId: 'gemini-2.5-pro',
          prompt: 'A futuristic observatory',
          numberOfImages: 1,
          externalTransmissionConfirmed: true
        })
      ).rejects.toThrow(/UNSUPPORTED_IMAGE_MODEL/)

      // Gemini models do not support transparent backgrounds
      await expect(
        visualHubService.generateImage({
          providerId: 'google-gemini',
          modelId: 'gemini-nano-banana-2.1',
          prompt: 'A transparent icon',
          background: 'transparent',
          numberOfImages: 1,
          externalTransmissionConfirmed: true
        })
      ).rejects.toThrow(/UNSUPPORTED_MODEL_OPTION/)

      // gemini-3.1-flash-lite-image does not support 4K resolution
      await expect(
        visualHubService.generateImage({
          providerId: 'google-gemini',
          modelId: 'gemini-3.1-flash-lite-image',
          prompt: 'A landscape',
          resolution: '4K',
          numberOfImages: 1,
          externalTransmissionConfirmed: true
        })
      ).rejects.toThrow(/UNSUPPORTED_MODEL_OPTION/)

      // OpenAI transparent background with JPEG must be rejected
      await expect(
        visualHubService.generateImage({
          providerId: 'openai',
          modelId: 'gpt-image-2.5-sunburst',
          prompt: 'A transparent badge',
          background: 'transparent',
          outputFormat: 'image/jpeg',
          numberOfImages: 1,
          externalTransmissionConfirmed: true
        })
      ).rejects.toThrow(/UNSUPPORTED_MODEL_OPTION/)
    })

    it('enforces explicit external transmission consent and blocks secret/credential leakage in prompts', async () => {
      await expect(
        visualHubService.generateImage({
          providerId: 'google-gemini',
          modelId: 'gemini-nano-banana-2.1',
          prompt: 'A cybernetic owl',
          numberOfImages: 1,
          externalTransmissionConfirmed: false
        })
      ).rejects.toThrow(/EXTERNAL_TRANSMISSION_CONSENT_REQUIRED/)

      await expect(
        visualHubService.generateImage({
          providerId: 'google-gemini',
          modelId: 'gemini-nano-banana-2.1',
          prompt: 'Render my secret key sk-proj-1234567890abcdefghijklmnop',
          numberOfImages: 1,
          externalTransmissionConfirmed: true
        })
      ).rejects.toThrow(/PRIVACY_POLICY_REJECTED/)
    })
  })

  describe('2. Generation Lifecycle, Cancellation, Timeout & Corrupt Output Protection (Section 17.4)', () => {
    it('executes image generation with Gemini and OpenAI models and creates validated temporary candidates without auto-saving to Media Gallery', async () => {
      const geminiJob = await visualHubService.generateImage({
        providerId: 'google-gemini',
        modelId: 'gemini-nano-banana-2.1',
        prompt: 'Orbital space station over a neon planet',
        aspectRatio: '16:9',
        resolution: '2K',
        outputFormat: 'image/png',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })

      expect(geminiJob.state).toBe('completed')
      expect(geminiJob.candidates).toHaveLength(1)
      expect(geminiJob.candidates[0]?.width).toBe(256)
      expect(geminiJob.candidates[0]?.height).toBe(256)
      expect(geminiJob.candidates[0]?.savedAssetId).toBeNull()

      // Verify Media Gallery is still empty until explicit user save
      expect(mediaService.listAssets({}).totalCount).toBe(0)

      const openaiJob = await visualHubService.generateImage({
        providerId: 'openai',
        modelId: 'gpt-image-2.5-sunburst',
        prompt: 'Minimalist geometric emblem',
        aspectRatio: '1:1',
        resolution: '1024x1024',
        quality: 'high',
        background: 'transparent',
        outputFormat: 'image/png',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })

      expect(openaiJob.state).toBe('completed')
      expect(openaiJob.candidates).toHaveLength(1)
    })

    it('supports cooperative cancellation and discards late provider responses', async () => {
      let capturedJobId: string | null = null

      currentProviderService = createFakeProviderService({
        generateImageImpl: async (req) => {
          // Cancel while the provider request is in-flight
          const snap = await visualHubService.getOverviewSnapshot()
          const runningJob = snap.activeJobs.find((j) => j.state === 'generating')
          if (runningJob) {
            capturedJobId = runningJob.jobId
            visualHubService.cancelImageGeneration({ jobId: runningJob.jobId })
          }
          return {
            provider: req.provider,
            model: req.model,
            images: [
              {
                base64Data: renderBoundedPngBuffer(128, 128).toString('base64'),
                mimeType: 'image/png'
              }
            ],
            latencyMs: 50
          }
        }
      })

      const job = await visualHubService.generateImage({
        providerId: 'google-gemini',
        modelId: 'gemini-nano-banana-2.1',
        prompt: 'Slow generation request that gets cancelled',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })

      expect(capturedJobId).toBeTruthy()
      expect(job.state).toBe('cancelled')
      expect(job.cancellationStatus).toBe('confirmed')
      expect(job.candidates).toHaveLength(0)
    })

    it('marks timed-out provider requests as outcome_unknown without automatic blind retry', async () => {
      let invocationCount = 0
      currentProviderService = createFakeProviderService({
        generateImageImpl: async () => {
          invocationCount++
          throw new AiProviderException({
            code: 'TIMEOUT',
            message: 'Provider image request timed out after 30000ms',
            provider: 'google-gemini',
            retryable: true
          })
        }
      })

      const job = await visualHubService.generateImage({
        providerId: 'google-gemini',
        modelId: 'gemini-nano-banana-2.1',
        prompt: 'A high-detail nebula',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })

      expect(invocationCount).toBe(1)
      expect(job.state).toBe('outcome_unknown')
      expect(job.errorCode).toBe('TIMEOUT_OUTCOME_UNKNOWN')
      expect(job.retryable).toBe(true)
    })

    it('rejects corrupt or non-image bytes returned by a provider before preview or gallery save', async () => {
      currentProviderService = createFakeProviderService({
        generateImageImpl: async (req) => ({
          provider: req.provider,
          model: req.model,
          images: [
            {
              base64Data: Buffer.from('not-a-valid-png-or-jpeg-binary').toString('base64'),
              mimeType: 'image/png'
            }
          ],
          latencyMs: 15
        })
      })

      const job = await visualHubService.generateImage({
        providerId: 'google-gemini',
        modelId: 'gemini-nano-banana-2.1',
        prompt: 'Corrupt payload test',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })

      expect(job.state).toBe('failed')
      expect(job.candidates).toHaveLength(0)
    })

    it('prevents duplicate concurrent submission of the identical image generation request', async () => {
      let releaseRequest!: () => void
      const gate = new Promise<void>((resolve) => {
        releaseRequest = resolve
      })

      currentProviderService = createFakeProviderService({
        generateImageImpl: async (req) => {
          await gate
          return {
            provider: req.provider,
            model: req.model,
            images: [
              {
                base64Data: renderBoundedPngBuffer(64, 64).toString('base64'),
                mimeType: 'image/png'
              }
            ],
            latencyMs: 20
          }
        }
      })

      const firstPromise = visualHubService.generateImage({
        providerId: 'google-gemini',
        modelId: 'gemini-nano-banana-2.1',
        prompt: 'Concurrent lock test prompt',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })

      await expect(
        visualHubService.generateImage({
          providerId: 'google-gemini',
          modelId: 'gemini-nano-banana-2.1',
          prompt: 'Concurrent lock test prompt',
          numberOfImages: 1,
          externalTransmissionConfirmed: true
        })
      ).rejects.toThrow(/DUPLICATE_GENERATION_IN_PROGRESS/)

      releaseRequest()
      const completedFirst = await firstPromise
      expect(completedFirst.state).toBe('completed')
    })
  })

  describe('3. Explicit Media Gallery Integration & Full 20-Step End-to-End Verification (Sections 17.5 & 21)', () => {
    it('executes the complete Step 37 end-to-end user journey across Diagram Studio, Image Studio, and Media Gallery', async () => {
      // 1-2. Open VisualHub overview and verify starter templates
      const initialOverview = await visualHubService.getOverviewSnapshot()
      expect(initialOverview.templates.length).toBe(7)

      // 3-4. Select flowchart template, customize, validate, and render safe SVG
      const flowchartTpl = BUILTIN_MERMAID_TEMPLATES.find((t) => t.diagramType === 'flowchart')!
      const renderValid = visualHubService.validateAndRenderMermaid({
        source: flowchartTpl.source + '\n  Store --> Audit["Audit Trail"]'
      })
      expect(renderValid.valid).toBe(true)
      expect(renderValid.svgMarkup).toContain('Audit Trail')

      // 5-6. Introduce syntax error, verify structured diagnostic, then restore valid syntax
      const renderBroken = visualHubService.validateAndRenderMermaid({
        source: flowchartTpl.source + '\n  Broken["Unclosed quote --> Audit'
      })
      expect(renderBroken.valid).toBe(false)
      expect(renderBroken.diagnostics.length).toBeGreaterThan(0)

      // 7-9. Save diagram document and export as .mmd, .svg, and .png
      const savedDoc = visualHubService.saveDiagramDocument({
        title: 'E2E Architecture Flowchart',
        description: 'Verified end-to-end diagram',
        source: flowchartTpl.source,
        tags: ['e2e', 'architecture']
      })
      expect(savedDoc.id).toBeTruthy()

      const expMmd = visualHubService.exportDiagram({
        source: savedDoc.source,
        format: 'mmd',
        suggestedFileName: 'e2e-arch'
      })
      const expSvg = visualHubService.exportDiagram({
        source: savedDoc.source,
        format: 'svg',
        suggestedFileName: 'e2e-arch'
      })
      const expPng = visualHubService.exportDiagram({
        source: savedDoc.source,
        format: 'png',
        suggestedFileName: 'e2e-arch'
      })
      expect(expMmd.exported && expSvg.exported && expPng.exported).toBe(true)

      // 10-14. Generate an image with a verified provider/model and inspect transient candidate
      const genJob = await visualHubService.generateImage({
        providerId: 'google-gemini',
        modelId: 'gemini-nano-banana-2.1',
        prompt: 'High-tech command center hologram interface',
        aspectRatio: '16:9',
        resolution: '1K',
        outputFormat: 'image/png',
        numberOfImages: 1,
        externalTransmissionConfirmed: true
      })
      expect(genJob.state).toBe('completed')
      const candidate = genJob.candidates[0]!
      expect(candidate).toBeDefined()

      // 15-17. Explicitly save the generated image to Step 36 Media Gallery and verify metadata & provenance
      const saveRes = await visualHubService.saveGeneratedImageToGallery({
        candidateId: candidate.candidateId,
        displayName: 'Hologram Interface Concept',
        tags: ['hologram', 'concept'],
        favorite: true,
        retainPromptInMetadata: true
      })
      expect(saveRes.saved).toBe(true)
      expect(saveRes.asset.sourceType).toBe('ai_generated_image')
      expect(saveRes.asset.sourceReference).toContain('ai:google-gemini:gemini-nano-banana-2.1')
      expect(saveRes.asset.favorite).toBe(true)
      expect(saveRes.asset.description).toContain('Hologram interface'.toLowerCase().slice(0, 5) ? 'Generated by' : '')

      // 18. Discard transient candidate from VisualHub session memory and verify saved Media Gallery asset remains intact
      const discardRes = visualHubService.discardGeneratedCandidate({
        candidateId: candidate.candidateId
      })
      expect(discardRes.discarded).toBe(true)
      expect(discardRes.preservedSavedAssetId).toBe(saveRes.asset.id)

      const galleryAsset = mediaService.getAsset(saveRes.asset.id)
      expect(galleryAsset).not.toBeNull()
      expect(galleryAsset?.status).toBe('available')

      // 19-20. Simulate application restart by instantiating fresh services on the same storage directory
      const restartedMediaService = new MediaLibraryService({ storageDir: tempDir })
      const restartedVisualHub = new VisualHubService({
        storageDir: tempDir,
        mediaLibraryService: restartedMediaService,
        providerServiceGetter: () => currentProviderService
      })

      const persistedDiagrams = restartedVisualHub.listDiagramDocuments({})
      expect(persistedDiagrams).toHaveLength(1)
      expect(persistedDiagrams[0]?.title).toBe('E2E Architecture Flowchart')

      const persistedGallery = restartedMediaService.listAssets({})
      expect(persistedGallery.totalCount).toBe(1)
      expect(persistedGallery.assets[0]?.displayName).toBe('Hologram Interface Concept')

      restartedVisualHub.dispose()
      restartedMediaService.dispose()
    })
  })
})
