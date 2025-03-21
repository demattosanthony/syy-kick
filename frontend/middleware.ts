import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import api from "./lib/api";

export async function middleware(req: NextRequest) {
  const user = await api.auth.me();

  // Redirect unauthenticated users
  if (user === null) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/settings",
    "/threads",
    "/projects",
    "/threads/:threadId",
    "/projects/:projectId",
    "/projects/:projectId/settings",
    "/projects/:projectId/blob/:path",
    "/projects/:projectId/tree/:path",
  ],
};
