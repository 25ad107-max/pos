import { NextResponse } from "next/server";
import type { LoadStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const allowedTransitions: Partial<Record<LoadStatus, LoadStatus>> = {
  ASSIGNED: "ACCEPTED",
  ACCEPTED: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (user!.role !== "DRIVER") {
    return NextResponse.json({ error: "Driver access is required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("status" in body) ||
      typeof body.status !== "string" ||
      !["ACCEPTED", "IN_TRANSIT", "DELIVERED"].includes(body.status)) {
    return NextResponse.json({ error: "Choose a valid delivery status." }, { status: 422 });
  }

  const { id } = await context.params;
  const nextStatus = body.status as LoadStatus;

  try {
    const driver = await prisma.driver.findFirst({
      where: { userId: user!.id, status: "ACTIVE", archivedAt: null },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ error: "Your driver profile is not available." }, { status: 403 });
    }

    const load = await prisma.load.findFirst({
      where: { id, driverId: driver.id },
      select: { id: true, status: true },
    });
    if (!load) {
      return NextResponse.json({ error: "Delivery was not found." }, { status: 404 });
    }
    if (allowedTransitions[load.status] !== nextStatus) {
      return NextResponse.json(
        { error: "This delivery status can no longer be changed from its current state." },
        { status: 409 },
      );
    }

    const updated = await prisma.load.updateMany({
      where: { id: load.id, driverId: driver.id, status: load.status },
      data: {
        status: nextStatus,
        ...(nextStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "The delivery changed before your update could be saved. Refresh and try again." },
        { status: 409 },
      );
    }

    return NextResponse.json({ status: nextStatus });
  } catch (error) {
    console.error("[driver:load-status] Unable to update delivery status.", error);
    return NextResponse.json({ error: "Unable to update the delivery status." }, { status: 500 });
  }
}
