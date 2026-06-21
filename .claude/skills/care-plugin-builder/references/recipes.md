# Recipes (common subset)

Copy-paste patterns for the four most common plugin features. Each shows the
`src/manifest.tsx` wiring plus the file it points at. Scope here is the common subset;
encounter/org tabs, devices, and overrides are in
`references/advanced-extension-points.md`.

Rules that apply to all recipes:

- The manifest is typed `const manifest: PluginManifest` (from `@/types/pluginManifest`).
- Every `components` / `encounterTabs` value is `React.lazy(() => import(...))`.
- `@/` resolves to this plugin's own `src/`.
- Read the exact prop type in `care_fe/src/pluginTypes.ts` before wiring a slot.

## A. A route

raviger route map. `:param` segments arrive as named args. Wrap pages in the shared `Page`
layout so they render with host chrome.

```tsx
// src/manifest.tsx
const manifest: PluginManifest = {
  plugin: "care_hello_fe",
  routes: {
    "/hello": () => (
      <Page>
        <Hello />
      </Page>
    ),
    "/hello/:id": ({ id }) => (
      <Page>
        <HelloDetail id={id} />
      </Page>
    ),
  },
};
```

```tsx
// src/pages/HelloDetail.tsx
export default function HelloDetail({ id }: { id: string }) {
  return <div>Hello {id}</div>;
}
```

Navigate from anywhere in the plugin with raviger's `navigate()` / `<Link>` (raviger is a
shared singleton, so the plugin shares the host router).

## B. A component slot

Inject a component into an existing host screen. The slot key and props come from
`SupportedPluginComponents` in `care_fe/src/pluginTypes.ts` (mirrored in
`references/manifest-contract.md`). **Use the exact props for that slot** — the host injects
exactly those (plus an optional `__meta`).

```tsx
// src/manifest.tsx
import { lazy } from "react";

const manifest: PluginManifest = {
  plugin: "care_hello_fe",
  components: {
    // Must be React.lazy() — the host renders slots under Suspense.
    PatientInfoCardQuickActions: lazy(() => import("./components/Button")),
  },
};
```

```tsx
// src/components/Button.tsx
import { Link } from "raviger";
import { Button } from "./ui/button";
import type { EncounterRead } from "@/types/pluginManifest";

// Host slot contract: PatientInfoCardQuickActions = FC<{ encounter: EncounterRead; className? }>.
// The host also injects an optional `__meta` prop at runtime; ignore unless needed.
export default function HelloButton(props: {
  className?: string;
  encounter: EncounterRead;
}) {
  return (
    <Button className={props.className} variant="default">
      <Link href={`/hello/${props.encounter.id}`}>Hello!</Link>
    </Button>
  );
}
```

To use a different slot, copy its prop type from `pluginTypes.ts` into
`src/types/pluginManifest.ts`, add the key to `PluginComponentMap`, then wire it the same
way.

## C. The 4 nav menus

`navItems`, `billingNavItems`, `userNavItems`, and `adminNavItems` are each
`NavigationLink[]`. Items can nest via `children`. `visibility: false` hides an item.

```tsx
// src/manifest.tsx
import { Stethoscope } from "lucide-react";

const manifest: PluginManifest = {
  plugin: "care_hello_fe",
  // Main sidebar
  navItems: [
    { name: "Hello", url: "/hello", icon: <Stethoscope className="size-4" /> },
  ],
  // Billing section
  billingNavItems: [{ name: "Hello Billing", url: "/hello/billing" }],
  // User/profile menu
  userNavItems: [{ name: "Hello Profile", url: "/hello/me" }],
  // Admin section
  adminNavItems: [
    {
      header: "Hello Admin",
      name: "Settings",
      url: "/hello/admin/settings",
      children: [{ name: "General", url: "/hello/admin/settings/general" }],
    },
  ],
};
```

`NavigationLink` fields: `header?`, `headerIcon?`, `name` (required), `url` (required),
`icon?`, `visibility?`, `children?`. Pair nav items with matching `routes` entries so the
links resolve.

## D. An authenticated API call

Define a typed route object with the vendored `apiRoutes` + `Type<T>()`, then drive it with
TanStack Query and the vendored `query` / `mutate`. The vendored layer
(`@/lib/requests`) reads `window.CARE_API_URL` and the JWT from `localStorage`
automatically — do **not** import the host's request utils.

```tsx
// src/pages/CurrentUser.tsx
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
  return <p>Hello, {data?.first_name ?? data?.username}</p>;
}
```

Mutation variant (POST/PATCH/etc.): pass `method` and a `TBody` type, then drive with
`useMutation`:

```tsx
import { useMutation } from "@tanstack/react-query";
import { HttpMethod, Type, apiRoutes, mutate } from "@/lib/requests";

const routes = apiRoutes({
  updateNote: {
    path: "/api/v1/notes/{id}/",
    method: HttpMethod.PATCH,
    TBody: Type<{ text: string }>(),
    TRes: Type<{ id: string; text: string }>(),
  },
});

const { mutate: save } = useMutation({
  mutationFn: mutate(routes.updateNote, { pathParams: { id: noteId } }),
});
save({ text: "updated" });
```

Path params (`{id}` in `path`) are supplied via `pathParams`; query-string params via
`queryParams`. Pass `silent: true` to suppress global error toasts.

**Reusing host route types / components.** When you want the host's real request DTOs or a
host UI component instead of re-declaring them, run `clone-component` from `care_fe` to copy
the host file (and its transitive imports) into this plugin, rewriting aliases:

```bash
# run from the care_fe checkout
npm run clone-component -- @/components/ui/button care_hello_fe
npm run clone-component -- src/types/user/user.ts care_hello_fe --dry-run
```

Cloned files are independent copies and won't stay in sync; the CLI does not install npm
deps, so add any reported "External packages" to this plugin's `package.json`. See
`references/data-and-auth.md` for the full `clone-component` walkthrough.
