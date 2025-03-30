import { and, eq } from "drizzle-orm";
import db from "../app/config/db";
import {
  documents,
  knowledgeBases,
  memberRoles,
  projects,
  roles,
  threads,
} from "../app/config/schema";
import { Permissions } from "../app/features/permissions/permissions.types";

async function convertProjectToKnowledgeBase(
  projectId: string,
  newKbName?: string
): Promise<string | null> {
  try {
    // 1. Get the project details
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      console.error("Project not found");
      return null;
    }
    console.log("Project found:", project);

    // Infer the creator from the project's user
    let createdBy = project.userId || null;

    // If there was no user stored with project creation, then use organization admin
    if (!createdBy) {
      console.log(
        "No user found for project, checking organization members..."
      );
      try {
        // Get organization admin
        const orgAdmins = await db
          .select({
            userId: memberRoles.userId,
          })
          .from(memberRoles)
          .innerJoin(roles, eq(memberRoles.roleId, roles.id))
          .where(
            and(
              eq(memberRoles.organizationId, project.organizationId!),
              eq(roles.name, Permissions.Roles.ORGANIZATION_ADMIN)
            )
          )
          .limit(1);

        if (orgAdmins.length > 0) {
          createdBy = orgAdmins[0].userId;
        }
      } catch (error) {
        console.error("Error while checking organization members:", error);
      }
    }

    if (!createdBy) {
      console.error("Project doesn't have an associated user");
      return null;
    }

    // 2. Create a new knowledge base
    const kbName = newKbName || project.name;
    const [newKnowledgeBase] = await db
      .insert(knowledgeBases)
      .values({
        name: kbName,
        description: project.description || "",
        organizationId: project.organizationId,
        userId: null,
        createdBy: createdBy,
      })
      .returning();

    if (!newKnowledgeBase) {
      console.error("Failed to create knowledge base");
      return null;
    }

    // 3. Move documents from project to knowledge base
    const projectDocs = await db.query.documents.findMany({
      where: eq(documents.projectId, projectId),
    });

    for (const doc of projectDocs) {
      await db
        .update(documents)
        .set({
          projectId: null,
          knowledgeBaseId: newKnowledgeBase.id,
        })
        .where(eq(documents.id, doc.id));
    }

    // 4. Clone or move relevant threads
    const projectThreads = await db.query.threads.findMany({
      where: eq(threads.projectId, projectId),
    });

    for (const thread of projectThreads) {
      // Update existing threads instead of creating new ones
      await db
        .update(threads)
        .set({
          projectId: null,
          knowledgeBaseId: newKnowledgeBase.id,
        })
        .where(eq(threads.id, thread.id));
    }

    // 5. Delete the original project after successful conversion
    await db.delete(projects).where(eq(projects.id, projectId));
    console.log(`Original project with ID ${projectId} has been deleted.`);

    console.log(
      `Project "${project.name}" successfully converted to knowledge base "${kbName}"`
    );
    console.log(`Knowledge Base ID: ${newKnowledgeBase.id}`);
    return newKnowledgeBase.id;
  } catch (error) {
    console.error("Error converting project to knowledge base:", error);
    return null;
  }
}

// Main function to handle command line execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "Usage: bun run project-to-kb.ts <project-uuid> [knowledge-base-name]"
    );
    process.exit(1);
  }

  const projectId = args[0];
  const knowledgeBaseName = args[1]; // Optional

  console.log(`Converting project ${projectId} to knowledge base...`);
  const result = await convertProjectToKnowledgeBase(
    projectId,
    knowledgeBaseName
  );

  if (result) {
    console.log("Conversion completed successfully!");
    process.exit(0);
  } else {
    console.error("Conversion failed.");
    process.exit(1);
  }
}

// Execute the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
