import { describe, it, expect } from 'vitest'
import {
  ExecutionAuditTrail,
  sanitizeAuditMetadata
} from '../../src/shared/orchestration/ExecutionAuditTrail'
import { AuditEventType } from '../../src/shared/orchestration/types'

describe('Step 27: Structured Execution Audit Trail', () => {
  describe('Metadata Sanitization & Privacy Boundaries', () => {
    it('redacts sensitive keys including token, secret, password, key, credential, auth', () => {
      const dirty = {
        normalField: 'hello world',
        apiKey: 'secret_12345',
        bearer_token: 'xyz-jwt',
        userPassword: 'super-secure-password',
        authCredential: 'basic-auth-val',
        nested: {
          sessionToken: 'nested-secret',
          safeCount: 42
        }
      }

      const clean = sanitizeAuditMetadata(dirty)
      expect(clean).toBeDefined()
      expect(clean?.normalField).toBe('hello world')
      expect(clean?.apiKey).toBe('[REDACTED]')
      expect(clean?.bearer_token).toBe('[REDACTED]')
      expect(clean?.userPassword).toBe('[REDACTED]')
      expect(clean?.authCredential).toBe('[REDACTED]')
      expect((clean?.nested as any)?.sessionToken).toBe('[REDACTED]')
      expect((clean?.nested as any)?.safeCount).toBe(42)
    })

    it('truncates strings longer than 256 characters to prevent log bloat', () => {
      const longString = 'a'.repeat(300)
      const sanitized = sanitizeAuditMetadata({ documentText: longString })
      expect(sanitized?.documentText).toContain('... [TRUNCATED]')
      expect((sanitized?.documentText as string).length).toBeLessThan(280)
    })

    it('omits raw binary buffers and replaces arrays with summary representations', () => {
      const buffer = Buffer.from('raw binary audio or image data')
      const uint8 = new Uint8Array([1, 2, 3, 4, 5])
      const array = [1, 2, 3]

      const sanitized = sanitizeAuditMetadata({
        audioBuffer: buffer,
        imageBytes: uint8,
        items: array
      })

      expect(sanitized?.audioBuffer).toMatch(/\[Binary buffer: \d+ bytes\]/)
      expect(sanitized?.imageBytes).toMatch(/\[Binary buffer: \d+ bytes\]/)
      expect(sanitized?.items).toBe('[Array length: 3]')
    })

    it('handles undefined or null metadata cleanly', () => {
      expect(sanitizeAuditMetadata(undefined)).toBeUndefined()
    })
  })

  describe('Audit Trail Recording & Sequencing', () => {
    it('records events with strictly monotonic sequence numbers', () => {
      const audit = new ExecutionAuditTrail()
      const event1 = audit.recordEvent({
        taskId: 'task-1',
        eventType: 'task:created',
        newState: 'created'
      })

      const event2 = audit.recordEvent({
        taskId: 'task-1',
        stepId: 'step-1',
        eventType: 'step:dispatched',
        newState: 'running',
        attemptNumber: 1
      })

      const event3 = audit.recordEvent({
        taskId: 'task-2',
        eventType: 'task:created',
        newState: 'created'
      })

      expect(event1.sequenceNumber).toBe(1)
      expect(event2.sequenceNumber).toBe(2)
      expect(event3.sequenceNumber).toBe(3)
      expect(event2.stepId).toBe('step-1')
      expect(event2.attemptNumber).toBe(1)
    })

    it('freezes recorded events to prevent subsequent mutation', () => {
      const audit = new ExecutionAuditTrail()
      const event = audit.recordEvent({
        taskId: 'task-1',
        eventType: 'task:created',
        newState: 'created'
      })

      expect(Object.isFrozen(event)).toBe(true)
      expect(() => {
        ;(event as any).newState = 'corrupted'
      }).toThrow()
    })

    it('preserves failed attempts rather than overwriting them', () => {
      const audit = new ExecutionAuditTrail()
      const taskId = 'task-fail-retry'
      const stepId = 'step-network'

      // Step dispatched attempt 1
      audit.recordEvent({
        taskId,
        stepId,
        eventType: 'step:dispatched',
        newState: 'running',
        attemptNumber: 1
      })

      // Step failed attempt 1
      audit.recordEvent({
        taskId,
        stepId,
        eventType: 'step:failed',
        newState: 'failed',
        attemptNumber: 1,
        resultCategory: 'temporary_provider_failure'
      })

      // Retry scheduled
      audit.recordEvent({
        taskId,
        stepId,
        eventType: 'retry:scheduled',
        newState: 'retry_scheduled',
        attemptNumber: 2
      })

      // Step dispatched attempt 2
      audit.recordEvent({
        taskId,
        stepId,
        eventType: 'step:dispatched',
        newState: 'running',
        attemptNumber: 2
      })

      // Step succeeded attempt 2
      audit.recordEvent({
        taskId,
        stepId,
        eventType: 'step:succeeded',
        newState: 'succeeded',
        attemptNumber: 2
      })

      const taskEvents = audit.getTaskAudit(taskId)
      expect(taskEvents).toHaveLength(5)
      expect(taskEvents[0].attemptNumber).toBe(1)
      expect(taskEvents[1].eventType).toBe('step:failed')
      expect(taskEvents[1].attemptNumber).toBe(1)
      expect(taskEvents[3].attemptNumber).toBe(2)
      expect(taskEvents[4].eventType).toBe('step:succeeded')
    })
  })

  describe('Ring-Buffer Capacity Limits & Bounded Memory', () => {
    it('enforces maximum event limits per task ring buffer', () => {
      const audit = new ExecutionAuditTrail({ maxEventsPerTask: 5 })
      const taskId = 'task-bounded'

      for (let i = 1; i <= 10; i++) {
        audit.recordEvent({
          taskId,
          eventType: 'step:dispatched',
          newState: `state_${i}`,
          metadata: { iteration: i }
        })
      }

      const events = audit.getTaskAudit(taskId)
      expect(events).toHaveLength(5)
      // The oldest 5 should have been shifted out; events should have sequence 6..10
      expect(events[0].sequenceNumber).toBe(6)
      expect(events[4].sequenceNumber).toBe(10)
    })

    it('enforces global event limits across multiple tasks', () => {
      const audit = new ExecutionAuditTrail({ maxGlobalEvents: 8 })

      for (let i = 1; i <= 12; i++) {
        audit.recordEvent({
          taskId: `task-${i}`,
          eventType: 'task:created',
          newState: 'created'
        })
      }

      expect(audit.totalEventCount).toBe(8)
    })
  })

  describe('Query Filtering & Purging', () => {
    it('filters audit events by stepId, eventTypes, and limit', () => {
      const audit = new ExecutionAuditTrail()
      const taskId = 'task-query'

      audit.recordEvent({ taskId, stepId: 'step-a', eventType: 'step:dispatched', newState: 'running' })
      audit.recordEvent({ taskId, stepId: 'step-a', eventType: 'step:succeeded', newState: 'succeeded' })
      audit.recordEvent({ taskId, stepId: 'step-b', eventType: 'step:dispatched', newState: 'running' })
      audit.recordEvent({ taskId, stepId: 'step-b', eventType: 'step:failed', newState: 'failed' })

      const stepAEvents = audit.query({ taskId, stepId: 'step-a' })
      expect(stepAEvents).toHaveLength(2)

      const failedEvents = audit.query({ taskId, eventTypes: ['step:failed'] })
      expect(failedEvents).toHaveLength(1)
      expect(failedEvents[0].stepId).toBe('step-b')

      const limited = audit.query({ taskId, limit: 2 })
      expect(limited).toHaveLength(2)
      expect(limited[1].stepId).toBe('step-b')
    })

    it('purges task audit trail upon task/conversation cleanup', () => {
      const audit = new ExecutionAuditTrail()
      const taskId = 'task-to-purge'

      audit.recordEvent({ taskId, eventType: 'task:created', newState: 'created' })
      expect(audit.getTaskAudit(taskId)).toHaveLength(1)

      const purged = audit.purgeTaskAudit(taskId)
      expect(purged).toBe(true)
      expect(audit.getTaskAudit(taskId)).toHaveLength(0)
    })
  })
})
