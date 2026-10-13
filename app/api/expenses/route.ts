import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedCategories = new Set(["Tyres", "Diesel", "Loading", "Others"]);

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (user!.role === "DRIVER") {
    return NextResponse.json({ error: "You do not have access to expenses." }, { status: 403 });
  }

  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
      take: 50,
    });

    return NextResponse.json({
      expenses: expenses.map((expense) => ({
        id: expense.id,
        expenseNumber: expense.expenseNumber,
        date: expense.date.toISOString(),
        category: expense.category,
        amount: Number(expense.amount),
        vehicleId: expense.vehicleId,
        driverId: expense.driverId,
        description: expense.description,
        receiptUrl: expense.receiptUrl,
      })),
    });
  } catch (error) {
    console.error("[expenses:list] Unable to load expenses.", error);
    return NextResponse.json({ error: "Unable to load expenses." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (user!.role === "DRIVER") {
    return NextResponse.json({ error: "You do not have permission to add expenses." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid expense payload." }, { status: 400 });
  }

  const { date, category, amount, vehicleId, driverId, description } = body as {
    date?: string;
    category?: string;
    amount?: number | string;
    vehicleId?: string | null;
    driverId?: string | null;
    description?: string;
  };

  if (!date || !category || amount === undefined || Number(amount) <= 0) {
    return NextResponse.json({ error: "Enter a valid date, category and amount." }, { status: 422 });
  }
  if (!allowedCategories.has(category)) {
    return NextResponse.json(
      { error: "Choose a valid expense category: Tyres, Diesel, Loading or Others." },
      { status: 422 },
    );
  }

  try {
    const created = await prisma.expense.create({
      data: {
        expenseNumber: `EXP-${randomBytes(4).toString("hex").toUpperCase()}`,
        date: new Date(date),
        category,
        amount: Number(amount),
        vehicleId: vehicleId || null,
        driverId: driverId || null,
        description: description || "Expense entry",
        createdBy: user!.id,
      },
    });

    return NextResponse.json({ expense: created }, { status: 201 });
  } catch (error) {
    console.error("[expenses:create] Unable to create expense.", error);
    return NextResponse.json({ error: "Unable to save the expense." }, { status: 500 });
  }
}
