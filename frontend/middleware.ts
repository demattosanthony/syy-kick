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

    // Threads
    "/threads",
    "/threads/:threadId",

    // Sites
    "/sites",

    // Projects
    "/projects/:projectId",
    "/projects/:projectId/settings",
    "/projects/:projectId/blob/:path",
    "/projects/:projectId/tree/:path",
    "/projects/:projectId/issues",
    "/projects/:projectId/issues/new",
    "/projects/:projectId/issues/:issueNumber",

    // Knowledge Bases
    "/knowledge-bases",
    "/knowledge-bases/:kbId",
    "/knowledge-bases/:kbId/blob/:path",
    "/knowledge-bases/:kbId/tree/:path",
    "/knowledge-bases/:kbId/settings",

    // Workflows
    "/workflows",
    "/workflows/:workflowId",
  ],
};
