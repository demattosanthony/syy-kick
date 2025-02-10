export const CONFIG = {
  PORT: process.env.PORT || 4000,
  CORS_ORIGINS: [
    process.env.FRONTEND_URL!,
    "https://yo.syyclops.com",
    "https://www.yo.syyclops.com",
    "https://yo-syyclops.vercel.app",
  ],
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    domain: process.env.NODE_ENV === "production" ? ".syyclops.com" : "",
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
