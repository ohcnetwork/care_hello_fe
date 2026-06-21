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
