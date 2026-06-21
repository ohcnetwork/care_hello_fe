# Manifest contract

> **Snapshot — verify against the host.** The authoritative source is
> `/Users/bodhishthomas/code/care_fe/src/pluginTypes.ts`. This file is a point-in-time
> copy for quick reference. If anything here disagrees with `pluginTypes.ts`, the host file
> wins. When you use a slot or extension point, re-read its exact type in `pluginTypes.ts`
> and mirror it into this plugin's `src/types/pluginManifest.ts`.

## `PluginManifest`

The default export of `src/manifest.tsx`. The host duck-types it — no field is validated
across the federation boundary, so the vendored `PluginManifest` type in
`src/types/pluginManifest.ts` (and `const manifest: PluginManifest`) is your only
compile-time guard.

| Field | Type | Notes |
|-------|------|-------|
| `plugin` | `string` | **Required.** The plugin slug. Must equal `federation.name` and the enabled-apps slug. |
| `routes?` | `AppRoutes` (`Record<string, (params) => ReactNode>`) | raviger-style route map; `:param` segments are passed as named args. |
| `extends?` | `readonly ("DoctorConnectButtons" \| "PatientExternalRegistration")[]` | Opt-in to extension points. |
| `navItems?` | `NavigationLink[]` | Main sidebar nav. |
| `billingNavItems?` | `NavigationLink[]` | Billing section nav. |
| `userNavItems?` | `NavigationLink[]` | User/profile menu nav. |
| `adminNavItems?` | `NavigationLink[]` | Admin section nav. |
| `organizationTabs?` | `PluginOrganizationTab[]` | Tabs on the organization screen. |
| `components?` | `PluginComponentMap` | Component slots (see table below). **Each value must be `React.lazy()`.** |
| `encounterTabs?` | `Record<string, LazyComponent<FC<PluginEncounterTabProps>>>` | Extra tabs on the encounter screen. **Lazy.** |
| `devices?` | `readonly PluginDeviceManifest[]` | Device integrations; `type` must equal the backend `care_type`. |
| `overrides?` | `readonly PluginOverride[]` | Component overrides (target must be `register()`-ed in the host). |

`NavigationLink` (host `src/components/ui/sidebar/nav-main.tsx`):

```ts
interface NavigationLink {
  header?: string;
  headerIcon?: ReactNode;
  name: string;
  url: string;
  icon?: ReactNode;
  visibility?: boolean;
  children?: NavigationLink[];
}
```

## Component slots — `SupportedPluginComponents` (all 17)

Provided under `manifest.components`. **Each value MUST be wrapped in `React.lazy(() =>
import(...))`** — the host renders every slot under `Suspense` + `PluginErrorBoundary`, and
a non-lazy component fails to render.

The host also **injects an extra `__meta?: PlugConfigMeta` prop** into every slot at
runtime, on top of the props below. It is optional; ignore it unless you need plugin
metadata. Plugins can't import `PlugConfigMeta`, so type it loosely (e.g. `__meta?:
Record<string, unknown>`) if you read it.

Prop types below are copied verbatim from `care_fe/src/pluginTypes.ts` (≈ lines 20–143).

| Slot key | Component type (props) |
|----------|------------------------|
| `DoctorConnectButtons` | `React.FC<{ user: UserReadMinimal }>` |
| `Scribe` | `React.FC<{ formState: QuestionnaireFormState[]; setFormState: React.Dispatch<React.SetStateAction<QuestionnaireFormState[]>> }>` |
| `PatientHomeActions` | `React.FC<{ patient: PatientRead; facilityId?: string; className?: string }>` |
| `PatientInfoCardQuickActions` | `React.FC<{ encounter: EncounterRead; className?: string }>` |
| `EncounterActions` | `React.FC<{ encounter: EncounterRead; className?: string }>` |
| `PatientInfoCardMarkAsComplete` | `React.FC<{ encounter: EncounterRead }>` |
| `FacilityHomeActions` | `React.FC<{ facility: FacilityRead; className?: string }>` |
| `PatientRegistrationForm` | `React.FC<{ form: UseFormReturn<any>; facilityId?: string; patientId?: string; submitForm?: () => void }>` |
| `PatientDetailsTabDemographyGeneralInfo` | `React.FC<{ facilityId: string; patientId: string; patientData: PatientRead }>` |
| `InvoiceRecordPaymentOptions` | `React.FC<{ facilityId: string; invoice: InvoiceRead }>` |
| `PatientSearchActions` | `React.FC<{ facilityId: string; className?: string }>` |
| `PatientInfoCardActions` | `React.FC<{ facilityId: string; patient: PatientRead \| PatientListRead \| PublicPatientRead; className?: string }>` |
| `ServiceRequestAction` | `React.FC<{ serviceRequestId: string }>` |
| `EncounterOverviewTop` | `React.FC<{ encounter: EncounterRead; patientId: string; encounterId: string }>` |
| `DiagnosticReportOverride` | `React.FC<{ observationDefinitions: {...}[]; handleComponentValueChange: (...) => void; handleValueChange: (...) => void; handleUnitChange: (...) => void; disabled?: boolean }>` (see `pluginTypes.ts` for the full `observationDefinitions` / handler signatures) |
| `PatientHomeQuickActions` | `React.FC<{ patient: PatientRead; facilityId?: string; className?: string }>` (same as `PatientHomeActions`) |
| `DeliveryOrderActions` | `React.FC<{ facilityId: string; locationId: string }>` |

The rich prop types (`UserReadMinimal`, `PatientRead`, `EncounterRead`, `FacilityRead`,
`InvoiceRead`, `QuestionnaireFormState`, etc.) are host types. A plugin **cannot import
them**. For each slot you use, mirror only the fields you read as a minimal structural type
in `src/types/pluginManifest.ts` (the template does this for `EncounterRead = { id: string }`),
or `clone-component` the full host type if you need it.

## Other manifest shapes (for the advanced extension points)

```ts
type PluginOrganizationTab = {
  name: string;
  slug: string;
  icon: ReactNode;
  component: React.FC<{ contextId: string; navOrganizationId?: string }>;
};

type PluginDeviceManifest = {
  type: string; // must equal the device's backend `care_type`
  icon?: React.FC<React.HTMLAttributes<HTMLElement>>;
  configureForm?: React.FC<{ facilityId: string; metadata: Record<string, unknown>; onChange: (m: Record<string, unknown>) => void }>;
  showPageCard?: React.FC<{ device: DeviceDetail; facilityId: string }>;
  encounterOverview?: React.FC<{ encounter: EncounterRead }>;
};

type PluginOverride = {
  component: string; // key of a host component registered with register()
  replacement: ComponentType<any> | LazyExoticComponent<ComponentType<any>>;
  condition?: OverrideCondition;
  priority?: number; // higher wins, default 0
  description?: string;
};
```

`encounterTabs` components receive `PluginEncounterTabProps` (host
`src/pages/Encounters/EncounterShow.tsx`). See `references/advanced-extension-points.md`.
