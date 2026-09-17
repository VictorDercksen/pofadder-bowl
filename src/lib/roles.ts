/**
 * Effective-role resolution. Pure so it can be unit tested; the database still enforces
 * every permission, this only decides what the UI shows and which screens are offered.
 */

export type Role = "participant" | "member" | "commissioner" | "admin";

export type RealAccess = {
  /** membership.is_admin */
  isAdmin: boolean;
  /** membership.is_commissioner (admins inherit this) */
  isCommissioner: boolean;
  /** event.participant_user_id === user.id */
  isParticipant: boolean;
};

export type EffectiveAccess = RealAccess & {
  /** Effective role: admin > commissioner > participant > member. */
  role: Role;
  /** True when the signed-in account holds more than plain membership. */
  canViewAsMember: boolean;
  /** True when an elevated account has switched to the league member view. */
  viewingAsMember: boolean;
};

/** Cookie that switches an elevated account to the league member view. */
export const MEMBER_VIEW_COOKIE = "pb-member-view";

export function roleOf(a: RealAccess): Role {
  return a.isAdmin ? "admin" : a.isCommissioner ? "commissioner" : a.isParticipant ? "participant" : "member";
}

/**
 * Applies the member-view switch. The switch can only ever remove capabilities: a plain
 * member with the cookie set is unaffected, and an elevated account in member view is
 * treated as a member by every page and server action (RLS still knows the real role).
 */
export function resolveAccess(real: RealAccess, memberView: boolean): EffectiveAccess {
  const isCommissioner = real.isCommissioner || real.isAdmin;
  const realRole = roleOf({ ...real, isCommissioner });
  const canViewAsMember = realRole !== "member";
  const viewingAsMember = canViewAsMember && memberView;
  if (viewingAsMember) {
    return { isAdmin: false, isCommissioner: false, isParticipant: false, role: "member", canViewAsMember, viewingAsMember };
  }
  return { isAdmin: real.isAdmin, isCommissioner, isParticipant: real.isParticipant, role: realRole, canViewAsMember, viewingAsMember };
}

/** Header label. Shows every hat the account wears so the participant can tell their screen apart. */
export function describeRole(a: EffectiveAccess): string {
  if (a.viewingAsMember) return "LEAGUE MEMBER VIEW";
  const parts: string[] = [];
  if (a.role === "admin") parts.push("ADMIN");
  else if (a.role === "commissioner") parts.push("COMMISSIONER");
  if (a.isParticipant) parts.push("PARTICIPANT");
  if (parts.length === 0) parts.push("LEAGUE MEMBER");
  return parts.join(" · ");
}
