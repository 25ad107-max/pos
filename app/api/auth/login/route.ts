import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginInput } from "@/lib/fleet-validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const passwordMatches =
      user?.isActive &&
      (await bcrypt.compare(parsed.data.password, user.passwordHash));

    if (!user || !passwordMatches) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const session = await createSession(user.id);
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );
    return response;
  } catch (error) {
    console.error("[auth:login] Unable to authenticate user.", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 500 });
  }
}
