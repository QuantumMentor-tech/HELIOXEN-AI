# HELIOXEN Architecture: Advanced Dynamic Skill Studio, Automated Validation, Testing, Versioning, and Safe Skill Evolution

## 1. Executive Summary & Purpose

Phase 14 (*Agent Orchestration and Extensibility*) Step 42 elevates HELIOXEN's dynamic skills capability into a robust, local-first **Advanced Skill Studio**. It provides end-to-end tooling to author, deterministically validate, test, version, diff, safely roll back, import, export, and evolve declarative multi-step agent skills without sacrificing the authoritative security perimeter.

In HELIOXEN, skills are strictly declarative Directed Acyclic Graphs (DAGs) composed of registered tools. They execute solely through the authoritative `TaskExecutionEngine`. No arbitrary runtime code (`eval()`, dynamic scripting, shell execution) is ever permitted.

---

## 2. 7-Stage Deterministic Validation Pipeline

The Studio implements a sequential 7-stage validation pipeline (`validateSkillStaged`) that verifies definitions prior to registration, test execution, or activation:

```
[Candidate Skill Definition]
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │ 1. Structural Schema Validation              │ (Zod schema conformance, unique step IDs, non-empty)
  └──────────────────────┬───────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────┐
  │ 2. Tool Registry Resolution                  │ (Tool catalog resolution, enabled status, existence)
  └──────────────────────┬───────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────┐
  │ 3. Data-Flow Lineage & Binding Integrity     │ (Forward reference check, missing source, leak scrubbing)
  └──────────────────────┬───────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────┐
  │ 4. Dependency Graph / DAG Cycle Detection    │ (Kahn's topological sort, circular dependency detection)
  └──────────────────────┬───────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────┐
  │ 5. Authorization & Risk Classification       │ (Capability union derivation, RiskTier mapping, consent gates)
  └──────────────────────┬───────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────┐
  │ 6. Resource Limits & Quotas                  │ (Max steps, execution timeout bounds, retry constraints)
  └──────────────────────┬───────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────┐
  │ 7. Actionable Readiness Summary              │ (Blocking errors vs non-blocking warnings, readiness badge)
  └──────────────────────────────────────────────┘
```

1. **Stage 1: Structural Schema Validation (`structural`)**
   - Validates identity, version number, display names, and step arrays against `DynamicSkillDefinitionSchema`.
   - Guarantees step ID uniqueness and non-empty step collections.
2. **Stage 2: Tool Registry Resolution (`registry_resolution`)**
   - Resolves all referenced `toolId` targets against the authoritative `ToolRegistry`.
   - Blocks unregistered tools and flags disabled tools with actionable remediation suggestions.
3. **Stage 3: Data-Flow Lineage & Secret Leak Protection (`data_flow`)**
   - Validates that step output bindings (`step_output`) reference existing steps that execute strictly prior to the consuming step.
   - Forbids forward references and circular data flows.
   - Scans string literals for leaked API tokens, passwords, bearer tokens, or secret patterns (`AIza...`, `sk-...`).
4. **Stage 4: DAG Cycle Detection (`dependency_graph`)**
   - Runs topological sorting using in-degree reduction to detect circular step dependencies (`A -> B -> A`).
   - Generates the deterministic topological execution order (`stepOrder`).
5. **Stage 5: Authorization & Risk Tier Derivation (`authorization_risk`)**
   - Aggregates required capabilities from all steps into `derivedCapabilities`.
   - Derives the overall risk tier (`low`, `moderate`, `high`, `prohibited`) based on the highest risk tier among referenced tools.
   - Enforces human confirmation policies on sensitive actions (e.g. disk write, process management).
6. **Stage 6: Resource Limits & Quotas (`resource_limits`)**
   - Enforces step count limits (max 20 steps per skill).
   - Validates execution timeout bounds (default 30s, max 120s) and step retry bounds (max 3 retries).
7. **Stage 7: Actionable Readiness Summary (`readiness_summary`)**
   - Categorizes issues by severity (`error` vs `warning`).
   - Produces a clear `valid: boolean` readiness status along with `suggestedFix` recommendations.

---

## 3. Immutable Versioning, Canonical Hashing, and Safe Rollback

1. **Canonical SHA-256 Hashing (`computeSkillDefinitionHash`)**
   - Normalizes step sorting, property ordering, and input binding keys before generating a SHA-256 digest.
   - Ensures cosmetic formatting changes (whitespace, key ordering) do not trigger phantom revisions.
2. **Immutable Version Records (`SkillVersionRecord`)**
   - Stored in atomic disk persistence `skills_version_store.json`.
   - Each record stores the version number (`1.0.0`), version ID (`ver_<timestamp>_<hash>`), changelog description, canonical hash, snapshot definition, and 7-stage validation report.
3. **Version Comparison Engine (`compareSkillDefinitions`)**
   - Analyzes differences between any two skill versions.
   - Detects `stepsAdded`, `stepsRemoved`, `stepsModified` (tool changes, input binding changes, dependency changes, approval requirements), `capabilitiesAdded`, `capabilitiesRemoved`, and `riskTierChanged`.
4. **Safe Capability-Revalidated Rollback (`rollbackSkillVersion`)**
   - Rollback does not naively trust historical approval states.
   - Before activating a historical revision, it re-validates the definition against the **currently registered tools and capabilities** in the application.
   - Updates the active definition and increments the version timeline.

---

## 4. Test Workbench & Synthetic Regression Suites

1. **Synthetic Test Scenarios (`SkillTestScenario`)**
   - Persisted in atomic disk storage `skills_test_scenarios_store.json`.
   - Allows users and developers to define deterministic input parameters and mock tool outputs (e.g. mock weather telemetry, mock time).
   - Specifies expected outputs and expected terminal status (`completed` or `failed`).
2. **Scenario Execution Runner (`runTestScenario`)**
   - Executes the skill workflow steps within an isolated simulation context using registered mock outputs.
   - Records step-by-step trace: step ID, tool ID, resolved inputs, mock output, simulated duration, and status.
   - Compares actual execution outputs and status against expected assertions to yield `passed: boolean`.
3. **Regression Suite Runner (`runRegressionTests`)**
   - Runs all defined scenarios for a target skill.
   - Aggregates metrics: total scenarios, passed count, failed count, and flags `newlyFailedScenarioIds`.
   - Protects against accidental workflow regressions across updates and edits.

---

## 5. Portable Declarative Import & Export Hygiene

1. **Scrubbed Package Export (`serializeSkillExportPackage`)**
   - Serializes skill definition and associated test fixtures into a structured JSON envelope (`helioxen-skill-package` v1).
   - Strictly sanitizes input bindings: removes any API keys, bearer tokens, or password strings (`[REDACTED_CREDENTIAL]`).
   - Embeds the canonical SHA-256 hash.
2. **Untrusted Import Quarantine (`parseAndValidateSkillImportPackage` & `importSkillPackage`)**
   - Validates JSON envelope against strict Zod schema `SkillExportPackageSchema`.
   - Pre-flight dependency resolution: detects missing tools or connectors on the host installation.
   - **Quarantine Guarantee:** All imported packages are registered strictly in `status: 'draft'`, quarantined from automatic execution until explicitly inspected, validated, and enabled by the user.

---

## 6. AI-Assisted Structured Workflow Drafting & Refinement

1. **Provider Model Integration**
   - Uses `ProviderService` to prompt the active LLM provider for structured JSON skill definitions.
   - System prompts constrain output to registered tool names, categories, and declarative step DAGs.
2. **Strict Defense Against Hallucinations**
   - The returned JSON is parsed and filtered against the authoritative `ToolRegistry`. Any fabricated or unregistered tools are rejected.
   - The generated workflow is quarantined with `status: 'draft'`.
   - Refinement instructions modify step parameters without permitting arbitrary code execution.

