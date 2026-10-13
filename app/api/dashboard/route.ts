import { NextResponse } from "next/server";
import { canViewDashboard, forbiddenResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function indiaDayStart(date: Date) {
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${localDay}T00:00:00+05:30`);
}

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canViewDashboard(user!)) return forbiddenResponse();

  try {
    const today = indiaDayStart(new Date());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const [activeDrivers, activeVehicles, todayOrders, pendingOrders, outstanding, deliveredToday, recentLoads] =
      await Promise.all([
        prisma.driver.count({ where: { status: "ACTIVE", archivedAt: null } }),
        prisma.vehicle.count({
          where: { status: { in: ["AVAILABLE", "ASSIGNED"] }, archivedAt: null },
        }),
        prisma.order.findMany({
          where: { createdAt: { gte: today, lt: tomorrow }, archivedAt: null },
          select: { totalAmount: true },
        }),
        prisma.order.count({
          where: {
            status: { in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "OUT_FOR_DELIVERY"] },
            archivedAt: null,
          },
        }),
        prisma.order.findMany({
          where: { paymentStatus: { in: ["PENDING", "PARTIALLY_PAID"] }, archivedAt: null },
          select: { totalAmount: true, amountPaid: true },
        }),
        prisma.load.count({
          where: { status: "DELIVERED", deliveredAt: { gte: today, lt: tomorrow } },
        }),
        prisma.load.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            driver: { select: { name: true } },
            vehicle: { select: { vehicleNumber: true } },
            order: {
              select: {
                orderNumber: true,
                customer: { select: { name: true } },
                material: { select: { name: true } },
              },
            },
          },
        }),
      ]);

    const todaysRevenue = todayOrders.reduce((total, order) => total + Number(order.totalAmount), 0);
    const outstandingPayments = outstanding.reduce(
      (total, order) => total + Number(order.totalAmount) - Number(order.amountPaid),
      0,
    );

    return NextResponse.json({
      metrics: {
        activeDrivers,
        activeVehicles,
        todayOrders: todayOrders.length,
        todaysRevenue,
        pendingOrders,
        outstandingPayments,
        deliveredToday,
      },
      recentLoads,
    });
  } catch (error) {
    console.error("[dashboard:summary] Unable to load dashboard data.", error);
    return NextResponse.json({ error: "Unable to load dashboard data." }, { status: 500 });
  }
}
