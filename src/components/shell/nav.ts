export type ShellRole = "participant" | "member" | "commissioner" | "admin" | "demo" | "guest";
export type NavItem = { n: string; label: string; href: string; roles?: string[] };

/** Screens offered per effective role. Pages enforce access themselves; this is only the menu. */
export function navFor(role: ShellRole, base: string): NavItem[] {
  const all: NavItem[] = [
    { n: "01", label: "Game centre", href: `${base}/game-centre` },
    { n: "02", label: "My trip", href: `${base}/my-trip`, roles: ["participant", "commissioner", "admin", "demo"] },
    { n: "03", label: "Check-in map", href: `${base}/map` },
    { n: "04", label: "Proof locker", href: `${base}/proof`, roles: ["participant", "commissioner", "admin", "demo"] },
    { n: "05", label: "Commissioner", href: `${base}/review`, roles: ["commissioner", "admin", "demo"] },
    { n: "06", label: "Punishment Bingo", href: `${base}/bingo` },
    { n: "07", label: "Predictions", href: `${base}/predictions` },
    { n: "08", label: "Press room", href: `${base}/press` },
    { n: "09", label: "Final whistle", href: `${base}/recap` },
    { n: "10", label: "League access", href: role === "demo" ? `${base}/access` : `${base}/account` },
    { n: "11", label: "League admin", href: `${base}/review/members`, roles: ["admin"] },
  ];
  return all.filter((item) => !item.roles || item.roles.includes(role));
}
