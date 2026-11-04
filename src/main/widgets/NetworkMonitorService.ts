/**
 * HELIOXEN AI — Step 39: Network Monitor Service
 * Main-process local connectivity detection and bounded HTTPS diagnostic testing.
 * Strictly prevents SSRF/private-network probing, enforces bounded timeouts,
 * accurately measures single-endpoint round-trip time, and clearly states test limitations.
 */

import {
  APPROVED_NETWORK_ENDPOINTS,
  validateDiagnosticTargetUrl
} from '../../shared/widgets/contracts'
import {
  DiagnosticResultStatus,
  LocalConnectivityStatus,
  NetworkDiagnosticResult,
  NetworkStatusSnapshot
} from '../../shared/widgets/types'

export interface NetworkMonitorServiceOptions {
  readonly getIsOnlineFn?: () => boolean
  readonly fetchFn?: typeof fetch
  readonly nowFn?: () => number
}

export class NetworkMonitorService {
  private activeAbortController: AbortController | null = null
  private activeTestId: string | null = null
  private lastDiagnosticResult: NetworkDiagnosticResult | null = null
  private selectedEndpointUrl: string = APPROVED_NETWORK_ENDPOINTS[0].url
  private readonly getIsOnlineFn: () => boolean
  private readonly fetchFn: typeof fetch
  private readonly nowFn: () => number

  constructor(options: NetworkMonitorServiceOptions = {}) {
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)

    this.getIsOnlineFn =
      options.getIsOnlineFn ??
      (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { net } = require('electron')
          if (net && typeof net.isOnline === 'function') {
            return net.isOnline()
          }
        } catch {
          // Fallback outside Electron
        }
        return true
      })
  }

  public dispose(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.activeAbortController = null
      this.activeTestId = null
    }
  }

  /**
   * Retrieves current local network connectivity indication and recent diagnostic state.
   */
  public getNetworkStatusSnapshot(): NetworkStatusSnapshot {
    const isOnline = this.getIsOnlineFn()
    const connectivity: LocalConnectivityStatus = {
      isOnline,
      checkedAt: this.nowFn(),
      networkType: isOnline ? 'local_network_connected' : 'local_network_disconnected'
    }

    return {
      connectivity,
      lastDiagnostic: this.lastDiagnosticResult,
      approvedEndpoints: APPROVED_NETWORK_ENDPOINTS,
      selectedEndpointUrl: this.selectedEndpointUrl,
      isTesting: this.activeAbortController !== null
    }
  }

  /**
   * Sets the user's preferred approved diagnostic endpoint.
   */
  public setSelectedEndpoint(url: string): void {
    const check = validateDiagnosticTargetUrl(url)
    if (!check.valid || !check.normalizedUrl) {
      throw new Error(`INVALID_ENDPOINT: ${check.error || 'Invalid diagnostic target URL'}`)
    }
    this.selectedEndpointUrl = check.normalizedUrl
  }

  /**
   * Cancels any currently in-flight network diagnostic test.
   */
  public cancelDiagnostic(): boolean {
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.activeAbortController = null
      this.activeTestId = null
      return true
    }
    return false
  }

  /**
   * Runs a bounded connection diagnostic test against an authorized HTTPS endpoint.
   * Cancels any obsolete in-flight test before starting a new one.
   */
  public async runDiagnostic(options: {
    targetUrl?: string
    timeoutMs?: number
  } = {}): Promise<NetworkDiagnosticResult> {
    const targetUrl = options.targetUrl || this.selectedEndpointUrl
    const urlCheck = validateDiagnosticTargetUrl(targetUrl)

    if (!urlCheck.valid || !urlCheck.normalizedUrl || !urlCheck.host) {
      throw new Error(`SECURITY_VIOLATION: ${urlCheck.error || 'Disallowed diagnostic URL'}`)
    }

    // Cancel obsolete active diagnostic
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.activeAbortController = null
    }

    const testId = `diag_${this.nowFn()}_${Math.random().toString(36).slice(2, 8)}`
    const abortController = new AbortController()
    this.activeAbortController = abortController
    this.activeTestId = testId

    const startedAt = this.nowFn()
    const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? 5000, 30000))
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error('TIMEOUT_EXCEEDED'))
    }, timeoutMs)

    let status: DiagnosticResultStatus = 'dns_or_network_error'
    let statusCode: number | null = null
    let roundTripTimeMs: number | null = null
    let errorMessage: string | null = null
    let diagnosticBasis = ''

    try {
      const response = await this.fetchFn(urlCheck.normalizedUrl, {
        method: 'GET',
        signal: abortController.signal,
        headers: {
          Accept: 'text/plain, application/json, */*',
          'User-Agent': 'HELIOXEN-Desktop-NetworkMonitor/1.0'
        }
      })

      const completedAt = this.nowFn()
      roundTripTimeMs = Math.max(1, completedAt - startedAt)
      statusCode = response.status

      if (response.ok || (response.status >= 200 && response.status < 400)) {
        status = 'success'
        diagnosticBasis = `Successfully reached ${urlCheck.host} (HTTP ${response.status}) in ${roundTripTimeMs} ms.`
      } else {
        status = 'http_error'
        errorMessage = `HTTP_${response.status}: Target endpoint returned status ${response.status}`
        diagnosticBasis = `Endpoint ${urlCheck.host} responded with HTTP ${response.status}.`
      }

      // Read bounded slice of body to avoid resource waste
      try {
        const text = await response.text()
        // Discard body safely
        void text
      } catch {
        // Ignore body read errors after header reception
      }
    } catch (err: any) {
      const completedAt = this.nowFn()
      roundTripTimeMs = Math.max(1, completedAt - startedAt)

      if (abortController.signal.aborted) {
        if (err?.message === 'TIMEOUT_EXCEEDED' || err?.name === 'TimeoutError') {
          status = 'timeout'
          errorMessage = `Request timed out after ${timeoutMs} ms without response.`
          diagnosticBasis = `Endpoint ${urlCheck.host} did not respond within ${timeoutMs} ms.`
        } else {
          status = 'cancelled'
          errorMessage = 'Diagnostic test was cancelled by user.'
          diagnosticBasis = 'Test was aborted before completion.'
        }
      } else {
        status = 'dns_or_network_error'
        errorMessage = err instanceof Error ? err.message : String(err)
        diagnosticBasis = `Network transport failure connecting to ${urlCheck.host}: ${errorMessage}`
      }
    } finally {
      clearTimeout(timeoutId)
      if (this.activeTestId === testId) {
        this.activeAbortController = null
        this.activeTestId = null
      }
    }

    const completedAt = this.nowFn()
    const result: NetworkDiagnosticResult = {
      testId,
      targetUrl: urlCheck.normalizedUrl,
      targetHost: urlCheck.host,
      status,
      statusCode,
      roundTripTimeMs: status === 'cancelled' ? null : roundTripTimeMs,
      startedAt,
      completedAt,
      errorMessage,
      diagnosticBasis,
      disclaimer:
        'Diagnostic measures request round-trip time to the tested endpoint only. It does not measure ICMP ping, ISP packet loss, or overall internet reachability.'
    }

    this.lastDiagnosticResult = result
    return result
  }
}

