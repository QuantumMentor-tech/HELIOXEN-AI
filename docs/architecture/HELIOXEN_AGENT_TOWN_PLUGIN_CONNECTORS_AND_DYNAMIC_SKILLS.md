# HELIOXEN Architecture Document — Step 40
## Agent Town, Plugin Connectors, and Dynamic Skills Framework

**Phase:** 14 — Agent Orchestration and Extensibility  
**Step:** 40 of 48  
**Status:** Completed & Authoritatively Verified  

---

### 1. Architectural Mission & Core Principles

Step 40 establishes the foundational **Agent Town** workspace and a strictly sandboxed, extensible plugin, connector, and dynamic skills framework within HELIOXEN.

The system adheres to four core non-negotiable architectural invariants:

1. **Truthful Agent Availability:**
   - Every agent is an explicit, first-class entity with a documented purpose, eligible models, assigned tasks, and verified runtime status (`idle`, `assigned`, `running`, `awaiting_approval`, `disabled`, `unavailable`).
   - Artificial "theater", fake conversational agents, and simulated phantom activity are prohibited. Agents exist only when backed by genuine operational configurations.

2. **Strict Default-Deny Plugin & Connector Sandboxing:**
   - Plugins and connectors are governed by versioned manifests (`PluginManifestSchema`, `ConnectorDescriptorSchema`).
   - Capabilities are declared with fine-grained read/write scope separation (`ConnectorScopeSchema`).
   - Dynamic executable script injection (`eval`, `new Function`, `<script>`, remote script loading) is banned by design.
   - Immediate capability revocation: whenever a plugin or connector is disabled or disconnected, its tools and capabilities are immediately revoked from the authoritative `ToolRegistry`.

3. **Declarative Directed Acyclic Graph (DAG) Workflows:**
   - Dynamic skills are authored purely as declarative sequences of tool steps (`DynamicSkillDefinition`).
   - Graph validation (`validateSkillWorkflowGraph`) runs Kahn's topological sort algorithm to detect dependency cycles, reject self-dependency loops, and catch unsequenced forward references.
   - Step output data bindings (`$step.<stepId>.output.<field>`) resolve dynamically without code execution.

4. **Trusted Permission & Risk Tier Derivation (No Self-Granting):**
   - A dynamic skill cannot self-declare permissions or risk levels.
   - The trusted registry derives the required capabilities and overall risk tier by inspecting the referenced tools in `ToolRegistry`. If any step references a `high` risk tool, the entire skill inherits the `high` risk tier.
   - Any modification to an enabled skill definition resets its status to `validated`/`draft`, requiring re-review and explicit activation.

---

### 2. Architecture & Data Contracts

#### 2.1 Shared Data Models (`src/shared/agents/`)
- [`types.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/shared/agents/types.ts):
  - `AgentDefinition`: Unique ID, display name, purpose, eligible models, required capabilities, runtime status, active task assignment.
  - `PluginManifest`: Schema version, metadata, publisher verification, declared tool IDs, connector list.
  - `ConnectorDescriptor`: Endpoint URL, protocol (`native_adapter`, `mcp_spec`, `webhook_receiver`), connection status, scopes (`read_only`, `read_write`, `administrative`), write permission flag.
  - `DynamicSkillDefinition`: Id, steps, input bindings, derived capabilities, derived risk tier, lifecycle status (`draft`, `validated`, `enabled`, `disabled`, `archived`), execution constraints.
  - `SkillDryRunResult`: Simulated dry-run output without mutating real system state.
  - `AgentTownOverviewSnapshot`: Comprehensive summary of agents, plugins, and skills for renderer presentation.

- [`contracts.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai Assistant%20(working)/src/shared/agents/contracts.ts):
  - Zod runtime validation schemas for agents, plugins, connectors, and skills.
  - Built-in registered agents: `agent_general`, `agent_researcher`, `agent_coding`, `agent_productivity`, `agent_system_operator`.
  - Built-in approved plugins: `plugin_github_connector`, `plugin_weather_intelligence`, `plugin_local_productivity`.
  - `validateSkillWorkflowGraph()`: Cycle detection, duplicate step detection, unmapped dependency verification, script primitive injection defense.
  - `resolveSkillDataBinding()`: Safe property path resolution across prior step outputs.

#### 2.2 Main Process Services (`src/main/agents/`)
- [`AgentRegistry.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/agents/AgentRegistry.ts):
  - Agent discovery, validation, atomic JSON persistence, enable/disable toggles, runtime status tracking.
- [`ConnectorRegistry.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/agents/ConnectorRegistry.ts):
  - Plugin and connector lifecycle management, scope updates, immediate tool revocation in `ToolRegistry`.
- [`DynamicSkillsManager.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/agents/DynamicSkillsManager.ts):
  - Safe declarative workflow authoring, graph validation, capability and risk derivation, dry-run simulation mode, approval invalidation upon edit, translation to `TaskPlan` and execution via authoritative `TaskExecutionEngine`.
- [`AgentTownService.ts`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/main/agents/AgentTownService.ts):
  - High-level orchestrator providing unified facade and snapshot acquisition for IPC handlers.

#### 2.3 IPC and Preload Bridge (`src/preload/`, `src/shared/ipc/`)
- Dedicated channel constants: `AGENTS_GET_OVERVIEW`, `AGENTS_LIST`, `AGENTS_SET_ENABLED`, `PLUGINS_LIST`, `PLUGINS_SET_ENABLED`, `CONNECTORS_CONNECT`, `CONNECTORS_DISCONNECT`, `CONNECTORS_UPDATE_SCOPES`, `SKILLS_LIST`, `SKILLS_GET`, `SKILLS_VALIDATE`, `SKILLS_DRY_RUN`, `SKILLS_SAVE`, `SKILLS_SET_STATUS`, `SKILLS_DELETE`, `SKILLS_EXECUTE`.
- Type-safe preload bridge: `window.helioxen.agents.*`.

#### 2.4 User Interface (`src/renderer/src/components/agents/AgentTownPanel.tsx`)
- Tabbed primary workspace:
  - **Agents:** Grid of truthful agent cards, purpose, status badges, model eligibility, active task assignment, enable/disable toggles.
  - **Plugin Connectors:** Plugin manifest cards, connection statuses, scope pills (`read_only` / `read_write`), connect/disconnect actions.
  - **Dynamic Skills:** Catalog of validated dynamic workflows, step breakdown, derived capability counts, risk tier badges, execution launcher, status toggles.
  - **Skill Studio:** Safe declarative workflow builder, step editor selecting registered tools, DAG graph validator, non-mutating dry-run simulator, save and activate workflow.

---

### 3. Verification & Compliance Matrix

| Requirement | Implementation Component | Verification Test |
| :--- | :--- | :--- |
| **Truthful Agent Registry** | `AgentRegistry.ts`, `contracts.ts` | `tests/agents/agentRegistryAndPlugins.test.ts` (passed) |
| **Plugin & Connector Lifecycle** | `ConnectorRegistry.ts`, `contracts.ts` | `tests/agents/agentRegistryAndPlugins.test.ts` (passed) |
| **Tool Revocation on Disconnect** | `ConnectorRegistry.ts`, `ToolRegistry.ts` | `tests/agents/agentRegistryAndPlugins.test.ts` (passed) |
| **DAG Graph Cycle Detection** | `contracts.ts` (`validateSkillWorkflowGraph`) | `tests/agents/dynamicSkillsAndSecurity.test.ts` (passed) |
| **Permission & Risk Derivation** | `DynamicSkillsManager.ts` | `tests/agents/dynamicSkillsAndSecurity.test.ts` (passed) |
| **Arbitrary Code Prohibition** | `contracts.ts`, `DynamicSkillsManager.ts` | `tests/agents/dynamicSkillsAndSecurity.test.ts` (passed) |
| **Dry-Run Simulation Mode** | `DynamicSkillsManager.ts` (`dryRunSkill`) | `tests/agents/dynamicSkillsAndSecurity.test.ts` (passed) |
| **Execution via TaskExecutionEngine** | `DynamicSkillsManager.ts` (`executeSkill`) | `tests/agents/dynamicSkillsAndSecurity.test.ts` (passed) |
| **Preload Bridge & Typecheck** | `src/preload/index.ts`, `src/preload/types.ts` | `npm run typecheck` (passed node & web) |
| **Production Build** | `electron-vite build` | Clean production build (passed) |

