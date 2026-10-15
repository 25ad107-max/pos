import { NextResponse } from "next/server";
import { canViewDashboard, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canViewDashboard(user!)) {
    return NextResponse.json({ error: "You do not have access to billing data." }, { status: 403 });
  }

  try {
    const [summary, openOrders, recentOrders, recentPayments] = await Promise.all([
      prisma.order.aggregate({
        where: { archivedAt: null },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      prisma.order.findMany({
        where: {
          archivedAt: null,
          paymentStatus: { in: ["PENDING", "PARTIALLY_PAID"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          amountPaid: true,
          paymentStatus: true,
          createdAt: true,
          customer: { select: { name: true } },
          material: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          quantity: true,
          unit: true,
          rate: true,
          totalAmount: true,
          amountPaid: true,
          paymentStatus: true,
          paymentMethod: true,
          deliveryLocation: true,
          createdAt: true,
          customer: { select: { name: true } },
          material: { select: { name: true } },
          _count: { select: { loads: true } },
        },
      }),
      prisma.payment.findMany({
        orderBy: { receivedAt: "desc" },
        take: 8,
        include: {
          order: {
            select: {
              orderNumber: true,
              customer: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const totalRevenue = Number(summary._sum.totalAmount ?? 0);
    const totalCollected = Number(summary._sum.amountPaid ?? 0);
    const outstanding = totalRevenue - totalCollected;
    const paidOrders = await prisma.order.count({
      where: { archivedAt: null, paymentStatus: "PAID" },
    });

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalCollected,
        outstanding,
        paidOrders,
        pendingOrders: openOrders.length,
      },
      openOrders: openOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer.name,
        material: order.material.name,
        totalAmount: Number(order.totalAmount),
        amountPaid: Number(order.amountPaid),
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt.toISOString(),
      })),
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer.name,
        material: order.material.name,
        siteLocation: order.deliveryLocation,
        quantity: Number(order.quantity),
        unit: order.unit,
        rate: Number(order.rate),
        totalAmount: Number(order.totalAmount),
        amountPaid: Number(order.amountPaid),
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        loadCount: order._count.loads,
        createdAt: order.createdAt.toISOString(),
      })),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        orderNumber: payment.order.orderNumber,
        customer: payment.order.customer.name,
        amount: Number(payment.amount),
        method: payment.method,
        receivedAt: payment.receivedAt.toISOString(),
        reference: payment.reference ?? "Manual entry",
      })),
    });
  } catch (error) {
    console.error("[billing:summary] Unable to load billing data.", error);
    return NextResponse.json({ error: "Unable to load billing data." }, { status: 500 });
  }
}
