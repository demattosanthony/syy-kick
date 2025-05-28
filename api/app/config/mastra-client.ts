import { MastraClient } from "@mastra/client-js";

const client = new MastraClient({
  baseUrl: process.env.MASTRA_URL!,
  headers: {
    Authorization: `Basic ${Buffer.from(`${process.env.BASIC_AUTH_USERNAME}:${process.env.BASIC_AUTH_PASSWORD}`).toString("base64")}`,
  },
});

export default client;
