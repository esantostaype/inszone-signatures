/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/providers.tsx - MEJORADO
"use client";
import { ToastNotification } from "@/components";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";


export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <ToastNotification />
      </QueryProvider>
    </ThemeProvider>
  );
};