"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Fond de l'en-tête : grille lumineuse et halos qui dérivent lentement. Décoratif uniquement. */
export function HeroBackground() {
  const reduce = useReducedMotion();
  const drift = (x: number[], y: number[], duration: number) =>
    reduce ? undefined : { x, y, transition: { duration, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const } };

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="premium-grid absolute inset-0" />
      <motion.div
        className="absolute -top-32 left-1/4 size-[28rem] rounded-full bg-[#ff7a29]/20 blur-[110px]"
        animate={drift([0, 80, -40], [0, 30, -20], 18)}
      />
      <motion.div
        className="absolute -top-24 right-0 size-[26rem] rounded-full bg-[#3b5ba5]/25 blur-[120px]"
        animate={drift([0, -60, 30], [0, 40, 10], 22)}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}
