import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { canManageFleet, forbiddenResponse, requireUser } from "@/lib/auth";
import { auditChanges } from "@/lib/audit";
import { driverInput } from "@/lib/fleet-validation";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();

  try {
    const drivers = await prisma.driver.findMany({
      where: { archivedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { loads: true, assignedVehicles: true } },
        assignedVehicles: { select: { id: true, vehicleNumber: true } },
      },
    });
    return NextResponse.json({ drivers });
  } catch (error) {
    console.error("[drivers:list] Unable to load drivers.", error);
    return NextResponse.json({ error: "Unable to load driver records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();

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
    const driverNumber = `DR-${randomBytes(4).toString("hex").toUpperCase()}`;
    const driver = await prisma.$transaction(async (tx) => {
      const created = await tx.driver.create({
        data: { ...parsed.data, driverNumber, createdBy: user!.id },
        include: {
          _count: { select: { loads: true, assignedVehicles: true } },
          assignedVehicles: { select: { id: true, vehicleNumber: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "CREATE",
          entityType: "DRIVER",
          entityId: created.id,
          changes: auditChanges(null, created, Object.keys(parsed.data)),
        },
      });
      return created;
    });
    return NextResponse.json({ driver }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A driver with that licence number already exists." },
        { status: 409 },
      );
    }
    console.error("[drivers:create] Unable to create driver.", error);
    return NextResponse.json({ error: "Unable to save the driver record." }, { status: 500 });
  }
}
