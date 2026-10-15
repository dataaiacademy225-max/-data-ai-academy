"use client";

import { InboxIcon, LayoutDashboardIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const MAIN_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboardIcon },
  { href: "/projects/new", label: "Nouveau projet", icon: PlusIcon },
  { href: "/settings/account", label: "Mon compte", icon: UserRoundIcon },
];
// Réservé au propriétaire : la page revérifie les droits côté serveur.
const OWNER_ITEMS = [{ href: "/settings/demandes-acces", label: "Demandes d'accès", icon: InboxIcon }];

export type NavProject = { id: string; companyName: string; isDemo: boolean };

const isActive = (pathname: string, href: string, exact: boolean) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/** Liens de navigation de l'espace connecté, avec repère animé sur la page active. */
export function NavLinks({
  projects = [],
  variant,
  owner = false,
}: {
  projects?: NavProject[];
  variant: "sidebar" | "bar";
  owner?: boolean;
}) {
  const pathname = usePathname();
  const items = owner ? [...MAIN_ITEMS, ...OWNER_ITEMS] : MAIN_ITEMS;
  const reduce = useReducedMotion();
  const pillId = `nav-pill-${variant}`;

  const item = (href: string, label: string, icon: ReactNode, active: boolean, extra?: ReactNode) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId={reduce ? undefined : pillId}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute inset-0 rounded-md border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]"
          aria-hidden="true"
        />
      )}
      {active && variant === "sidebar" && (
        <span aria-hidden="true" className="absolute top-1/2 -left-3 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_rgb(255_122_41/0.8)]" />
      )}
      <span className="relative flex items-center gap-2.5 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {extra && <span className="relative ml-auto">{extra}</span>}
    </Link>
  );

  if (variant === "bar") {
    return (
      <nav aria-label="Navigation principale" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
        {items.map(({ href, label, icon: Icon }) =>
          item(href, label, <Icon className="size-4" aria-hidden="true" />, isActive(pathname, href, href === "/dashboard")),
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Navigation principale" className="space-y-6">
      <div className="space-y-0.5">
        {items.map(({ href, label, icon: Icon }) =>
          item(
            href,
            label,
            <Icon className="size-4 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />,
            isActive(pathname, href, href === "/dashboard"),
          ),
        )}
      </div>
      {projects.length > 0 && (
        <div>
          <p className="px-3 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">Projets</p>
          <div className="space-y-0.5">
            {projects.map((project) =>
              item(
                `/projects/${project.id}`,
                project.companyName,
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full transition-shadow duration-300",
                    project.isDemo ? "bg-[#7d9bd1]" : "bg-accent group-hover:shadow-[0_0_8px_rgb(255_122_41/0.9)]",
                  )}
                />,
                isActive(pathname, `/projects/${project.id}`, false),
                project.isDemo ? <span className="text-[10px] text-muted-foreground">Démo</span> : undefined,
              ),
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
