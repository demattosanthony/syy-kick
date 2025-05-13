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

    presignFile: async (file: any) => {
        if (!file) return file;
        return {
            ...file,
            file: s3.presign(file.fileKey, { method: 'GET', expiresIn: 60 * 60 * 24 * 30 })
        };
    },

    presignFiles: async (files: any[]) => {
        if (!Array.isArray(files)) return files;

        const uniqueFiles = Array.from(new Set(files.map(file => JSON.stringify(file)))).map(file => JSON.parse(file));

        return Promise.all(
            uniqueFiles.map(async (file) => {
                if (file.type === "file" && file.file) {
                    return {
                        ...file,
                        file: runsUtils.presignFile(file.file),
                    };
                }
                return file;
            })
        );
    },

    presignStepOutput: async (output: any) => {
        if (!output) return output;
        const presignedOutput = { ...output };

        for (const key in presignedOutput) {
            const value = presignedOutput[key];
            if (Array.isArray(value)) {
                const uniqueValues = Array.from(new Set(value.map(item => JSON.stringify(item)))).map(item => JSON.parse(item));
                presignedOutput[key] = await runsUtils.presignFiles(uniqueValues);
            }
        }

        return presignedOutput;
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
    }
}
