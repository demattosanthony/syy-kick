import { z } from "zod";
import s3 from "../../../config/s3";

export const runsUtils = {
    validateInput: (input: any, inputSchema: string) => {
        try {
            const conditions: Record<string, z.ZodObject<any>> = {};
            const schema = JSON.parse(inputSchema);

            const getZodSchemaFromPropertiesType = (property: any) => {
                // For file fields
                if (property.properties?.fileKey) {
                    return z.object({
                        fileKey: z.string(),
                        mimeType: z.string(),
                        fileName: z.string()
                    });
                }

                // For text fields
                if (property.properties?.text) {
                    return z.string();
                }

                // For number fields
                if (property.properties?.number) {
                    return z.number();
                }

                return z.any();
            };

            Object.entries(schema.json.properties).forEach(([key, property]: [string, any]) => {
                const zodSchema = z.object({
                    type: z.literal(property.properties.type.const),
                    label: z.literal(property.properties.label.const),
                    value: getZodSchemaFromPropertiesType(property.properties.value)
                });

                conditions[key] = zodSchema;
            });

            const finalZodSchema = z.object(conditions);
            finalZodSchema.parse(input);

            return input;
        } catch (error) {
            throw new Error(`Validation error: ${error}`);
        }
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

}
