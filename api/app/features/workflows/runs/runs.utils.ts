import { z } from "zod";
import s3 from "../../../config/s3";

export const runsUtils = {
    validateInput: (input: any, inputSchema: string) => {
        try {
            const conditions: Record<string, z.ZodObject<any>> = {};
            const schema = JSON.parse(inputSchema);

            Object.entries(schema.json.properties).forEach(([key, property]: [string, any]) => {
                let zodSchema = z.object({});

                if (property.required) {
                    property.required.forEach((requiredField: string) => {
                        const fieldSchema = property.properties[requiredField];

                        if (fieldSchema.type === 'string') {
                            if (fieldSchema.const) {
                                zodSchema = zodSchema.extend({
                                    [requiredField]: z.literal(fieldSchema.const)
                                });
                            } else {
                                zodSchema = zodSchema.extend({
                                    [requiredField]: z.string()
                                });
                            }
                        } else if (fieldSchema.type === 'object') {
                            if (requiredField === 'value') {
                                zodSchema = zodSchema.extend({
                                    value: z.object({
                                        mimeType: z.string(),
                                        fileName: z.string(),
                                        fileKey: z.string()
                                    })
                                });
                            }
                        }
                    });
                }

                conditions[key] = zodSchema;
            });

            const finalZodSchema = z.object(conditions);
            finalZodSchema.parse(input);

            return input;
        } catch (error) {
            throw new Error(`Validation error: ${error}`);
        }
    },

    presignInputs: async (inputs: Record<string, any>) => {
        const presignedInputs = { ...inputs };

        for (const key in presignedInputs) {
            const input = presignedInputs[key];
            if (input.type === "file" && input.value?.fileKey) {
                presignedInputs[key] = {
                    ...input,
                    value: runsUtils.presignFile(input.value),
                };
            }
        }

        return presignedInputs;
    },

    presignFile: (file: { fileKey: string; mimeType: string; fileName: string }) => {
        const presignedUrl = s3.presign(file.fileKey, {
            expiresIn: 3600,
            method: 'GET',
        });
        return {
            ...file,
            url: presignedUrl,
        };
    }
}
