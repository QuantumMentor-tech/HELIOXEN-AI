import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AndroidDeviceService } from '../../src/main/devices/AndroidDeviceService'
import { isValidDeviceId } from '../../src/shared/devices/contracts'
import { AndroidActionType } from '../../src/shared/devices/types'

describe('Android Device Integration Service & Contracts (Step 45)', () => {
  let tempDir: string
  let service: AndroidDeviceService
  let mockCurrentTime: number

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-devices-test-'))
    mockCurrentTime = 1700000000000

    service = new AndroidDeviceService({
      storageDir: tempDir,
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

  describe('1. Device ID Validation & Command Injection Prevention', () => {
    it('accepts valid device IDs matching the safe character set', () => {
      expect(isValidDeviceId('pixel_8_pro_usb')).toBe(true)
      expect(isValidDeviceId('galaxy_s24_wifi')).toBe(true)
      expect(isValidDeviceId('emulator-5554')).toBe(true)
      expect(isValidDeviceId('192.168.1.100:5555')).toBe(true)
      expect(isValidDeviceId('android_device_01')).toBe(true)
    })

    it('rejects command injection patterns and invalid characters in device IDs', () => {
      expect(isValidDeviceId('pixel; rm -rf /')).toBe(false)
      expect(isValidDeviceId('dev && calc.exe')).toBe(false)
      expect(isValidDeviceId('dev | bash')).toBe(false)
      expect(isValidDeviceId('dev`whoami`')).toBe(false)
      expect(isValidDeviceId('dev$(id)')).toBe(false)
      expect(isValidDeviceId('')).toBe(false)
      expect(isValidDeviceId(' ')).toBe(false)
      expect(isValidDeviceId('a'.repeat(129))).toBe(false) // exceeds 128 chars
    })
  })

  describe('2. Device Discovery and Status Inspection', () => {
    it('lists initialized default devices', async () => {
      const devices = await service.listDevices()
      expect(devices.length).toBeGreaterThanOrEqual(2)
      
      const pixel = devices.find(d => d.id === 'pixel_8_pro_usb')
      expect(pixel).toBeDefined()
      expect(pixel?.model).toBe('Pixel 8 Pro')
      expect(pixel?.manufacturer).toBe('Google')
      expect(pixel?.isAuthorized).toBe(true)
      expect(pixel?.status).toBe('connected')
    })

    it('retrieves detailed device status for authorized device', async () => {
      const status = await service.getDeviceStatus('pixel_8_pro_usb')
      expect(status).not.toBeNull()
      expect(status?.id).toBe('pixel_8_pro_usb')
      expect(status?.status).toBe('connected')
      expect(status?.batteryPercent).toBeGreaterThanOrEqual(0)
      expect(status?.androidVersion).toBeDefined()
      expect(status?.sdkLevel).toBeGreaterThan(0)
      expect(status?.supportedCapabilities).toContain('ping')
      expect(status?.supportedCapabilities).toContain('get_battery_status')
    })

    it('rejects status query for invalid device ID format', async () => {
      const status = await service.getDeviceStatus('pixel; malicious')
      expect(status).toBeNull()
    })

    it('returns null for non-existent device ID', async () => {
      const status = await service.getDeviceStatus('non_existent_device_id')
      expect(status).toBeNull()
    })
  })

  describe('3. Secure Pairing Workflow', () => {
    it('successfully pairs a device via USB with explicit user authorization', async () => {
      const result = await service.pairDevice({
        deviceId: 'galaxy_s24_wifi',
        pairingMethod: 'usb_authorization'
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('connected')

      const updated = service.getDeviceStatus('galaxy_s24_wifi')
      expect(updated?.isAuthorized).toBe(true)
      expect(updated?.status).toBe('connected')
    })

    it('successfully pairs a device via wireless with valid 6-digit pairing code', async () => {
      const result = await service.pairDevice({
        deviceId: 'galaxy_s24_wifi',
        pairingMethod: 'wireless_pair_code',
        pairingCode: '123456'
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('connected')
    })

    it('rejects wireless pairing when pairing code is missing or not 6 digits', async () => {
      const result = await service.pairDevice({
        deviceId: 'galaxy_s24_wifi',
        pairingMethod: 'wireless_pair_code',
        pairingCode: '123'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_PAIRING_CODE')
    })

    it('rejects pairing when device ID contains forbidden characters', async () => {
      const result = await service.pairDevice({
        deviceId: 'device; reboot',
        pairingMethod: 'usb_authorization'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_DEVICE_ID')
    })

    it('revokes authorization and sets status to disconnected on disconnectDevice', async () => {
      const disconnected = service.disconnectDevice('pixel_8_pro_usb')
      expect(disconnected).toBe(true)

      const status = await service.getDeviceStatus('pixel_8_pro_usb')
      expect(status?.isAuthorized).toBe(false)
      expect(status?.status).toBe('disconnected')
    })
  })

  describe('4. Allowlisted Action Execution', () => {
    it('executes "ping" action and returns latency telemetry', async () => {
      const result = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'ping'
      })

      expect(result.success).toBe(true)
      expect(result.action).toBe('ping')
      expect(result.data).toHaveProperty('reachable', true)
      expect(result.data).toHaveProperty('latencyMs')
    })

    it('executes "get_battery_status" action without accessing private data', async () => {
      const result = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'get_battery_status'
      })

      expect(result.success).toBe(true)
      expect(result.action).toBe('get_battery_status')
      expect(typeof result.data?.batteryPercent).toBe('number')
      expect(typeof result.data?.isCharging).toBe('boolean')
    })

    it('executes "get_device_properties" action with bounded system metadata', async () => {
      const result = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'get_device_properties'
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('model', 'Pixel 8 Pro')
      expect(result.data).toHaveProperty('manufacturer', 'Google')
      expect(result.data).toHaveProperty('sdkLevel', 35)
    })

    it('executes "get_screen_state" and "send_test_intent" actions', async () => {
      const screenRes = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'get_screen_state'
      })
      expect(screenRes.success).toBe(true)
      expect(screenRes.data).toHaveProperty('isScreenOn')

      const intentRes = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'send_test_intent',
        parameters: { message: 'Test Notification' }
      })
      expect(intentRes.success).toBe(true)
      expect(intentRes.data).toHaveProperty('dispatched', true)
    })

    it('rejects execution on unauthorized or disconnected devices', async () => {
      service.disconnectDevice('pixel_8_pro_usb')

      const result = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'ping'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('UNAUTHORIZED_DEVICE')
    })

    it('strictly rejects non-allowlisted arbitrary actions', async () => {
      const result = await service.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'arbitrary_shell_command' as unknown as AndroidActionType
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('UNSUPPORTED_ACTION')
    })
  })

  describe('5. Discrete ADB Command Vector Execution (No Shell Injection)', () => {
    it('invokes custom ADB executor with isolated arguments array and bounded timeout', async () => {
      const mockAdb = vi.fn().mockResolvedValue({
        stdout: 'ro.build.version.release=14\n',
        stderr: '',
        exitCode: 0
      })

      const customService = new AndroidDeviceService({
        storageDir: tempDir,
        nowFn: () => mockCurrentTime,
        adbExecutor: mockAdb
      })

      const result = await customService.executeAction({
        deviceId: 'pixel_8_pro_usb',
        action: 'ping'
      })

      expect(result.success).toBe(true)
      expect(mockAdb).toHaveBeenCalled()
      // Ensure first argument is target device switch
      const args = mockAdb.mock.calls[0][0] as string[]
      expect(args[0]).toBe('-s')
      expect(args[1]).toBe('FA4B100987') // Serial number passed as isolated token
    })
  })
})
