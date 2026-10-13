import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { canManageFleet, forbiddenResponse, requireUser } from "@/lib/auth";
import { auditChanges } from "@/lib/audit";
import { driverInput } from "@/lib/fleet-validation";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

async function unassignDriverVehicles(
  tx: Prisma.TransactionClient,
  driverId: string,
  actorId: string,
) {
  const vehicles = await tx.vehicle.findMany({
    where: { assignedDriverId: driverId, status: "ASSIGNED" },
  });
  for (const vehicle of vehicles) {
    const updated = await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { assignedDriverId: null, status: "AVAILABLE" },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "UNASSIGN",
        entityType: "VEHICLE",
        entityId: updated.id,
        changes: auditChanges(vehicle, updated, ["assignedDriverId", "status"]),
      },
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = driverInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the driver details and try again.", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    const driver = await prisma.$transaction(async (tx) => {
      const previous = await tx.driver.findFirst({ where: { id, archivedAt: null } });
      if (!previous) return null;
      const updated = await tx.driver.update({
        where: { id, archivedAt: null },
        data: parsed.data,
        include: {
          _count: { select: { loads: true, assignedVehicles: true } },
          assignedVehicles: { select: { id: true, vehicleNumber: true } },
        },
      });
      if (updated.status === "INACTIVE") {
        await unassignDriverVehicles(tx, updated.id, user!.id);
        if (updated.userId) {
          await tx.user.update({ where: { id: updated.userId }, data: { isActive: false } });
          await tx.session.deleteMany({ where: { userId: updated.userId } });
        }
      }
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "UPDATE",
          entityType: "DRIVER",
          entityId: updated.id,
          changes: auditChanges(previous, updated, Object.keys(parsed.data)),
        },
      });
      return updated;
    });
    if (!driver) return NextResponse.json({ error: "Driver record was not found." }, { status: 404 });
    return NextResponse.json({ driver });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Driver record was not found." }, { status: 404 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A driver with that licence number already exists." },
        { status: 409 },
      );
    }
    console.error("[drivers:update] Unable to update driver.", error);
    return NextResponse.json({ error: "Unable to update the driver record." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();
  const { id } = await context.params;

  try {
    const archived = await prisma.$transaction(async (tx) => {
      const previous = await tx.driver.findFirst({ where: { id, archivedAt: null } });
      if (!previous) return null;
      await unassignDriverVehicles(tx, id, user!.id);
      const archived = await tx.driver.update({
        where: { id, archivedAt: null },
        data: { archivedAt: new Date(), status: "INACTIVE" },
      });
      if (archived.userId) {
        await tx.user.update({ where: { id: archived.userId }, data: { isActive: false } });
        await tx.session.deleteMany({ where: { userId: archived.userId } });
      }
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "ARCHIVE",
          entityType: "DRIVER",
          entityId: archived.id,
          changes: auditChanges(previous, archived, ["status", "archivedAt"]),
        },
      });
      return archived;
    });
    if (!archived) return NextResponse.json({ error: "Driver record was not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Driver record was not found." }, { status: 404 });
    }
    console.error("[drivers:archive] Unable to archive driver.", error);
    return NextResponse.json({ error: "Unable to archive the driver record." }, { status: 500 });
  }
}
