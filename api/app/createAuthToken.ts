import * as jwt from "jsonwebtoken";
import { Response } from "express";
import { eq, sql } from "drizzle-orm";
import db from "./config/db";
import { users } from "./config/schema";

export type RefreshTokenData = {
  userId: string;
  refreshTokenVersion?: number;
};

export type AccessTokenData = {
  userId: string;
};

export type DbUser = typeof users.$inferSelect;

const createAuthTokens = (
  user: DbUser
): { refreshToken: string; accessToken: string } => {
  const refreshToken = jwt.sign(
    { userId: user.id, refreshTokenVersion: user.refreshTokenVersion },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: "30d",
    }
  );

  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "15min",
    }
  );

  return { refreshToken, accessToken };
};

// __prod__ is a boolean that is true when the NODE_ENV is "production"
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  domain: process.env.NODE_ENV === "production" ? ".syykick.com" : "",
  maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 year
} as const;

export const sendAuthCookies = (res: Response, user: DbUser) => {
  const { accessToken, refreshToken } = createAuthTokens(user);
  res.cookie("id", accessToken, cookieOpts);
  res.cookie("rid", refreshToken, cookieOpts);
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie("id", cookieOpts);
  res.clearCookie("rid", cookieOpts);
};

export const invalidateTokens = async (userId: string) => {
  await db
    .update(users)
    .set({ refreshTokenVersion: sql`${users.refreshTokenVersion} + 1` })
    .where(eq(users.id, userId));
};

export const checkTokens = async (
  accessToken: string,
  refreshToken: string
): Promise<{ userId: string; user: DbUser }> => {
  // First try to verify the access token
  try {
    const data = <AccessTokenData>(
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!)
    );

    const user = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if last active time is more than 30 minutes ago
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    let shouldIncrementSession = false;

    if (!user.lastActiveAt || user.lastActiveAt < thirtyMinutesAgo) {
      shouldIncrementSession = true;
    }

    // Update lastActiveAt and potentially sessionCount
    const updateData: Partial<{ lastActiveAt: Date; sessionCount: any }> = {
      lastActiveAt: now,
    };
    if (shouldIncrementSession) {
      updateData.sessionCount = sql`${users.sessionCount} + 1`;
    }

    db.update(users)
      .set(updateData)
      .where(eq(users.id, data.userId))
      .catch(console.error); // Fire and forget

    // Return the user data (sessionCount may have been updated asynchronously)
    // If immediate accuracy needed, might need to adjust or re-fetch user object if incremented
    return {
      userId: data.userId,
      // Return the user object fetched before the update
      user: shouldIncrementSession
        ? {
            ...user,
            sessionCount: (user.sessionCount || 0) + 1,
            lastActiveAt: now,
          }
        : { ...user, lastActiveAt: now },
    };
  } catch {
    // Access token is invalid, expired, or user not found
    // Fallback to refresh token
    if (!refreshToken) {
      throw new Error("No refresh token provided");
    }

    // Verify refresh token
    let refreshTokenData;
    try {
      refreshTokenData = <RefreshTokenData>(
        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!)
      );
    } catch {
      throw new Error("Invalid refresh token");
    }

    // Get user and verify refresh token version
    const user = await db.query.users.findFirst({
      where: eq(users.id, refreshTokenData.userId),
    });

    if (
      !user ||
      user.refreshTokenVersion !== refreshTokenData.refreshTokenVersion
    ) {
      throw new Error("Invalid refresh token");
    }

    // Successfully validated refresh token - THIS IS A NEW SESSION
    // Increment session count and update last active time
    const now = new Date();
    db.update(users)
      .set({
        sessionCount: sql`${users.sessionCount} + 1`,
        lastActiveAt: now,
      })
      .where(eq(users.id, refreshTokenData.userId))
      .catch(console.error); // Fire and forget update

    // Return the user data (sessionCount will be updated asynchronously)
    return {
      userId: refreshTokenData.userId,
      // We return the user object fetched before the update, but manually update relevant fields
      user: {
        ...user,
        sessionCount: (user.sessionCount || 0) + 1,
        lastActiveAt: now,
      },
    };
  }
};
