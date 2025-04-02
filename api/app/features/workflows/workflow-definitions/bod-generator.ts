import { Workflow } from "../workflows.schemas";
import { z } from "zod";

export const basisOfDesignGenWorkflow: Workflow = {
  id: "bod-generator",
  title: "Basis of Design Generator",
  description:
    "This workflow generates a Basis of Design (BOD) document based engineering drawings.",
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
  ],
  inputs: [
    {
      id: "engineering-drawings",
      type: "file",
      title: "Drawings and Plans",
      description: "Upload the engineering drawings",
      acceptedFileTypes: "application/pdf",
      required: true,
    },
  ],
  output: {
    type: "text/markdown",
    title: "Basis of Design Document",
    description: "View the generated Basis of Design document",
    outputKey: "basisOfDesignDocument",
  },
  steps: [
    {
      id: "basis-of-design",
      title: "Basis of Design",
      type: "llm",
      inputMapping: {
        file: "workflowInput.engineering-drawings",
      },
      config: {
        modelName: "claude-3.7-sonnet",
        outputSchema: z.object({
          basisOfDesignDocument: z.string(),
        }),
        promptTemplate: `You are tasked with generating a Basis of Design (BOD) document based on a provided PDF file containing mechanical, electrical, plumbing, or other engineering specifications. Your goal is to extract key information from the PDF and organize it into a clear, structured BOD document.

Carefully analyze the content of the PDF file. Pay attention to important details such as project scope, design criteria, system descriptions, and performance requirements.

Create a Basis of Design document that includes the following sections:

1. Project Overview
2. Design Criteria and Standards
3. System Descriptions
4. Performance Requirements
5. Sustainability and Energy Efficiency Considerations
6. Key Assumptions and Limitations
7. Interdisciplinary Coordination
8. References

For each section:
- Extract relevant information from the PDF content
- Summarize key points concisely
- Use bullet points or numbered lists where appropriate
- Include specific technical details, calculations, or references when necessary

Ensure that your BOD document is:
- Clear and well-organized
- Technical yet accessible to various stakeholders
- Consistent in formatting and terminology

Format your output as a Markdown document. Use appropriate Markdown syntax for headings, lists, and emphasis.

Remember, your final output should only include the Markdown-formatted BOD document within the specified artifact tags. Do not include any explanations, notes, or other content outside of these tags.`,
      },
    },
  ],
};
