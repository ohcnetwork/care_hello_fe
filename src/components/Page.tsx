import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ContainerRefProvider, useContainerRef } from "@/hooks/useContainerRef";

const queryClient = new QueryClient();

function Providers(props: { children: React.ReactNode }) {
  const containerRef = useContainerRef();

  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      containerRef.current = container.current;
    }
  }, [container, containerRef]);

  return (
    <div className="care-hello-container" ref={container}>
      {props.children}
    </div>
  );
}

export default function Page(props: { children: React.ReactNode }) {
  return (
    <ContainerRefProvider>
      <QueryClientProvider client={queryClient}>
        <Providers>{props.children}</Providers>
      </QueryClientProvider>
    </ContainerRefProvider>
  );
}
