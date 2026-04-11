import { lazy } from "react";
import Page from "./components/Page";
import LoginOverride from "./pages/LoginOverride";
import QuickActionOverride from "./pages/QuickActionOverride";
import Hello from "./pages/Hello";

interface NavigationLink {
  url: string;
  name: string;
  icon?: React.ReactNode;
  children?: NavigationLink[];
}
interface Manifest {
  plugin: string;
  routes: Record<string, (...args: any) => React.ReactNode>;
  extends: string[];
  overrides?: Array<{
    component: string;
    replacement:
      | React.ComponentType<Record<string, unknown>>
      | React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>;
    priority?: number;
    description?: string;
  }>;
  components: {
    PatientInfoCardQuickActions: React.LazyExoticComponent<
      React.FC<{
        encounter: { id: string };
        patientId: string;
        facilityId: string;
      }>
    >;
  };
  navItems?: NavigationLink[];
  userNavItems?: NavigationLink[];
  adminNavItems?: NavigationLink[];
}

const manifest: Manifest = {
  plugin: "care_hello_fe",
  routes: {
    "/hello": () => (
      <Page>
        <Hello />
      </Page>
    ),
  },
  extends: [],
  overrides: [
    {
      component: "Login",
      replacement: LoginOverride,
      priority: 10,
      description: "care_hello_fe login replacement",
    },
    {
      component: "QuickAction",
      replacement: QuickActionOverride,
      priority: 10,
      description: "Replaces allergy quick action with diagnosis quick action",
    },
  ],
  components: {
    PatientInfoCardQuickActions: lazy(() => import("./components/Button")),
  },
  userNavItems: [],
  adminNavItems: [],
};

export default manifest;
