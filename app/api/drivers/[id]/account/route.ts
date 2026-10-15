import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageFleet, forbiddenResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const accountInput = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
});

export async function POST(request: Request, context: RouteContext) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!canManageFleet(user!)) return forbiddenResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = accountInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and a password of at least 12 characters." },
      { status: 422 },
    );
  }

  const { id } = await context.params;
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const account = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findFirst({
        where: { id, status: "ACTIVE", archivedAt: null },
        select: { id: true, name: true, userId: true },
      });
      if (!driver) return { kind: "not-found" as const };
      if (driver.userId) return { kind: "already-linked" as const };

      const created = await tx.user.create({
        data: {
          name: driver.name,
          email: parsed.data.email,
          passwordHash,
          role: "DRIVER",
        },
        select: { id: true },
      });
      await tx.driver.update({ where: { id: driver.id }, data: { userId: created.id } });
      await tx.auditLog.create({
        data: {
          actorId: user!.id,
          action: "LINK_LOGIN",
          entityType: "DRIVER",
          entityId: driver.id,
          changes: { userId: { from: null, to: created.id } },
        },
      });
      return { kind: "created" as const };
    });

    if (account.kind === "not-found") {
      return NextResponse.json({ error: "Active driver record was not found." }, { status: 404 });
    }
    if (account.kind === "already-linked") {
      return NextResponse.json({ error: "This driver already has a login account." }, { status: 409 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("[drivers:account] Unable to create driver login.", error);
    return NextResponse.json({ error: "Unable to create the driver login." }, { status: 500 });
  }
}
