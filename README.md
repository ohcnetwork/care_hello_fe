# care_hello_fe

A minimal, correct template for building a **CARE plugin** — a feature you add to the
[CARE](https://github.com/ohcnetwork/care_fe) EMR without forking it. This repo is a
working "hello world": one route (`/hello`) and one component slot
(`PatientInfoCardQuickActions`), wired the way real plugins are.

---

## 1. What is a CARE plugin?

A CARE plugin is a **self-contained federated React remote**. The defining property:

> **Plugins do NOT import host source at compile time.** They build completely
> independently of `care_fe` and integrate at runtime via
> [Module Federation](https://github.com/originjs/vite-plugin-federation) + a handful of
> `window` globals.

- The plugin exposes `./manifest` (→ `src/manifest.tsx`) through federation, producing a
  `remoteEntry.js`.
- The host (`care_fe`) loads that manifest, unwraps its ES **default export**, and
  **duck-types** it as a `PluginManifest`. There is no compile-time validation across the
  boundary — the manifest shape is the entire integration surface, so getting it right
  matters.
- The host (`care_fe`) is the application that mounts your plugin. You never run `care_fe`'s
  code from inside this repo; you build a `remoteEntry.js` (or develop in-tree) and the host
  pulls it in.

---

## 2. Quick start

```bash
git clone https://github.com/ohcnetwork/care_hello_fe.git
cd care_hello_fe
npm install
```

You also need the host (`care_fe`) cloned and runnable locally — see
[care_fe](https://github.com/ohcnetwork/care_fe) for its setup. The two integration modes
below describe how to attach this plugin to it.

---

## 3. Two integration modes

### Mode A — in-tree dev (recommended for development)

The host auto-discovers plugins under its `apps/` directory and serves them through its own
Vite graph with full HMR. No separate dev server, no build loop.

1. Place this plugin at `care_fe/apps/care_hello_fe` as a **real directory** — copy it, or
   `git clone` it there:

   ```bash
   # from inside your care_fe checkout
   git clone https://github.com/ohcnetwork/care_hello_fe.git apps/care_hello_fe
   ```

   > **Caveat:** it must be a real directory. The host's `localPluginDevSupport()` discovery
   > (in `care_fe/vite.config.mts`) does **not** follow symlinks — a symlinked `apps/<slug>`
   > is silently ignored.

2. Start the **host** dev server:

   ```bash
   # from inside care_fe
   npm run dev
   ```

   The host discovers `apps/care_hello_fe/src/manifest.tsx`, loads it through its Vite graph
   with HMR, and serves the plugin's `public/` from `/local-plugins/care_hello_fe`.

In this mode `@/` resolves to **this plugin's own `src/`** — exactly as it does in a
standalone build — so imports behave identically whether you're developing in-tree or
building standalone.

### Mode B — standalone remote (production + remote-style testing)

Build a real `remoteEntry.js` and serve it like production.

```bash
npm run build      # → dist/assets/remoteEntry.js
npm run preview    # serves dist/ on http://localhost:4173
```

Then enable it (see below). For production you'd serve `dist/` from GitHub Pages or any
static host instead of `npm run preview`.

---

## 4. Enabling the plugin

A built/served plugin is loaded by the host through **two** merged sources (build-time wins
on conflict and is read-only).

### `REACT_ENABLED_APPS` (build-time, set on the host)

Comma-separated entries, in one of two forms:

| Form | Resolves to |
| ---- | ----------- |
| `org/repo` | `https://{org}.github.io/{repo}` (GitHub Pages default) |
| `org/repo@host/path/to/remoteEntry.js` | the explicit URL you give |

For local Mode B against `npm run preview`:

```
REACT_ENABLED_APPS=ohcnetwork/care_hello_fe@localhost:4173/assets/remoteEntry.js
```

### Backend `plug_config` (runtime, via the API)

The host also fetches enabled plugins from the backend:

```
GET /api/v1/plug_config/
```

Each config carries a `meta` object — `{ "url": "...remoteEntry.js", "name": "care_hello_fe" }`.
Build-time `REACT_ENABLED_APPS` and the API response are combined by the host's
`mergePlugConfigs()`; build-time entries take precedence and are marked read-only.

Once enabled, reload the host, open a patient encounter, and you'll see the plugin's
**Hello!** quick action.

---

## 5. The manifest contract

`src/manifest.tsx` is the whole integration surface. Its type is the **source of truth**:

- **Authoritative:** [`care_fe/src/pluginTypes.ts`](https://github.com/ohcnetwork/care_fe/blob/develop/src/pluginTypes.ts)
  → `PluginManifest` and `SupportedPluginComponents`. Always read this before adding or
  changing a manifest field or a component slot. Never invent slot prop types.
- **Vendored mirror (this repo):** [`src/types/pluginManifest.ts`](./src/types/pluginManifest.ts)
  — a small local copy of `PluginManifest` plus the slot prop types the template uses, so
  `manifest.tsx` (typed `const manifest: PluginManifest`) gets compile-time drift detection.
  Keep it in sync with the host; when you need a richer host type, vendor it (see
  `clone-component` below).

Every component listed under `components` or `encounterTabs` **must** be wrapped in
`React.lazy()` — the host renders slots under `Suspense` + an error boundary. The host also
injects an extra `__meta` prop into every slot component.

---

## 6. Host services (`window` globals)

The plugin never imports host code. Instead the host exposes a small set of runtime globals
(declared for TypeScript in [`src/vite-env.d.ts`](./src/vite-env.d.ts)):

| Global | What it is | Use |
| ------ | ---------- | --- |
| `window.CARE_API_URL` | Backend API base URL (`careConfig.apiUrl`) | Build request URLs |
| `window.AuthUserContext` | React context holding auth state (`user`, `signIn`, `signOut`) | `React.useContext(window.AuthUserContext)` |
| `window.__CORE_ENV__` | The full `careConfig` object | Read host runtime config |
| `window.__CARE_PLUGIN_RUNTIME__.meta` | Frozen `Record<slug, meta>` of plugin metadata | Look up your plugin's `meta` |

`window.AuthUserContext` works because `react` is a **shared singleton** (see §8): the
plugin's component tree renders inside the host's `AuthUserProvider`.

---

## 7. Data access

Plugins do not import the host's request utilities — they **vendor** their own. This repo
ships [`src/lib/requests.ts`](./src/lib/requests.ts): a `query` / `mutate` / `request` trio
that builds URLs from `window.CARE_API_URL`, reads the JWT from `localStorage`
(`care_access_token`), and plugs into TanStack Query. It **mirrors** the host's
`@/Utils/request/{query,mutate}.ts` API but is a standalone reimplementation, so it works in
a federated remote that can't import host source.

```ts
import { useQuery } from "@tanstack/react-query";
import { query } from "@/lib/requests";

const { data } = useQuery({
  queryKey: ["me"],
  queryFn: query(currentUserRoute),
});
```

### Reusing host components — `clone-component`

When you genuinely need a host component or type, don't import it — **clone** it. The host
ships a script that walks a component's import graph, copies every transitively-imported file
into your plugin's `src/`, and rewrites aliases (`@core/foo → @/foo`,
`@careConfig → @/care.config`, `@/foo` kept as-is). Run it **from the `care_fe` checkout**:

```bash
# from inside care_fe
npm run clone-component -- <host-source-path> care_hello_fe
```

Cloned files are independent copies. External bare imports it can't resolve are reported for
you to add to this repo's `package.json` manually.

---

## 8. Shared-dependency parity (the #1 footgun)

This plugin's `federation.shared` (in [`vite.config.ts`](./vite.config.ts)) **must include
every host singleton it consumes**, or React/router/query context breaks at runtime with
`"Should have a queue"` hook-order errors (caused by duplicate module instances).

The host shares:
`react, react-dom, react-i18next, @tanstack/react-query, raviger, sonner, decimal.js`
(and dedupes `i18next`). This template shares the subset it uses:

```ts
shared: ["react", "react-dom", "react-i18next", "@tanstack/react-query", "raviger"]
```

`react` and `react-dom` also belong in `peerDependencies`. **When you add a dependency that
the host also owns as a singleton, add it to `shared` too** — diff against the host's
`care_fe/vite.config.mts` if unsure.

---

## 9. Building a feature

To add a route, a component slot, nav items, or an authenticated API call:

1. Read the host's manifest contract in `care_fe/src/pluginTypes.ts` (the source of truth)
   and its vendored mirror in [`src/types/pluginManifest.ts`](./src/types/pluginManifest.ts) —
   never invent slot props.
2. Wire the extension point in [`src/manifest.tsx`](./src/manifest.tsx). Component slots must be
   `React.lazy()` — the host renders them under `Suspense`.
3. Mirror any new host type you use into `src/types/pluginManifest.ts` so drift is a
   compile error (`npx tsc -b`), not a silent runtime break.
4. Reach host services through `window` globals (see section 6) and make authenticated calls
   through the vendored [`src/lib/requests.ts`](./src/lib/requests.ts) layer (see section 7).
5. Develop in-tree under `care_fe/apps/care_hello_fe/` for HMR, then verify with
   `npx tsc -b && npm run build` before shipping the `remoteEntry.js`.

> A `care-plugin-builder` Claude Code skill — encoding this workflow with copy-paste recipes
> and pointers into the host's `pluginTypes.ts` and `care-apps-*` docs — is in progress and is
> not yet bundled in this repository.
