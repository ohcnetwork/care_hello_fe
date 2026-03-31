import { lazy } from "react";
import Page from "./components/Page";
import Hello from "./pages/Hello";
import AppStore from "./pages/AppStore";

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
    "/app-store": () => (
      <Page>
        <AppStore />
      </Page>
    ),
  },
  extends: [],
  components: {
    PatientInfoCardQuickActions: lazy(() => import("./components/Button")),
  },
  navItems: [
    {
      url: "/app-store",
      name: "App Store",
    },
  ],
  userNavItems: [],
  adminNavItems: [],
};

export default manifest;
