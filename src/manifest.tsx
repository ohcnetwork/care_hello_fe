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
