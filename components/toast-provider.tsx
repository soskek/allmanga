"use client";

import React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: number;
  message: string;
  undoEndpoint?: string;
  undoBody?: Record<string, unknown>;
};

const ToastContext = createContext<{
  pushToast: (item: Omit<ToastItem, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const router = useRouter();

  const value = useMemo(
    () => ({
      pushToast(item: Omit<ToastItem, "id">) {
        const next = { ...item, id: Date.now() + Math.random() };
        setItems((current) => [...current, next]);
        window.setTimeout(() => {
          setItems((current) => current.filter((toast) => toast.id !== next.id));
        }, 5000);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 bottom-24 z-50 flex flex-col gap-3 sm:left-auto sm:right-6 sm:w-96">
        {items.map((item) => (
          <div key={item.id} className="surface flex items-center justify-between gap-4 px-4 py-3">
            <p className="text-sm font-medium text-ink">{item.message}</p>
            {item.undoEndpoint ? (
              <button
                className={cn(
                  "rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink",
                  "hover:border-ember/30 hover:text-ember"
                )}
                onClick={async () => {
                  if (!item.undoEndpoint) {
                    return;
                  }
                  await fetch(item.undoEndpoint, {
                    method: "POST",
                    headers: {
                      "content-type": "application/json"
                    },
                    body: JSON.stringify(item.undoBody ?? {})
                  });
                  setItems((current) => current.filter((toast) => toast.id !== item.id));
                  router.refresh();
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
