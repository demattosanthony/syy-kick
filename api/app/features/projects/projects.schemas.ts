import { z } from "zod";

export const schemas = {
  createProject: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(255).optional(),
    project_number: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    estimated_start_date: z.string().datetime().optional(),
    estimated_end_date: z.string().datetime().optional(),
    siteId: z.string().uuid(),
  }),

  updateProject: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(255).optional(),
    project_number: z.string().optional(),
    estimated_start_date: z.string().datetime().optional(),
    estimated_end_date: z.string().datetime().optional(),
    organizationId: z.string().optional(),
    siteId: z.string().uuid(),
  }),
};
