"use server";

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
