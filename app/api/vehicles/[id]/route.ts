import { NextResponse } from "next/server";
import { canManageFleet, forbiddenResponse, requireUser } from "@/lib/auth";
import { auditChanges } from "@/lib/audit";
import { vehicleInput } from "@/lib/fleet-validation";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

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
  const parsed = vehicleInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the vehicle details and try again.", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  if (parsed.data.assignedDriverId && parsed.data.status !== "ASSIGNED") {
    return NextResponse.json({ error: "Choose Assigned when a driver is selected." }, { status: 422 });
  }
  if (!parsed.data.assignedDriverId && parsed.data.status === "ASSIGNED") {
    return NextResponse.json({ error: "Select a driver for an assigned vehicle." }, { status: 422 });
  }

  try {
    if (parsed.data.assignedDriverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: parsed.data.assignedDriverId, archivedAt: null, status: "ACTIVE" },
        select: { id: true },
      });
      if (!driver) return NextResponse.json({ error: "Choose an active driver." }, { status: 422 });
    }
    const vehicle = await prisma.$transaction(async (tx) => {
      const previous = await tx.vehicle.findFirst({ where: { id, archivedAt: null } });
      if (!previous) return null;
      const updated = await tx.vehicle.update({
        where: { id, archivedAt: null },
        data: parsed.data,
        include: {
          assignedDriver: { select: { id: true, driverNumber: true, name: true, phone: true } },
          _count: { select: { loads: { where: { status: "DELIVERED" } } } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "UPDATE",
          entityType: "VEHICLE",
          entityId: updated.id,
          changes: auditChanges(previous, updated, Object.keys(parsed.data)),
        },
      });
      return updated;
    });
    if (!vehicle) return NextResponse.json({ error: "Vehicle record was not found." }, { status: 404 });
    return NextResponse.json({ vehicle });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle record was not found." }, { status: 404 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That vehicle number is already registered." }, { status: 409 });
    }
    console.error("[vehicles:update] Unable to update vehicle.", error);
    return NextResponse.json({ error: "Unable to update the vehicle record." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();
  const { id } = await context.params;

  try {
    const archived = await prisma.$transaction(async (tx) => {
      const previous = await tx.vehicle.findFirst({ where: { id, archivedAt: null } });
      if (!previous) return null;
      const archived = await tx.vehicle.update({
        where: { id, archivedAt: null },
        data: { archivedAt: new Date(), status: "INACTIVE", assignedDriverId: null },
      });
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "ARCHIVE",
          entityType: "VEHICLE",
          entityId: archived.id,
          changes: auditChanges(previous, archived, ["status", "assignedDriverId", "archivedAt"]),
        },
      });
      return archived;
    });
    if (!archived) return NextResponse.json({ error: "Vehicle record was not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle record was not found." }, { status: 404 });
    }
    console.error("[vehicles:archive] Unable to archive vehicle.", error);
    return NextResponse.json({ error: "Unable to archive the vehicle record." }, { status: 500 });
  }
}
