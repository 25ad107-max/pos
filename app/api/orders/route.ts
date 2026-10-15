import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageFleet, forbiddenResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const orderInput = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().regex(/^[+0-9()\s-]{8,20}$/),
  deliveryLocation: z.string().trim().min(3).max(500),
  materialId: z.string().trim().min(1),
  quantity: z.number().finite().positive().multipleOf(0.01).max(1000000),
  rate: z.number().finite().min(0).multipleOf(0.01).max(100000000),
  deliveryCharge: z.number().finite().min(0).multipleOf(0.01).max(100000000).default(0),
  otherCharges: z.number().finite().min(0).multipleOf(0.01).max(100000000).default(0),
  discount: z.number().finite().min(0).multipleOf(0.01).max(100000000).default(0),
  amountPaid: z.number().finite().min(0).multipleOf(0.01).max(100000000),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CREDIT"]),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).superRefine((value, context) => {
  if (value.deliveryDate) {
    const date = new Date(`${value.deliveryDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.deliveryDate) {
      context.addIssue({ code: "custom", path: ["deliveryDate"], message: "Enter a valid delivery date." });
    }
  }
  if (value.amountPaid > 0 && value.paymentMethod === "CREDIT") {
    context.addIssue({ code: "custom", path: ["paymentMethod"], message: "Choose the method used to receive payment." });
  }
});

function reference(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();

  try {
    const [orders, materials] = await Promise.all([
      prisma.order.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
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
          status: true,
          deliveryLocation: true,
          deliveryDate: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
          material: { select: { name: true } },
          _count: { select: { loads: true } },
        },
      }),
      prisma.material.findMany({
        where: { status: "ACTIVE", archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, unit: true, rate: true },
      }),
    ]);
    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        material: order.material.name,
        quantity: Number(order.quantity),
        unit: order.unit,
        rate: Number(order.rate),
        totalAmount: Number(order.totalAmount),
        amountPaid: Number(order.amountPaid),
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        status: order.status,
        deliveryLocation: order.deliveryLocation,
        deliveryDate: order.deliveryDate?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        loadCount: order._count.loads,
      })),
      materials: materials.map((material) => ({
        id: material.id,
        name: material.name,
        unit: material.unit,
        rate: Number(material.rate),
      })),
    });
  } catch (error) {
    console.error("[orders:list] Unable to load orders.", error);
    return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
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
  const parsed = orderInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the order details and try again.", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const materialAmount = Math.round(input.quantity * input.rate * 100) / 100;
  const totalAmount = Math.round(
    (materialAmount + input.deliveryCharge + input.otherCharges - input.discount) * 100,
  ) / 100;
  if (materialAmount > 9999999999.99 || totalAmount <= 0 ||
      totalAmount > 9999999999.99 || input.amountPaid > totalAmount) {
    return NextResponse.json(
      { error: "The order total must be positive and payment cannot exceed the total amount." },
      { status: 422 },
    );
  }

  const paymentStatus = input.amountPaid >= totalAmount
    ? "PAID"
    : input.amountPaid > 0
      ? "PARTIALLY_PAID"
      : "PENDING";

  try {
    const order = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: input.materialId, status: "ACTIVE", archivedAt: null },
        select: { id: true, unit: true },
      });
      if (!material) return null;

      const customer = await tx.customer.findFirst({
        where: { phone: input.customerPhone, status: "ACTIVE", archivedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      const customerId = customer
        ? (await tx.customer.update({
          where: { id: customer.id },
          data: { name: input.customerName },
          select: { id: true },
        })).id
        : (await tx.customer.create({
          data: {
            customerNumber: reference("CUS"),
            name: input.customerName,
            phone: input.customerPhone,
            createdBy: user!.id,
          },
          select: { id: true },
        })).id;

      const created = await tx.order.create({
        data: {
          orderNumber: reference("ORD"),
          customerId,
          materialId: material.id,
          quantity: input.quantity,
          unit: material.unit,
          rate: input.rate,
          materialAmount,
          deliveryCharge: input.deliveryCharge,
          otherCharges: input.otherCharges,
          discount: input.discount,
          totalAmount,
          amountPaid: input.amountPaid,
          paymentStatus,
          paymentMethod: input.paymentMethod,
          deliveryLocation: input.deliveryLocation,
          deliveryDate: input.deliveryDate ? new Date(`${input.deliveryDate}T00:00:00.000Z`) : null,
          notes: input.notes || null,
          createdBy: user!.id,
        },
        select: { id: true, orderNumber: true, totalAmount: true, paymentStatus: true },
      });

      if (input.amountPaid > 0) {
        await tx.payment.create({
          data: {
            paymentNumber: reference("PAY"),
            orderId: created.id,
            amount: input.amountPaid,
            method: input.paymentMethod,
            reference: "Initial order payment",
            createdBy: user!.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "CREATE",
          entityType: "ORDER",
          entityId: created.id,
          changes: {
            orderNumber: created.orderNumber,
            customerId,
            materialId: material.id,
            totalAmount,
            paymentStatus,
          },
        },
      });

      return created;
    });

    if (!order) {
      return NextResponse.json({ error: "Choose an active material." }, { status: 422 });
    }
    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        paymentStatus: order.paymentStatus,
      },
    }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      console.error("[orders:create] A generated customer, order, or payment reference collided.", error);
      return NextResponse.json({ error: "Unable to generate an order reference. Please try again." }, { status: 503 });
    }
    console.error("[orders:create] Unable to create order.", error);
    return NextResponse.json({ error: "Unable to save the order." }, { status: 500 });
  }
}
