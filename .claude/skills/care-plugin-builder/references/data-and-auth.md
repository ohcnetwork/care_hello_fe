# Data & auth

How a plugin talks to the backend and reads the signed-in user. The rule from the mental
model holds throughout: **plugins reach host services through `window` globals, never
through imports**, and the request layer is **vendored**, not borrowed from the host.

## 1. `window` globals (the host service surface)

The host sets these on `window` in `care_fe/src/index.tsx` (and one in
`care_fe/src/PluginEngine.tsx`). Because `react` is a shared federation singleton, a plugin
component runs inside the host's React tree and can read these directly at runtime.

| Global | Type (host) | Set in | Use it for |
|--------|-------------|--------|------------|
| `window.CARE_API_URL` | `string` | `src/index.tsx` (`careConfig.apiUrl`) | Base URL for all backend calls. The vendored request layer reads this. |
| `window.AuthUserContext` | `React.Context<AuthContextType \| null>` | `src/index.tsx` | The auth context. `React.useContext(window.AuthUserContext)` gives `{ user, signIn, signOut, … }`. |
| `window.__CORE_ENV__` | `typeof careConfig` | `src/index.tsx` | The full host `careConfig` object (feature flags, locale, plugin config, etc.). |
| `window.__CARE_PLUGIN_RUNTIME__.meta` | `{ meta: PlugConfigMeta }` (deep-frozen) | `src/PluginEngine.tsx` | Per-plugin runtime metadata (e.g. `meta.url`). Frozen — read only. |

Declare these in the plugin's `src/vite-env.d.ts` so TypeScript knows about them. The
template ships exactly that (loose mirrors, because plugins can't import the host's
`AuthContextType` / `PlugConfigMeta`):

```ts
/// <reference types="vite/client" />

interface Window {
  CARE_API_URL: string;
  AuthUserContext: import("react").Context<unknown>;
  __CORE_ENV__: Record<string, unknown>;
  __CARE_PLUGIN_RUNTIME__: { meta: Record<string, unknown> };
}
```

The host types are richer than these mirrors. Mirror only what you read; never widen a
mirror to claim a shape you haven't verified in `care_fe/src/index.tsx`.

## 2. The vendored request layer (`src/lib/requests.ts`)

The template vendors a standalone `query` / `mutate` / `request` trio in `src/lib/requests.ts`.
It **mirrors the API** of the host's `@/Utils/request/{query,mutate}.ts` (same call shapes,
same `apiRoutes` / `Type<T>()` / `HttpMethod` helpers) but is a **separate reimplementation**:
it builds URLs from `window.CARE_API_URL` and reads the JWT from `localStorage`.

### Why not import the host's request utils

- **They aren't federation-shared.** Only `react, react-dom, react-i18next,
  @tanstack/react-query, raviger` (and friends) are in the host's `federation.shared`. The
  request utils are not — importing them would mean either bundling a second copy or a
  missing module at runtime.
- **`clone-component` can't reproduce them cleanly.** The host request layer pulls in
  global error handling, session-expiry redirects, and toast wiring that depend on host-only
  modules outside `src/`. The intent is a small, self-contained layer the plugin fully owns.
- **The plugin owns its error policy.** Vendoring lets the plugin decide what `silent` means,
  how `HttpError` surfaces, etc., without coupling to host behavior.

So: **do not `clone-component` the host request utils.** Use the vendored
`src/lib/requests.ts`. (`clone-component` is still the right tool for host *DTO types* and
*UI components* — see §4.)

### Usage (with TanStack Query)

`@tanstack/react-query` is a shared singleton, so the plugin uses the host's single
`QueryClient`. Define a typed route object, then drive it with `useQuery` / `useMutation`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { HttpMethod, Type, apiRoutes, query } from "@/lib/requests";

const routes = apiRoutes({
  getCurrentUser: {
    path: "/api/v1/users/getcurrentuser/",
    method: HttpMethod.GET,
    TRes: Type<{ username: string; first_name?: string }>(),
  },
});

const { data } = useQuery({
  queryKey: ["care_hello_fe", "current-user"],
  queryFn: query(routes.getCurrentUser, { silent: true }),
});
```

- **Path params** — `{id}` segments in `path` are filled from `pathParams`.
- **Query params** — `queryParams` is serialized into the query string (arrays repeat the key).
- **Auth** — every request reads `localStorage.getItem("care_access_token")` and sets
  `Authorization: Bearer …` unless the route is marked `noAuth`.
- **`silent`** — `true` (or a predicate on the `Response`) suppresses surfacing the error;
  by default a failed request throws an `HttpError`.

Mutations use `mutate(route)` as the `mutationFn`; see `references/recipes.md` §D for the
POST/PATCH variant.

## 3. Auth — reading the signed-in user

There is **no auth import**. Read the host's auth context off `window`:

```tsx
import { useContext } from "react";

export function useAuthUser() {
  // Host context shape: { user, signIn, signOut, ... } (AuthContextType in care_fe).
  return useContext(window.AuthUserContext) as {
    user?: { username: string; external_id?: string };
    signOut?: () => void;
  } | null;
}
```

This works **because `react` is a shared singleton** — the plugin's `useContext` and the
host's `AuthUserContext.Provider` are the same React instance, so the plugin tree renders
inside the host's `AuthUserProvider`. If `react` were not shared, this returns `null` (or
crashes), which is one symptom of broken shared-dep parity (see
`references/integration-and-deploy.md`).

The **JWT itself** lives in `localStorage` under `care_access_token` (the host's
`AuthUserProvider` writes it). The vendored request layer reads it automatically; you rarely
need to touch it directly. There is also a refresh token managed by the host — plugins
should not refresh tokens themselves; rely on the host's 5-minute refresh cycle.

## 4. Reusing host code — `clone-component` (and its caveats)

When you need a host **DTO type** (a real request/response type from `care_fe/src/types/…`)
or a host **UI component** instead of re-declaring it, copy it in with the host's
`clone-component` CLI (host file: `care_fe/scripts/clone-component.ts`). Run it **from the
`care_fe` checkout**, targeting the plugin under `apps/`:

```bash
# from the care_fe checkout
npm run clone-component -- @/components/ui/button care_hello_fe
npm run clone-component -- src/types/user/user.ts care_hello_fe --dry-run
```

It walks the import graph of `<source>`, copies every transitively-imported file under
`src/` into `apps/<target>/src/` (preserving paths), and **rewrites the host's aliases**:

| Host specifier | Rewritten to | Note |
|----------------|--------------|------|
| `@core/foo` | `@/foo` | The plugin's `@/*` is its own `src/`. |
| `@careConfig` | `@/care.config` | `care.config.ts` is also copied into `src/`. |
| `@/foo` | `@/foo` (kept) | The plugin tsconfig uses the same `@/*` alias. |
| `./foo`, `../foo` | unchanged | Relative imports copy as-is. |
| bare packages (`react`, `@radix-ui/...`) | unchanged, **reported** | External deps you must add to `package.json` yourself. |

### Caveats

- **No dependency install.** The CLI only copies source; it lists "External packages
  referenced" at the end. Add any missing ones to the plugin's `package.json` before
  building — a missing dep is an unresolved-import build failure.
- **Copies drift.** Cloned files are independent snapshots; they will **not** stay in sync
  with the host. Re-run with `--force` to refresh when the host changes.
- **`src/`-only.** Only files under `src/` (plus `care.config.ts`) are followed. Imports
  resolving outside those roots are reported as "Unresolved imports" and need manual handling
  (often host globals like `vite-env.d.ts` declarations or modules the plugin doesn't need).
- **Use `--dry-run` first** to see the full transitive set — a single host component can pull
  in a surprising number of files.

For the request layer specifically, remember §2: clone **types and UI**, not the request
utils.
