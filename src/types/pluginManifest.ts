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
