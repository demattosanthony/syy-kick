import { tool } from "ai";
import Exa from "exa-js";
import { z } from "zod";

class ExaClient {
  private exa: Exa;

  public tools = {
    web_search: this.webSearchTool(),
  };

  constructor() {
    this.exa = new Exa(process.env.EXA_API_KEY);
  }

  private webSearchTool() {
    return tool({
      description:
        'Web research tool for finding up-to-date, credible sources beyond the chat context. Use for facts, standards, codes, and recent information. Craft focused queries (key entities, constraints, operators). Prefer authoritative domains. To limit results to a site, pass specific_domain (e.g., "nfpa.org"). Return only the most relevant sources.',
      parameters: z.object({
        query: z
          .string()
          .min(3, "query must be at least 3 characters")
          .describe("Natural language query describing what to find"),
        specific_domain: z
          .string()
          .optional()
          .describe('Optional domain to restrict results to, e.g., "nfpa.org"'),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe(
            "Optional cap on number of results to return (default 4, max 10)"
          ),
      }),
      execute: async ({ query, specific_domain, max_results }) => {
        try {
          const result = await this.exa.searchAndContents(query, {
            numResults: max_results || 4,
            text: true,
          });

          let items = result?.results ?? [];

          if (specific_domain) {
            const domain = specific_domain.toLowerCase();
            items = items.filter((item) => {
              try {
                const host = new URL(item.url).hostname.toLowerCase();
                return host === domain || host.endsWith(`.${domain}`);
              } catch {
                return item.url.toLowerCase().includes(domain);
              }
            });
          }

          const seen = new Set<string>();
          const deduped = items.filter((item) => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });

          return deduped;
        } catch (error) {
          throw new Error("Error searching the web");
        }
      },
    });
  }
}

const exaClient = new ExaClient();

export default exaClient;
