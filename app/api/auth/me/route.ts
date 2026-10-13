import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth:me] Unable to read session.", error);
    return NextResponse.json({ error: "Unable to verify your session." }, { status: 500 });
  }
}
