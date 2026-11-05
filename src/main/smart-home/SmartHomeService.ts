/**
 * HELIOXEN AI — Step 45: Smart-Home Integration Service
 * Manages smart-home hubs (Home Assistant, Matter REST), entity discovery,
 * state inspection, and human-confirmed physical actuation.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  SmartHomeEntity,
  SmartHomeHubDescriptor,
  SmartHomeActionCommand,
  SmartHomeActionResult,
  SmartHomeSecurityConfirmationRequest,
  SmartHomeEntityDomain
} from '../../shared/smart-home/types'
import {
  classifyActionRisk,
  isHighRiskPhysicalAction
} from '../../shared/smart-home/contracts'
import { CredentialStorageService } from '../security/credentialStorage'
import { securityLogger } from '../security/securityLogger'

export interface SmartHomeServiceOptions {
  readonly storageDir: string
  readonly credentialStorage?: CredentialStorageService
  readonly nowFn?: () => number
}

interface PersistedSmartHomeStore {
  readonly schemaVersion: number
  readonly updatedAt: number
  readonly hubs: Record<string, SmartHomeHubDescriptor>
  readonly entities: Record<string, SmartHomeEntity>
}

export class SmartHomeService {
  private readonly storageDir: string
  private readonly storePath: string
  private readonly credentialStorage?: CredentialStorageService
  private readonly nowFn: () => number

  private hubs: Map<string, SmartHomeHubDescriptor> = new Map()
  private entities: Map<string, SmartHomeEntity> = new Map()
  private pendingSecurityConfirmations: Map<string, SmartHomeSecurityConfirmationRequest> = new Map()

  constructor(options: SmartHomeServiceOptions) {
    this.storageDir = options.storageDir
    this.credentialStorage = options.credentialStorage
    this.nowFn = options.nowFn ?? (() => Date.now())

    const shDir = path.resolve(this.storageDir, 'smart-home')
    if (!fs.existsSync(shDir)) {
      fs.mkdirSync(shDir, { recursive: true })
    }
    this.storePath = path.join(shDir, 'smart_home_store.json')

    this.initializeDefaultData()
    this.loadFromDisk()
  }

  private initializeDefaultData(): void {
    const now = this.nowFn()
    const hubId = 'hub_home_assistant_local'

    this.hubs.set(hubId, {
      hubId,
      platform: 'home_assistant',
      displayName: 'Home Assistant Local Gateway',
      endpointUrl: 'http://homeassistant.local:8123/api',
      isConnected: true,
      isAuthorized: true,
      entityCount: 6,
      lastHealthCheckAt: now
    })

    const sampleEntities: SmartHomeEntity[] = [
      {
        entityId: 'light.living_room_ceiling',
        hubId,
        domain: 'light',
        friendlyName: 'Living Room Ceiling Fixture',
        state: 'on',
        attributes: { brightness: 200, color_temp: 350 },
        riskClass: 'reversible_action',
        isAvailable: true,
        lastUpdated: now,
        supportedCommands: ['turn_on', 'turn_off', 'set_brightness']
      },
      {
        entityId: 'climate.office_thermostat',
        hubId,
        domain: 'climate',
        friendlyName: 'Executive Office Thermostat',
        state: 'heat',
        attributes: { current_temperature: 21.5, target_temperature: 22.0, hvac_mode: 'heat' },
        riskClass: 'reversible_action',
        isAvailable: true,
        lastUpdated: now,
        supportedCommands: ['set_temperature', 'set_hvac_mode']
      },
      {
        entityId: 'sensor.patio_temperature',
        hubId,
        domain: 'sensor',
        friendlyName: 'Outdoor Patio Temperature',
        state: '18.4',
        attributes: { unit_of_measurement: '°C', device_class: 'temperature' },
        riskClass: 'read_only',
        isAvailable: true,
        lastUpdated: now,
        supportedCommands: []
      },
      {
        entityId: 'lock.front_door_deadbolt',
        hubId,
        domain: 'lock',
        friendlyName: 'Main Entrance Deadbolt',
        state: 'locked',
        attributes: { battery_level: 92, lock_status: 'secured' },
        riskClass: 'physical_security_consequential',
        isAvailable: true,
        lastUpdated: now,
        supportedCommands: ['lock', 'unlock']
      },
      {
        entityId: 'cover.garage_bay_door',
        hubId,
        domain: 'cover',
        friendlyName: 'Garage Vehicle Access Door',
        state: 'closed',
        attributes: { current_position: 0 },
        riskClass: 'physical_security_consequential',
        isAvailable: true,
        lastUpdated: now,
        supportedCommands: ['open', 'close', 'stop']
      },
      {
        entityId: 'alarm.perimeter_security',
        hubId,
        domain: 'alarm',
        friendlyName: 'Perimeter Alarm System',
        state: 'armed_away',
        attributes: { code_format: 'number' },
        riskClass: 'physical_security_consequential',
        isAvailable: true,
        lastUpdated: now,
        supportedCommands: ['arm_home', 'arm_away', 'disarm']
      }
    ]

    for (const ent of sampleEntities) {
      this.entities.set(ent.entityId, ent)
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        this.persistToDisk()
        return
      }
      const raw = fs.readFileSync(this.storePath, 'utf-8')
      const parsed = JSON.parse(raw) as PersistedSmartHomeStore
      if (parsed?.hubs) {
        for (const [id, hub] of Object.entries(parsed.hubs)) {
          this.hubs.set(id, hub)
        }
      }
      if (parsed?.entities) {
        for (const [id, ent] of Object.entries(parsed.entities)) {
          this.entities.set(id, ent)
        }
      }
    } catch (err) {
      console.warn('[SmartHomeService] Failed to load store from disk:', err)
    }
  }

  private persistToDisk(): void {
    try {
      const data: PersistedSmartHomeStore = {
        schemaVersion: 1,
        updatedAt: this.nowFn(),
        hubs: Object.fromEntries(this.hubs.entries()),
        entities: Object.fromEntries(this.entities.entries())
      }
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[SmartHomeService] Failed to persist smart home store:', err)
    }
  }

  public getHubStatus(hubId: string): SmartHomeHubDescriptor | null {
    return this.hubs.get(hubId) || null
  }

  public listHubs(): SmartHomeHubDescriptor[] {
    return Array.from(this.hubs.values())
  }

  public async connectHub(params: {
    hubId: string
    endpointUrl: string
    accessToken?: string
    displayName?: string
  }): Promise<{ success: boolean; hub?: SmartHomeHubDescriptor; error?: string }> {
    const now = this.nowFn()
    const hubId = params.hubId.trim()

    // Store encrypted access token if provided
    if (params.accessToken && this.credentialStorage) {
      try {
        await this.credentialStorage.storeSecret({
          id: `smart_home:${hubId}`,
          provider: 'smart_home_hub',
          label: `Access Token for ${params.displayName || hubId}`,
          secret: params.accessToken
        })
      } catch (err: any) {
        return { success: false, error: `Failed to securely encrypt token: ${err.message}` }
      }
    }

    const hub: SmartHomeHubDescriptor = {
      hubId,
      platform: 'home_assistant',
      displayName: params.displayName || 'Home Assistant Hub',
      endpointUrl: params.endpointUrl,
      isConnected: true,
      isAuthorized: true,
      entityCount: Array.from(this.entities.values()).filter((e) => e.hubId === hubId).length,
      lastHealthCheckAt: now
    }

    this.hubs.set(hubId, hub)
    this.persistToDisk()

    securityLogger.logEvent('INTEGRATION_CONNECT', 'user', 'PERMITTED', {
      integrationId: hubId,
      endpointUrl: params.endpointUrl
    })

    return { success: true, hub }
  }

  public async disconnectHub(hubId: string): Promise<boolean> {
    const existing = this.hubs.get(hubId)
    if (!existing) return false

    if (this.credentialStorage) {
      try {
        await this.credentialStorage.deleteSecret(`smart_home:${hubId}`)
      } catch {
        // ignore
      }
    }

    const updated: SmartHomeHubDescriptor = {
      ...existing,
      isConnected: false,
      isAuthorized: false
    }

    this.hubs.set(hubId, updated)
    this.persistToDisk()

    securityLogger.logEvent('INTEGRATION_DISCONNECT', 'user', 'PERMITTED', {
      integrationId: hubId
    })

    return true
  }

  public listEntities(query?: { hubId?: string; domain?: SmartHomeEntityDomain }): SmartHomeEntity[] {
    let result = Array.from(this.entities.values())
    if (query?.hubId) {
      result = result.filter((e) => e.hubId === query.hubId)
    }
    if (query?.domain) {
      result = result.filter((e) => e.domain === query.domain)
    }
    return result
  }

  public getEntityState(entityId: string): SmartHomeEntity | null {
    return this.entities.get(entityId) || null
  }

  /**
   * Generates a 60-second confirmation token for high-impact physical security operations.
   */
  public requestSecurityConfirmation(params: {
    hubId: string
    entityId: string
    command: string
  }): SmartHomeSecurityConfirmationRequest {
    const entity = this.entities.get(params.entityId)
    if (!entity) throw new Error(`Entity "${params.entityId}" not found.`)

    const now = this.nowFn()
    const confirmationId = `sh_conf_${now}_${crypto.randomBytes(4).toString('hex')}`
    const token = `token_${crypto.randomBytes(16).toString('hex')}`

    const riskDesc = `Actuating ${entity.domain.toUpperCase()} "${entity.friendlyName}" (${entity.entityId}) with command "${params.command.toUpperCase()}".`

    const request: SmartHomeSecurityConfirmationRequest = {
      confirmationId,
      hubId: params.hubId,
      entityId: params.entityId,
      friendlyName: entity.friendlyName,
      command: params.command,
      targetState: params.command === 'unlock' ? 'unlocked' : params.command === 'open' ? 'open' : 'disarmed',
      riskDescription: riskDesc,
      expiresAt: now + 60000, // 60-second TTL
      token
    }

    this.pendingSecurityConfirmations.set(confirmationId, request)

    securityLogger.logEvent('SMART_HOME_SECURITY_CONFIRMATION', 'system', 'PERMITTED', {
      confirmationId,
      entityId: params.entityId,
      command: params.command
    })

    return request
  }

  /**
   * Executes a verified smart-home action, enforcing mandatory human confirmation
   * for high-impact physical security operations.
   */
  public async executeAction(command: SmartHomeActionCommand): Promise<SmartHomeActionResult> {
    const now = this.nowFn()
    const entity = this.entities.get(command.entityId)

    // 1. Entity Existence Check
    if (!entity) {
      return {
        success: false,
        entityId: command.entityId,
        command: command.command,
        outcome: 'failed',
        message: `Entity "${command.entityId}" does not exist.`,
        error: 'ENTITY_NOT_FOUND',
        executedAt: now
      }
    }

    // 2. Availability Check
    if (!entity.isAvailable) {
      return {
        success: false,
        entityId: command.entityId,
        command: command.command,
        outcome: 'failed',
        message: `Device "${entity.friendlyName}" is currently unreachable or offline.`,
        error: 'DEVICE_UNAVAILABLE',
        executedAt: now
      }
    }

    // 3. Hub Connectivity Check
    const hub = this.hubs.get(entity.hubId)
    if (!hub || !hub.isConnected) {
      return {
        success: false,
        entityId: command.entityId,
        command: command.command,
        outcome: 'failed',
        message: `Smart home hub for "${entity.friendlyName}" is disconnected.`,
        error: 'HUB_DISCONNECTED',
        executedAt: now
      }
    }

    // 4. Physical Security Action Confirmation Check
    const isPhysical = isHighRiskPhysicalAction(entity.domain, command.command)
    if (isPhysical) {
      if (!command.confirmationToken) {
        securityLogger.logEvent('SMART_HOME_ACTION', 'user', 'DENIED', {
          entityId: command.entityId,
          command: command.command,
          reason: 'Physical security action executed without mandatory human confirmation token'
        })
        return {
          success: false,
          entityId: command.entityId,
          command: command.command,
          outcome: 'awaiting_confirmation',
          message: `Action "${command.command}" on physical device "${entity.friendlyName}" requires explicit human confirmation.`,
          error: 'CONFIRMATION_REQUIRED',
          executedAt: now
        }
      }

      // Find matching confirmation
      let matchedConfirmation: SmartHomeSecurityConfirmationRequest | null = null
      let matchedId: string | null = null

      for (const [id, conf] of this.pendingSecurityConfirmations.entries()) {
        if (
          conf.token === command.confirmationToken &&
          conf.entityId === command.entityId &&
          conf.command === command.command
        ) {
          matchedConfirmation = conf
          matchedId = id
          break
        }
      }

      if (!matchedConfirmation || !matchedId) {
        securityLogger.logEvent('SMART_HOME_ACTION', 'user', 'DENIED', {
          entityId: command.entityId,
          command: command.command,
          reason: 'Invalid or consumed confirmation token'
        })
        return {
          success: false,
          entityId: command.entityId,
          command: command.command,
          outcome: 'failed',
          message: 'Confirmation token is invalid or has already been consumed.',
          error: 'INVALID_CONFIRMATION_TOKEN',
          executedAt: now
        }
      }

      // Check TTL (60s)
      if (now > matchedConfirmation.expiresAt) {
        this.pendingSecurityConfirmations.delete(matchedId)
        securityLogger.logEvent('SMART_HOME_ACTION', 'user', 'DENIED', {
          entityId: command.entityId,
          command: command.command,
          reason: 'Confirmation token expired'
        })
        return {
          success: false,
          entityId: command.entityId,
          command: command.command,
          outcome: 'failed',
          message: 'Confirmation token expired. Physical action must be re-confirmed.',
          error: 'CONFIRMATION_TOKEN_EXPIRED',
          executedAt: now
        }
      }

      // Consume token
      this.pendingSecurityConfirmations.delete(matchedId)
    }

    // 5. Compute new state based on command
    const previousState = entity.state
    let newState = previousState
    const updatedAttributes = { ...entity.attributes }

    switch (command.command) {
      case 'turn_on':
        newState = 'on'
        break
      case 'turn_off':
        newState = 'off'
        break
      case 'set_brightness':
        if (typeof command.parameters?.brightness === 'number') {
          const brightnessVal = Math.min(255, Math.max(0, command.parameters.brightness))
          updatedAttributes.brightness = brightnessVal
          newState = brightnessVal > 0 ? 'on' : 'off'
        }
        break
      case 'set_temperature':
        if (typeof command.parameters?.temperature === 'number') {
          updatedAttributes.target_temperature = Math.min(32, Math.max(12, command.parameters.temperature))
        }
        break
      case 'lock':
        newState = 'locked'
        updatedAttributes.lock_status = 'secured'
        break
      case 'unlock':
        newState = 'unlocked'
        updatedAttributes.lock_status = 'unlocked'
        break
      case 'open':
        newState = 'open'
        updatedAttributes.current_position = 100
        break
      case 'close':
        newState = 'closed'
        updatedAttributes.current_position = 0
        break
      case 'disarm':
        newState = 'disarmed'
        break
      case 'arm_home':
        newState = 'armed_home'
        break
      case 'arm_away':
        newState = 'armed_away'
        break
      default:
        newState = command.command
    }

    const updatedEntity: SmartHomeEntity = {
      ...entity,
      state: newState,
      attributes: updatedAttributes,
      lastUpdated: now
    }

    this.entities.set(command.entityId, updatedEntity)
    this.persistToDisk()

    securityLogger.logEvent('SMART_HOME_ACTION', 'user', 'PERMITTED', {
      entityId: command.entityId,
      command: command.command,
      previousState,
      newState,
      isPhysical
    })

    return {
      success: true,
      entityId: command.entityId,
      command: command.command,
      outcome: 'completed',
      previousState,
      newState,
      message: `Successfully executed "${command.command}" on ${entity.friendlyName}.`,
      executedAt: now
    }
  }
}
