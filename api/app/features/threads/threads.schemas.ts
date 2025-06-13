import { z } from "zod";

const threadSchemas = {
  getThreadsQuery: z.object({
    page: z.string().optional(),
    pageSize: z.string().optional(),
    search: z.string().optional(),
  }),

  updateThread: z.object({
    title: z.string().optional(),
    isPublic: z.boolean().optional(),
  }),
};

export default threadSchemas;
