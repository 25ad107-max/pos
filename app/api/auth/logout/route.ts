import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token && token.length <= 128) {
      await prisma.session.deleteMany({
        where: { id: createHash("sha256").update(token).digest("hex") },
      });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
    return response;
  } catch (error) {
    console.error("[auth:logout] Unable to end session.", error);
    return NextResponse.json({ error: "Sign-out failed. Please try again." }, { status: 500 });
  }
}
