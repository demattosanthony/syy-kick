"use server";

import { Project } from "@/types/project";
import { User } from "@/types/user";
import { cookies } from "next/headers";

export async function me(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Cookie: cookieString,
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

export async function getProject(pid: string): Promise<Project | null> {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL!}/projects/${pid}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Cookie: cookieString,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

export async function getOrgFromInviteToken(token: string) {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL!}/organizations/invite/${token}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Cookie: cookieString,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}
