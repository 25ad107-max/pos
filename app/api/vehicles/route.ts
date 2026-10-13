import { NextResponse } from "next/server";
import { canManageFleet, forbiddenResponse, requireUser } from "@/lib/auth";
import { auditChanges } from "@/lib/audit";
import { vehicleInput } from "@/lib/fleet-validation";
import { prisma } from "@/lib/prisma";

function assignmentError(status: string, driverId: string | null) {
  if (driverId && status !== "ASSIGNED") {
    return "Choose Assigned when a driver is selected.";
  }
  if (!driverId && status === "ASSIGNED") {
    return "Select a driver for an assigned vehicle.";
  }
  return null;
}

async function validateDriverAssignment(driverId: string | null) {
  if (!driverId) return null;
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, archivedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  return driver ? null : "Choose an active driver.";
}

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();

  try {
    const [vehicles, drivers] = await Promise.all([
      prisma.vehicle.findMany({
        where: { archivedAt: null },
        orderBy: [{ status: "asc" }, { vehicleNumber: "asc" }],
        include: {
          assignedDriver: { select: { id: true, driverNumber: true, name: true, phone: true } },
          _count: { select: { loads: { where: { status: "DELIVERED" } } } },
        },
      }),
      prisma.driver.findMany({
        where: { archivedAt: null, status: "ACTIVE" },
        select: { id: true, driverNumber: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const expiryLimit = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => ({
        ...vehicle,
        documentAttention: [
          vehicle.insuranceExpiry,
          vehicle.fitnessExpiry,
          vehicle.permitExpiry,
          vehicle.pollutionExpiry,
        ].some((expiry) => expiry !== null && expiry.getTime() <= expiryLimit),
      })),
      drivers,
    });
  } catch (error) {
    console.error("[vehicles:list] Unable to load vehicles.", error);
    return NextResponse.json({ error: "Unable to load vehicle records." }, { status: 500 });
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
  const parsed = vehicleInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the vehicle details and try again.", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const stateError = assignmentError(parsed.data.status, parsed.data.assignedDriverId);
  if (stateError) return NextResponse.json({ error: stateError }, { status: 422 });

  try {
    const driverError = await validateDriverAssignment(parsed.data.assignedDriverId);
    if (driverError) return NextResponse.json({ error: driverError }, { status: 422 });

    const vehicleNumber = parsed.data.vehicleNumber;
    const vehicle = await prisma.$transaction(async (tx) => {
      const created = await tx.vehicle.create({
        data: { ...parsed.data, vehicleNumber, createdBy: user!.id },
        include: {
          assignedDriver: { select: { id: true, driverNumber: true, name: true, phone: true } },
          _count: { select: { loads: { where: { status: "DELIVERED" } } } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "CREATE",
          entityType: "VEHICLE",
          entityId: created.id,
          changes: auditChanges(null, created, Object.keys(parsed.data)),
        },
      });
      return created;
    });
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That vehicle number is already registered." }, { status: 409 });
    }
    console.error("[vehicles:create] Unable to create vehicle.", error);
    return NextResponse.json({ error: "Unable to save the vehicle record." }, { status: 500 });
  }
}
