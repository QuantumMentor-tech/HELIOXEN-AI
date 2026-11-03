/**
 * HELIOXEN AI — Step 31: Browser Navigation Policy Tests
 */

import { describe, it, expect } from 'vitest'
import { NavigationPolicy } from '../../src/main/browser/NavigationPolicy'

describe('Step 31: Browser Navigation Policy', () => {
  it('permits valid HTTPS and HTTP URLs', () => {
    const httpsUrl = 'https://www.google.com/search?q=helioxen'
    const httpUrl = 'http://example.com/test?query=param#hash'

    expect(NavigationPolicy.validateUrl(httpsUrl)).toBe(httpsUrl)
    expect(NavigationPolicy.validateUrl(httpUrl)).toBe(httpUrl)
    expect(NavigationPolicy.isUrlAllowed(httpsUrl)).toBe(true)
    expect(NavigationPolicy.isUrlAllowed(httpUrl)).toBe(true)
  })

  it('rejects empty, blank, or malformed URLs', () => {
    expect(() => NavigationPolicy.validateUrl('')).toThrow(/non-empty string/)
    expect(() => NavigationPolicy.validateUrl('   ')).toThrow(/cannot be empty or blank/)
    expect(() => NavigationPolicy.validateUrl('not-a-valid-url')).toThrow(/Malformed URL/)
    expect(NavigationPolicy.isUrlAllowed('bad-url')).toBe(false)
  })

  it('rejects URLs exceeding 2048 characters', () => {
    const oversizedUrl = 'https://example.com/' + 'a'.repeat(2040)
    expect(() => NavigationPolicy.validateUrl(oversizedUrl)).toThrow(/exceeds maximum length/)
  })

  it('strictly rejects embedded user credentials in URLs', () => {
    const credUrl = 'https://admin:secretPassword123@example.com/vault'
    expect(() => NavigationPolicy.validateUrl(credUrl)).toThrow(/Embedded credentials in URLs.*are prohibited/)
    expect(NavigationPolicy.isUrlAllowed(credUrl)).toBe(false)
  })

  it('strictly rejects dangerous and non-web protocol schemes', () => {
    // file: protocol
    expect(() => NavigationPolicy.validateUrl('file:///C:/Windows/System32/cmd.exe')).toThrow(
      /Protocol 'file:' is prohibited/
    )

    // javascript: protocol
    expect(() => NavigationPolicy.validateUrl('javascript:alert(1)')).toThrow(
      /Protocol 'javascript:' is prohibited/
    )

    // data: protocol
    expect(() => NavigationPolicy.validateUrl('data:text/html,<h1>Hacked</h1>')).toThrow(
      /Protocol 'data:' is prohibited/
    )

    // vbscript: protocol
    expect(() => NavigationPolicy.validateUrl('vbscript:msgbox(1)')).toThrow(
      /Protocol 'vbscript:' is prohibited/
    )

    // chrome: protocol
    expect(() => NavigationPolicy.validateUrl('chrome://settings')).toThrow(
      /Protocol 'chrome:' is prohibited/
    )

    // custom/shell protocol
    expect(() => NavigationPolicy.validateUrl('ms-settings:privacy')).toThrow(
      /Protocol 'ms-settings:' is prohibited/
    )
  })
})

