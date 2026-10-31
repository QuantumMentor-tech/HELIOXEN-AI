# HELIOXEN AI — Technical Foundation Implementation Decisions

**Document ID:** `HELIOXEN-FID-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 2: Technical Architecture and Project Foundation  
**Step:** 5 of 48 (Repository Initialization, Development Environment and Configuration)  
**Status:** Approved Foundation Blueprint  
**Date:** October 31, 2026  
**Target Environment:** Windows 10/11 Desktop (64-bit)  

---

## 1. PURPOSE AND ARCHITECTURAL TRANSLATION

This document records the exact technical decisions, configuration defaults, dependency justifications, and deliberate deferrals established during **Step 5 (Repository Initialization)** to realize the architecture approved in [HELIOXEN_TECH_STACK_DECISION.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_TECH_STACK_DECISION.md) and [HELIOXEN_ARCHITECTURE_DECISION_RECORDS.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_ARCHITECTURE_DECISION_RECORDS.md).

---

## 2. DIRECT DEPENDENCY JUSTIFICATIONS

In accordance with Section 6 of the Step 5 specification, dependencies were kept strictly lean: only libraries required for the foundational desktop bootstrap and build pipeline were installed. Advanced feature dependencies (Three.js, SQLite, Playwright, AI provider SDKs) are deferred to the specific steps that implement them.

| Package Name | Category | Exact Version / Range | Justification & Architectural Role | Link to ADR |
| :--- | :--- | :--- | :--- | :--- |
| `electron` | devDependency | `^33.2.0` | Desktop runtime providing native Windows 10/11 windowing, safeStorage DPAPI vault, and multi-process architecture. | `ADR-001` |
| `electron-vite` | devDependency | `^2.3.0` | Integrated bundler providing fast HMR across Main, Preload, and Renderer without fragmented Webpack configs. | `ADR-003` |
| `vite` | devDependency | `^5.4.10` | Core esbuild-powered dev server and bundler powering the React renderer pipeline. | `ADR-003` |
| `@vitejs/plugin-react` | devDependency | `^4.3.3` | Babel/SWC fast refresh plugin enabling seamless React HMR during desktop UI development. | `ADR-002` |
| `typescript` | devDependency | `^5.6.3` | Compile-time type safety across Main process, Preload script, and React renderer components. | `ADR-002` |
| `@types/node` | devDependency | `^20.17.0` | Node.js type declarations for Main process APIs and build scripts. | `ADR-002` |
| `@types/react` | devDependency | `^18.3.12` | React type declarations for TSX renderer components. | `ADR-002` |
| `@types/react-dom` | devDependency | `^18.3.1` | React DOM type declarations. | `ADR-002` |
| `tailwindcss` | devDependency | `^3.4.14` | Utility-first CSS styling engine enabling zero-runtime desktop bundle styling and dynamic CSS tokens. | `ADR-004` |
| `postcss` | devDependency | `^8.4.47` | CSS transformation pipeline required by Tailwind CSS. | `ADR-004` |
| `autoprefixer` | devDependency | `^10.4.20` | Vendor-prefix post-processor ensuring cross-version Chromium rendering stability. | `ADR-004` |
| `react` | dependency | `^18.3.1` | Declarative UI framework for rendering the command center and multi-panel workspace. | `ADR-002` |
| `react-dom` | dependency | `^18.3.1` | React DOM bindings for mounting the UI into Chromium document root. | `ADR-002` |

---

## 3. CONFIGURATION DEFAULTS AND DEVIATIONS

### 3.1 TypeScript Configuration Separation
Rather than a single monolithic `tsconfig.json`, the repository establishes a strict 3-tier project reference system:
- `tsconfig.json`: Root project reference coordinator.
- `tsconfig.node.json`: Configured strictly for the Node.js runtime (`src/main/`, `src/preload/`, and `electron.vite.config.ts`) with `target: ES2022`, `moduleResolution: Bundler`, and `types: ["node"]`.
- `tsconfig.web.json`: Configured strictly for the browser DOM environment (`src/renderer/`) with `jsx: react-jsx`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, and DOM event types.

### 3.2 Security Defaults in Main Process
The minimal bootstrap window in `src/main/index.ts` enforces modern desktop security from day one:
1. `contextIsolation: true`: Prevents prototype pollution and keeps Preload context separated from the React DOM.
2. `nodeIntegration: false`: Renderer has zero direct access to Node.js `require()` or `process`.
3. `sandbox: true`: Chromium sandbox enforced on all renderer threads.
4. `webSecurity: true`: Same-origin policy and CORS strictly enforced.
5. `setWindowOpenHandler: deny`: Arbitrary popups or new windows are blocked and redirected to the user's default OS browser.
6. `Content-Security-Policy (CSP)`: Injected on all session responses, restricting script execution strictly to local bundles (`script-src 'self'`).

---

## 4. INTENTIONALLY DEFERRED CAPABILITIES

In compliance with Step 5 scope boundaries:
1. **No Three.js / R3F Shaders:** Deferred to Step 12 (Central AI Core Visualizer).
2. **No AI Provider SDKs (`@google/genai`):** Deferred to Step 16 (Provider Adapters & Credential Vault).
3. **No Database Dependencies (`better-sqlite3`):** Deferred to Step 34 (Memory & Persistence).
4. **No Browser Automation (`playwright`):** Deferred to Step 31 (Browser Automation).
5. **No Final UI Layouts or Custom Titlebar:** Deferred to Step 7–11. The current renderer is an intentional, neutral development bootstrap status card.

---

## 5. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | Principal Software Architect | Documented foundational implementation decisions for Step 5 of 48. Detailed dependency justifications, TypeScript project references, mandatory Electron security defaults, and deferred capabilities. |
