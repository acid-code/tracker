"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppPaletteSync } from "@/components/AppPaletteSync";
import { DailyTipPrefetch } from "@/components/DailyTip";
import { makeQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={client}>
      <AppPaletteSync />
      <DailyTipPrefetch />
      {children}
    </QueryClientProvider>
  );
}
