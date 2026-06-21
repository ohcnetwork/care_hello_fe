---
name: care-plugin-builder
description: Use when building a feature for CARE (ohcnetwork/care_fe) as a plugin — adding a route, a component slot, nav items, or an authenticated API call to the EMR via the care_hello_fe template. Encodes the plugin manifest contract, the self-contained federated-remote model, window-global host services, the vendored request layer, in-tree vs standalone integration, and the verify-before-ship checklist.
---

# Building CARE plugins

A CARE plugin adds a feature to the CARE EMR (`ohcnetwork/care_fe`, the **host**) without
modifying the host. Use this skill when the task is "add X to CARE as a plugin": a new
route/page, a button or widget in an existing screen (a component slot), nav-menu items,
or a screen that reads/writes the backend API. Start from the `care_hello_fe` template.

## 1. Mental model

A CARE plugin is a **self-contained federated React remote**. Internalize these properties
before writing any code:

- **Plugins do NOT import host source at compile time.** The plugin builds completely
  independently of `care_fe`. It integrates only at runtime, via Module Federation +
  `window` globals.
- **The integration surface is `./manifest`.** The plugin exposes `src/manifest.tsx` as
  `./manifest` via federation (building `remoteEntry.js`). The host loads it, unwraps the
  ES **default export**, and **duck-types** it as `PluginManifest`. There is no
  compile-time validation across the boundary — getting the shape wrong fails silently at
  runtime, which is why the "Source of truth" section and the verify-step matter.
- **Host services are reached through `window` globals — never imports.** The host sets
  `window.CARE_API_URL`, `window.AuthUserContext`, `window.__CORE_ENV__`, and
  `window.__CARE_PLUGIN_RUNTIME__.meta` in `care_fe/src/index.tsx`. Read auth with
  `React.useContext(window.AuthUserContext)` (works because `react` is a shared singleton,
  so the plugin tree renders inside the host's `AuthUserProvider`).
- **The data layer is vendored, not imported.** Plugins ship their own `query`/`mutate`/
  `request` trio (`src/lib/requests.ts`) that builds URLs from `window.CARE_API_URL` and
  reads the JWT from `localStorage` (`care_access_token`). It mirrors the API of the host's
  `@/Utils/request/{query,mutate}.ts` but is a standalone reimplementation. Do **not** try
  to `clone-component` the host's request utils.
- **Reuse host components with `clone-component`.** `npm run clone-component` (run from
  `care_fe`) copies a host component plus its transitive imports into the plugin and
  rewrites aliases. Cloned files are independent copies that will not stay in sync.
- **Two integration modes** (details in `references/integration-and-deploy.md`):
  - *In-tree dev (recommended):* the plugin lives at `care_fe/apps/<slug>/`. The host's
    `npm run dev` auto-discovers `apps/*/src/manifest.tsx` and serves it through the host
    Vite graph with full HMR.
  - *Standalone remote (production):* `npm run build` → `dist/assets/remoteEntry.js`,
    enabled via `REACT_ENABLED_APPS` and/or the backend `plug_config` API.
- **`@/` is the plugin's own `src/`.** Inside a plugin, the `@/*` alias resolves to the
  plugin's `src/`, never to the host. This holds in both integration modes.

## 2. Source of truth — read this before touching a manifest

The authoritative contract is **`care_fe/src/pluginTypes.ts`** (`PluginManifest`,
`SupportedPluginComponents`, and the per-slot prop types). **Always read it before writing
or changing a manifest.** Never invent or guess slot props — the host injects exactly the
props declared there (plus an extra `__meta`), and a wrong prop name is a silent runtime
break, not a compile error across the federation boundary.

This template vendors a trimmed mirror at **`src/types/pluginManifest.ts`** so the manifest
type-checks (`const manifest: PluginManifest`). That mirror is a *snapshot* — when you use a
new slot or extension point, copy its exact prop type from `care_fe/src/pluginTypes.ts` into
`src/types/pluginManifest.ts`, then use it. `references/manifest-contract.md` reproduces all
17 slots as a quick reference, but it too is a snapshot: the host file wins.

## 3. Workflow

1. **Scaffold** from the `care_hello_fe` template (clone, `npm install`).
2. **Pick the extension point** (route, component slot, nav menu, encounter/org tab,
   device, override) and **read its exact type in `care_fe/src/pluginTypes.ts`**.
3. **Implement** the page/component — use the copy-paste patterns in
   `references/recipes.md`; for API access use the vendored `src/lib/requests.ts`.
4. **Mirror any new host type** you depend on into `src/types/pluginManifest.ts` (slot prop
   type, or a minimal structural type for a rich host type like `EncounterRead`).
5. **Wire the manifest** in `src/manifest.tsx` (`const manifest: PluginManifest = …`).
   Every `components`/`encounterTabs` entry must be `React.lazy(() => import(...))`.
6. **Develop in-tree** by copying the plugin into `care_fe/apps/<slug>/` (a **real**
   directory — symlinks are not discovered) and running the host's `npm run dev` for HMR.
7. **Run the verify-step** (see the "Verify-step" section).
8. **Build** the standalone remote: `npm run build` → `dist/assets/remoteEntry.js`.
9. **Enable** via `REACT_ENABLED_APPS` and/or the backend `plug_config` API
   (`references/integration-and-deploy.md`).

## 4. Verify-step (run before claiming done)

- [ ] `npx tsc -b` passes. (The vendored `PluginManifest` typing turns manifest-shape
      drift into a compile error — this is the primary gate.)
- [ ] Every entry in `components` and `encounterTabs` is wrapped in `React.lazy()`. A
      non-lazy slot/tab component fails to render under the host's `Suspense`.
- [ ] `federation.shared` (in `vite.config.ts`) includes **every host singleton** the
      plugin imports — at minimum the subset of `react, react-dom, react-i18next,
      @tanstack/react-query, raviger` it actually uses. Diff against the host's
      `care_fe/vite.config.mts`. A missing singleton causes a `"Should have a queue"`
      hook-order crash at runtime.
- [ ] `manifest.plugin` === the plugin slug === `federation.name`.
- [ ] When enabling standalone, `meta.url` is a valid **absolute** URL (an invalid URL
      makes the host skip the plugin with only a console error).
- [ ] `npm run build` emits `dist/assets/remoteEntry.js`.

## 5. Gotchas (silent failures)

These fail quietly — no thrown error reaches the user. Check them when a plugin "does
nothing":

- **Invalid / non-URL `meta.url` -> the plugin is skipped** (console error only, app keeps
  running).
- **401/403 from `GET /api/v1/plug_config/` is swallowed silently -> no API plugins load**
  (build-time plugins still load).
- **Manifests/overrides only apply after the config fetch finishes** (`isLoading: false`).
- **Overrides only work on components wrapped with `register()`** (host
  `src/lib/override/`). An override targeting an unregistered component is a no-op.
- **`device.type` must exactly equal the backend `device.care_type`**, or the device
  manifest is never matched.
- **Manifest objects are deep-frozen** by the host — no runtime mutation.
- **Slot/tab components not wrapped in `React.lazy()`** cause render failures.

## 6. References

Read these on demand:

- `references/manifest-contract.md` — full `PluginManifest` field list + all 17 component
  slots with exact prop types (snapshot of `care_fe/src/pluginTypes.ts`).
- `references/recipes.md` — copy-paste recipes: a route, a component slot, the 4 nav menus,
  an authenticated API call.
- `references/data-and-auth.md` — `window` globals, the vendored request pattern, auth via
  `window.AuthUserContext`, `clone-component` usage.
- `references/integration-and-deploy.md` — in-tree `apps/` dev vs standalone
  `remoteEntry.js`, `REACT_ENABLED_APPS` formats, backend `plug_config`, shared-dep parity.
- `references/advanced-extension-points.md` — encounter tabs, organization tabs, devices,
  overrides: orientation + pointers to `care_fe/src/pluginTypes.ts` and the host docs.
