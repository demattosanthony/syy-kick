export const CONFIG = {
  PORT: process.env.PORT || 4000,
  CORS_ORIGINS: [
    process.env.FRONTEND_URL!,
    "https://syykick.com",
    "https://www.syykick.com",
    "https://yo.syyclops.com",
    "https://www.yo.syyclops.com",
    "https://yo-syyclops.vercel.app",
  ],
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    domain: process.env.NODE_ENV === "production" ? ".syykick.com" : "",
    path: "/",
  },
  EMAIL_WHITELIST: [
    "mgkurass@gmail.com",
    "gopal24krishna@gmail.com",
    "ben.montalbano12@gmail.com",
    "adi.mechie@gmail.com",
    "quentinnippert@gmail.com",
  ],
  __prod__: process.env.NODE_ENV === "production",
};
