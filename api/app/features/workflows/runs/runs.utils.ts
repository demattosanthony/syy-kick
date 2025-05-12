import { z } from "zod";

export const runsUtils = {
    validateInput: (input: any, inputSchema: string) => {
        try {
            const zodSchema = z.object(JSON.parse(inputSchema));
            const validatedInput = zodSchema.parse(input);
            return validatedInput;
        } catch (error) {
            throw new Error(`Validation error: ${error}`);
        }
    }
}