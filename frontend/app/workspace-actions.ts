"use server";

import { cookies } from "next/headers";
import { type Workspace } from "@/types/workspace";

export async function setActiveWorkspaceCookie(workspace: Workspace) {
  const cookieStore = await cookies();
  cookieStore.set("activeWorkspace", JSON.stringify(workspace), {
    path: "/",
    maxAge: 2147483647,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Change from "none" to "lax"
    domain: process.env.NODE_ENV === "production" ? ".syyclops.com" : undefined,
  });
}

export async function getActiveWorkspaceCookie(): Promise<Workspace | null> {
  const cookieStore = await cookies();
  const workspaceCookie = cookieStore.get("activeWorkspace");
  return workspaceCookie ? JSON.parse(workspaceCookie.value) : null;
}
