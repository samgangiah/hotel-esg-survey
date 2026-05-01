import raw from "@/data/questions.json";
import type { FormSpec, Group, Section, Question } from "./schema";

export const formSpec = raw as unknown as FormSpec;

export function getSection(sectionId: string): Section | undefined {
  return formSpec.sections.find((s) => s.id === sectionId);
}

export function getGroup(
  sectionId: string,
  groupId: string
): { section: Section; group: Group } | undefined {
  const section = getSection(sectionId);
  if (!section) return undefined;
  const group = section.groups.find((g) => g.id === groupId);
  if (!group) return undefined;
  return { section, group };
}

export interface GroupRef {
  sectionIndex: number;
  groupIndex: number;
  sectionId: string;
  groupId: string;
}

export function getAllGroups(): GroupRef[] {
  const refs: GroupRef[] = [];
  formSpec.sections.forEach((s, si) =>
    s.groups.forEach((g, gi) =>
      refs.push({
        sectionIndex: si,
        groupIndex: gi,
        sectionId: s.id,
        groupId: g.id,
      })
    )
  );
  return refs;
}

export function findGroupRef(
  sectionId: string,
  groupId: string
): GroupRef | undefined {
  return getAllGroups().find(
    (r) => r.sectionId === sectionId && r.groupId === groupId
  );
}

export function nextGroupRef(current: GroupRef): GroupRef | undefined {
  const all = getAllGroups();
  const idx = all.findIndex(
    (r) =>
      r.sectionId === current.sectionId && r.groupId === current.groupId
  );
  return all[idx + 1];
}

export function prevGroupRef(current: GroupRef): GroupRef | undefined {
  const all = getAllGroups();
  const idx = all.findIndex(
    (r) =>
      r.sectionId === current.sectionId && r.groupId === current.groupId
  );
  return idx > 0 ? all[idx - 1] : undefined;
}

export function isLastGroup(current: GroupRef): boolean {
  const all = getAllGroups();
  return (
    all[all.length - 1].sectionId === current.sectionId &&
    all[all.length - 1].groupId === current.groupId
  );
}

export function findQuestion(id: string): Question | undefined {
  for (const section of formSpec.sections) {
    for (const group of section.groups) {
      for (const q of group.questions) {
        if (q.id === id) return q;
        if (q.subQuestions) {
          const sub = q.subQuestions.find((sq) => sq.id === id);
          if (sub) return sub;
        }
      }
    }
  }
  return undefined;
}
