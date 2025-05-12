import { MastraClient } from "@mastra/client-js";

const client = new MastraClient({
    baseUrl: process.env.MASTRA_URL!,
});

export default client;