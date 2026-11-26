"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useAuth } from "@/modules/auth/hooks/useAuth";

interface AppProvidersProps {
  children: ReactNode;
}

// Bootstrap sem Context redundante; o estado de UI já é compartilhado pelo hook.
function AuthBootstrap({ children }: AppProvidersProps) {
  const { refreshSession } = useAuth();
  useEffect(() => {
    void refreshSession();
    const refresh = () => { void refreshSession(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("sidpb-session-expired", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("sidpb-session-expired", refresh); };
  }, [refreshSession]);
  return children;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>{children}</AuthBootstrap>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
