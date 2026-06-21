# Integration & deploy

How a plugin gets loaded into the host — during development (in-tree) and in production
(standalone remote). Plus the one footgun that breaks everything: shared-dependency parity.

> Host doc: `care_fe/docs/care-apps-local-dev.md` is the authoritative host-side writeup of
> local dev and `clone-component`. Read it alongside this file.

## 1. In-tree dev (recommended for development)

The host's Vite config (`care_fe/vite.config.mts`) ships a `localPluginDevSupport()` plugin
that **auto-discovers** plugins placed under `care_fe/apps/`. No separate build, no preview
server, full HMR — the plugin's source is served through the host's own Vite graph.

### How discovery works

- On host `npm run dev`, `getLocalPluginDefinitions()` reads `care_fe/apps/`, keeps every
  **directory** that contains `src/manifest.tsx`, and emits a virtual module
  `virtual:care-local-plugins` that imports each `apps/<slug>/src/manifest.tsx` as a default
  export. `PluginEngine` consumes that module; no `REACT_ENABLED_APPS` entry is needed for
  in-tree plugins.
- The plugin's `@/…` imports are rewritten on the fly to `/@fs/<abs-path>` pointing at the
  **plugin's own `src/`** (`rewriteLocalPluginImports`), so `@/` stays the plugin's source,
  not the host's.
- The plugin's `public/` is served at **`/local-plugins/<slug>/…`** by a dev middleware.
  Reference plugin assets via that prefix, not a bare `/`.
- Adding/removing an `apps/<slug>/src/manifest.tsx` triggers a full reload (the watcher
  invalidates the virtual module). Editing plugin source HMRs normally.

### Must be a REAL directory — not a symlink

`getLocalPluginDefinitions()` filters with `entry.isDirectory()`. A symlink-to-directory
reports `isDirectory() === false`, so a symlinked plugin is **silently never discovered** —
the smoke test renders nothing while appearing to "pass". Copy (or `git clone`) the plugin
into `apps/<slug>/` as a real directory:

```bash
mkdir -p /path/to/care_fe/apps
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude dist \
  /path/to/care_hello_fe/ \
  /path/to/care_fe/apps/care_hello_fe/
# then, in care_fe:
npm run dev   # http://localhost:4000 — plugin is auto-discovered
```

> In-tree, shared singletons resolve from the host (the host `resolve.dedupe` list), but the
> plugin's **non-shared** bare imports (radix, `cmdk`, etc.) must be resolvable from the host
> or the copied app's `node_modules`. An unresolved import shows up as a Vite error — install
> the missing package.

(Out-of-tree dev via symlink is a known host limitation, flagged as a follow-up to make
`localPluginDevSupport()` accept symlinks.)

## 2. Standalone remote (production + remote-style testing)

The production path. Build the plugin into a federated remote and point the host at it.

```bash
npm run build      # emits dist/assets/remoteEntry.js (+ the manifest chunk)
npm run preview    # serves the build on :4173 for local remote-style testing
```

The host loads it with Vite federation: `PluginEngine` calls `setFederationRemote(slug, url)`
then `getFederationRemote(slug, "./manifest")`, unwraps the ES default export, and duck-types
it as `PluginManifest`. Production deploys typically serve `dist/` from GitHub Pages.

## 3. Enabling a plugin

A plugin loads if it appears in the **merged** plug-config set (build-time + API). There are
two sources:

### a. Build-time — `REACT_ENABLED_APPS`

A space-separated list parsed by `care.config.ts` into `careConfig.careApps`. Two entry
formats (host: `care_fe/docs/care-apps-architecture-note.md`):

| Format | Resolves to | Use |
|--------|-------------|-----|
| `org/repo` | `https://{org}.github.io/{repo}` (**GitHub Pages default**) | Production, repo published to Pages. |
| `org/repo@host/path/to/remoteEntry.js` | `http://` if host contains `localhost`, else `https://` | Local/remote testing against a specific server. |

Example (local standalone test against `npm run preview`):

```
REACT_ENABLED_APPS=ohcnetwork/care_hello_fe@localhost:4173/assets/remoteEntry.js
```

Build-time plugins are marked `source: "build"`, `isReadOnly: true` — they always load even
without a backend row, and can't be toggled off in the UI.

### b. Backend API — `GET /api/v1/plug_config/`

The backend returns API-configured plugins (`source: "api"`, editable in the UI). These are
fetched at runtime by `PluginEngine`.

> **In-tree dev needs neither.** Auto-discovered `apps/<slug>` plugins are injected as
> build-time configs by `localPluginDevSupport()` directly — no `REACT_ENABLED_APPS`, no
> backend row.

### Merge precedence — `mergePlugConfigs()`

Build-time and API configs are merged by `mergePlugConfigs()` in
`care_fe/src/Utils/plugConfig.ts`:

- Both sources are keyed by `slug`; one merged entry per slug.
- **Build-time wins on conflict.** For a slug present in both, the result is
  `source: "build"`, `isReadOnly: true`, and on overlapping `meta` keys the **build-time
  value overrides** the API value (`{ ...apiMeta, ...buildMeta }`).
- Non-conflicting API-only `meta` keys are preserved.
- Build-time entries sort ahead of API-only entries.

## 4. Shared-dependency parity (the #1 footgun — "Should have a queue")

The plugin's `federation.shared` (in the plugin's `vite.config.ts`) **must include every
host singleton the plugin consumes.** If it doesn't, the plugin bundles its own second copy
of that library, and at runtime you get **two instances** of React / the router / the query
client. The classic symptom is a React hook-order crash:

```
Error: Should have a queue. This is likely a bug in React.
```

(Other symptoms: `useContext(window.AuthUserContext)` returns `null`; `useQuery` runs against
a different `QueryClient`; raviger navigation doesn't update the host URL.)

### What the host shares

From `care_fe/vite.config.mts` (`federation.shared` + `resolve.dedupe`):

```
react, react-dom, react-i18next, @tanstack/react-query, raviger, sonner, decimal.js
```

(plus `i18next` deduped). A plugin shares the **subset it actually imports** — the template
shares:

```ts
shared: ["react", "react-dom", "react-i18next", "@tanstack/react-query", "raviger"]
```

### The rule

> Every library you `import` that the host also owns as a singleton **must** be in your
> `federation.shared`. `react` + `react-dom` additionally go in `peerDependencies` (the host
> provides the actual instance).

When verifying (skill verify-step): diff your `federation.shared` against the host's
`care_fe/vite.config.mts` and confirm every shared lib the plugin imports is listed. Adding a
new shared host dependency (e.g. you start using `sonner` for toasts) means adding it to
`shared` too — otherwise it crashes only at runtime, never at build time.
