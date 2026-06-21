# Design: CARE plugin-authoring skill + template refresh

**Date:** 2026-06-21
**Repos touched:** `care_hello_fe` (template + skill, primary), `care_fe` (host doc refresh)
**Status:** Approved design → ready for implementation plan

---

## 1. Problem

CARE supports micro-frontend **plugins** loaded into the `care_fe` host via Module
Federation. `care_hello_fe` is the official starter template, but it has drifted out
of sync with the host and contains two runtime-breaking bugs. Separately, there is no
guided, repeatable way to build a new plugin feature — the knowledge lives scattered
across `care_fe/src/pluginTypes.ts`, `PluginEngine.tsx`, three partially-stale docs,
and the real plugin repos.

Two deliverables:

1. **Update `care_hello_fe`** to match the host contract and **document the plugin
   internals from `care_fe` correctly**.
2. **Create a Claude Code skill** (living in `care_hello_fe`) that can build any
   common feature on CARE via plugins.

---

## 2. Ground truth: how CARE plugins actually work

Verified against the host (`care_fe`) and a real, shipping plugin
(`care_analytics_fe`). This is the model the template and skill must encode.

A CARE plugin is a **self-contained federated React remote**. The defining property:

> **Plugins do NOT import host source at compile time.** They are built completely
> independently of `care_fe` and integrate at runtime via Module Federation + `window`
> globals.

### 2.1 Manifest contract (the integration surface)

- The plugin exposes `./manifest` → `src/manifest.tsx` via federation, building
  `remoteEntry.js`.
- The host loads it with `getFederationRemote(slug, "./manifest")`, unwraps the ES
  **default export**, and **duck-types** it as `PluginManifest`. There is no
  compile-time validation across the boundary.
- Authoritative shape: `care_fe/src/pluginTypes.ts` → `PluginManifest`:
  `plugin`, `routes?`, `extends?`, `navItems?`, `billingNavItems?`, `userNavItems?`,
  `adminNavItems?`, `organizationTabs?`, `components?`, `encounterTabs?`, `devices?`,
  `overrides?`.
- Every component in `components` / `encounterTabs` **must** be wrapped in
  `React.lazy()` — the host renders them under `Suspense` + `PluginErrorBoundary`.
- The host injects an extra `__meta?: PlugConfigMeta` prop into every component slot.

### 2.2 Component slots (17 total) — `SupportedPluginComponents`

`DoctorConnectButtons, Scribe, PatientHomeActions, PatientInfoCardQuickActions,
EncounterActions, PatientInfoCardMarkAsComplete, FacilityHomeActions,
PatientRegistrationForm, PatientDetailsTabDemographyGeneralInfo,
InvoiceRecordPaymentOptions, PatientSearchActions, PatientInfoCardActions,
ServiceRequestAction, EncounterOverviewTop, DiagnosticReportOverride,
PatientHomeQuickActions, DeliveryOrderActions`.

Each has an exact prop type in `pluginTypes.ts`. Example (the one the template uses):
`PatientInfoCardQuickActions = React.FC<{ encounter: EncounterRead; className?: string }>`.

### 2.3 How a plugin reaches host services (runtime, via `window` — never imports)

Set by the host in `care_fe/src/index.tsx`:

- `window.CARE_API_URL` — backend API base (`careConfig.apiUrl`).
- `window.AuthUserContext` — `React.useContext(window.AuthUserContext)` for auth
  (`user`, `signIn`, `signOut`). Works because `react` is a shared singleton, so the
  plugin tree renders inside the host's `AuthUserProvider`.
- `window.__CORE_ENV__` — full `careConfig`.
- `window.__CARE_PLUGIN_RUNTIME__.meta` — frozen `Record<slug, PlugConfigMeta>`.

### 2.4 Data layer — vendored, not imported

Real plugins vendor their own request helper (`care_analytics_fe/src/lib/requests.ts`):
a `query`/`mutate`/`request` trio that builds URLs from `window.CARE_API_URL`, reads
the JWT from `localStorage` (`care_access_token`), and plugs into TanStack Query
(`useQuery({ queryFn: query(route, opts) })`, `useMutation({ mutationFn: mutate(route) })`).
It **mirrors the API** of the host's `@/Utils/request/{query,mutate}.ts` but is a
**standalone reimplementation** — it defines its own `HttpError`, `apiRoutes`, `Type<T>`,
`HttpMethod`, etc. The template must vendor a fresh file; do **not** expect
`clone-component` of the host's request utils to reproduce it.

### 2.5 Reusing host components — `clone-component`

The host ships `care_fe/scripts/clone-component.ts` (`npm run clone-component -- <source>
<target-app> [--dry-run|--force]`). It walks the import graph of a host component,
copies every transitively-imported file into `apps/<target-app>/src/`, and rewrites
aliases: `@core/foo → @/foo`, `@careConfig → @/care.config` (+ copies the shim), `@/foo`
left as-is (plugins use the same `@/*` alias for their own `src/`). External bare imports
are reported for manual `package.json` addition. Cloned files are independent copies.

### 2.6 Two integration modes

- **In-tree dev (recommended for development):** plugin lives at `care_fe/apps/<slug>/`.
  Host `npm run dev` auto-discovers `apps/*/src/manifest.tsx` (via
  `localPluginDevSupport()` in `care_fe/vite.config.mts`), loads it through the host Vite
  graph with full HMR, rewrites the plugin's `@/` imports to `/@fs/` plugin paths, and
  serves the plugin's `public/` from `/local-plugins/<slug>`. No build loop, no separate
  server.
- **Standalone remote (production + remote-style testing):** `npm run build` →
  `dist/assets/remoteEntry.js`, served on a preview port or GitHub Pages. Enabled via
  `REACT_ENABLED_APPS=org/repo` (defaults to `https://{org}.github.io/{repo}`) or
  `org/repo@host/path/to/remoteEntry.js` (e.g.
  `ohcnetwork/care_hello_fe@localhost:4173/assets/remoteEntry.js`), and/or the backend
  `GET /api/v1/plug_config/` API. Build-time + API configs are merged by
  `mergePlugConfigs()`; build-time wins on conflicts and is `isReadOnly`.

### 2.7 Shared-dependency parity (the #1 footgun)

The plugin's `federation.shared` must include every host **singleton** the plugin
consumes, or React/router/query context breaks at runtime with `"Should have a queue"`
hook-order errors (duplicate module instances). Host shares:
`react, react-dom, react-i18next, @tanstack/react-query, raviger, sonner, decimal.js`
(and dedupes `i18next`). `care_analytics_fe` shares the subset it uses:
`react, react-dom, react-i18next, @tanstack/react-query, raviger`. `react` + `react-dom`
go in `peerDependencies`.

### 2.8 Silent-failure gotchas (must be in the skill)

- Invalid / non-URL `meta.url` → plugin skipped (console error only).
- `401/403` from `plug_config` → swallowed silently → no plugins load.
- Manifests/overrides only apply after `isLoading: false`.
- Overrides only work on components wrapped with `register()` (`care_fe/src/lib/override`).
- `device.type` must exactly equal the backend `device.care_type`.
- Manifest objects are deep-frozen — no runtime mutation.
- Slot/tab components not wrapped in `React.lazy()` → render failures.

---

## 3. What's broken in `care_hello_fe` today

| # | Area | Current (template) | Expected (host) | Severity |
|---|------|--------------------|-----------------|----------|
| 1 | `PatientInfoCardQuickActions` props | `{ encounter: {id}, patientId, facilityId }` (`src/components/Button.tsx`, `src/manifest.tsx`) | `{ encounter: EncounterRead, className? }` + injected `__meta` | **breaking** |
| 2 | `federation.shared` | `[react, react-dom, react-i18next]` but uses `raviger` + `@tanstack/react-query` | must add `@tanstack/react-query`, `raviger` | **breaking** (hook crash) |
| 3 | Manifest typing | hand-rolled local `Manifest` interface (drift undetected) | mirror host `PluginManifest` | outdated |
| 4 | `raviger` | `^5.0.0-2` (prerelease) | host `^5.3.0` | outdated |
| 5 | `@originjs/vite-plugin-federation` | `^1.4.1` | host build `^1.3.7` (note: `care_analytics_fe` runs `^1.4.0`; anchor to the **host**) | cosmetic |
| 6 | build target | `esnext` / TS `ES2020` | host `es2022` | cosmetic |
| 7 | `federation.name` | `"care_hello"` | should equal slug `"care_hello_fe"` | cosmetic |
| 8 | data layer | none | vendored `src/lib/requests.ts` | gap |
| 9 | dev workflow | `vite preview & vite build --watch` only | document in-tree apps/ HMR as primary | outdated |

---

## 4. Design

### 4.1 Deliverable A — fix `care_hello_fe` into a minimal-correct template

Goal: a clean "hello world" that is **correct** and demonstrates the real patterns —
**not** a kitchen sink. One route + one component slot, done right.

- **`src/manifest.tsx`** — type as the vendored `PluginManifest` (see 4.4); correct the
  `PatientInfoCardQuickActions` slot; set `plugin: "care_hello_fe"`.
- **`src/components/Button.tsx`** — signature `React.FC<{ encounter: EncounterRead;
  className?: string }>`; drop `patientId`/`facilityId`; tolerate optional `__meta`.
- **`vite.config.ts`** — `federation.name: "care_hello_fe"`; `shared:
  [react, react-dom, react-i18next, @tanstack/react-query, raviger]`; `build.target:
  "es2022"`; keep `exposes { "./manifest": "./src/manifest.tsx" }`, `filename:
  "remoteEntry.js"`.
- **`package.json`** — `raviger ^5.3.0`, `@originjs/vite-plugin-federation ^1.3.7`,
  align `react-i18next`/`lucide-react` to host ranges; `react`/`react-dom` stay
  `peerDependencies`. Document that the `dev`/`build` scripts cover the standalone mode
  and that in-tree dev runs from the host.
- **`src/lib/requests.ts`** — vendored `query`/`mutate`/`request` (the canonical pattern,
  reading `window.CARE_API_URL` + `localStorage` token). **`src/lib/utils.ts`** —
  `cn()` + `sleep()`.
- **`tsconfig*`** — target `es2022`; keep `@/*` → plugin `./src/*`.
- **`README.md`** — rewrite (see 4.3).
- One small **example authenticated query** wired into the Hello page to exercise
  `requests.ts` + TanStack Query end-to-end (kept minimal).

### 4.2 Deliverable B — the skill at `care_hello_fe/.claude/skills/care-plugin-builder/`

A Claude Code skill (SKILL.md + `references/`) authored with the
`superpowers:writing-skills` skill. Scope = **common subset** (routes, component slots,
nav items, authenticated API), with advanced points as pointers.

**`SKILL.md`** (the always-loaded core):
- **When to use** + the mental model from §2 (self-contained remote, duck-typed
  manifest, `window` globals, two modes).
- **Source of truth**: always read `care_fe/src/pluginTypes.ts` before writing a
  manifest; never invent slot props.
- **Workflow**: scaffold from template → choose extension point → implement →
  wire manifest → dev via `care_fe/apps/<slug>/` (HMR) → **verify** → build →
  enable (`REACT_ENABLED_APPS` / backend `plug_config`).
- **Verify step**: diff manifest usage + `federation.shared` parity against the host;
  confirm every slot/tab component is `React.lazy()`; confirm `meta.url` validity.
- **Gotchas** = the §2.8 list.

**`references/`** (loaded on demand):
- `manifest-contract.md` — full `PluginManifest` + all 17 slot names with exact props
  (mirrored from `pluginTypes.ts`, with a "verify against host" banner).
- `recipes.md` — copy-paste recipes for the common subset: a route, a component slot,
  the 4 nav menus, an authenticated API call (vendored `requests.ts` + `clone-component`
  for host types/route objects).
- `data-and-auth.md` — `window` globals, the vendored request pattern, auth via
  `window.AuthUserContext`, `clone-component` usage.
- `integration-and-deploy.md` — in-tree apps/ dev vs standalone remoteEntry,
  `REACT_ENABLED_APPS` formats, backend `plug_config` enablement, shared-dep parity.
- `advanced-extension-points.md` — encounter tabs, organization tabs, devices,
  overrides: short orientation + pointers to `pluginTypes.ts` and the host docs.

### 4.3 `care_hello_fe/README.md` rewrite

Authoritative template usage: what a plugin is, the two integration modes with exact
commands, the `window` globals table, the `clone-component` workflow, `REACT_ENABLED_APPS`
formats, backend `plug_config` enablement, and the shared-dep parity warning. Points to
the skill for building features and to `care_fe/src/pluginTypes.ts` as the contract.

### 4.4 Manifest typing strategy (best-maintainable, hybrid)

- Vendor **one small** `care_hello_fe/src/types/pluginManifest.ts` mirroring the host's
  `PluginManifest` + only the slot prop types the template uses. For rich host types
  (`EncounterRead`), use a **minimal structural type** covering just the fields used,
  each with a comment naming the canonical host type. Header banner: "Mirror of
  `care_fe/src/pluginTypes.ts` — keep in sync; the skill's verify-step checks this."
- The template's `manifest.tsx` is typed `const manifest: PluginManifest`, giving
  **compile-time** drift detection on the manifest shape (directly fixing the original
  "silent drift" complaint).
- The skill's verify-step is the runtime/author-time safety net; `clone-component` is
  the escape hatch when a plugin needs a full host type.

### 4.5 Deliverable C — refresh host docs in `care_fe/docs/`

- `care-apps-local-dev.md` — rewrite the stale "Dev-Mode Local Discovery **Plan**"
  section to describe the **shipped** `apps/` auto-discovery (`localPluginDevSupport`),
  and correct the `dev` workflow guidance.
- `care-apps-architecture-note.md` — light touch; already accurate. Add the
  `window`-globals + clone-component cross-references if missing.
- `care-apps-override-architecture.md` — add a header noting it is a design-intent doc
  and pointing to the shipped implementation in `src/lib/override/`.

---

## 5. Out of scope / follow-ups (PR comments, not this change)

- **Host publishes `@ohcnetwork/care-plugin-types`** — the real ecosystem fix so every
  plugin stops re-vendoring host types. Flag as the recommended next step.
- Kitchen-sink examples for advanced extension points (encounter tabs, org tabs,
  devices, overrides) as living code — deferred; covered as pointers in the skill.
- No i18n namespace deep-dive beyond noting `react-i18next` must be shared.

---

## 6. Verification

- `care_hello_fe`: `npm run build` produces `dist/assets/remoteEntry.js` cleanly;
  `tsc -b` passes with the vendored `PluginManifest` typing (manifest type-checks).
- In-tree: symlink/checkout the plugin into `care_fe/apps/care_hello_fe`, run host
  `npm run dev`, confirm `/hello` route + the `PatientInfoCardQuickActions` button render
  with no console hook errors.
- Standalone: `REACT_ENABLED_APPS=ohcnetwork/care_hello_fe@localhost:4173/assets/remoteEntry.js`
  loads the plugin against a running host.
- Skill: dry-run the workflow on a throwaway feature (e.g. a new nav item + route) and
  confirm the recipes + verify-step catch a deliberately-wrong slot prop.

---

## 7. Decisions locked

| Decision | Choice |
|----------|--------|
| Local-dev / integration model | In-tree `apps/<slug>/` for dev; `remoteEntry.js` for prod |
| Extension-point scope | Common subset (routes, slots, nav, API); advanced = pointers |
| Skill location | `care_hello_fe/.claude/skills/care-plugin-builder/` |
| Template strategy | Minimal correct template + rich skill |
| Manifest typing | Vendored trimmed `pluginManifest.ts` + skill verify-step (hybrid) |
| Host docs | Refresh `care_fe/docs/` to match shipped reality |
