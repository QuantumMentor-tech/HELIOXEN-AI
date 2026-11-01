# HELIOXEN AI — Brand Identity, Logo Integration and Design Tokens

**Document ID:** `HELIOXEN-DES-001`  
**Version:** `1.0.0`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 3: Brand Identity and UI Foundation  
**Step:** Step 7 of 48 (HELIOXEN Brand Identity, Logo Integration and Design Tokens)  
**Status:** Approved Design Foundation Baseline  
**Date:** November 1, 2026  
**Authoritative Locations:**
- Design Tokens (CSS Variables): [`src/renderer/src/index.css`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/index.css)
- Framework Utility Bindings: [`tailwind.config.js`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/tailwind.config.js)
- Integrated Brand Asset: [`src/renderer/src/assets/brand/helioxen-orbital-logo.png`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/assets/brand/helioxen-orbital-logo.png)
- Electron Desktop Window Icon: [`resources/icon.png`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/resources/icon.png)

---

## 1. BRAND IDENTITY OVERVIEW & CREATIVE DIRECTION

**HELIOXEN AI** is an original, cinematic desktop AI command assistant combining conversational intelligence, real-time voice, multimodal vision, OS automation, persistent memory, and agent orchestration.

The visual direction synthesizes three complementary priorities:

```
+---------------------------------------------------------------------------------------+
|                              HELIOXEN BRAND IDENTITY SYNTHESIS                        |
+---------------------------------------------------------------------------------------+
|  [ SIMPLICITY & ERGONOMICS ]   [ CINEMATIC ATMOSPHERE ]        [ ORIGINAL BRAND IDENTITY ]|
|  Stonic AI Benchmark           JARVIS HUD Benchmark            HELIOXEN Clean-Room        |
|  - Calm 3-Panel Hierarchy      - Luminous Orbital Rings        - Original Orbital Emblem  |
|  - Central AI Core Focus       - Restrained Accent Glows       - Neon Cyan (#00f0ff)      |
|  - Zero Multi-Gauge Clutter    - Crisp High-Tech Typography    - Deep Orbital Blue        |
|  - Instant Voice Dock          - Subtle State Telemetry        - High Contrast (WCAG AA)  |
+---------------------------------------------------------------------------------------+
```

### 1.1 Core Principles
1. **Simplicity First:** The product prioritizes clean surfaces, disciplined spacing, and clear information hierarchy over visual noise. It avoids the "multi-gauge trap" of reference projects that overwhelm users with dense arrays of simultaneous dials.
2. **Controlled Cinematic Atmosphere:** Visual effects (orbital particles, accent glows, luminous borders) are reserved for purposeful communication—such as the Central AI Core operational state and voice activity—without sacrificing desktop responsiveness.
3. **100% Original Expression:** The visual identity is strictly anchored in original HELIOXEN assets. Zero trademarked logos, UI artwork, or proprietary code are copied from reference systems.

---

## 2. BRAND ASSET AUDIT & INTEGRATION INVENTORY

### 2.1 Discovered & Integrated Brand Assets

| Asset ID | Asset Name | Repository Location | Format & Dimensions | Intended Application Role | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ASSET-001` | **Futuristic Helioxen Orbital Logo** | `src/renderer/src/assets/brand/helioxen-orbital-logo.png`<br>`resources/icon.png`<br>`Futuristic Helioxen Orbital Logo.png` (root master preserved) | PNG Truecolor with Alpha (RGBA)<br>510 x 456 px<br>337,490 bytes | Official application brand emblem, desktop window icon, splash screen anchor, and 3D Central AI Core visual reference. | **INTEGRATED & VERIFIED** |
| `ASSET-002` | **Helioxen Symbol Logo (Transparent)** | To be derived from `ASSET-001` vector master | Isolated SVG / PNG symbol without outer glow | Compact navigation rail and system tray icon. | **PARTIAL (To be vector-authored)** |
| `ASSET-003` | **Helioxen Wordmark (Transparent)** | To be derived from project typography | Vector SVG text wordmark (`HELIOXEN`) | Horizontal header and titlebar wordmark. | **PARTIAL (To be vector-authored)** |
| `ASSET-004` | **Helioxen Combined Logo (Transparent)** | To be composed from `ASSET-002` + `ASSET-003` | Vector SVG combined lockup | About modal and release documentation. | **PARTIAL (To be vector-authored)** |

> [!NOTE]
> Per the project's Missing Logo Policy, unsupplied vector-isolated variants (`ASSET-002` through `ASSET-004`) are recorded as **PARTIAL** rather than fabricating unapproved replacements. The master `Futuristic Helioxen Orbital Logo.png` is fully integrated and functional.

---

## 3. DESIGN-TOKEN ARCHITECTURE

Design tokens are defined as **CSS Custom Properties** in [`src/renderer/src/index.css`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/src/renderer/src/index.css) as the single source of truth, and bound into [`tailwind.config.js`](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/tailwind.config.js) to provide immediate utility-first ergonomics.

### 3.1 Color Tokens & Semantic Roles

| Token Name | Tailwind Class | Value | Semantic Role | WCAG AA Contrast on `#070a10` |
| :--- | :--- | :--- | :--- | :--- |
| `--hx-color-bg-space` | `bg-hx-space` | `#070a10` | Deepest root canvas / desktop background | Baseline |
| `--hx-color-bg-panel` | `bg-hx-panel` | `#0d121d` | Navigation rail & right context panel | N/A (Surface) |
| `--hx-color-bg-card` | `bg-hx-card` | `#131b2a` | Content cards, dialogs, execution traces | N/A (Surface) |
| `--hx-color-bg-surface-elevated`| `bg-hx-surface-elevated` | `#182235` | Tooltips, popovers, floating badges | N/A (Surface) |
| `--hx-color-bg-hover` | `bg-hx-hover` | `#1c273c` | Interactive item hover state | N/A (State) |
| `--hx-color-bg-active` | `bg-hx-active` | `#23314d` | Interactive item pressed state | N/A (State) |
| `--hx-color-text-primary` | `text-hx-text-primary` | `#f3f4f6` | Headings, active values, high-priority text | **18.00:1 (Passes AAA)** |
| `--hx-color-text-secondary` | `text-hx-text-secondary` | `#9ca3af` | Body copy, labels, secondary metadata | **7.80:1 (Passes AAA)** |
| `--hx-color-text-muted` | `text-hx-text-muted` | `#768390` | Footers, timestamps, placeholders | **5.11:1 (Passes AA)** |
| `--hx-color-text-inverse` | `text-hx-text-inverse` | `#070a10` | Dark text on bright accent badges | **14.07:1 on Cyan** |
| `--hx-color-accent-cyan` | `text-hx-cyan` / `bg-hx-cyan` | `#00f0ff` | Primary brand accent, active orbital ring | **14.07:1 (Passes AAA)** |
| `--hx-color-accent-cyan-hover` | `bg-hx-cyan-hover` | `#33f3ff` | Hover state for cyan action triggers | **15.20:1** |
| `--hx-color-accent-sky` | `text-hx-sky` / `bg-hx-sky` | `#38bdf8` | Secondary speaking state, active wave | **9.25:1 (Passes AAA)** |
| `--hx-color-accent-blue` | `text-hx-blue` / `bg-hx-blue` | `#0055ff` | Core energy blue, orbital core sphere | Accent energy |
| `--hx-color-accent-deep-blue` | `bg-hx-deep-blue` | `#0b1e3f` | Core shadow, deep gradient anchor | Gradient base |
| `--hx-color-border-subtle` | `border-hx-border-subtle` | `rgba(56, 189, 248, 0.12)` | Subtle panel dividers & quiet borders | Structural |
| `--hx-color-border-panel` | `border-hx-border-panel` | `rgba(56, 189, 248, 0.22)` | Standard card borders & panel perimeters| Structural |
| `--hx-color-border-glow` | `border-hx-border-glow` | `rgba(0, 240, 255, 0.40)` | Active focus border, glowing indicator | Structural |
| `--hx-color-focus-ring` | `outline-hx-cyan` | `#00f0ff` | Keyboard focus ring indicator | Accessibility |
| `--hx-color-status-nominal` | `text-hx-nominal` / `bg-hx-nominal` | `#10b981` | Standby, connected, nominal health | **7.81:1 (Passes AAA)** |
| `--hx-color-status-warning` | `text-hx-warning` / `bg-hx-warning` | `#f59e0b` | Awaiting approval, degraded telemetry | **9.23:1 (Passes AAA)** |
| `--hx-color-status-danger` | `text-hx-danger` / `bg-hx-danger` | `#ef4444` | Security gate alert, error, offline | **5.26:1 (Passes AA)** |
| `--hx-color-status-info` | `text-hx-info` / `bg-hx-info` | `#00f0ff` | System advice, tips, hints | **14.07:1 (Passes AAA)** |

---

### 3.2 Typography Tokens

```css
/* Font Families */
--hx-font-family-display: 'Outfit', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--hx-font-family-body: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--hx-font-family-mono: 'JetBrains Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;

/* Type Scale */
--hx-font-size-xs: 0.75rem;     /* 12px - Badges, telemetry, timestamps */
--hx-font-size-sm: 0.875rem;    /* 14px - Compact labels, secondary info */
--hx-font-size-base: 1rem;      /* 16px - Standard body copy, inputs */
--hx-font-size-lg: 1.125rem;    /* 18px - Panel titles, modal headers */
--hx-font-size-xl: 1.25rem;     /* 20px - Section headings */
--hx-font-size-2xl: 1.5rem;     /* 24px - Primary assistant title */
--hx-font-size-3xl: 1.875rem;   /* 30px - Display banner */

/* Font Weights */
--hx-font-weight-normal: 400;
--hx-font-weight-medium: 500;
--hx-font-weight-semibold: 600;
--hx-font-weight-bold: 700;

/* Line Heights */
--hx-line-height-tight: 1.25;
--hx-line-height-snug: 1.375;
--hx-line-height-normal: 1.5;
--hx-line-height-relaxed: 1.625;
```

---

### 3.3 Spacing, Radius, and Elevation Tokens

```css
/* 4px/8px Regular Spacing Grid */
--hx-spacing-1: 0.25rem;  /* 4px  - Micro padding, icon gaps */
--hx-spacing-2: 0.5rem;   /* 8px  - Compact control padding */
--hx-spacing-3: 0.75rem;  /* 12px - Input padding, card gaps */
--hx-spacing-4: 1rem;     /* 16px - Standard component padding */
--hx-spacing-5: 1.25rem;  /* 20px - Card interior padding */
--hx-spacing-6: 1.5rem;   /* 24px - Panel margins */
--hx-spacing-8: 2rem;     /* 32px - Section spacing */
--hx-spacing-10: 2.5rem;  /* 40px - Layout gaps */
--hx-spacing-12: 3rem;    /* 48px - Primary viewport padding */

/* Corner Radii */
--hx-radius-sm: 0.25rem;   /* 4px  - Small badges, micro tags */
--hx-radius-md: 0.375rem;  /* 6px  - Buttons, inputs, chips */
--hx-radius-lg: 0.5rem;    /* 8px  - Cards, dialog panels */
--hx-radius-xl: 0.75rem;   /* 12px - Primary application panels */
--hx-radius-full: 9999px;  /* Pills, avatars, orbital indicators */

/* Elevation & Controlled Luminous Glows */
--hx-shadow-subtle: 0 2px 8px rgba(0, 0, 0, 0.4);
--hx-shadow-card: 0 4px 16px rgba(0, 0, 0, 0.55);
--hx-shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.7);
--hx-glow-cyan-sm: 0 0 10px rgba(0, 240, 255, 0.25);
--hx-glow-cyan-md: 0 0 20px rgba(0, 240, 255, 0.4);
--hx-glow-blue-md: 0 0 20px rgba(0, 85, 255, 0.4);
```

---

### 3.4 Motion, Reduced-Motion, and Layering Scale

```css
/* Transitions */
--hx-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--hx-transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--hx-transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);

/* Layering (Z-Index) */
--hx-z-base: 0;
--hx-z-elevated: 10;
--hx-z-sticky: 20;
--hx-z-dropdown: 30;
--hx-z-modal-backdrop: 40;
--hx-z-modal: 50;
--hx-z-toast: 60;
--hx-z-titlebar: 100;
```

#### Reduced-Motion Rule
To ensure full accessibility for users with vestibular sensitivities, `index.css` enforces:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 4. ACCESSIBILITY & WCAG 2.1 CONTRAST VERIFICATION

All color tokens were mathematically verified using the WCAG 2.1 relative luminance and contrast ratio formulas:

$$L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
$$\text{Contrast Ratio} = \frac{L_{\text{lighter}} + 0.05}{L_{\text{darker}} + 0.05}$$

### 4.1 Contrast Verification Results

| Foreground Element | Hex Code | Background Surface | Contrast Ratio | WCAG 2.1 Minimum Required | Compliance Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Text** | `#f3f4f6` | `#070a10` (Space) | **18.00:1** | 4.5:1 (AA) / 7.0:1 (AAA) | **PASS (AAA)** |
| **Primary Text** | `#f3f4f6` | `#0d121d` (Panel) | **16.63:1** | 4.5:1 (AA) / 7.0:1 (AAA) | **PASS (AAA)** |
| **Primary Text** | `#f3f4f6` | `#131b2a` (Card) | **14.28:1** | 4.5:1 (AA) / 7.0:1 (AAA) | **PASS (AAA)** |
| **Secondary Text** | `#9ca3af` | `#070a10` (Space) | **7.80:1** | 4.5:1 (AA) | **PASS (AAA)** |
| **Muted Text** | `#768390` | `#070a10` (Space) | **5.11:1** | 4.5:1 (AA) | **PASS (AA)** |
| **Neon Cyan Accent** | `#00f0ff` | `#070a10` (Space) | **14.07:1** | 3.0:1 (UI) / 4.5:1 (Text) | **PASS (AAA)** |
| **Nominal Status** | `#10b981` | `#070a10` (Space) | **7.81:1** | 3.0:1 (UI) / 4.5:1 (Text) | **PASS (AAA)** |
| **Warning Status** | `#f59e0b` | `#070a10` (Space) | **9.23:1** | 3.0:1 (UI) / 4.5:1 (Text) | **PASS (AAA)** |
| **Danger Status** | `#ef4444` | `#070a10` (Space) | **5.26:1** | 3.0:1 (UI) / 4.5:1 (Text) | **PASS (AA)** |
| **Focus Indicator** | `#00f0ff` | Surrounding Elements| High Visibility Cyan | 3.0:1 (Non-text) | **PASS** |

### 4.2 Accessibility Non-Color Independence
Semantic status cues (Nominal, Warning, Danger) are never conveyed via color alone; UI components in subsequent steps are required to provide accompanying status text (e.g., `STANDBY`, `AWAITING APPROVAL`, `ERROR`) and distinct icon shapes.

---

## 5. EXTENSION RULES & CONSUMPTION GUIDELINES

1. **Direct Utility Consumption:** Use Tailwind utility classes directly in React TSX (`bg-hx-space`, `text-hx-cyan`, `border-hx-border-subtle`, `shadow-hx-glow-cyan-sm`).
2. **Dynamic Styling / Shaders:** For dynamic canvas renders or Three.js materials, read CSS custom properties via `getComputedStyle(document.documentElement).getPropertyValue('--hx-color-accent-cyan')`.
3. **No Hardcoded Hex Values:** Hardcoded color hex codes or random pixel values are prohibited in component code; all visual styling must resolve through the design-token hierarchy.
4. **Preserve Scope Boundary:** This design token system is ready for subsequent UI steps. Do not prematurely build the final 3-panel command dashboard, custom titlebar, or Three.js particle core until their designated steps (Steps 8–12).
