import { eq } from "drizzle-orm";
import { workflows } from "./workflows.schema";
import db from "../../config/db";

export const workflowsOps = {
  getWorkflow: async (workflowId: string) => {
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
      with: {
        steps: {
          with: {
            agents: true,
          },
        },
        tags: true,
      },
    });
    return workflow;
  },
};
