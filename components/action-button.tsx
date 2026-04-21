"use client";

import { BellOff, Check, CheckCheck, Clock3, Pin, Plus, RotateCcw, UserMinus, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

type Props = {
  endpoint: string;
  label: string;
  body?: Record<string, unknown>;
  className?: string;
  undoEndpoint?: string;
  undoBody?: Record<string, unknown>;
  successMessage?: string;
  icon?: "check" | "check-double" | "clock" | "pin" | "volume-x" | "bell-off" | "user-minus" | "plus" | "rotate-ccw";
  hideLabel?: boolean;
  variant?: "neutral" | "solid" | "danger";
};

export function ActionButton({
  endpoint,
  label,
  body,
  className,
  undoEndpoint,
  undoBody,
  successMessage,
  icon,
  hideLabel = false,
  variant = "neutral"
}: Props) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const Icon = icon ? iconMap[icon] : null;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-medium shadow-sm",
        hideLabel ? "h-6 w-6 px-0 py-0" : "h-7 px-2",
        variant === "solid" && "border-ink bg-ink text-white hover:border-ink hover:text-white/95",
        variant === "danger" && "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:text-rose-800",
        variant === "neutral" && "border-ink/10 bg-white/92 text-ink hover:border-ember/25 hover:text-ember",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      disabled={pending}
      title={label}
      aria-label={label}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify(body ?? {})
          });
          if (!response.ok) {
            throw new Error("Request failed");
          }
          pushToast({
            message: successMessage ?? `${label} を反映しました`,
            undoEndpoint,
            undoBody
          });
          startTransition(() => {
            router.refresh();
          });
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? (
        "..."
      ) : (
        <>
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          {hideLabel ? null : label}
        </>
      )}
    </button>
  );
}

const iconMap = {
  check: Check,
  "check-double": CheckCheck,
  clock: Clock3,
  pin: Pin,
  "volume-x": VolumeX,
  "bell-off": BellOff,
  "user-minus": UserMinus,
  plus: Plus,
  "rotate-ccw": RotateCcw
} as const;
