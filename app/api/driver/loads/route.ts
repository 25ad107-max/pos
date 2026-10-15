import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (user!.role !== "DRIVER") {
    return NextResponse.json({ error: "Driver access is required." }, { status: 403 });
  }

  try {
    const driver = await prisma.driver.findFirst({
      where: { userId: user!.id, status: "ACTIVE", archivedAt: null },
      select: {
        id: true,
        driverNumber: true,
        name: true,
        assignedVehicles: {
          where: { status: { in: ["AVAILABLE", "ASSIGNED"] } },
          select: { vehicleNumber: true, vehicleType: true },
          take: 1,
        },
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Your driver profile is not linked or is inactive. Contact your manager." },
        { status: 403 },
      );
    }

    const loads = await prisma.load.findMany({
      where: {
        driverId: driver.id,
        status: { not: "CANCELLED" },
      },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        loadNumber: true,
        status: true,
        quantity: true,
        deliveryDate: true,
        driverNotes: true,
        order: {
          select: {
            orderNumber: true,
            deliveryLocation: true,
            deliveryDate: true,
            material: { select: { name: true } },
            customer: { select: { name: true, phone: true } },
          },
        },
        vehicle: { select: { vehicleNumber: true, vehicleType: true } },
      },
    });

    return NextResponse.json({
      driver: {
        driverNumber: driver.driverNumber,
        name: driver.name,
        assignedVehicles: driver.assignedVehicles,
      },
      loads,
    });
  } catch (error) {
    console.error("[driver:loads] Unable to load assigned deliveries.", error);
    return NextResponse.json({ error: "Unable to load your deliveries." }, { status: 500 });
  }
}
