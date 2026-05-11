import type { FormSpec, Group, Section } from "@/lib/schema";

export interface RespondentScope {
  /** Distinct role keys this respondent holds within this instance. */
  roles: Set<string>;
  /** Buildings the respondent is scoped to. "all" if any assignment has buildingId=null (Operator Admin). */
  buildingIds: Set<string> | "all";
  /** True iff the respondent is the Operator Admin (sees everything). */
  isOperatorAdmin: boolean;
}

export function computeScope(args: {
  assignments: Array<{ role: string; buildingId: string | null }>;
  isOperatorAdmin: boolean;
}): RespondentScope {
  const roles = new Set<string>();
  let buildingIds: Set<string> | "all" = new Set<string>();

  for (const a of args.assignments) {
    roles.add(a.role);
    if (buildingIds === "all") continue;
    if (a.buildingId === null) buildingIds = "all";
    else (buildingIds as Set<string>).add(a.buildingId);
  }

  return { roles, buildingIds, isOperatorAdmin: args.isOperatorAdmin };
}

export function isGroupVisibleToScope(
  group: Group,
  scope: RespondentScope
): boolean {
  if (scope.isOperatorAdmin) return true;
  if (!group.roles || group.roles.length === 0) return true;
  return group.roles.some((r) => scope.roles.has(r));
}

/**
 * Filter the template down to the sections + groups this respondent can see.
 * Sections with zero visible groups are dropped entirely.
 */
export function visibleSpec(formSpec: FormSpec, scope: RespondentScope): FormSpec {
  if (scope.isOperatorAdmin) return formSpec;

  const sections: Section[] = formSpec.sections
    .map((s) => ({
      ...s,
      groups: s.groups.filter((g) => isGroupVisibleToScope(g, scope)),
    }))
    .filter((s) => s.groups.length > 0);

  return { ...formSpec, sections };
}
