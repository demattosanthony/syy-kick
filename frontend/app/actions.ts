"use server";

import { ApiError } from "@/lib/api";
import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

/**
 * Server-side fetch with cookies for use in Server Actions
 */
export async function serverFetch<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown,
  options: RequestInit = {}
): Promise<T> {
  try {
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();
    const config: RequestInit = {
      method,
      credentials: "include",
      headers: {
        Cookie: cookieString,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP error! status: ${response.status}` };
      }
      throw new ApiError(
        response.status,
        errorData?.message ||
          errorData?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    throw error;
  }
}

export async function serverUploadFormData<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Cookie: cookieHeader,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Upload failed with status ${response.status}`
    );
  }

  return response.json();
}
