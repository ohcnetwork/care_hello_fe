import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useRoutes } from "raviger";
import Page from "@/components/Page";
import Main from "@/pages/Main";
import manifest from "@/manifest";
import "@/style/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

function App() {
  const manifestRoute = useRoutes(manifest.routes);

  if (manifestRoute) {
    return <>{manifestRoute}</>;
  }

  return (
    <Page>
      <Main />
    </Page>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);