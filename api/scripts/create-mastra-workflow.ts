import db from "../app/config/db";
import { workflows, workflowOrganizations } from "../app/config/schema";
import { eq } from "drizzle-orm";

const mastraId = process.argv[2];
const orgId = process.argv[3];
const description = process.argv[4];

if (!mastraId || !orgId) {
  console.error("Usage: bun run create-mastra-workflow.ts <mastraId> <orgId>");
  process.exit(1);
}

async function main() {
  // 1. Find or create the workflow by mastraId
  let workflow = await db.query.workflows.findFirst({
    where: eq(workflows.mastraId, mastraId),
  });

  if (!workflow) {
    // Insert new workflow
    const [inserted] = await db
      .insert(workflows)
      .values({ mastraId, description })
      .returning();
    if (!inserted) {
      console.error("Failed to create workflow");
      process.exit(1);
    }
    workflow = inserted;
    console.log(`Created workflow with id: ${workflow.id}`);
  } else {
    console.log(`Workflow already exists with id: ${workflow.id}`);
  }

  // 2. Create the workflow_organizations record if it doesn't exist
  const existingOrg = await db.query.workflowOrganizations.findFirst({
    where: eq(workflowOrganizations.workflowId, workflow.id),
  });

  if (!existingOrg) {
    await db.insert(workflowOrganizations).values({
      workflowId: workflow.id,
      organizationId: orgId,
    });
    console.log(`Linked workflow ${workflow.id} to organization ${orgId}`);
  } else {
    console.log(
      `Workflow ${workflow.id} is already linked to organization ${orgId}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
