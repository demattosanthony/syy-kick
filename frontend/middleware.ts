import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { me } from "./app/actions";

export async function middleware(req: NextRequest) {
  const user = await me();

  // Redirect unauthenticated users
  if (user === null) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/settings", "/projects", "/projects/:projectId"],
};
