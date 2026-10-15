"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Arrière-plan du haut de la page d'accueil : grille, halos qui respirent et horizon lumineux. Décoratif. */
export function LandingGlow() {
  const reduce = useReducedMotion();
  const breathe = (scale: number[], duration: number) =>
    reduce ? undefined : { scale, opacity: [0.7, 1, 0.7], transition: { duration, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="premium-grid absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,#000_35%,transparent_80%)]" />
      <motion.div
        className="absolute -top-40 left-1/2 h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_122_41/0.28),transparent)] blur-2xl"
        animate={breathe([1, 1.08, 1], 9)}
      />
      <motion.div
        className="absolute top-24 -right-40 size-[30rem] rounded-full bg-[#3b5ba5]/25 blur-[120px]"
        animate={breathe([1, 1.12, 1], 13)}
      />
      <motion.div
        className="absolute top-60 -left-40 size-[24rem] rounded-full bg-[#ff7a29]/10 blur-[110px]"
        animate={breathe([1.1, 1, 1.1], 11)}
      />
      {/* Horizon : une ligne fine avec un faisceau qui la parcourt. */}
      <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-gradient-to-r from-transparent via-white/15 to-transparent">
        <div className="beam h-px w-1/3 bg-gradient-to-r from-transparent via-[#ff7a29] to-transparent" />
      </div>
    </div>
  );
}
