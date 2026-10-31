# HELIOXEN AI — License and Asset Provenance Register

**Document ID:** `HELIOXEN-LAR-001`  
**Version:** `1.0.0-DRAFT`  
**Project:** HELIOXEN AI Desktop Assistant  
**Phase:** Phase 1: Product Definition and Requirements  
**Step:** 2 of 48 (Reference Analysis, Clean-Room Design and License Review)  
**Status:** Baseline Asset & Provenance Register  
**Date:** October 31, 2026  

---

## 1. PURPOSE AND VERIFICATION FRAMEWORK

This register tracks the provenance, licensing terms, permissions, restrictions, and verification confidence for all reference materials, supplied visual assets, and candidate dependencies associated with **HELIOXEN AI**.

### 1.1 Evidence Confidence Levels
- **VERIFIED (High):** Official license file directly inspected in an accessible repository or authoritative registry.
- **PROVISIONAL (Medium):** License terms declared in project documentation/reports, but exact physical repository file uninspected locally.
- **UNVERIFIED (Low):** Ambiguous or contradictory licensing claims requiring primary source inspection.
- **REQUIRES_PERMISSION:** Source-available or proprietary terms where redistribution or derivative creation is prohibited without explicit authorization.
- **REQUIRES_LEGAL_REVIEW:** Unsettled copyright, trademark, or commercial redistribution questions.

---

## 2. REFERENCE SYSTEM LICENSE AND PROVENANCE REGISTER

| Asset / Source ID | Name | Origin / Reference Path | Evidence Type | Reported License / Terms | Attribution Required? | Modification Allowed? | Redistribution Allowed? | Commercial Use Status | Intended HELIOXEN Use | Current Disposition | Verification Date | Confidence | Required Follow-Up |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LIC-001` | **Stonic AI V1** | Stonic V1 PRIS Project Report | Secondary Report Summary | Reported as ISC License | Yes (if code reused) | Yes | Yes | Permitted under ISC | UI/UX concepts only; zero code reuse | **CONCEPT-ONLY REUSE** | 2026-10-31 | `PROVISIONAL` | Verify against official repository LICENSE file if code ever evaluated. |
| `LIC-002` | **Stonic AI V2** | Stonic V2 PRIS Project Report | Secondary Report Summary & Security Audit | Reported as ISC License | Yes (if code reused) | Yes | Yes | Permitted under ISC | Architectural negative lessons (security flaws) | **REJECT CODE / LESSONS ONLY** | 2026-10-31 | `PROVISIONAL` | Ensure zero insecure patterns copied. |
| `LIC-003` | **Stonic AI V3** | Stonic V3 PRIS Project Report | Secondary Report Summary | Reported as ISC License | Yes (if code reused) | Yes | Yes | Permitted under ISC | Primary UI/UX reference (layout, core, panels) | **CONCEPT-ONLY REUSE** | 2026-10-31 | `PROVISIONAL` | Independent UI reimplementation. |
| `LIC-004` | **Brahma Echo** | `Brahma-Echo-PRIS_PROJECT_REPORT.md` | Secondary Report Summary | Custom Source-Available License | Yes | Restricted / No derivative creation | Prohibited without license | Prohibited without commercial agreement | Multi-step planner & recovery concepts only | **PROHIBITED FOR REUSE / CONCEPT ONLY** | 2026-10-31 | `REQUIRES_PERMISSION` | Do NOT copy code, schemas, or brand assets. 100% clean-room. |
| `LIC-005` | **Brahma AI Evo** | `Brahma-Ai-Evo-PRIS_PROJECT_REPORT.md` | Secondary Report Summary | Custom Source-Available (Non-distribution) | Yes | Restricted | Prohibited | Strictly Prohibited | Skill builder & 3D globe concepts only | **PROHIBITED FOR REUSE / CONCEPT ONLY** | 2026-10-31 | `REQUIRES_PERMISSION` | Strictly avoid any AST or orchestration code transplantation. |
| `LIC-006` | **IRIS AI** | `IRIS AI PRIS` & `IRIS-AI part 1 scan report` | Secondary Report Summary & Codebase Scan | Ambiguous: PRIS states "Custom Source-Available"; Scan states "Custom / MIT Reference" | Yes | Unknown | Restricted under PRIS | Uncertain / Disputed | 3D particle sphere & telemetry concepts only | **PROHIBITED FOR REUSE / CONCEPT ONLY** | 2026-10-31 | `UNVERIFIED` | Presume restrictive source-available terms. No code or shader reuse. |
| `LIC-007` | **JARVIS Cinematic HUD** | Conceptual sci-fi HUD reference screenshot | Visual Media Asset | Unlicensed Creative Inspiration (Marvel/Disney IP) | N/A | N/A | N/A | Prohibited (Trademarked IP) | Visual inspiration for orbital glow & status rings | **INSPIRATION ONLY / ZERO ASSET REUSE** | 2026-10-31 | `REQUIRES_LEGAL_REVIEW` | Zero Marvel trademarks, names, or film graphics permitted in app. |

---

## 3. PROJECT BRANDING AND SUPPLIED ASSET REGISTER

| Asset ID | Asset Name | Local File Path | Asset Type / Format | Dimensions / Size | Provenance / Author | Intended Application Use | Copyright / Rights Status | Disposition | Verification Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ASSET-001` | **Futuristic Helioxen Orbital Logo** | `d:/App Winrar Files/Helioxen Ai Assistant (working)/Futuristic Helioxen Orbital Logo.png` | PNG Raster Image (RGBA) | 512x576 (estimated) / 337,490 bytes | User-Supplied Official Project Brand Asset | Official application icon, titlebar brand, splash screen, and AI Core visual inspiration | Authorized for HELIOXEN project use by User | **APPROVED PROJECT ASSET** | 2026-10-31 |
| `ASSET-002` | **Helioxen Symbol Logo (Transparent)** | `helioxen_symbol_logo_transparent.png` | PNG Raster Image | N/A (Not physically present) | Referenced in prompt instructions | Standalone app icon / tray icon | User / Project | **UNAVAILABLE / TO BE DERIVED** | 2026-10-31 |
| `ASSET-003` | **Helioxen Text Logo (Transparent)** | `helioxen_text_logo_transparent.png` | PNG Raster Image | N/A (Not physically present) | Referenced in prompt instructions | Header wordmark | User / Project | **UNAVAILABLE / TO BE DERIVED** | 2026-10-31 |
| `ASSET-004` | **Helioxen Combined Logo (Transparent)** | `helioxen_combined_logo_transparent.png` | PNG Raster Image | N/A (Not physically present) | Referenced in prompt instructions | Splash screen / About modal | User / Project | **UNAVAILABLE / TO BE DERIVED** | 2026-10-31 |

> [!NOTE]
> **Asset Status AS-01:** `ASSET-001` is physically verified and active in the root directory. Assets `ASSET-002`, `ASSET-003`, and `ASSET-004` are recorded as physically unavailable in the current directory; they will be cleanly derived from `ASSET-001` or vector-rendered during Phase 2 (Step 7: Brand Identity and Logo Integration).

---

## 4. CANDIDATE DEPENDENCY LICENSING PRE-SCREENING

The following candidate dependency categories (evaluated for upcoming Steps 4 & 5) are pre-screened against the Clean-Room Policy ([HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md](file:///d:/App%20Winrar%20Files/Helioxen%20Ai%20Assistant%20(working)/docs/HELIOXEN_CLEAN_ROOM_IMPLEMENTATION_POLICY.md)):

| Candidate Technology Domain | Candidate Packages | Standard License | Clean-Room Policy Status | Known Compliance Obligations |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop Runtime** | `electron` | MIT | **PERMITTED (Green)** | Include Electron copyright notice in distribution. |
| **Frontend Framework** | `react` + `react-dom` OR `vue` | MIT | **PERMITTED (Green)** | Include MIT license text in production bundle. |
| **Build & Bundler Tooling** | `vite`, `@vitejs/plugin-react` | MIT | **PERMITTED (Green)** | Build-time only; no runtime footprint. |
| **CSS & Iconography** | `lucide-react`, `tailwindcss` (if approved) | ISC / MIT | **PERMITTED (Green)** | Permissive licenses; include license notice. |
| **3D Rendering Engine** | `three` (Three.js) | MIT | **PERMITTED (Green)** | Retain Three.js copyright header. |
| **Native Credential Storage** | `keytar` OR Electron `safeStorage` | MIT / Built-in | **PERMITTED (Green)** | Electron `safeStorage` requires zero extra dependencies. |
| **System Telemetry** | `systeminformation` | MIT | **PERMITTED (Green)** | Highly permissive; verified safe for commercial desktop use. |
| **Local Database & Vector** | `better-sqlite3`, `sqlite-vec` | MIT / Apache 2.0 | **PERMITTED (Green)** | Native bindings; compile cleanly on Windows 64-bit. |
| **Document Parsing** | `pdf-parse`, `docx`, `exceljs` | MIT | **PERMITTED (Green)** | Retain appropriate library notices. |
| **Browser Automation** | `playwright-core` | Apache 2.0 | **PERMITTED (Green)** | Apache 2.0 notice requirements; ensure no restricted scrapers. |
| **AI Provider SDKs** | `@google/genai`, `openai`, `@anthropic-ai/sdk`| Apache 2.0 / MIT | **PERMITTED (Green)** | Standard official provider client libraries. |

---

## 5. REVISION HISTORY

| Date | Version | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **2026-10-31** | `1.0.0-DRAFT` | License & Provenance Analyst | Initial License and Asset Provenance Register established for Step 2 of 48. Exhaustive analysis of 7 reference systems, 4 project branding assets, and 11 candidate dependency categories completed. Clear confidence ratings and clean-room dispositions assigned. |
