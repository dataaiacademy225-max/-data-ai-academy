"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Carte avec halo orange qui suit la souris et bordure qui s'éclaire au survol. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        "spotlight group relative h-full overflow-hidden rounded-xl border border-border bg-card/80 shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset] transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_20px_50px_-20px_rgb(255_122_41/0.25)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
