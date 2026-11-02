# HELIOXEN AI — TOOL REGISTRY, TYPED SCHEMAS AND CAPABILITY DEFINITIONS
## Architecture Specification & Security Blueprint

**Project:** HELIOXEN  
**Roadmap:** Phase 9 · Tool Registry and Agent Orchestration Foundation  
**Step:** 25 of 48  
**Status:** Implemented & Validated  
**Date:** November 2, 2026

---

## 1. Executive Summary & Purpose

Step 25 of 48 establishes a centralized, type-safe, validated, and permission-aware tool registry for HELIOXEN.

Prior to Step 25, HELIOXEN implemented multi-turn conversation (Steps 1–18), real-time voice sessions (Steps 19–21), visual capture (Step 22), document extraction & VQA (Step 23), and unified multimodal context (Step 24). Phase 9 inaugurates the agent orchestration foundation, starting with Step 25's authoritative tool registry:

- **Strict Separation of Definition and Execution:** Tool definitions declare what an operation is, what typed parameters it accepts, what output structure it guarantees, what security capabilities it requires, and what risk level it presents. Registration does NOT grant authorization, nor does it execute the tool (execution belongs to Step 26).
- **Enforceable Runtime Schemas:** Every tool contract specifies runtime Zod schemas for both input and output. Unknown or unexpected properties are strictly rejected (`.strict()`) to protect against prompt injection and payload smuggling.
- **Three-Tier Security Evaluation:** Evaluates tool definition requirements, implementation availability, and granted security capabilities independently. Prohibited tools (e.g. arbitrary shell execution) are permanently barred from invocation.
- **Model-Facing Translation:** Generates provider-specific function calling declarations (OpenAI tools and Google Gemini function declarations) directly from authoritative definitions, ensuring a single source of truth across the desktop runtime.

---

## 2. Tool Definition Contract & Schema Model

### 2.1 Types (`src/shared/tools/types.ts`)

```typescript
export interface ToolDefinition<TInput = any, TOutput = any> {
  readonly id: string                           // Stable identifier: 'namespace:action_name'
  readonly displayName: string                  // Human-readable title
  readonly description: string                  // Concise purpose description
  readonly category: ToolCategory               // 'system' | 'workspace' | 'documents' | 'media' | 'utility'
  readonly version: string                      // Semver contract version
  readonly inputSchema: z.ZodType<TInput>       // Enforceable runtime input schema
  readonly outputSchema: z.ZodType<TOutput>     // Enforceable runtime output schema
  readonly jsonSchema: JsonSchemaProperty       // Model-facing parameter declaration
  readonly requiredCapabilities: readonly string[] // Authoritative security capabilities
  readonly riskTier: RiskTier                   // 'low' | 'moderate' | 'high' | 'prohibited'
  readonly confirmationPolicy: ConfirmationPolicy // 'none' | 'user_confirmation' | 'prohibited'
  readonly implementationStatus: ImplementationStatus // 'available' | 'unavailable' | 'planned'
  readonly registrationStatus: ToolRegistrationStatus // 'enabled' | 'disabled'
  readonly executionMode: ExecutionMode         // 'synchronous' | 'asynchronous'
  readonly limits: ToolLimits                   // timeoutMs, maxPayloadSizeBytes
  readonly source: 'builtin' | 'extension'
  readonly tags?: readonly string[]
}
```

---

## 3. Built-In Tool Catalog

| Tool Identifier | Category | Risk Tier | Required Capability | Implementation Status | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `system:get_time` | `system` | `low` | None | `available` | Returns system local time and ISO UTC timestamps. |
| `workspace:get_context_summary` | `workspace` | `low` | `workspace:readContext` | `available` | Retrieves active multimodal context metrics for conversation. |
| `documents:extract_text` | `documents` | `low` | `documents:extract` | `available` | Safely parses and extracts normalized text from documents. |
| `media:get_capture_sources` | `media` | `moderate` | `capture:getSources` | `available` | Enumerates display screens and windows for capture. |
| `models:list_available` | `utility` | `low` | `models:getCatalog` | `available` | Lists active curated AI models and capability profiles. |
| `shell:execute` | `system` | `prohibited` | `shell:execute` | `unavailable` | Prohibited reference definition. Permanently banned per ADR-013. |

---

## 4. Capability Evaluation & Authorization Separation

The registry enforces three distinct, non-overlapping verification layers:

1. **Definition Requirement:** What the tool contract declares it needs in `def.requiredCapabilities`. Tools cannot self-grant capabilities.
2. **Implementation Availability:** Whether the underlying native module or service is currently initialized and operational (`available` vs `unavailable`).
3. **Authorization Check:** Evaluated by `ToolRegistry.evaluateEligibility(toolId, grantedCapabilities)`.
   - Prohibited risk tier tools are permanently ineligible regardless of granted capabilities.
   - Disabled tools return `Tool is disabled`.
   - Missing security capabilities result in immediate eligibility failure with a specific explanatory reason.

---

## 5. Model-Facing Schema Generation

`ToolRegistry` formats canonical tool schemas directly into provider-specific function calling formats:

### 5.1 OpenAI Function Format (`formatOpenAiTools`)
```json
{
  "type": "function",
  "function": {
    "name": "system__get_time",
    "description": "Returns the current operating system time in local and ISO UTC formats.",
    "parameters": {
      "type": "object",
      "properties": {
        "timezone": { "type": "string", "description": "..." }
      },
      "required": []
    }
  }
}
```

### 5.2 Google Gemini Declaration Format (`formatGeminiTools`)
```json
{
  "name": "system__get_time",
  "description": "Returns the current operating system time in local and ISO UTC formats.",
  "parameters": {
    "type": "object",
    "properties": {
      "timezone": { "type": "string", "description": "..." }
    },
    "required": []
  }
}
```

- Prohibited tools (`riskTier: 'prohibited'`) and disabled tools are strictly excluded from model-facing schema outputs.
- Colons in tool identifiers are converted to double underscores (`system:get_time` → `system__get_time`) to comply with provider schema naming rules.

---

## 6. IPC Security & Preload Interface

- **Preload API (`window.helioxen.tools`):**
  - `list(filter?: ToolQueryFilter): Promise<ToolMetadata[]>`
  - `get(id: string): Promise<ToolMetadata | null>`
  - `validateInput(id: string, input: unknown): Promise<ToolValidationResult>`
- **Security Capabilities:** Authorized via `tools:list`, `tools:get`, and `tools:validate`.
- **Zero Execution Channel:** No arbitrary execution IPC channel is exposed in Step 25.

---

## 7. Automated Testing Suite

1. `tests/tools/toolContracts.test.ts` (9 tests):
   - Validates identifier syntax, unknown field rejection (`.strict()`), string/numeric bounds, and metadata sanitization.
2. `tests/tools/toolRegistry.test.ts` (14 tests):
   - Validates built-in registration, duplicate prevention, atomic failure, exact resolution, filtering, and payload validation.
3. `tests/tools/capabilityAndRisk.test.ts` (8 tests):
   - Validates security capability checking, prohibited capability mismatch rejection, and `evaluateEligibility` checks.
4. `tests/tools/modelSchemaTranslation.test.ts` (4 tests):
   - Validates OpenAI and Gemini tool declaration formatting and prohibited tool exclusion.
- Total test coverage: **42 test files, 261 unit/integration tests passing** with 0 regressions.
