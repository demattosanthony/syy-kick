import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import { Strategy as SamlStrategy, VerifiedCallback } from "passport-saml";
import passport from "passport";
import db from "./db";
import { eq, sql } from "drizzle-orm";
import { organizationMembers, organizations, users } from "./schema";
import s3 from "./s3";
import { NextFunction, Request, Response } from "express";

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
      async (
        accessToken: string,
        _: string,
        profile: any,
        done: VerifiedCallback
      ) => {
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

  passport.use(
    "microsoft-files",
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        callbackURL: process.env.MICROSOFT_FILES_CALLBACK_URL!,
        tenant: "organizations",
        authorizationURL: "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        tokenURL: "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
        scope: ["offline_access", "https://graph.microsoft.com/.default"],
      },
      async (accessToken: string, refreshToken: string, profile: any, done: VerifiedCallback) => {
        const access = { accessToken, refreshToken, profile };
        done(null, access);
      }
    )
  );

  return passport;
}

const myPassport = configurePassport();

export async function authenticateSaml(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const slug = req.params.slug; // Get the organization slug from the URL
    const passphrase = process.env.PGCRYPTO_KEY;

    if (!passphrase) {
      throw new Error("Encryption key not configured");
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
      with: {
        samlConfig: true,
      },
    });

    if (!org || !org.samlConfig) {
      res.status(404).send("Organization or SAML configuration not found");
      return;
    }

    // Decrypt SAML configuration
    const decryptedConfig = await db
      .execute(
        sql`
      SELECT 
        pgp_sym_decrypt(${org.samlConfig.entryPoint}, ${passphrase})::text as entry_point,
        pgp_sym_decrypt(${org.samlConfig.issuer}, ${passphrase})::text as issuer,
        pgp_sym_decrypt(${org.samlConfig.cert}, ${passphrase})::text as cert,
        ${org.samlConfig.callbackUrl} as callback_url
    `
      )
      .then((result) => result.rows[0]);

    if (!decryptedConfig) {
      throw new Error("Failed to decrypt SAML configuration");
    }

    // SAML Strategy
    passport.use(
      `saml-${org.id}`,
      new SamlStrategy(
        {
          entryPoint: decryptedConfig.entry_point as string,
          issuer: decryptedConfig.issuer as string,
          cert: decryptedConfig.cert as string,
          callbackUrl: decryptedConfig.callback_url as string,
          disableRequestedAuthnContext: true,
        },
        async function (profile: any, done: VerifiedCallback) {
          try {
            const samlEmail =
              profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
              ];
            const [emailName, emailDomain] = samlEmail.split("@");

            if (!samlEmail) {
              return done(new Error("SAML Response missing email address"));
            }

            // Find organization by domain
            const org = await db.query.organizations.findFirst({
              where: eq(organizations.domain, emailDomain),
            });

            if (!org) {
              throw new Error("No organization found for this email domain");
            }

            const samlName =
              profile["attributes"]["http://schemas.auth0.com/nickname"] ||
              emailName;

            const profilePicture =
              profile["attributes"]["http://schemas.auth0.com/picture"] || null;

            let user = await db.query.users.findFirst({
              where: eq(users.email, samlEmail),
            });

            if (!user) {
              [user] = await db
                .insert(users)
                .values({
                  email: samlEmail,
                  name: samlName,
                  identityProvider: "saml", // Set identity provider
                  profilePicture,
                })
                .returning();

              // Add user to organization
              await db.insert(organizationMembers).values({
                organizationId: org.id,
                userId: user.id,
                role: "member",
              });
            }

            done(null, user);
          } catch (error: any) {
            console.error(error);
            done(error);
          }
        }
      )
    );

    passport.authenticate(`saml-${org.id}`, { session: false })(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to authenticate with SAML" });
  }
}

export default myPassport;
