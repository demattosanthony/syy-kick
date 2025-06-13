import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import passport from "passport";
import db from "./db";
import { eq } from "drizzle-orm";
import { users } from "./schema";
import s3 from "./s3";

async function findOrCreateUser(
  profile: any,
  provider: "google" | "microsoft",
  providerIdKey: "googleId" | "microsoftId",
  additionalUserProps: any = {}
) {
  let user = await db.query.users.findFirst({
    where: eq(users[providerIdKey], profile.id),
  });

  if (!user) {
    let email, name;

    if (provider === "microsoft") {
      email = profile.emails?.[0]?.value || profile._json?.mail;
      name =
        profile.displayName ||
        `${profile._json?.givenName} ${profile._json?.surname}`.trim();
    } else {
      // Google profile handling
      const { email: googleEmail, name: googleName } = profile._json || profile;
      email = googleEmail;
      name = googleName;
    }

    if (!email || !name) {
      console.error("Missing fields - email:", email, "name:", name);
      throw new Error(
        `Missing required fields (email: ${!!email}, name: ${!!name})`
      );
    }

    [user] = await db
      .insert(users)
      .values({
        ...additionalUserProps,
        [providerIdKey]: profile.id,
        identityProvider: provider,
        email,
        name,
      })
      .returning();
  } else if (additionalUserProps.profilePicture) {
    [user] = await db
      .update(users)
      .set({ profilePicture: additionalUserProps.profilePicture })
      .where(eq(users.id, user.id))
      .returning();
  }
  return user;
}

async function fetchMicrosoftProfilePicture(
  accessToken: string,
  profileId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/photo/$value`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    await s3.write(`profile-pictures/${profileId}.jpg`, buffer, {
      acl: "public-read",
    });
    return s3.presign(`profile-pictures/${profileId}.jpg`, {
      acl: "public-read",
    });
  } catch (err) {
    console.error("Error fetching Microsoft profile picture", err);
    return null;
  }
}

export function configurePassport() {
  passport.use(
    "google",
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const profilePictureUrl = profile.photos?.[0]?.value;
          const user = await findOrCreateUser(profile, "google", "googleId", {
            profilePicture: profilePictureUrl,
          });

          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  passport.use(
    "microsoft",
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        callbackURL: process.env.MICROSOFT_CALLBACK_URL!,
        scope: [
          "user.read",
          "profile",
          "email",
          "openid",
          "user.read.all",
          "profilephoto.read.all",
        ],
        tenant: "common",
        authorizationURL:
          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      },
      async (accessToken: string, _: string, profile: any, done: any) => {
        try {
          const profilePictureUrl = await fetchMicrosoftProfilePicture(
            accessToken,
            profile.id
          );
          const user = await findOrCreateUser(
            profile,
            "microsoft",
            "microsoftId",
            { profilePicture: profilePictureUrl }
          );
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  return passport;
}

const myPassport = configurePassport();

export default myPassport;
