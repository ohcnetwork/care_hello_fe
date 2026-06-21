# CARE Plugin Skill + Template Refresh — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `care_hello_fe` into a minimal-correct plugin template, author a `care-plugin-builder` Claude Code skill, and refresh the host plugin docs.

**Architecture:** A CARE plugin is a self-contained federated React remote: it exposes `./manifest` via Module Federation, is duck-typed by the host as `PluginManifest`, reaches host services through `window` globals (never imports), vendors its own request layer, and is developed in-tree under `care_fe/apps/<slug>/` (HMR) then shipped as `remoteEntry.js`. The fix re-aligns the template to that contract; the skill encodes the workflow; the docs are corrected to match shipped reality.

**Tech Stack:** React 19, Vite 6, `@originjs/vite-plugin-federation`, TanStack Query, raviger, Tailwind v4, TypeScript.

**Spec:** `care_hello_fe/docs/superpowers/specs/2026-06-21-care-plugin-skill-design.md`

**Repos & working dirs:**
- `care_hello_fe` (`/Users/bodhishthomas/code/care_hello_fe`) — branch `feat/plugin-authoring-skill` (already created). Template + skill.
- `care_fe` (`/Users/bodhishthomas/code/care_fe`) — Chunk 3 only (host doc refresh). **Branch before committing** (currently `develop`).

**Verification model:** This work is config + markdown, not unit-testable logic. The gates are: `npx tsc -b` passes (proves the vendored `PluginManifest` typing catches drift), `npm run build` emits `dist/assets/remoteEntry.js`, and an in-tree host smoke test renders the plugin with no console hook errors. Treat those as the "tests."

---

## Chunk 1: Fix the `care_hello_fe` template

All paths in this chunk are relative to `/Users/bodhishthomas/code/care_hello_fe`. Commit after each task.

### Task 1: Vendor the manifest type contract

**Files:**
- Create: `src/types/pluginManifest.ts`

The host's `PluginManifest` lives in `care_fe/src/pluginTypes.ts`. Plugins can't import it at build time, so mirror the subset the template uses. This is what makes drift a **compile error** instead of a silent runtime break.

- [ ] **Step 1: Create the vendored type file**

```ts
/**
 * Mirror of care_fe `src/pluginTypes.ts` — KEEP IN SYNC.
 *
 * Plugins build standalone and cannot import host types, so this file re-declares
 * the subset of the host `PluginManifest` contract this plugin uses. The
 * care-plugin-builder skill's verify-step diffs this against the host. When you use a
 * new extension point or slot, mirror its type here.
 *
 * Canonical source: https://github.com/ohcnetwork/care_fe → src/pluginTypes.ts
 */
import type { FC, LazyExoticComponent, ReactNode } from "react";

/**
 * Minimal structural type — only the fields this plugin reads.
 * Canonical: care_fe → src/types/emr/encounter/encounter.ts (`EncounterRead`).
 */
export type EncounterRead = { id: string };

/** Mirror of care_fe → src/components/ui/sidebar/nav-main.tsx (`NavigationLink`). */
export interface NavigationLink {
  header?: string;
  headerIcon?: ReactNode;
  name: string;
  url: string;
  icon?: ReactNode;
  visibility?: boolean;
  children?: NavigationLink[];
}

/** raviger-style route map. Canonical: care_fe → src/Routers/AppRouter.tsx (`AppRoutes`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRoutes = Record<string, (params: any) => ReactNode>;

/**
 * Component slot prop types. Mirror ONLY the slots this plugin contributes to.
 * Full list of all 17 slots + exact props: care_fe `src/pluginTypes.ts`
 * (`SupportedPluginComponents`) and the skill's references/manifest-contract.md.
 */
export type PatientInfoCardQuickActionsComponentType = FC<{
  encounter: EncounterRead;
  className?: string;
}>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyComponent<T extends FC<any>> = LazyExoticComponent<T>;

/** Subset of care_fe `SupportedPluginComponents` this plugin uses. */
export type PluginComponentMap = {
  PatientInfoCardQuickActions?: LazyComponent<PatientInfoCardQuickActionsComponentType>;
  // Add other slots here as you use them.
};

/** Mirror of care_fe `src/pluginTypes.ts` (`PluginManifest`). */
export type PluginManifest = {
  plugin: string;
  routes?: AppRoutes;
  extends?: readonly ("DoctorConnectButtons" | "PatientExternalRegistration")[];
  navItems?: NavigationLink[];
  billingNavItems?: NavigationLink[];
  userNavItems?: NavigationLink[];
  adminNavItems?: NavigationLink[];
  components?: PluginComponentMap;
  // Advanced (not used by this template — see skill references for the host shapes):
  // organizationTabs?, encounterTabs?, devices?, overrides?
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/pluginManifest.ts
git commit -m "feat: vendor PluginManifest type contract from host"
```

### Task 2: Vendor the request layer

**Files:**
- Create: `src/lib/requests.ts`

Self-contained `query`/`mutate`/`request` that mirror the host's `@/Utils/request` API but build URLs from `window.CARE_API_URL` and read the JWT from `localStorage`. Self-contained (inline `sleep`) so it has no cross-file deps.

> Note: spec §4.1 mentioned a `src/lib/utils.ts` (cn + sleep). It is intentionally **not** created — `cn` already lives at `@/utils/utils` (used by `ui/button.tsx`), and `sleep` is inlined here. Don't duplicate `cn`.

- [ ] **Step 1: Create `src/lib/requests.ts`**

```ts
/**
 * Vendored request layer for CARE plugins. Mirrors the API of care_fe
 * `src/Utils/request/{query,mutate}.ts` but is standalone: it reads the backend base
 * URL from `window.CARE_API_URL` and the JWT from localStorage. Plugins must NOT import
 * the host's request utils (they aren't federation-shared) — vendor this instead.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type QueryParams = Record<string, QueryParamValue>;

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

export interface ApiRoute<TData, TBody = unknown> {
  baseUrl?: string;
  method?: HttpMethod;
  path: string;
  TBody?: TBody;
  TRes: TData;
  noAuth?: boolean;
  defaultQueryParams?: QueryParams;
}

export const apiRoutes = <
  const T extends Record<string, ApiRoute<unknown, unknown>>,
>(
  routes: T,
): T => routes;

type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}{${infer Param}}${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : never;

type PathParams<T extends string> = { [_ in ExtractRouteParams<T>]: string };

interface ApiCallOptions<Route extends ApiRoute<unknown, unknown>> {
  pathParams?: PathParams<Route["path"]>;
  queryParams?: QueryParams;
  body?: Route["TBody"];
  silent?: boolean | ((response: Response) => boolean);
  signal?: AbortSignal;
  headers?: HeadersInit;
  baseUrl?: string;
}

export class HttpError extends Error {
  status: number;
  silent: boolean;
  cause?: Record<string, unknown>;
  constructor(args: {
    message: string;
    status: number;
    silent: boolean;
    cause?: Record<string, unknown>;
  }) {
    super(args.message);
    this.status = args.status;
    this.silent = args.silent;
    this.cause = args.cause;
  }
}

export interface PaginatedResponse<TItem> {
  count: number;
  results: TItem[];
}

/** Phantom type helper — captures TS types for a route without runtime cost. */
export function Type<T>(): T {
  return {} as T;
}

const getQueryParams = (query: QueryParams) => {
  const qp = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v) => qp.append(key, `${v}`));
      return;
    }
    qp.set(key, `${value}`);
  });
  return qp.toString();
};

const getUrl = (
  path: string,
  query?: QueryParams,
  pathParams?: Record<string, string | number>,
  baseUrl?: string,
) => {
  if (pathParams) {
    path = Object.entries(pathParams).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, `${value}`),
      path,
    );
  }
  const url = new URL(path, baseUrl || window.CARE_API_URL);
  if (query) url.search = getQueryParams(query);
  return url.toString();
};

function getHeaders(noAuth?: boolean, additional?: HeadersInit) {
  const headers = new Headers(additional);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (!noAuth) {
    const token = localStorage.getItem("care_access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function getResponseBody<TData>(res: Response): Promise<TData> {
  if (res.headers.get("content-length") === "0") return null as TData;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) return (await res.text()) as TData;
  try {
    return await res.json();
  } catch {
    return (await res.text()) as TData;
  }
}

async function request<Route extends ApiRoute<unknown, unknown>>(
  { path, method, noAuth }: Route,
  options?: ApiCallOptions<Route>,
): Promise<Route["TRes"]> {
  const url = getUrl(
    path,
    options?.queryParams,
    options?.pathParams,
    options?.baseUrl,
  );
  const fetchOptions: RequestInit = {
    method: method ?? HttpMethod.GET,
    headers: getHeaders(noAuth, options?.headers),
    signal: options?.signal,
  };
  if (options?.body) fetchOptions.body = JSON.stringify(options.body);

  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch {
    throw new Error("Network Error");
  }
  const data = await getResponseBody<Route["TRes"]>(res);
  if (!res.ok) {
    const isSilent =
      typeof options?.silent === "function"
        ? options.silent(res)
        : (options?.silent ?? false);
    throw new HttpError({
      message: "Request Failed",
      status: res.status,
      silent: isSilent,
      cause: data as unknown as Record<string, unknown>,
    });
  }
  return data;
}

const query = <Route extends ApiRoute<unknown, unknown>>(
  route: Route,
  options?: ApiCallOptions<Route>,
) => {
  return ({ signal }: { signal: AbortSignal }) =>
    request(route, { ...options, signal });
};

const debouncedQuery = <Route extends ApiRoute<unknown, unknown>>(
  route: Route,
  options?: ApiCallOptions<Route> & { debounceInterval?: number },
) => {
  return async ({ signal }: { signal: AbortSignal }) => {
    await sleep(options?.debounceInterval ?? 500);
    return query(route, { ...options })({ signal });
  };
};
query.debounced = debouncedQuery;

const mutate = <Route extends ApiRoute<unknown, unknown>>(
  route: Route,
  options?: ApiCallOptions<Route>,
) => {
  return (variables: Route["TBody"]) =>
    request(route, { ...options, body: variables });
};

export { request, query, mutate };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/requests.ts
git commit -m "feat: vendor query/mutate request layer reading window.CARE_API_URL"
```

### Task 3: Fix the manifest + component slot contract

**Files:**
- Modify: `src/manifest.tsx` (full rewrite)
- Modify: `src/components/Button.tsx` (props)

This fixes the two **breaking** bugs (wrong slot props) and the hand-rolled `Manifest` interface.

- [ ] **Step 1: Rewrite `src/manifest.tsx`**

```tsx
import { lazy } from "react";
import Page from "./components/Page";
import Hello from "./pages/Hello";
import type { PluginManifest } from "./types/pluginManifest";

const manifest: PluginManifest = {
  plugin: "care_hello_fe",
  routes: {
    "/hello": () => (
      <Page>
        <Hello />
      </Page>
    ),
  },
  extends: [],
  components: {
    // Must be React.lazy() — the host renders slots under Suspense.
    PatientInfoCardQuickActions: lazy(() => import("./components/Button")),
  },
  navItems: [],
  userNavItems: [],
  adminNavItems: [],
};

export default manifest;
```

- [ ] **Step 2: Fix `src/components/Button.tsx` props to match the host slot type**

```tsx
import { Link } from "raviger";
import { Button } from "./ui/button";
import type { EncounterRead } from "@/types/pluginManifest";

// Host slot contract: PatientInfoCardQuickActions = FC<{ encounter: EncounterRead; className? }>.
// The host also injects a `__meta` prop at runtime (optional, ignore unless needed).
export default function HelloButton(props: {
  className?: string;
  encounter: EncounterRead;
}) {
  return (
    <div className="care-hello-container">
      <Button className={props.className} variant={"default"}>
        <Link href={`/hello`}>Hello!</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/manifest.tsx src/components/Button.tsx
git commit -m "fix: correct PatientInfoCardQuickActions slot contract; type manifest as PluginManifest"
```

### Task 4: Fix Vite federation + build config

**Files:**
- Modify: `vite.config.ts`

Fixes the **breaking** `shared` gap (raviger + react-query are used but not shared → hook-order crash), the `federation.name` mismatch, and the build target.

- [ ] **Step 1: Update `federation(...)` and `build.target`**

In `vite.config.ts`, change the `federation` block and build target to:

```ts
federation({
  name: "care_hello_fe", // must equal the plugin slug
  filename: "remoteEntry.js",
  exposes: {
    "./manifest": "./src/manifest.tsx",
  },
  // Share every host singleton the plugin consumes, or React/router/query context
  // breaks at runtime with "Should have a queue" hook-order errors.
  shared: ["react", "react-dom", "react-i18next", "@tanstack/react-query", "raviger"],
}),
```

and:

```ts
build: {
  target: "es2022",
  minify: true,
  cssCodeSplit: false,
  modulePreload: { polyfill: false },
  rollupOptions: {
    external: [],
    input: { main: "./index.html" },
    output: { format: "esm" },
  },
},
```

Leave `preview.port: 4173` as-is (matches the documented standalone remote URL).

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "fix: share react-query+raviger, rename federation to slug, target es2022"
```

### Task 5: Align dependency versions + TS target + window globals

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.app.json`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Read the host's canonical versions**

```bash
grep -E '"(react|react-dom|react-i18next|@tanstack/react-query|raviger)"' /Users/bodhishthomas/code/care_fe/package.json
grep '@originjs/vite-plugin-federation' /Users/bodhishthomas/code/care_fe/package.json
```

- [ ] **Step 2: Update `package.json`** — set shared singletons + the federation plugin to the host's ranges. Known targets (verify against Step 1, host wins):
  - `raviger`: `^5.0.0-2` → `^5.3.0`
  - `react-i18next`: → host range (≈ `^15.2.0`)
  - `@tanstack/react-query`: → host range
  - `lucide-react`: → host range (≈ `^0.548.0`)
  - `@originjs/vite-plugin-federation` (devDeps): `^1.4.1` → `^1.3.7` (**intentional downgrade** to anchor to the host's build, even though `care_analytics_fe` runs `^1.4.0`; note this in the commit body so it isn't "fixed" back)
  - Keep `react`/`react-dom` in `peerDependencies`.

- [ ] **Step 3: Update `tsconfig.app.json`** — `target` and `lib` ES2020 → ES2022:

```jsonc
"target": "ES2022",
"lib": ["ES2022", "DOM", "DOM.Iterable"],
```

- [ ] **Step 4: Extend `src/vite-env.d.ts`** with all host-provided globals:

```ts
/// <reference types="vite/client" />

interface Window {
  /** Backend API base URL (careConfig.apiUrl). Set by the host in src/index.tsx. */
  CARE_API_URL: string;
  /** React context for auth state: React.useContext(window.AuthUserContext). */
  AuthUserContext: import("react").Context<unknown>;
  /** Full careConfig object. */
  __CORE_ENV__: Record<string, unknown>;
  /** Plugin runtime metadata set after the manifest loads.
   *  Loose mirror — host types this `meta` as PlugConfigMeta, which plugins can't import. */
  __CARE_PLUGIN_RUNTIME__: { meta: Record<string, unknown> };
}
```

- [ ] **Step 5: Reinstall deps**

Run: `npm install`
Expected: lockfile updates, no peer-dep errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json src/vite-env.d.ts
git commit -m "chore: align shared deps to host, target es2022, declare window globals"
```

### Task 6: Build + type-check gate

**Files:** none (verification only)

- [ ] **Step 1: Type-check (proves the vendored PluginManifest catches drift)**

Run: `npx tsc -b`
Expected: exits 0, no errors. (If the manifest shape were wrong, this fails — that's the point.)

- [ ] **Step 2: Build the remote**

Run: `npm run build`
Expected: exits 0; `dist/assets/remoteEntry.js` exists.
Verify: `ls dist/assets/remoteEntry.js`

- [ ] **Step 3: Negative check (optional, prove drift detection)**

Temporarily edit `src/manifest.tsx` to add `patientId: "x"` inside the `PatientInfoCardQuickActions` lazy import usage or mistype a manifest key, run `npx tsc -b`, confirm it FAILS, then revert. Do not commit the temporary change.

- [ ] **Step 4: Commit** (only if any incidental fixes were needed to pass the gate; otherwise skip)

### Task 7: Wire one example authenticated query

**Files:**
- Create: `src/pages/CurrentUser.tsx`
- Modify: `src/pages/Hello.tsx` (render the example)

Demonstrates the end-to-end data path: `query()` + `window.CARE_API_URL` + TanStack Query. Keep it minimal.

- [ ] **Step 1: Read current `src/pages/Hello.tsx`** to match its style.

Run: `cat src/pages/Hello.tsx`

- [ ] **Step 2: Create `src/pages/CurrentUser.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { HttpMethod, Type, apiRoutes, query } from "@/lib/requests";

// Typed route object — mirrors the host's src/types/*Api.ts pattern.
const routes = apiRoutes({
  getCurrentUser: {
    path: "/api/v1/users/getcurrentuser/",
    method: HttpMethod.GET,
    TRes: Type<{ username: string; first_name?: string; last_name?: string }>(),
  },
});

export default function CurrentUser() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["care_hello_fe", "current-user"],
    queryFn: query(routes.getCurrentUser, { silent: true }),
  });

  if (isLoading) return <p>Loading current user…</p>;
  if (error) return <p>Not signed in (or API unavailable).</p>;
  return <p>Hello, {data?.first_name ?? data?.username} 👋</p>;
}
```

- [ ] **Step 3: Render `<CurrentUser />` inside `src/pages/Hello.tsx`** (import it and add it to the rendered output, preserving existing content).

- [ ] **Step 4: Re-run the gate**

Run: `npx tsc -b && npm run build`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CurrentUser.tsx src/pages/Hello.tsx
git commit -m "feat: example authenticated query via vendored query() + window.CARE_API_URL"
```

### Task 8: In-tree host smoke test

**Files:** none (manual verification; requires `care_fe` + backend running)

- [ ] **Step 1: Copy the plugin into the host's `apps/` as a REAL directory**

> ⚠️ Do **not** symlink. The host's `localPluginDevSupport()` filters `apps/` entries with
> `fs.readdirSync(appsDir, { withFileTypes: true }).filter(e => e.isDirectory())`, and a
> symlinked directory reports `isDirectory() === false` (verified) — so a symlink is never
> discovered and the smoke test would silently render nothing while appearing to "pass".
> Use a real copy (or a real `git clone` of the branch into `apps/care_hello_fe`).

```bash
mkdir -p /Users/bodhishthomas/code/care_fe/apps
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude dist \
  /Users/bodhishthomas/code/care_hello_fe/ \
  /Users/bodhishthomas/code/care_fe/apps/care_hello_fe/
```

> Note: in-tree, the plugin's source is served through the host Vite graph. Shared singletons
> resolve from the host (dedupe), but the plugin's **non-shared** bare imports (e.g.
> `lottie-react`, `cmdk`, `next-themes`, radix packages) must be resolvable. If Vite reports an
> unresolved import, install it in the host or in the copied `apps/care_hello_fe`.

- [ ] **Step 2: Start the host** (separate terminal, backend on :9000 already up)

Run (in `care_fe`): `npm run dev`
Expected: app on `http://localhost:4000`; the local plugin under `apps/care_hello_fe` is
auto-discovered (its manifest is imported into the generated `virtual:care-local-plugins`
module). If you see no plugin behavior at all, the directory wasn't discovered — re-check
Step 1 used a real directory, not a symlink.

- [ ] **Step 3: Verify in browser**
  - Navigate to `http://localhost:4000/hello` → the Hello page renders (and `CurrentUser` shows the signed-in user).
  - Open a patient encounter → the `PatientInfoCardQuickActions` "Hello!" button renders.
  - **Console: zero "Should have a queue" / hook-order errors** (proves shared-dep parity).

- [ ] **Step 4: Clean up the copied app** when done.

```bash
rm -rf /Users/bodhishthomas/code/care_fe/apps/care_hello_fe
# Remove apps/ if now empty:
rmdir /Users/bodhishthomas/code/care_fe/apps 2>/dev/null || true
```

> If `care_fe`/backend aren't running in this environment, record this task as "manual verification pending" and proceed — the `tsc -b` + build gates already cover the contract.

### Task 9: Rewrite `README.md`

**Files:**
- Modify: `README.md` (full rewrite)

- [ ] **Step 1: Write the new README** covering, in order:
  1. **What is a CARE plugin** — self-contained federated remote; duck-typed `PluginManifest`; the host is `care_fe`.
  2. **Quick start** — clone, `npm install`.
  3. **Two integration modes:**
     - *In-tree dev (recommended):* copy or `git clone` the plugin into `care_fe/apps/care_hello_fe` (a **real** directory — symlinks aren't discovered by the host), run host `npm run dev`, full HMR. `@/` resolves to the plugin's own `src/`.
     - *Standalone remote (prod):* `npm run build` → `dist/assets/remoteEntry.js`; serve (`npm run preview` on :4173 or GitHub Pages); enable via `REACT_ENABLED_APPS`.
  4. **Enabling the plugin** — `REACT_ENABLED_APPS` formats (`org/repo` → `https://{org}.github.io/{repo}`; `org/repo@host/path/to/remoteEntry.js`, e.g. `ohcnetwork/care_hello_fe@localhost:4173/assets/remoteEntry.js`); and the backend `GET /api/v1/plug_config/` path.
  5. **The manifest contract** — points to `care_fe/src/pluginTypes.ts` as source of truth and to `src/types/pluginManifest.ts` (vendored mirror).
  6. **Host services (`window` globals) table** — `CARE_API_URL`, `AuthUserContext`, `__CORE_ENV__`, `__CARE_PLUGIN_RUNTIME__.meta`.
  7. **Data access** — the vendored `src/lib/requests.ts` pattern (`query`/`mutate`); reuse host components with `npm run clone-component` (run from `care_fe`).
  8. **Shared-dependency parity warning** — must match host singletons or hooks crash.
  9. **Building a feature** — points to the `.claude/skills/care-plugin-builder` skill.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for two-mode workflow, window globals, manifest contract"
```

---

## Chunk 2: Author the `care-plugin-builder` skill

All paths relative to `/Users/bodhishthomas/code/care_hello_fe`. Use the `superpowers:writing-skills` skill to author and validate. Scope = **common subset** (routes, slots, nav, API); advanced points are pointers.

### Task 10: Skill core (`SKILL.md`)

**Files:**
- Create: `.claude/skills/care-plugin-builder/SKILL.md`

- [ ] **Step 1: Write `SKILL.md` with frontmatter**

```markdown
---
name: care-plugin-builder
description: Use when building a feature for CARE (ohcnetwork/care_fe) as a plugin — adding a route, a component slot, nav items, or an authenticated API call to the EMR via the care_hello_fe template. Encodes the plugin manifest contract, the self-contained federated-remote model, window-global host services, the vendored request layer, in-tree vs standalone integration, and the verify-before-ship checklist.
---
```

- [ ] **Step 2: Body sections** (write fully):
  1. **Mental model** (from spec §2): self-contained federated remote; `./manifest` duck-typed as `PluginManifest`; host services via `window` globals (never imports); vendored request layer; `clone-component` for host components; two integration modes; `@/` = plugin's own `src/`.
  2. **Source of truth** — ALWAYS read `care_fe/src/pluginTypes.ts` before writing/changing a manifest. Never invent slot props. Keep `src/types/pluginManifest.ts` in sync.
  3. **Workflow** (numbered): scaffold from template → read `pluginTypes.ts` for the target extension point → implement (recipes in `references/recipes.md`) → mirror any new type into `src/types/pluginManifest.ts` → wire the manifest → dev in-tree under `care_fe/apps/<slug>/` → **run the verify-step** → `npm run build` → enable.
  4. **Verify-step (checklist)** — `npx tsc -b` passes; every `components`/`encounterTabs` entry is `React.lazy()`; `federation.shared` includes every host singleton the plugin imports (diff against host `vite.config.mts`); `manifest.plugin` == slug == `federation.name`; `meta.url` is a valid absolute URL.
  5. **Gotchas** (spec §2.8, verbatim list) — invalid `meta.url` skipped silently; 401/403 from `plug_config` swallowed → no plugins; overrides only on `register()`-ed components; `device.type` must equal `care_type`; manifests deep-frozen; non-lazy slots fail.
  6. **References index** — one line each pointing to the 5 `references/*.md`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/care-plugin-builder/SKILL.md
git commit -m "feat(skill): care-plugin-builder core (SKILL.md)"
```

### Task 11: Reference — manifest contract

**Files:**
- Create: `.claude/skills/care-plugin-builder/references/manifest-contract.md`

- [ ] **Step 1: Write it** — a banner ("Verify against care_fe/src/pluginTypes.ts; this is a snapshot"), the full `PluginManifest` field list, and a table of **all 17 component slots** with their exact prop types (copy from `pluginTypes.ts` `SupportedPluginComponents`, lines 20–143). Note the injected `__meta` prop and the `React.lazy()` requirement.
- [ ] **Step 2: Commit** — `git commit -m "feat(skill): manifest-contract reference"`

### Task 12: Reference — recipes (common subset)

**Files:**
- Create: `.claude/skills/care-plugin-builder/references/recipes.md`

- [ ] **Step 1: Write copy-paste recipes**, each with the manifest wiring + the component/file:
  - **A route** (`routes: { "/foo/:id": ({ id }) => <Page>… </Page> }`, raviger `:param`).
  - **A component slot** (lazy import; correct props from the contract).
  - **The 4 nav menus** (`navItems`, `billingNavItems`, `userNavItems`, `adminNavItems`) with `NavigationLink`.
  - **An authenticated API call** — typed route object (`apiRoutes` + `Type<T>()`), `useQuery`/`useMutation` with vendored `query`/`mutate`; reuse host route types/components via `npm run clone-component -- <source> care_hello_fe`.
- [ ] **Step 2: Commit** — `git commit -m "feat(skill): recipes reference"`

### Task 13: Reference — data & auth

**Files:**
- Create: `.claude/skills/care-plugin-builder/references/data-and-auth.md`

- [ ] **Step 1: Write it** — the `window` globals table; the vendored `src/lib/requests.ts` pattern (why not import host utils); auth via `React.useContext(window.AuthUserContext)`; JWT in `localStorage` (`care_access_token`); `clone-component` usage + alias rewrites (`@core→@/`, `@careConfig→@/care.config`, `@/` kept) and its caveats (no dep install; copies drift).
- [ ] **Step 2: Commit** — `git commit -m "feat(skill): data-and-auth reference"`

### Task 14: Reference — integration & deploy

**Files:**
- Create: `.claude/skills/care-plugin-builder/references/integration-and-deploy.md`

- [ ] **Step 1: Write it** — in-tree apps/ dev (`localPluginDevSupport` auto-discovery, HMR, `/local-plugins/<slug>` assets) vs standalone `remoteEntry.js`; `REACT_ENABLED_APPS` formats + GitHub Pages default; backend `plug_config` enablement and `mergePlugConfigs` precedence; **shared-dep parity** explanation (the "Should have a queue" failure mode).
- [ ] **Step 2: Commit** — `git commit -m "feat(skill): integration-and-deploy reference"`

### Task 15: Reference — advanced extension points

**Files:**
- Create: `.claude/skills/care-plugin-builder/references/advanced-extension-points.md`

- [ ] **Step 1: Write it** — short orientation + pointers (not full recipes) for: `encounterTabs` (`PluginEncounterTabProps`, `ENCOUNTER_TAB__<key>` i18n), `organizationTabs` (permission-gated), `devices` (`type` == `care_type`), `overrides` (`register()` requirement, `OverrideCondition`, `window.__careOverrides`). Each points to `care_fe/src/pluginTypes.ts` + the relevant `care_fe/docs/care-apps-*.md`.
- [ ] **Step 2: Commit** — `git commit -m "feat(skill): advanced-extension-points reference"`

### Task 16: Validate the skill

**Files:** none

- [ ] **Step 1:** Invoke `superpowers:writing-skills` validation guidance: confirm frontmatter (`name`, `description`) is well-formed, the description has concrete trigger phrases, all `references/*.md` are linked from `SKILL.md`, and no broken intra-skill links.
- [ ] **Step 2:** Sanity-check that every host file path cited in the skill exists (`pluginTypes.ts`, the 3 docs, `scripts/clone-component.ts`, `vite.config.mts`).
- [ ] **Step 3: Commit** any fixes — `git commit -m "fix(skill): validation fixes"`

---

## Chunk 3: Refresh host docs in `care_fe`

All paths relative to `/Users/bodhishthomas/code/care_fe`. **Branch first** (currently `develop`).

### Task 17: Branch + refresh `care-apps-local-dev.md`

**Files:**
- Modify: `docs/care-apps-local-dev.md`

- [ ] **Step 1: Branch**

```bash
cd /Users/bodhishthomas/code/care_fe && git checkout -b docs/refresh-care-apps-plugin-docs
```

- [ ] **Step 2: Rewrite the stale sections** — the "Dev-Mode Local Discovery **Plan**" section describes auto-discovery as unbuilt, but it is **shipped** (`localPluginDevSupport()` in `vite.config.mts`). Rewrite to document the implemented behavior: `apps/*/src/manifest.tsx` auto-discovery, `@/`→`/@fs/` rewrite, `/local-plugins/<slug>` asset serving, full HMR via host `npm run dev`. Correct the "Local Dev Workflow" section so in-tree dev is primary and the 4173 build-watch loop is the standalone alternative. Keep the accurate `clone-component` section.
- [ ] **Step 3: Commit**

```bash
git add docs/care-apps-local-dev.md
git commit -m "docs: correct care-apps local-dev to match shipped apps/ auto-discovery"
```

### Task 18: Touch architecture + override notes

**Files:**
- Modify: `docs/care-apps-architecture-note.md`
- Modify: `docs/care-apps-override-architecture.md`

- [ ] **Step 1:** In `care-apps-architecture-note.md`, verify the `window`-globals section and add a cross-reference to `clone-component` and `src/pluginTypes.ts` if missing (it is largely accurate — light touch only).
- [ ] **Step 2:** In `care-apps-override-architecture.md`, add a header note: this is a **design-intent** document; the shipped implementation lives in `src/lib/override/` (`register.ts`, `registry.ts`, `bridge.ts`, `types.ts`).
- [ ] **Step 3: Commit**

```bash
git add docs/care-apps-architecture-note.md docs/care-apps-override-architecture.md
git commit -m "docs: clarify override doc is design-intent; cross-link architecture note"
```

---

## Follow-ups (PR comments, not this plan)

- **Host publishes `@ohcnetwork/care-plugin-types`** so plugins stop re-vendoring host types — the real ecosystem fix for the drift this work patches around.
- **Host: discover symlinked `apps/` dirs.** `localPluginDevSupport()` filters with `entry.isDirectory()`, which is false for a symlink-to-dir, so devs can't symlink an out-of-tree plugin checkout into `apps/`. Accepting `entry.isSymbolicLink()` (and resolving the target) would let developers keep their plugin repo anywhere and symlink it in — a much nicer in-tree dev workflow than copying.
- Living kitchen-sink examples for advanced extension points (encounter/org tabs, devices, overrides).

## Definition of done

- `care_hello_fe`: `npx tsc -b` + `npm run build` pass; `remoteEntry.js` emitted; in-tree smoke test renders with no hook errors (or recorded as pending).
- Skill: `SKILL.md` + 5 references committed; validated; all cited host paths exist.
- `care_fe`: local-dev doc matches shipped reality; override doc labeled design-intent.
- Two PRs opened (one per repo) or branches ready: `care_hello_fe@feat/plugin-authoring-skill`, `care_fe@docs/refresh-care-apps-plugin-docs`.
