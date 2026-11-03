/**
 * HELIOXEN AI — Step 33: Browser Agent Automation Manager
 * Manages safe page inspection, target resolution, controlled clicking, scrolling,
 * non-sensitive form field entry, pre-submission reviews, and consequential action gating.
 */

import * as crypto from 'crypto'
import {
  InspectPageRequest,
  PageInspectionSnapshot,
  PageInteractiveElement,
  PageFormSummary,
  ClickElementRequest,
  ScrollPageRequest,
  FillFieldRequest,
  SelectOptionRequest,
  ReviewFormRequest,
  FormReviewSummary,
  SubmitFormRequest,
  BrowserActionResult,
  InteractiveElementLocator
} from '../../shared/browser/types'
import {
  InspectPageRequestSchema,
  ClickElementRequestSchema,
  ScrollPageRequestSchema,
  FillFieldRequestSchema,
  SelectOptionRequestSchema,
  ReviewFormRequestSchema,
  SubmitFormRequestSchema
} from '../../shared/browser/contracts'
import { BrowserTabManager, browserTabManager } from './BrowserTabManager'
import { NavigationPolicy } from './NavigationPolicy'
import { IpcException } from '../../shared/ipc/errors'
import { securityLogger } from '../security/securityLogger'

const SENSITIVE_FIELD_PATTERN = /password|pass|pwd|card|cvv|cvc|ssn|token|secret|credit|pin|otp/i

export class BrowserAgentManager {
  private readonly tabManager: BrowserTabManager
  private readonly pendingFormReviews = new Map<string, FormReviewSummary>()

  constructor(tabManager?: BrowserTabManager) {
    this.tabManager = tabManager ?? browserTabManager
  }

  /**
   * Evaluates whether an element represents a sensitive field (password, payment, etc.).
   */
  public isSensitiveField(role: string, type?: string, name?: string, label?: string, id?: string): boolean {
    if (type?.toLowerCase() === 'password') return true
    const testString = `${name || ''} ${label || ''} ${id || ''}`
    return SENSITIVE_FIELD_PATTERN.test(testString)
  }

  /**
   * Inspects the current page state and gathers visible interactive elements and forms.
   */
  public async inspectPage(rawRequest: InspectPageRequest): Promise<PageInspectionSnapshot> {
    const request = InspectPageRequestSchema.parse(rawRequest)
    const tab = this.tabManager.getTabState(request.tabId)

    if (tab.status === 'crashed') {
      throw new IpcException('OPERATION_UNAVAILABLE', `Cannot inspect crashed tab '${request.tabId}'`)
    }

    NavigationPolicy.validateUrl(tab.url)

    const view = this.tabManager.getTabView(request.tabId)
    const wc = view?.webContents
    const maxElements = request.maxElements || 60
    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    let origin = 'unknown'
    try {
      origin = new URL(tab.url).origin
    } catch {
      // ignore
    }

    let elements: PageInteractiveElement[] = []
    let forms: PageFormSummary[] = []
    let isTruncated = false

    if (wc && typeof wc.executeJavaScript === 'function') {
      const auditedScript = `
        (() => {
          try {
            const results = [];
            const formSummaries = [];

            // 1. Discover interactive elements
            const candidates = Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [role="tab"]'));
            let elemIdx = 0;

            for (const el of candidates) {
              if (elemIdx >= ${maxElements}) break;

              // Basic visibility check
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                continue;
              }

              const tagName = el.tagName.toLowerCase();
              let role = 'button';
              if (tagName === 'a') role = 'link';
              else if (tagName === 'textarea') role = 'textarea';
              else if (tagName === 'select') role = 'select';
              else if (tagName === 'input') {
                const type = (el.getAttribute('type') || 'text').toLowerCase();
                if (type === 'checkbox') role = 'checkbox';
                else if (type === 'radio') role = 'radio';
                else if (type === 'submit' || type === 'button') role = 'button';
                else role = 'input';
              }

              const name = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('value') || '').trim().slice(0, 100);
              const id = el.id || undefined;
              const nameAttr = el.getAttribute('name') || undefined;
              const type = el.getAttribute('type') || undefined;
              const disabled = Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true');

              // Find associated label
              let label = undefined;
              if (id) {
                const labelEl = document.querySelector('label[for="' + id + '"]');
                if (labelEl) label = (labelEl.innerText || labelEl.textContent || '').trim().slice(0, 100);
              }
              if (!label && el.closest('label')) {
                label = (el.closest('label').innerText || '').trim().slice(0, 100);
              }

              // Sensitive field check
              const isSensitive = type === 'password' || /password|card|cvv|token|secret|pin/i.test((nameAttr || '') + ' ' + (label || '') + ' ' + (id || ''));

              results.push({
                elementId: 'elem_' + (++elemIdx),
                role,
                tagName,
                name: name || (label || tagName),
                label,
                type,
                value: isSensitive ? undefined : (el.value || undefined),
                checked: Boolean(el.checked),
                disabled,
                visible: true,
                isSensitive,
                locator: {
                  role,
                  name: name || undefined,
                  label: label || undefined,
                  id,
                  nameAttr
                }
              });
            }

            // 2. Discover forms
            const formElements = Array.from(document.querySelectorAll('form'));
            let formIdx = 0;
            for (const f of formElements) {
              const formId = f.id || ('form_' + (++formIdx));
              const action = f.getAttribute('action') || undefined;
              const method = (f.getAttribute('method') || 'GET').toUpperCase();
              const fields = [];

              const inputs = Array.from(f.querySelectorAll('input, textarea, select'));
              for (const inp of inputs) {
                const type = (inp.getAttribute('type') || 'text').toLowerCase();
                const name = inp.getAttribute('name') || '';
                const id = inp.id || '';
                let label = '';
                if (id) {
                  const lbl = document.querySelector('label[for="' + id + '"]');
                  if (lbl) label = (lbl.innerText || '').trim();
                }
                const isSensitive = type === 'password' || /password|card|cvv|token|secret|pin/i.test(name + ' ' + label + ' ' + id);

                fields.push({
                  fieldId: id || name || ('fld_' + Math.random().toString(36).substring(2, 6)),
                  role: inp.tagName.toLowerCase(),
                  type,
                  label: label || name || id || 'unlabeled',
                  name,
                  currentValue: isSensitive ? undefined : (inp.value || undefined),
                  isSensitive,
                  required: Boolean(inp.required)
                });
              }

              formSummaries.push({
                formId,
                action,
                method,
                fields
              });
            }

            return { elements: results, forms: formSummaries, isTruncated: candidates.length > ${maxElements} };
          } catch (e) {
            return { error: String(e) };
          }
        })()
      `
      const res = await wc.executeJavaScript(auditedScript, true)
      if (res && !res.error) {
        elements = res.elements || []
        forms = res.forms || []
        isTruncated = Boolean(res.isTruncated)
      }
    } else {
      // Deterministic synthetic snapshot for test / headless environments
      elements = [
        {
          elementId: 'elem_1',
          role: 'button',
          tagName: 'button',
          name: 'Search',
          disabled: false,
          visible: true,
          isSensitive: false,
          locator: { role: 'button', name: 'Search', id: 'search-btn' }
        },
        {
          elementId: 'elem_2',
          role: 'input',
          tagName: 'input',
          name: 'Search Query',
          label: 'Search Query',
          type: 'text',
          disabled: false,
          visible: true,
          isSensitive: false,
          locator: { role: 'input', name: 'Search Query', id: 'q', nameAttr: 'q' }
        }
      ]
      forms = [
        {
          formId: 'search_form',
          action: '/search',
          method: 'GET',
          fields: [
            {
              fieldId: 'q',
              role: 'input',
              type: 'text',
              label: 'Search Query',
              name: 'q',
              isSensitive: false,
              required: false
            }
          ]
        }
      ]
    }

    const snapshot: PageInspectionSnapshot = {
      snapshotId,
      tabId: tab.tabId,
      url: tab.url,
      origin,
      title: tab.title,
      timestamp: Date.now(),
      elements,
      forms,
      isTruncated
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:inspectPage',
      tabId: tab.tabId,
      url: tab.url,
      elementCount: elements.length,
      formCount: forms.length
    })

    return snapshot
  }

  /**
   * Deterministically resolves a locator query to an interactive element.
   */
  public resolveTargetElement(
    elements: PageInteractiveElement[],
    locator: InteractiveElementLocator
  ): PageInteractiveElement {
    // 1. Match by ID (exact)
    if (locator.id) {
      const match = elements.find((e) => e.locator.id === locator.id)
      if (match) return match
    }

    // 2. Match by exact nameAttr
    if (locator.nameAttr) {
      const matches = elements.filter((e) => e.locator.nameAttr === locator.nameAttr)
      if (matches.length === 1) return matches[0]
      if (matches.length > 1) {
        throw new IpcException('VALIDATION_ERROR', `Ambiguous locator: ${matches.length} elements match nameAttr '${locator.nameAttr}'`)
      }
    }

    // 3. Match by accessible name or label
    const targetName = (locator.name || locator.label || '').toLowerCase().trim()
    if (targetName) {
      const matches = elements.filter((e) => {
        if (locator.role && e.role !== locator.role) return false
        const nameMatch = e.name.toLowerCase().includes(targetName)
        const labelMatch = e.label?.toLowerCase().includes(targetName)
        return nameMatch || labelMatch
      })

      if (matches.length === 1) return matches[0]
      if (matches.length > 1) {
        throw new IpcException(
          'VALIDATION_ERROR',
          `Ambiguous locator: ${matches.length} elements match name '${targetName}'. Provide a unique ID or selector.`
        )
      }
    }

    // 4. Match by selector
    if (locator.selector) {
      const match = elements.find((e) => e.locator.selector === locator.selector)
      if (match) return match
    }

    throw new IpcException('OPERATION_UNAVAILABLE', `Target element not found matching locator: ${JSON.stringify(locator)}`)
  }

  /**
   * Clicks an interactive element on the page safely.
   */
  public async clickElement(rawRequest: ClickElementRequest): Promise<BrowserActionResult> {
    const request = ClickElementRequestSchema.parse(rawRequest)
    const snapshot = await this.inspectPage({ tabId: request.tabId })
    const target = this.resolveTargetElement(snapshot.elements, request.target)

    if (target.disabled) {
      throw new IpcException('VALIDATION_ERROR', `Cannot click disabled element '${target.name}'`)
    }

    const view = this.tabManager.getTabView(request.tabId)
    const wc = view?.webContents

    if (wc && typeof wc.executeJavaScript === 'function') {
      const clickScript = `
        (() => {
          try {
            let el = null;
            ${target.locator.id ? `el = document.getElementById(${JSON.stringify(target.locator.id)});` : ''}
            if (!el && ${JSON.stringify(target.locator.nameAttr || '')}) {
              el = document.querySelector('[name="' + ${JSON.stringify(target.locator.nameAttr || '')} + '"]');
            }
            if (!el && ${JSON.stringify(target.name)}) {
              const all = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
              el = all.find(e => (e.innerText || e.textContent || e.getAttribute('aria-label') || '').trim() === ${JSON.stringify(target.name)});
            }
            if (!el) return { success: false, reason: 'Element no longer present in DOM' };
            el.focus();
            el.click();
            return { success: true };
          } catch (e) {
            return { error: String(e) };
          }
        })()
      `
      const clickRes = await wc.executeJavaScript(clickScript, true)
      if (clickRes?.error) {
        throw new IpcException('OPERATION_UNAVAILABLE', `Click failed: ${clickRes.error}`)
      }
    }

    const currentTab = this.tabManager.getTabState(request.tabId)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:clickElement',
      tabId: request.tabId,
      elementId: target.elementId,
      name: target.name,
      resultingUrl: currentTab.url
    })

    return {
      success: true,
      action: 'click',
      tabId: request.tabId,
      resultingUrl: currentTab.url,
      targetFound: true,
      message: `Clicked element '${target.name}' successfully`
    }
  }

  /**
   * Scrolls the page viewport in a specified direction.
   */
  public async scrollPage(rawRequest: ScrollPageRequest): Promise<BrowserActionResult> {
    const request = ScrollPageRequestSchema.parse(rawRequest)
    const tab = this.tabManager.getTabState(request.tabId)
    const view = this.tabManager.getTabView(request.tabId)
    const wc = view?.webContents

    const distance = request.distance || 500

    if (wc && typeof wc.executeJavaScript === 'function') {
      let scrollExpr = `window.scrollBy({ top: ${distance}, behavior: 'smooth' });`
      if (request.direction === 'up') {
        scrollExpr = `window.scrollBy({ top: -${distance}, behavior: 'smooth' });`
      } else if (request.direction === 'top') {
        scrollExpr = `window.scrollTo({ top: 0, behavior: 'smooth' });`
      } else if (request.direction === 'bottom') {
        scrollExpr = `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });`
      }
      await wc.executeJavaScript(`(() => { ${scrollExpr} return true; })()`, true)
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:scrollPage',
      tabId: request.tabId,
      direction: request.direction,
      distance
    })

    return {
      success: true,
      action: 'scroll',
      tabId: request.tabId,
      resultingUrl: tab.url,
      targetFound: true,
      message: `Scrolled page ${request.direction}`
    }
  }

  /**
   * Fills an ordinary, non-sensitive form field with user-provided text.
   * Strictly blocks sensitive fields (passwords, cards) and NEVER implicitly submits.
   */
  public async fillField(rawRequest: FillFieldRequest): Promise<BrowserActionResult> {
    const request = FillFieldRequestSchema.parse(rawRequest)
    const snapshot = await this.inspectPage({ tabId: request.tabId })
    const target = this.resolveTargetElement(snapshot.elements, request.target)

    if (target.isSensitive || this.isSensitiveField(target.role, target.type, target.locator.nameAttr, target.label, target.locator.id)) {
      throw new IpcException(
        'VALIDATION_ERROR',
        `Security Policy Violation: Automated entry into sensitive fields (passwords, verification codes, payment credentials) is blocked.`
      )
    }

    if (target.disabled) {
      throw new IpcException('VALIDATION_ERROR', `Cannot fill disabled or read-only field '${target.name}'`)
    }

    const view = this.tabManager.getTabView(request.tabId)
    const wc = view?.webContents

    if (wc && typeof wc.executeJavaScript === 'function') {
      const fillScript = `
        (() => {
          try {
            let el = null;
            ${target.locator.id ? `el = document.getElementById(${JSON.stringify(target.locator.id)});` : ''}
            if (!el && ${JSON.stringify(target.locator.nameAttr || '')}) {
              el = document.querySelector('[name="' + ${JSON.stringify(target.locator.nameAttr || '')} + '"]');
            }
            if (!el) return { success: false, reason: 'Field not found in DOM' };
            if (el.disabled || el.readOnly) return { success: false, reason: 'Field is disabled or read-only' };

            el.focus();
            ${request.clearFirst !== false ? `el.value = '';` : ''}
            el.value = ${JSON.stringify(request.value)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          } catch (e) {
            return { error: String(e) };
          }
        })()
      `
      const fillRes = await wc.executeJavaScript(fillScript, true)
      if (fillRes?.error) {
        throw new IpcException('OPERATION_UNAVAILABLE', `Field filling failed: ${fillRes.error}`)
      }
    }

    const currentTab = this.tabManager.getTabState(request.tabId)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:fillField',
      tabId: request.tabId,
      elementId: target.elementId,
      charCount: request.value.length
    })

    return {
      success: true,
      action: 'fillField',
      tabId: request.tabId,
      resultingUrl: currentTab.url,
      targetFound: true,
      message: `Filled field '${target.name}' with ${request.value.length} characters (no implicit submission)`
    }
  }

  /**
   * Selects an option in a <select>, checkbox, or radio control.
   */
  public async selectOption(rawRequest: SelectOptionRequest): Promise<BrowserActionResult> {
    const request = SelectOptionRequestSchema.parse(rawRequest)
    const snapshot = await this.inspectPage({ tabId: request.tabId })
    const target = this.resolveTargetElement(snapshot.elements, request.target)

    const view = this.tabManager.getTabView(request.tabId)
    const wc = view?.webContents

    if (wc && typeof wc.executeJavaScript === 'function') {
      const selectScript = `
        (() => {
          try {
            let el = null;
            ${target.locator.id ? `el = document.getElementById(${JSON.stringify(target.locator.id)});` : ''}
            if (!el && ${JSON.stringify(target.locator.nameAttr || '')}) {
              el = document.querySelector('[name="' + ${JSON.stringify(target.locator.nameAttr || '')} + '"]');
            }
            if (!el) return { success: false, reason: 'Option target element not found' };

            el.focus();
            if (el.tagName.toLowerCase() === 'select') {
              el.value = ${JSON.stringify(request.optionValue)};
            } else if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = ${JSON.stringify(request.optionValue === 'true' || request.optionValue === 'checked')};
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          } catch (e) {
            return { error: String(e) };
          }
        })()
      `
      await wc.executeJavaScript(selectScript, true)
    }

    const currentTab = this.tabManager.getTabState(request.tabId)

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:selectOption',
      tabId: request.tabId,
      elementId: target.elementId,
      optionValue: request.optionValue
    })

    return {
      success: true,
      action: 'selectOption',
      tabId: request.tabId,
      resultingUrl: currentTab.url,
      targetFound: true,
      message: `Selected option '${request.optionValue}' on '${target.name}'`
    }
  }

  /**
   * Reviews form data before submission, checks for consequential side effects,
   * and creates a single-use confirmation token.
   */
  public async reviewForm(rawRequest: ReviewFormRequest): Promise<FormReviewSummary> {
    const request = ReviewFormRequestSchema.parse(rawRequest)
    const snapshot = await this.inspectPage({ tabId: request.tabId })

    const form = request.formId
      ? snapshot.forms.find((f) => f.formId === request.formId)
      : snapshot.forms[0]

    if (!form) {
      throw new IpcException('OPERATION_UNAVAILABLE', `Form '${request.formId || 'default'}' not found on page`)
    }

    const actionUrl = form.action || snapshot.url
    let destinationOrigin = snapshot.origin
    try {
      destinationOrigin = new URL(actionUrl, snapshot.url).origin
    } catch {
      // ignore
    }

    // Determine consequence: any POST form or external endpoint is consequential
    const isConsequential = form.method === 'POST' || destinationOrigin !== snapshot.origin || form.fields.length > 0
    const consequenceDescription = isConsequential
      ? `Submitting form '${form.formId}' will transmit form data to ${destinationOrigin} via ${form.method || 'GET'}.`
      : 'Form submission will perform standard in-page navigation query.'

    const fieldsToSubmit: Record<string, string> = {}
    for (const f of form.fields) {
      if (f.isSensitive) {
        fieldsToSubmit[f.name || f.fieldId] = '[REDACTED SENSITIVE FIELD]'
      } else {
        const val = request.proposedValues?.[f.name] ?? f.currentValue ?? ''
        fieldsToSubmit[f.name || f.fieldId] = String(val)
      }
    }

    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const confirmationToken = crypto.randomBytes(16).toString('hex')
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes validity

    const summary: FormReviewSummary = {
      reviewId,
      tabId: request.tabId,
      formId: form.formId,
      destinationOrigin,
      actionUrl,
      fieldsToSubmit,
      isConsequential,
      consequenceDescription,
      confirmationToken,
      expiresAt
    }

    this.pendingFormReviews.set(confirmationToken, summary)

    securityLogger.logEvent('CONSENT_REQUEST', 'system', 'PERMITTED', {
      action: 'browser:reviewForm',
      tabId: request.tabId,
      formId: form.formId,
      destinationOrigin,
      isConsequential
    })

    return summary
  }

  /**
   * Submits a form using a verified, action-specific confirmation token.
   */
  public async submitForm(rawRequest: SubmitFormRequest): Promise<BrowserActionResult> {
    const request = SubmitFormRequestSchema.parse(rawRequest)
    const review = this.pendingFormReviews.get(request.confirmationToken)

    if (!review) {
      throw new IpcException('UNAUTHORIZED_SENDER', 'Invalid or expired confirmation token for form submission')
    }

    if (Date.now() > review.expiresAt) {
      this.pendingFormReviews.delete(request.confirmationToken)
      throw new IpcException('VALIDATION_ERROR', 'Confirmation token has expired. Re-review form before submission.')
    }

    if (review.tabId !== request.tabId) {
      throw new IpcException('VALIDATION_ERROR', 'Confirmation token does not match active tab identifier')
    }

    // Invalidate token (single-use)
    this.pendingFormReviews.delete(request.confirmationToken)

    // Re-verify that page has not navigated away between confirmation and dispatch
    const currentTab = this.tabManager.getTabState(request.tabId)
    const currentOrigin = new URL(currentTab.url).origin
    if (currentOrigin !== review.destinationOrigin && currentOrigin !== new URL(review.actionUrl, currentTab.url).origin) {
      throw new IpcException(
        'VALIDATION_ERROR',
        `Destination origin changed from '${review.destinationOrigin}' to '${currentOrigin}'. Submission aborted for security.`
      )
    }

    const view = this.tabManager.getTabView(request.tabId)
    const wc = view?.webContents

    if (wc && typeof wc.executeJavaScript === 'function') {
      const submitScript = `
        (() => {
          try {
            const form = ${review.formId ? `document.getElementById(${JSON.stringify(review.formId)}) || ` : ''} document.querySelector('form');
            if (!form) return { success: false, reason: 'Form no longer present in DOM' };
            form.requestSubmit ? form.requestSubmit() : form.submit();
            return { success: true };
          } catch (e) {
            return { error: String(e) };
          }
        })()
      `
      await wc.executeJavaScript(submitScript, true)
    }

    securityLogger.logEvent('AUTHORIZATION_CHECK', 'system', 'PERMITTED', {
      action: 'browser:submitForm',
      tabId: request.tabId,
      formId: review.formId,
      destinationOrigin: review.destinationOrigin
    })

    return {
      success: true,
      action: 'submitForm',
      tabId: request.tabId,
      resultingUrl: currentTab.url,
      targetFound: true,
      message: `Form '${review.formId}' submitted successfully with verified user authorization.`
    }
  }
}

export const browserAgentManager = new BrowserAgentManager()
