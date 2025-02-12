"use server";

import { ProjectContent } from "@/types/project";
import { User } from "@/types/user";
import { cookies } from "next/headers";

export async function me(): Promise<User | null> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Convert cookies array to Cookie header string
  const cookieHeader = allCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

export async function getProjectFiles(
  projectId: string,
  path?: string
): Promise<ProjectContent[]> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Convert cookies array to Cookie header string
  const cookieHeader = allCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const queryParams = new URLSearchParams();
  if (path) {
    queryParams.append("path", path);
  }
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL!}/projects/${projectId}/files${
      queryParams.toString() ? "?" + queryParams.toString() : ""
    }`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Cookie: cookieHeader,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch project files");
  }

  return await response.json();
}
