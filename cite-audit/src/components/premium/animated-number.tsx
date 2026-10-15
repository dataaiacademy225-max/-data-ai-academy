"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Nombre qui défile de 0 à sa valeur à l'entrée dans l'écran.
 * La valeur finale est rendue côté serveur : lisible sans JavaScript et par les lecteurs d'écran.
 */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const format = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        el.textContent = format(n);
      },
    });
    return () => controls.stop();
    // format ne dépend que de decimals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value, decimals]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
