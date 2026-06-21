# Advanced extension points

Beyond routes, component slots, and nav items, the host exposes four heavier extension
points: **encounter tabs**, **organization tabs**, **devices**, and **component overrides**.

This file is **orientation + pointers, not full recipes.** These points are used rarely and
their exact shapes change; rather than ship copy-paste code that drifts, each entry below
tells you (a) what it does, (b) the authoritative type to read, and (c) the host doc that
explains the mechanism. **Always read the cited `care_fe/src/pluginTypes.ts` type before
wiring one of these**, and mirror anything new into `src/types/pluginManifest.ts`.

The general rules from the rest of the skill still apply: manifest values that are
components must be `React.lazy()`; getting a shape wrong fails silently at runtime, not at
compile time across the federation boundary.

## Encounter tabs — `manifest.encounterTabs`

Adds extra tabs to the encounter screen.

- **Shape:** `encounterTabs?: Record<string, LazyComponent<React.FC<PluginEncounterTabProps>>>`.
  The record **key** is the tab key; the value is a `React.lazy()` component.
- **Props:** `PluginEncounterTabProps = { encounter: EncounterRead; patient: PatientRead }`.
- **i18n:** the tab label is rendered as `t(\`ENCOUNTER_TAB__<key>\`)` by the host
  (`EncounterShow.tsx`). Your key needs a matching translation entry, or the label shows the
  raw key.
- **Read:** `care_fe/src/pluginTypes.ts` (`PluginManifest.encounterTabs`) and
  `care_fe/src/pages/Encounters/EncounterShow.tsx` (`PluginEncounterTabProps`, the
  `ENCOUNTER_TAB__` label convention). Tabs are wired through
  `care_fe/src/hooks/useCareApps.tsx`.

## Organization tabs — `manifest.organizationTabs`

Adds tabs to the organization screen.

- **Shape:** `organizationTabs?: PluginOrganizationTab[]`, where
  `PluginOrganizationTab = { name: string; slug: string; icon: ReactNode;
  component: React.FC<{ contextId: string; navOrganizationId?: string }> }`.
- **Permission-gated:** organization tabs render within the org layout, which is itself
  permission-gated — the tab only appears for users who can access that organization context.
  Don't assume your tab is visible to everyone.
- **Read:** `care_fe/src/pluginTypes.ts` (`PluginOrganizationTab`) and
  `care_fe/src/pages/Organization/components/OrganizationLayout.tsx` for how tabs are merged
  and gated.

## Devices — `manifest.devices`

Integrates a device type into the facility's device management.

- **Shape:** `devices?: readonly PluginDeviceManifest[]`, where `PluginDeviceManifest` has
  `type` plus optional `icon`, `configureForm`, `showPageCard`, `encounterOverview`
  components.
- **The matching rule:** `device.type` **must exactly equal the backend device's
  `care_type`**. A mismatch means the device manifest is never matched — a silent no-op.
- **Read:** `care_fe/src/pluginTypes.ts` (`PluginDeviceManifest`) for the exact component
  props (e.g. `configureForm` receives `{ facilityId, metadata, onChange }`).

## Component overrides — `manifest.overrides`

Replaces a host component with the plugin's own, optionally conditionally.

- **Shape:** `overrides?: readonly PluginOverride[]`, where
  `PluginOverride = { component: string; replacement; condition?: OverrideCondition;
  priority?: number; description? }`.
- **Only registered components are overrideable.** The `component` key must name a host
  component wrapped with `register()` (host `src/lib/override/`). An override targeting an
  unregistered component is a silent no-op.
- **`OverrideCondition`** gates when an override applies — by `page`, `userRole`,
  `facilityType`, render-stack `stackPath`, or a `custom` matcher.
  `priority` breaks ties (higher wins, default 0).
- **Runtime bridge:** federated plugins can't import the host override API, so the host
  installs `window.__careOverrides.addComponent(key, { component, condition?, … })`
  (`care_fe/src/lib/override/bridge.ts`). `PluginEngine` calls it for each
  `manifest.overrides` entry.
- **Read:** `care_fe/src/pluginTypes.ts` (`PluginOverride`),
  `care_fe/src/lib/override/types.ts` (`OverrideCondition`), and
  `care_fe/src/lib/override/index.ts` (`register`, `addOverride`, the `window.__careOverrides`
  bridge). **Note:** `care_fe/docs/care-apps-override-architecture.md` describes the override
  *design intent*; the shipped implementation lives in `care_fe/src/lib/override/`
  (`register.ts`, `registry.ts`, `bridge.ts`, `types.ts`) — read the code, not just the doc.

## When you adopt one of these

1. Read the cited type in `care_fe/src/pluginTypes.ts` (and the linked host file).
2. Mirror the new type(s) into `src/types/pluginManifest.ts` (the template's `PluginManifest`
   mirror intentionally comments these out — uncomment/extend as you use them).
3. Wire the manifest, wrapping any component value in `React.lazy()`.
4. Run the verify-step (`SKILL.md` §4) and the relevant gotchas (`SKILL.md` §5 — e.g.
   `device.type` == `care_type`, override target must be `register()`-ed).
