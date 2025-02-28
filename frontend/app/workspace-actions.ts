"use server";

import { cookies } from "next/headers";
import { type Workspace } from "@/types/workspace";

export async function setActiveWorkspaceCookie(workspace: Workspace) {
  const cookieStore = await cookies();
  cookieStore.set("activeWorkspace", JSON.stringify(workspace), {
    path: "/",
    maxAge: 2147483647, // Maximum value (~68 years) - effectively doesn't expire
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    domain: process.env.NODE_ENV === "production" ? ".syyclops.com" : undefined, // Add dot prefix for production
  });
}

export async function getActiveWorkspaceCookie(): Promise<Workspace | null> {
  const cookieStore = await cookies();
  const workspaceCookie = cookieStore.get("activeWorkspace");
  return workspaceCookie ? JSON.parse(workspaceCookie.value) : null;
}
