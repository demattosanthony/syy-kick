import { WorkflowStep, Workflow } from "../workflows.types";

const basisOfDesignAgent: WorkflowStep = {
  id: "basis-of-design-agent",
  name: "Basis of Design Agent",
  description: "Generates a Basis of Design document",
  instructions: `You are tasked with generating a Basis of Design (BOD) document based on a provided PDF file containing mechanical, electrical, plumbing, or other engineering specifications. Your goal is to extract key information from the PDF and organize it into a clear, structured BOD document.

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

Make sure to save the BOD document as an artifact.`,
  model: "gemini-2.5-pro-preview",
  activeTools: [],
  formSchema: {
    fields: {
      "engineering-drawings": {
        type: "file",
        label: "Engineering Drawings",
        required: true,
        acceptedFileTypes: ["application/pdf"],
      },
    },
  },
};

export const basisOfDesignGenWorkflow: Workflow = {
  id: "basis-of-design-gen",
  name: "Basis of Design Generator",
  description:
    "This workflow generates a Basis of Design (BOD) document based engineering drawings.",
  workflowSteps: [basisOfDesignAgent],
  //   inputs: [
  //     {
  //       id: "engineering-drawings",
  //       type: "file",
  //       title: "Drawings and Plans",
  //       description: "Upload the engineering drawings",
  //       required: true,
  //       acceptedFileTypes: ["application/pdf"],
  //     },
  //   ],
  authorizedOrganizationIds: [
    "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
    "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    "cb9e9135-3f61-4b0b-a21f-1ecde3fcaf02",
    "99b93b8d-0360-47af-bd74-0fd099f07c4e",
  ],
};
