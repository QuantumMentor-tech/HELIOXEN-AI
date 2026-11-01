# HELIOXEN AI — Command Center and Three-Panel Workspace Architecture

**Document Version:** 1.0.0  
**Phase:** Phase 4 — Desktop Application Shell and Command Center  
**Step:** 11 of 48  
**Status:** Approved & Implemented  
**Date:** November 2026  

---

## 1. Design Objectives

The HELIOXEN Command Center establishes an original, high-contrast, three-panel desktop workspace. Inspired by the clean visual hierarchy and uncluttered simplicity appreciated in modern desktop command interfaces (such as Stonic AI), HELIOXEN implements an entirely original design system and architectural foundation that balances:

1. **Immediate Orientation:** Fast visual comprehension with three distinct functional regions that never compete for global state.
2. **Visual Primacy:** The central workspace remains the dominant focus of the application shell, accommodating future multimodal AI visualization and thread transcripts without requiring shell refactoring.
3. **Calm, High-Contrast Aesthetics:** Cyan glowing accents (`#00f0ff`), deep cosmic dark backgrounds (`#070a10`, `#0c1017`), subtle borders, and WCAG AA-compliant typography (minimum 5.11:1 text contrast).
4. **Structural Honesty:** Zero fabricated data, synthetic streaming, mock telemetry, or fake agent activity. The workspace displays truthful readiness and security states.
5. **Responsive Reliability:** Flawless operation across the supported Windows desktop dimensions (1024x640 minimum, 1280x800 nominal, 1920x1080+ wide) with reversible panel collapse and zero horizontal clipping.

---

## 2. Workspace Panel Reference & Responsibilities

| Region | Responsibility | Actual Implementation | Current State | Future Integration Boundary |
|---|---|---|---|---|
| **Left Panel** | Primary navigation, destination routing, and workspace access | `src/renderer/src/components/navigation/NavRail.tsx` | Active (64px collapsed / 224px expanded) | Step 12+ dynamic notifications and active session badges |
| **Center Panel** | Primary intelligence workspace, active command input, and interaction focus | `src/renderer/src/components/workspace/PrimaryWorkspacePanel.tsx` | Active (`flex-1`, fluid stage & command input dock) | Step 12 3D particle core, conversation transcripts, and persistent voice dock |
| **Right Panel** | Contextual intelligence, supporting records, and execution inspection | `src/renderer/src/components/workspace/ContextPanel.tsx` | Active (320px collapsible contextual standby) | Step 13+ semantic memory associations, tool traces, and contextual inspectors |

---

## 3. Component Architecture and Hierarchy

The command center lives entirely within the secure renderer process and mounts inside the `AppShell` container established in Step 10:

```
App (src/renderer/src/App.tsx)
└── AppShell (src/renderer/src/components/layout/AppShell.tsx)
    ├── Titlebar (Custom Frameless Window Controls & Drag Region)
    └── CommandCenter (src/renderer/src/components/workspace/CommandCenter.tsx)
        └── WorkspaceLayout (src/renderer/src/components/workspace/WorkspaceLayout.tsx)
            ├── [Left Slot] NavRail (src/renderer/src/components/navigation/NavRail.tsx)
            ├── [Center Slot] PrimaryWorkspacePanel (src/renderer/src/components/workspace/PrimaryWorkspacePanel.tsx)
            │   ├── Header (Dynamic Destination & Action Controls)
            │   ├── Top Command Center Status Card
            │   ├── Primary Intelligence Stage (Reserved Container)
            │   ├── Command & Action Input Dock
            │   └── Three-Panel Architecture Summary Cards
            └── [Right Slot] ContextPanel (src/renderer/src/components/workspace/ContextPanel.tsx)
                ├── Context Header (STANDBY indicator & Collapse Action)
                ├── Session Context Card
                ├── Future Integration Boundary Note
                ├── Security Boundary Status (Context Isolation, Sandbox)
                └── Execution Trace Indicator
```

---

## 4. Panel Sizing and Layout Rules

1. **Left Panel (Navigation Rail):**
   - **Width:** 64px (`w-16`) in collapsed icon mode; 224px (`w-56`) in expanded mode.
   - **Height:** 100% of viewport below titlebar (`h-full`).
   - **Behavior:** Fixed width with animated transition (`duration-deliberate ease-standard`).
2. **Center Panel (Primary Workspace):**
   - **Width:** `flex-1 min-w-0` to expand smoothly and claim all available horizontal space.
   - **Max Width Container:** Centered at `max-w-5xl` for optimal reading width on wide/4K monitors.
   - **Height:** `h-full` with dedicated vertical scroll container (`overflow-y-auto`).
3. **Right Panel (Contextual Panel):**
   - **Width:** Fixed 320px (`w-80`) when active; unmounted / 0px when collapsed.
   - **Height:** `h-full` with dedicated vertical scroll container (`overflow-y-auto`).
   - **Behavior:** Reversible toggle via header icon button (`PanelRightOpen` / `PanelRightClose`) or auto-collapsed when viewport width is below 1120px.

---

## 5. Navigation Integration & Single Source of Truth

- The navigation state is governed exclusively by `useNavigation` in `src/renderer/src/components/navigation/useNavigation.ts`.
- Destinations are defined strictly in `types.ts` (`NAV_DESTINATIONS`).
- When navigating to `core`, the active Command Center workspace renders.
- When navigating to planned roadmap destinations (`conversations`, `memory`, `skills`, `character`, `monitor`, `settings`), the center panel renders a deliberate, honest roadmap destination view with an action button to return to the active foundation.
- No secondary or duplicate navigation state is maintained in the command center.

---

## 6. Responsive Behavior & Tested Dimensions

| Window Size | Scenario | Left Panel | Center Panel | Right Panel | Horizontal Overflow |
|---|---|---|---|---|---|
| **1024 x 640 px** | Minimum Practical Bounds | 64px (Collapsed) | ~960px (`flex-1`) | Auto-Collapsed (Toggleable) | None (0px scroll) |
| **1280 x 800 px** | Nominal Working Size | 64px or 224px | ~736px - 896px (`flex-1`) | 320px Active | None (0px scroll) |
| **1920 x 1080 px** | Full HD Desktop | 224px (Expanded) | Max 1024px centered | 320px Active | None (0px scroll) |
| **2560 x 1440 px (2K)** | High-DPI Ultra-Wide | 224px (Expanded) | Max 1024px centered | 320px Active | None (0px scroll) |

---

## 7. Scrolling and Overflow Boundaries

- **Shell Level:** `overflow-hidden` at the root window and `AppShell` container prevents any desktop window scrollbars.
- **Center Workspace:** Dedicated scroll container (`overflow-y-auto`) inside `PrimaryWorkspacePanel`.
- **Right Panel:** Dedicated independent scroll container (`overflow-y-auto`) inside `ContextPanel`.
- **Keyboard Scrolling:** Standard `PageUp`, `PageDown`, `Home`, `End`, and Arrow keys function natively within the focused scroll regions.

---

## 8. Accessibility & Semantic Structure

- **Semantic Landmarks:**
  - Navigation: `<nav aria-label="Application Navigation Rail" aria-expanded="...">`
  - Primary Workspace: `<main id="primary-workspace" aria-label="Primary Intelligence Workspace">`
  - Contextual Panel: `<aside id="contextual-workspace" aria-label="Contextual Intelligence Panel">`
- **Focus Indicators:** Explicit 2px cyan focus ring (`focus-visible:ring-2 focus-visible:ring-hx-cyan focus-visible:ring-offset-2`).
- **Interactive Labels:** All buttons, icon buttons, and toggles provide explicit `aria-label`, `title`, and descriptive text.
- **Hidden Panel Safety:** When collapsed, the right contextual panel is unmounted from the DOM, guaranteeing it cannot trap keyboard focus or intercept pointer events.
- **Reduced Motion:** Fully complies with `@media (prefers-reduced-motion: reduce)` tokens from Step 9.

---

## 9. Security & Boundary Integrity

- **Process Isolation:** The command center executes strictly in the unprivileged renderer process.
- **No Direct Node.js:** Node.js integration remains disabled (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
- **Narrow IPC Bridge:** Only the validated window-control API (`window:minimize`, `window:maximize`, `window:close`, `window:isMaximized`) is exposed via `window.helioxen`.
- **Zero API Credentials in UI:** No persistent API keys or credentials are stored or exposed in renderer components.

---

## 10. Deferred Features (Strict Stop Boundary)

The following capabilities are strictly deferred to subsequent roadmap steps per architectural plan:

- **Step 12:** 3D Particle AI Core canvas, central conversation panel, and persistent audio voice dock.
- **Step 13:** Multimodal input handlers, image ingestion, and screen capture pipelines.
- **Step 14:** AI Provider switching, streaming token management, and credential vaults.
- **Step 15+:** Dynamic skill execution, semantic memory stores, 3D world monitor, and agent town simulation.
