import { z } from "zod";

const getThreadsSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().optional(),
});

const updateThreadSchema = z.object({
  title: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export { getThreadsSchema, updateThreadSchema };
