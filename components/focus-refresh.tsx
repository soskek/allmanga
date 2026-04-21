"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function FocusRefresh() {
  const router = useRouter();
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const refreshIfReturned = () => {
      const hiddenAt = hiddenAtRef.current;
      if (!hiddenAt) {
        return;
      }
      if (Date.now() - hiddenAt > 1500) {
        router.refresh();
      }
      hiddenAtRef.current = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      refreshIfReturned();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refreshIfReturned);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refreshIfReturned);
    };
  }, [router]);

  return null;
}
