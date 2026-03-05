import { createContext, useContext, useRef } from "react";

const ContainerRefContext =
  createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export const useContainerRef = () => {
  const context = useContext(ContainerRefContext);
  if (!context)
    throw new Error(
      "useContainerRef must be used within a ContainerRefProvider",
    );
  return context;
};

export const ContainerRefProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ContainerRefContext.Provider value={ref}>
      {children}
    </ContainerRefContext.Provider>
  );
};
