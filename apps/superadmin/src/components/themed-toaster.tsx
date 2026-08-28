"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
