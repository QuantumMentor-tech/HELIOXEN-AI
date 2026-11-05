import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { SmartHomeService } from '../../src/main/smart-home/SmartHomeService'
import { classifyActionRisk, isHighRiskPhysicalAction } from '../../src/shared/smart-home/contracts'
import { CredentialStorageService } from '../../src/main/security/credentialStorage'

describe('Smart-Home Integration Service & Security Contracts (Step 45)', () => {
  let tempDir: string
  let service: SmartHomeService
  let mockCurrentTime: number
  let mockCredentialStorage: CredentialStorageService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-smarthome-test-'))
    mockCurrentTime = 1700000000000

    mockCredentialStorage = {
      storeSecret: vi.fn().mockResolvedValue(undefined),
      getSecret: vi.fn().mockResolvedValue('sample-decrypted-token'),
      deleteSecret: vi.fn().mockResolvedValue(true),
      hasSecret: vi.fn().mockResolvedValue(true),
      listSecrets: vi.fn().mockResolvedValue([])
    } as unknown as CredentialStorageService

    service = new SmartHomeService({
      storageDir: tempDir,
      credentialStorage: mockCredentialStorage,
      nowFn: () => mockCurrentTime
    })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Risk Classification & High-Risk Physical Detection', () => {
    it('classifies read-only sensors properly', () => {
      expect(classifyActionRisk('sensor', 'read')).toBe('read_only')
      expect(classifyActionRisk('binary_sensor', 'read')).toBe('read_only')
    })

    it('classifies environmental reversible actions properly', () => {
      expect(classifyActionRisk('light', 'turn_on')).toBe('reversible_action')
      expect(classifyActionRisk('light', 'turn_off')).toBe('reversible_action')
      expect(classifyActionRisk('switch', 'turn_on')).toBe('reversible_action')
      expect(classifyActionRisk('climate', 'set_temperature')).toBe('reversible_action')
      expect(classifyActionRisk('lock', 'lock')).toBe('reversible_action')
      expect(classifyActionRisk('cover', 'close')).toBe('reversible_action')
    })

    it('classifies physical access actuation as high-impact physical security consequential', () => {
      expect(classifyActionRisk('lock', 'unlock')).toBe('physical_security_consequential')
      expect(classifyActionRisk('cover', 'open')).toBe('physical_security_consequential')
      expect(classifyActionRisk('alarm', 'disarm')).toBe('physical_security_consequential')
    })

    it('identifies physical access actions needing mandatory human confirmation', () => {
      expect(isHighRiskPhysicalAction('lock', 'unlock')).toBe(true)
      expect(isHighRiskPhysicalAction('cover', 'open')).toBe(true)
      expect(isHighRiskPhysicalAction('alarm', 'disarm')).toBe(true)

      // Securing actions do not reduce physical perimeter security
      expect(isHighRiskPhysicalAction('lock', 'lock')).toBe(false)
      expect(isHighRiskPhysicalAction('cover', 'close')).toBe(false)
      expect(isHighRiskPhysicalAction('alarm', 'arm_away')).toBe(false)
      expect(isHighRiskPhysicalAction('light', 'turn_on')).toBe(false)
    })
  })

  describe('2. Smart-Home Hub Management & Secure Secrets', () => {
    it('initializes default Home Assistant local hub', () => {
      const hub = service.getHubStatus('hub_home_assistant_local')
      expect(hub).not.toBeNull()
      expect(hub?.displayName).toBe('Home Assistant Local Gateway')
      expect(hub?.isConnected).toBe(true)
      expect(hub?.isAuthorized).toBe(true)
      expect(hub?.platform).toBe('home_assistant')
    })

    it('connects a new hub and securely stores credentials via DPAPI storage', async () => {
      const result = await service.connectHub({
        hubId: 'hub_matter_rest_01',
        displayName: 'Matter Gateway Bedroom',
        endpointUrl: 'http://192.168.1.150:8080/api',
        accessToken: 'sec_bearer_token_xyz'
      })

      expect(result.success).toBe(true)
      expect(result.hub?.hubId).toBe('hub_matter_rest_01')
      expect(result.hub?.isConnected).toBe(true)
      expect(mockCredentialStorage.storeSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'smart_home:hub_matter_rest_01',
          secret: 'sec_bearer_token_xyz'
        })
      )
    })

    it('disconnects hub and deletes associated encrypted secret', async () => {
      const disconnected = await service.disconnectHub('hub_home_assistant_local')
      expect(disconnected).toBe(true)

      const hub = service.getHubStatus('hub_home_assistant_local')
      expect(hub?.isConnected).toBe(false)
      expect(hub?.isAuthorized).toBe(false)
      expect(mockCredentialStorage.deleteSecret).toHaveBeenCalledWith('smart_home:hub_home_assistant_local')
    })
  })

  describe('3. Entity Discovery & State Inspection', () => {
    it('lists registered entities with optional domain filtering', () => {
      const allEntities = service.listEntities()
      expect(allEntities.length).toBeGreaterThanOrEqual(5)

      const lightEntities = service.listEntities({ domain: 'light' })
      expect(lightEntities.length).toBe(1)
      expect(lightEntities[0].entityId).toBe('light.living_room_ceiling')

      const locks = service.listEntities({ domain: 'lock' })
      expect(locks.length).toBe(1)
      expect(locks[0].entityId).toBe('lock.front_door_deadbolt')
    })

    it('retrieves detailed state for a specific entity', () => {
      const thermostat = service.getEntityState('climate.office_thermostat')
      expect(thermostat).not.toBeNull()
      expect(thermostat?.friendlyName).toBe('Executive Office Thermostat')
      expect(thermostat?.state).toBe('heat')
      expect(thermostat?.attributes.current_temperature).toBe(21.5)
      expect(thermostat?.attributes.target_temperature).toBe(22.0)
    })

    it('returns null for unknown entity ID', () => {
      expect(service.getEntityState('sensor.unknown_entity')).toBeNull()
    })
  })

  describe('4. Reversible Environmental Actions (Direct Execution)', () => {
    it('turns on and off living room lighting directly', async () => {
      const offResult = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'light.living_room_ceiling',
        command: 'turn_off'
      })

      expect(offResult.success).toBe(true)
      expect(offResult.newState).toBe('off')

      const onResult = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'light.living_room_ceiling',
        command: 'turn_on'
      })

      expect(onResult.success).toBe(true)
      expect(onResult.newState).toBe('on')
    })

    it('adjusts lighting brightness within bounded values (0-255)', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'light.living_room_ceiling',
        command: 'set_brightness',
        parameters: { brightness: 120 }
      })

      expect(result.success).toBe(true)
      const light = service.getEntityState('light.living_room_ceiling')
      expect(light?.attributes.brightness).toBe(120)
    })

    it('adjusts climate target temperature within safe limits (12-32 C)', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'climate.office_thermostat',
        command: 'set_temperature',
        parameters: { temperature: 23.5 }
      })

      expect(result.success).toBe(true)
      const thermostat = service.getEntityState('climate.office_thermostat')
      expect(thermostat?.attributes.target_temperature).toBe(23.5)
    })

    it('secures/locks deadbolt directly without high-risk confirmation token', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'lock.front_door_deadbolt',
        command: 'lock'
      })

      expect(result.success).toBe(true)
      expect(result.newState).toBe('locked')
    })
  })

  describe('5. Physical Security Actions & 60-Second Human Confirmation', () => {
    it('strictly denies unlocking door deadbolt without confirmation token', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'lock.front_door_deadbolt',
        command: 'unlock'
      })

      expect(result.success).toBe(false)
      expect(result.outcome).toBe('awaiting_confirmation')
      expect(result.error).toBe('CONFIRMATION_REQUIRED')
      expect(result.message).toContain('explicit human confirmation')
    })

    it('strictly denies opening garage door without confirmation token', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'cover.garage_bay_door',
        command: 'open'
      })

      expect(result.success).toBe(false)
      expect(result.outcome).toBe('awaiting_confirmation')
      expect(result.error).toBe('CONFIRMATION_REQUIRED')
    })

    it('strictly denies disarming alarm without confirmation token', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'alarm.perimeter_security',
        command: 'disarm'
      })

      expect(result.success).toBe(false)
      expect(result.outcome).toBe('awaiting_confirmation')
      expect(result.error).toBe('CONFIRMATION_REQUIRED')
    })

    it('issues 60-second TTL security confirmation request and successfully unlocks with token', async () => {
      const confirmation = service.requestSecurityConfirmation({
        hubId: 'hub_home_assistant_local',
        entityId: 'lock.front_door_deadbolt',
        command: 'unlock'
      })

      expect(confirmation.confirmationId).toBeDefined()
      expect(confirmation.token).toBeDefined()
      expect(confirmation.expiresAt).toBe(mockCurrentTime + 60000)
      expect(confirmation.targetState).toBe('unlocked')

      // Execute with valid token
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'lock.front_door_deadbolt',
        command: 'unlock',
        confirmationToken: confirmation.token
      })

      expect(result.success).toBe(true)
      expect(result.newState).toBe('unlocked')
      expect(result.outcome).toBe('completed')

      // Token is single-use: replay attempt must be rejected
      const replayResult = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'lock.front_door_deadbolt',
        command: 'unlock',
        confirmationToken: confirmation.token
      })

      expect(replayResult.success).toBe(false)
      expect(replayResult.error).toBe('INVALID_CONFIRMATION_TOKEN')
    })

    it('rejects confirmation token when 60-second TTL expires', async () => {
      const confirmation = service.requestSecurityConfirmation({
        hubId: 'hub_home_assistant_local',
        entityId: 'cover.garage_bay_door',
        command: 'open'
      })

      // Advance time by 61 seconds
      mockCurrentTime += 61000

      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'cover.garage_bay_door',
        command: 'open',
        confirmationToken: confirmation.token
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('CONFIRMATION_TOKEN_EXPIRED')
      expect(result.message).toContain('Confirmation token expired')
    })
  })

  describe('6. Edge Cases & Resilience', () => {
    it('rejects action on non-existent entity', async () => {
      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'light.non_existent_fixture',
        command: 'turn_on'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('ENTITY_NOT_FOUND')
    })

    it('rejects action when hub is disconnected', async () => {
      await service.disconnectHub('hub_home_assistant_local')

      const result = await service.executeAction({
        hubId: 'hub_home_assistant_local',
        entityId: 'light.living_room_ceiling',
        command: 'turn_on'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('HUB_DISCONNECTED')
    })
  })
})
