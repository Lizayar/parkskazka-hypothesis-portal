export type PortalNavItem = {
  href: string;
  label: string;
  requiresPermission?: string;
};

export const defaultPortalNavigation: readonly PortalNavItem[] = [
  { href: "/", label: "Summary" },
  { href: "/explorer", label: "Campaign explorer" },
  { href: "/hypotheses", label: "Hypotheses" },
  { href: "/rotations", label: "Rotations" },
  { href: "/creative-lab", label: "Creative Lab" },
  { href: "/data-quality", label: "Data quality" },
];
export * from "./read-models.js";

