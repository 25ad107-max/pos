import { NextResponse } from "next/server";
import { canViewDashboard, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canViewDashboard(user!)) {
    return NextResponse.json({ error: "You do not have access to reports." }, { status: 403 });
  }

  try {
    const now = new Date();
    const currentMonthStart = monthStart(now);
    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 5);

    const [salarySummary, expenseSummary, monthlyOrders, salaryPeriods] = await Promise.all([
      prisma.salaryPeriod.aggregate({
        where: { createdAt: { gte: currentMonthStart } },
        _sum: { netSalary: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: currentMonthStart } },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        where: {
          archivedAt: null,
          createdAt: { gte: previousMonthStart },
        },
        select: { createdAt: true, totalAmount: true },
      }),
      prisma.salaryPeriod.findMany({
        orderBy: { periodEnd: "desc" },
        take: 6,
        include: { driver: { select: { name: true } } },
      }),
    ]);

    const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
      const target = new Date(currentMonthStart);
      target.setMonth(target.getMonth() - (5 - index));
      const monthTotal = monthlyOrders
        .filter((order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate.getMonth() === target.getMonth() && orderDate.getFullYear() === target.getFullYear();
        })
        .reduce((sum, order) => sum + Number(order.totalAmount), 0);

      return {
        label: monthLabel(target),
        revenue: monthTotal,
      };
    });

    const paidSalaryPeriods = await prisma.salaryPeriod.count({
      where: { paidAt: { not: null } },
    });

    return NextResponse.json({
      summary: {
        payrollThisMonth: Number(salarySummary._sum.netSalary ?? 0),
        monthlyRevenue: revenueByMonth.reduce((total, entry) => total + entry.revenue, 0),
        totalExpenses: Number(expenseSummary._sum.amount ?? 0),
        paidSalaryPeriods,
      },
      monthlyRevenue: revenueByMonth,
      recentSalaryPeriods: salaryPeriods.map((period) => ({
        id: period.id,
        driverName: period.driver.name,
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        netSalary: Number(period.netSalary),
        paidAt: period.paidAt ? period.paidAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[reports:summary] Unable to load reports data.", error);
    return NextResponse.json({ error: "Unable to load reports data." }, { status: 500 });
  }
}
