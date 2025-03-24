import * as jwt from "jsonwebtoken";
import { Response } from "express";
import { eq } from "drizzle-orm";
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

export const checkTokens = async (
  accessToken: string,
  refreshToken: string
) => {
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

    return {
      userId: data.userId,
      user,
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

    return {
      userId: refreshTokenData.userId,
      user,
    };
  }
};
