export type NavItem = { href: string; label: string };

// Pages shown in the sidebar once the user is inside the app.
export const appNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/diagnosis", label: "Disease diagnosis" },
  { href: "/experiments", label: "FL experiments" },
  { href: "/results", label: "Results & analytics" },
  { href: "/about", label: "Project information" },
];
