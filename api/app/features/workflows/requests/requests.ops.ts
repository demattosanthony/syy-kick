/** Database */
import db from "../../../config/db";

/** Schemas */
import { workflowRequestInputs, workflowRequests, workflowRequestSteps, workflowRequestStepsDependsOn, workflowRequestStepsInputs } from "./requests.schemas";

/** Types */
import { WorkflowRequestBody } from "./requests.types";

export const requestsOps = {
    create: async (body: WorkflowRequestBody, userId: string) => {

        await db.transaction(async (tx) => {
            // 1. Create the workflow request
            const [workflowRequest] = await tx.insert(workflowRequests).values({
                title: body.title,
                description: body.description,
                requestedBy: userId
            }).returning();

            // 2. Create the attachments
            const attachments = [];
            for (const attachement of Object.values(body.attachments)) {
                const [insertedAttachment] = await tx.insert(workflowRequestInputs).values({
                    requestId: workflowRequest.id,
                    fileKey: attachement.fileKey,
                    filename: attachement.filename,
                    mimeType: attachement.mimeType
                }).returning();
                attachments.push(insertedAttachment);
            }

            // 3. Create the steps
            const steps: typeof workflowRequestSteps.$inferInsert[] = [];
            for (const [stepIndex, step] of body.steps.entries()) {
                const stepData = {
                    requestId: workflowRequest.id,
                    title: step.title,
                    details: step.details,
                    outputDescription: step.outputDescription
                };

                const [insertedStep] = await tx.insert(workflowRequestSteps).values(stepData).returning();
                steps.push(insertedStep);

                // If the step is the first step, add the attachments to the step
                if (stepIndex === 0) {
                    if (attachments.length > 0) {
                        const attachementsInputs = attachments.map((attachment) => ({
                            stepId: insertedStep.id,
                            inputId: attachment.id
                        }));

                        await tx.insert(workflowRequestStepsInputs).values(attachementsInputs);
                    }
                }

                // 4. Create the steps dependencies
                const stepsDependencies = step.dependsOn.map((dependsOn) => {

                    const dependsOnStepIndex = parseInt(dependsOn.split("-")[1]);
                    const dependsOnStep = steps[dependsOnStepIndex];

                    return ({
                        stepId: insertedStep.id,
                        dependsOnId: dependsOnStep.id
                    })
                });

                if (stepsDependencies.length > 0) {
                    await tx.insert(workflowRequestStepsDependsOn).values(stepsDependencies);
                }
            }
        });
    }
}