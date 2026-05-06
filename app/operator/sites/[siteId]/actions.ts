"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";

export async function updateSite(
  siteId: string,
  args: { name: string; address: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();
  if (!args.name) return { ok: false, error: "Site name required." };

  const site = await db.site.findFirst({
    where: { id: siteId, operatorId: me.operatorId, deletedAt: null },
  });
  if (!site) return { ok: false, error: "Site not found." };

  await db.site.update({
    where: { id: siteId },
    data: { name: args.name, address: args.address },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "site.updated",
    targetType: "Site",
    targetId: siteId,
    payload: { name: args.name, address: args.address ?? undefined },
  });

  return { ok: true };
}

export async function addBuilding(
  siteId: string,
  name: string
): Promise<{ ok: true; buildingId: string } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();
  if (!name) return { ok: false, error: "Building name required." };

  const site = await db.site.findFirst({
    where: { id: siteId, operatorId: me.operatorId, deletedAt: null },
  });
  if (!site) return { ok: false, error: "Site not found." };

  const b = await db.building.create({
    data: { siteId, name },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "building.added",
    targetType: "Building",
    targetId: b.id,
    payload: { siteId, name },
  });

  return { ok: true, buildingId: b.id };
}

export async function removeBuilding(
  siteId: string,
  buildingId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  const building = await db.building.findFirst({
    where: { id: buildingId, siteId, deletedAt: null },
    include: {
      _count: { select: { answers: true, assignments: true } },
      site: true,
    },
  });
  if (!building) return { ok: false, error: "Building not found." };
  if (building.site.operatorId !== me.operatorId)
    return { ok: false, error: "Not your operator." };
  if (building.site.primaryBuildingId === buildingId)
    return { ok: false, error: "Can't remove the primary building." };
  if (building._count.answers > 0 || building._count.assignments > 0)
    return { ok: false, error: "Building is in use — can't remove." };

  await db.building.update({
    where: { id: buildingId },
    data: { deletedAt: new Date() },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "building.removed",
    targetType: "Building",
    targetId: buildingId,
  });

  return { ok: true };
}
