"use server";

import { Project } from "@/types/project";
import { User } from "@/types/user";
import { cookies } from "next/headers";
import { cache } from "react";

// Cache the me function to avoid repeated API calls
export const me = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Cookie: cookieString,
    },
    // Add next.js cache control
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
});

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
export async function getProjects(options?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: Project[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}> {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();

  const queryParams = new URLSearchParams();

  if (options?.search) {
    queryParams.append("search", options.search);
  }

  if (options?.page !== undefined) {
    queryParams.append("page", options.page.toString());
  }

  if (options?.limit !== undefined) {
    queryParams.append("limit", options.limit.toString());
  }

  const url = `${process.env.NEXT_PUBLIC_API_URL!}/projects${
    queryParams.toString() ? "?" + queryParams.toString() : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Cookie: cookieString,
    },
  });

  if (!response.ok) {
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
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

export async function getThread(threadId: string): Promise<any | null> {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL!}/threads/${threadId}`,
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

export async function getPublicThread(threadId: string): Promise<any | null> {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL!}/public/threads/${threadId}`,
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
