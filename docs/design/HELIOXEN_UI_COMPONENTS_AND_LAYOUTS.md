# HELIOXEN AI — Reusable UI Components, Navigation and Layout System

**Document ID:** `HELIOXEN-DES-002`  
**Version:** `1.0.0`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 3: Brand Identity and UI Foundation  
**Step:** Step 8 of 48 (Reusable UI Components, Navigation and Layout System)  
**Status:** Approved Component & Navigation Specification  
**Date:** November 1, 2026  
**Authoritative Locations:**
- UI Primitives: [`src/renderer/src/components/ui/`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/ui/)
- Layout Primitives: [`src/renderer/src/components/layout/`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/layout/)
- Navigation Foundation: [`src/renderer/src/components/navigation/`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/components/navigation/)
- Design Tokens Source: [`src/renderer/src/index.css`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/index.css)

---

## 1. COMPONENT ARCHITECTURE & PHILOSOPHY

The HELIOXEN UI architecture enforces a strict four-layer separation of concerns:

```
+---------------------------------------------------------------------------------------+
|                                    APPLICATION VIEW                                   |
|               (src/renderer/src/App.tsx — Representative Layout Validation)           |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         NAVIGATION & LAYOUT PRIMITIVES                                |
|  - NavRail (Collapsible vertical rail)         - Header (Region title, badges, actions)|
|  - AppContainer (Root viewport & bounds)       - ContentRegion (Scrollable container)  |
|  - Stack (Directional flex layout)             - useNavigation (State & fallback)     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                              REUSABLE UI PRIMITIVES                                   |
|  - Button (Primary, secondary, outline, danger) - IconButton (Accessible tooltips)     |
|  - Card (Panel, card, elevated surfaces)       - Badge (Nominal, warning, danger, info)|
|  - Input (Accessible form control & probe)     - Lucide React (Tree-shaken icons)     |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         DESIGN TOKENS (CSS & TAILWIND)                                |
|  - Deep Space Palette (#070a10, #0d121d)       - Neon Cyan (#00f0ff) & Orbital Blue   |
|  - WCAG 2.1 AA Contrast (> 4.5:1)              - Focus Rings & Reduced Motion Rules   |
+---------------------------------------------------------------------------------------+
```

### 1.1 Architectural Guarantees
1. **Zero Privileged Coupling:** All UI components exist entirely within the untrusted renderer process. Components never directly invoke Node.js, Electron runtime APIs, or raw shell tools.
2. **Design-Token Strictness:** Components strictly use the semantic tokens defined in Step 7 (`index.css` and `tailwind.config.js`). Hardcoded hex codes and magic pixel offsets are banned.
3. **Accessibility by Default:** Native semantic HTML (`<button>`, `<input>`, `<nav>`, `<header>`) is used exclusively. All interactive controls support keyboard focus with high-contrast cyan outlines.

---

## 2. REUSABLE UI COMPONENT INVENTORY

| Component | Source Path | Primary Props / Options | Supported States | Accessibility Features | Current Consumers | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`Button`** | `components/ui/Button.tsx` | `variant`: `primary`, `secondary`, `outline`, `ghost`, `danger`<br>`size`: `sm`, `md`, `lg`<br>`isLoading`: boolean<br>`leftIcon`, `rightIcon`: ReactNode<br>`fullWidth`: boolean | Default, Hover, Active, Disabled, Loading | Native `<button>`, `focus-visible` ring (`#00f0ff`), loading spinner with `aria-hidden` | `App.tsx`, `Header.tsx` | **IMPLEMENTED** |
| **`IconButton`** | `components/ui/IconButton.tsx` | `icon`: ReactNode<br>`aria-label`: string (Required)<br>`variant`: `ghost`, `secondary`, `primary`, `danger`<br>`size`: `sm`, `md`, `lg`<br>`isActive`: boolean<br>`tooltip`: string | Default, Hover, Active, Disabled | Mandatory `aria-label`, automatic `title`, high-contrast active indicator strip | `NavRail.tsx`, `App.tsx` | **IMPLEMENTED** |
| **`Card`** | `components/ui/Card.tsx` | `variant`: `default`, `panel`, `elevated`, `space`<br>`border`: `subtle`, `panel`, `glow`, `none`<br>`padding`: `none`, `sm`, `md`, `lg`<br>`isHoverable`: boolean | Static, Hover (if enabled) | Semantic `<div>` surface, high-contrast borders | `App.tsx` | **IMPLEMENTED** |
| **`Badge`** | `components/ui/Badge.tsx` | `variant`: `nominal`, `warning`, `danger`, `info`, `neutral`<br>`size`: `sm`, `md`<br>`isDot`: boolean (Pulsing dot)<br>`icon`: ReactNode | Static | Text + Color dual-coding (non-color dependence), `aria-hidden` decorative dot | `NavRail.tsx`, `Header.tsx`, `App.tsx` | **IMPLEMENTED** |
| **`Input`** | `components/ui/Input.tsx` | `label`: string<br>`helperText`: string<br>`errorMessage`: string<br>`leftIcon`, `rightIcon`: ReactNode | Default, Focused, Disabled, Error | Connected `<label htmlFor>`, `aria-invalid`, `aria-describedby` error/helper IDs, high-contrast focus ring | `App.tsx` | **IMPLEMENTED** |

---

## 3. LAYOUT PRIMITIVES

| Primitive | Source Path | Role & Responsibilities | Key Props |
| :--- | :--- | :--- | :--- |
| **`AppContainer`** | `components/layout/AppContainer.tsx` | Root desktop viewport container. Prevents horizontal/vertical overflow and establishes background. | `className`, `children` |
| **`Stack`** | `components/layout/Stack.tsx` | Directional Flexbox layout primitive for consistent spacing and alignment. | `direction`: `vertical` \| `horizontal`<br>`spacing`: `none` \| `xs` \| `sm` \| `md` \| `lg` \| `xl`<br>`align`: `start` \| `center` \| `end` \| `stretch`<br>`justify`: `start` \| `center` \| `end` \| `between`<br>`wrap`: boolean |
| **`Header`** | `components/layout/Header.tsx` | View/region header with title, subtitle, status badge slot, and action button slot. | `title`: string<br>`subtitle`: string<br>`statusBadge`: ReactNode<br>`actions`: ReactNode |
| **`ContentRegion`** | `components/layout/ContentRegion.tsx` | Main content container with controlled scrolling, padding, and overflow protection. | `scrollable`: boolean<br>`padding`: `none` \| `sm` \| `md` \| `lg` |

---

## 4. NAVIGATION FOUNDATION & STATE MANAGEMENT

### 4.1 Navigation Destinations

The navigation model distinguishes between **Active Foundation Destinations** and **Roadmap Destinations**:

```typescript
export type NavDestinationId =
  | 'core'           // [ACTIVE] Central Command Intelligence & Active Assistant
  | 'conversations'  // [ROADMAP] Threaded Dialogue History & Context Records
  | 'memory'         // [ROADMAP] Persistent Semantic Knowledge & Fact Store
  | 'skills'         // [ROADMAP] Installed Tools, Dynamic Skills & Manifests
  | 'character'      // [ROADMAP] Personality Archetypes & Voice Modulation
  | 'monitor'        // [ROADMAP] 3D World Globe & System Performance Telemetry
  | 'settings'       // [ROADMAP] Provider API Routes, Audio Devices & Security Vault
```

### 4.2 State Hook: `useNavigation`
- **Active Selection:** Local component-level state initialized to `'core'`.
- **Safe Fallback:** If `navigateTo()` receives an invalid or unknown string, it logs a warning and gracefully falls back to `'core'`.
- **Collapsible Rail State:** Manages `isExpanded` (width `w-16` / 64px collapsed, `w-56` / 224px expanded) with smooth transitions.

### 4.3 NavRail Component
- Renders primary navigation destinations (`core` through `monitor`) and bottom system destination (`settings`).
- Displays the official miniature HELIOXEN orbital brand logo.
- When collapsed: Renders compact icon buttons with accessible `title` tooltips.
- When expanded: Renders icon + label + roadmap badge.
- Active item indicator: Glowing neon cyan pill strip with subtle background highlight and `shadow-hx-glow-cyan-sm`.
- Native accessibility: Sets `aria-current="page"` on the active destination.

---

## 5. ACCESSIBILITY & USABILITY VALIDATION

1. **Keyboard Operability:** All buttons, navigation items, inputs, and toggles are fully navigable via `Tab` and activatable via `Enter` / `Space`.
2. **Focus Visibility:** Standard outlines are augmented with an intentional high-contrast Cyan ring (`focus-visible:ring-2 focus-visible:ring-hx-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-hx-space`).
3. **Contrast Compliance:** All text on UI primitives satisfies WCAG 2.1 AA (> 4.5:1 on dark surfaces).
4. **Honest Roadmap Indication:** Navigating to a roadmap destination renders an intentional status screen with `AlertTriangle` badge clearly declaring: *"Roadmap Milestone • Not Yet Implemented"*, with an instant one-click return button to `'core'`.

---

## 6. SCOPE BOUNDARY & EXTENSION GUIDANCE

- **Deferred Features:** The full 3-panel command dashboard, custom titlebar, 3D Three.js particle AI Core, voice dock, and streaming conversation views will build directly on these primitives during subsequent steps (Steps 9–12).
- **Prohibited Patterns:** No component should implement arbitrary shell commands, raw filesystem access, or external network calls.
