"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, BookOpen, Compass, Home, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/followed", label: "フォロー", icon: BookMarked },
  { href: "/discover", label: "発見", icon: Compass },
  { href: "/library", label: "ライブラリ", icon: BookOpen },
  { href: "/search", label: "検索", icon: Search }
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1 text-[9px] font-medium",
                active ? "bg-sand text-ember" : "text-ink/65"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
