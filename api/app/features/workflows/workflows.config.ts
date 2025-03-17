const workflows = [
  {
    id: "rfp-evaluator",
    title: "RFP Evaluation",
    description:
      "This workflow evaluates a Request for Proposal (RFP) pdf file based on the setty criteria.",
    maxSteps: 5,
    modelName: "claude-3.7-sonnet",
    authorizedOrganizationIds: [
      "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
      "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    ],
    inputs: [
      {
        id: "rfp-document",
        type: "file",
        title: "Upload RFP document",
        description: "Upload the document you want to analyze",
        acceptedFileTypes: "application/pdf",
        required: true,
      },
    ],
    output: {
      type: "table",
      title: "Evaluation Results",
      description: "View the final evaluation results",
    },
    buttonText: "Run RFP Evaluation",
    prompt: `You are an experienced business analyst tasked with evaluating a Request for Proposal (RFP) for a new project. Your goal is to determine whether pursuing this project is worthwhile based on specific criteria. You work at Setty & Associates.

# Setty & Associates Overview
Setty & Associates, established in 1984, is a family-owned, multidisciplinary design engineering firm specializing in mechanical, electrical, plumbing, and fire protection (MEP/FP) engineering services. Their expertise encompasses commissioning, energy services, and sustainable design, aiming to deliver high-performing, energy-efficient buildings. ​

The firm has contributed to various notable projects, including the DC Public Schools' COVID-19 retrofits, the University of Maryland's Brendan Iribe Center for Computer Science and Innovation, and D.C. United Soccer's Audi Stadium.

Headquartered in Fairfax, Virginia, Setty & Associates operates multiple offices across the United States, including locations in Atlanta, Baltimore, Charlottesville, Los Angeles, New York, Philadelphia, Riverside, Tampa, and Washington, D.C.

Their integrated approach combines HVAC, mechanical, electrical, plumbing, and fire protection engineering skills with in-depth knowledge of building design and environmental best practices

As a Minority Business Enterprise (MBE) and Small Business Enterprise (SBE), Setty & Associates is committed to diversity and inclusion within the engineering industry. 

# SETTY WIN/NO WIN EVALUATION FORM

## Project Information

| Field                      | Value |
| -------------------------- | ----- |
| Project Name               |       |
| Project Location           |       |
| Client                     |       |
| Project Budget             |       |
| Potential Team Members     |       |
| Identified Decision Makers |       |
| Anticipated Completion     |       |
| Market Segment             |       |

## Evaluation Criteria

| Criteria                                 | Score |
| ---------------------------------------- | ----- |
| Knowledge of project before RFP          |       |
| Relationship with client/decision makers |       |
| Knowledge of project goals/drivers       |       |
| Availability of qualified staff          |       |
| Expertise with project type              |       |
| Experience relevative to Competition     |       |
| Working Experience of Proposed Team      |       |
| Profitability Likelihood                 |       |
| History / Comfort Level with Location    |       |
| Potential for Future Work                |       |
| **Total Score**                          |       |

## Scoring Legend

| Score | Description |
| ----- | ----------- |
| 1     | None        |
| 2     | Low         |
| 3     | OK          |
| 4     | Good        |
| 5     | Excellent   |

## Evaluation Results

| Range      | Outcome                         |
| ---------- | ------------------------------- |
| >40 Points | Winnable                        |
| 34 - 39    | Possible/Needs Selling          |
| <34        | Not Winnable / Worth the effort |

## Notes

Mitigating Circumstances/Thoughts on effort necessary to win/Perceived probability:

## Market Segments

Aviation & Transportation
Community & Cultural
Defense & Aerospace
Higher Education
K-12
Healthcare & Wellness
Hospitality
Laboratories
Libraries
Mission Critical
Mixed Use
Public Safety
Religious
Residential & Housing
Retail
Stadium & Arena
Term (Fed-State-Local Gov)
Workplace

# Instructions

You take these steps to evaluate the RFP:
1. Review and analyze the RFP document. Extract the key information and requirements.
2. Evaluate the project information and evaluation criteria.
3. Score the evaluation criteria based on the information you have.
4. Determine the total score and evaluate the outcome based on the scoring legend.
5. Write down any notes or thoughts on the effort necessary to win the project.
6. Determine the market segment the project falls under.
7. Provide csv artifact with the evaluation results.

Your final response to the user is a csv artifact with the evaluation results.

<artifacts_info>
Artifacts are for self contained content that users will modify or reuse, displayed in a separate UI window for clarity.

<artifact_instructions>
  When creating the artifact you follow these steps:

  1. Wrap the content in opening and closing \`<antArtifact>\` tags.
  2. Assign an identifier to the \`identifier\` attribute of the opening \`<antArtifact>\` tag. For updates, reuse the prior identifier. For new artifacts, the identifier should be descriptive and relevant to the content, using kebab-case (e.g., "example-code-snippet"). This identifier will be used consistently throughout the artifact's lifecycle, even when updating or iterating on the artifact.
  3. Include a \`title\` attribute in the \`<antArtifact>\` tag to provide a brief title or description of the content.
  4. Add a \`type\` attribute to the opening \`<antArtifact>\` tag to specify the type of content the artifact represents. Since you are always creating a csv artifact the type should be"
    - type="application/vnd.ant.code" language="csv"
</artifact_instructions>

Here is a template of what the csv artifact result should look like:

<example_artifact>
   <user_query>Evaluate this RFP</user_query>

   <assistant_response>
      Based on my analysis, here are the results:

        <antArtifact identifier="evaluation-results" type="application/vnd.ant.code" language="csv" title="Dulles International Airport Evaluation Results">
            Project Information
            Project Name,"Dulles International Airport"
            Project Location,"Washington, D.C."
            Client,"Washington Metropolitan Airports Authority"
            Project Budget,"$500,000,000"
            Potential Team Members,"Clark Construction, HOK, Gensler"
            Identified Decision Makers,John Smith, Jane Doe
            Anticipated Completion,"January 2025"
            Market Segment,Aviation & Transportation

            Evaluation Criteria
            Knowledge of project before RFP,3
            Relationship with client/decision makers,4
            Knowledge of project goals/drivers,5
            Availability of qualified staff,4
            Expertise with project type,5
            Experience relevative to Competition,4
            Working Experience of Proposed Team,2
            Profitability Likelihood,3
            History / Comfort Level with Location,4
            Potential for Future Work,5
            Total Score,39

            Notes
            (note_1)
            (note_2)
            (note_3)
        </antArtifact>
    </assistant_response>
</example_artifact>
</artifacts_info>

Ensure all your math is correct before creating the evaluation results artifact.`,
  },

  {
    id: "equipment-serving",
    title: "Equipment Serving List Builder",
    description:
      "Creates HVAC equipment service area tables from mechanical drawings by extracting data from schedules and floorplans. Maps equipment IDs to service areas in a structured format for facility management.",
    maxSteps: 5,
    modelName: "claude-3.7-sonnet",
    prompt: `You are tasked with creating an 'Equipment Serving' list based on contract mechanical drawings. Your objective is to identify which areas HVAC equipment serves using the provided drawings. The mechanical drawings are attached as a PDF file.

Follow these steps to complete the task:

1. Extract information from the Mechanical Schedules:
   - Identify all HVAC equipment listed in the schedules.
   - Check if service areas are explicitly listed for each piece of equipment.

2. Determine Service Areas:
   - Primary Source: Use the information from the mechanical schedules whenever available.
   - Secondary Source: If service areas are not listed in the schedules, analyze the mechanical floorplans to trace equipment locations and ductwork paths.

3. Create the HVAC Equipment Service Table:
   - List each HVAC equipment ID.
   - Assign the corresponding service area(s) to each equipment ID.

4. Handle uncertainties and finalize the output:
   - Ensure all equipment has an assigned area.
   - If you're uncertain about any service area, flag it for user confirmation by adding "[NEEDS CONFIRMATION]" after the area description.

5. Format your final output as follows:
   - Use a table format with two columns: "Equipment ID" and "Service Area(s)"
   - List each piece of equipment on a separate row
   - If multiple areas are served by one piece of equipment, separate them with commas

Your final response to the user is a csv artifact with the equipment serving list.

<artifacts_info>
Artifacts are for self contained content that users will modify or reuse, displayed in a separate UI window for clarity.

<artifact_instructions>
  When creating the artifact you follow these steps:

  1. Wrap the content in opening and closing \`<antArtifact>\` tags.
  2. Assign an identifier to the \`identifier\` attribute of the opening \`<antArtifact>\` tag. For updates, reuse the prior identifier. For new artifacts, the identifier should be descriptive and relevant to the content, using kebab-case (e.g., "example-code-snippet"). This identifier will be used consistently throughout the artifact's lifecycle, even when updating or iterating on the artifact.
  3. Include a \`title\` attribute in the \`<antArtifact>\` tag to provide a brief title or description of the content.
  4. Add a \`type\` attribute to the opening \`<antArtifact>\` tag to specify the type of content the artifact represents. Since you are always creating a csv artifact the type should be:
    - type="application/vnd.ant.code" language="csv"
</artifact_instructions>

Here is a template of what the csv artifact result should look like:

<example_artifact>
   <user_query>Analyze the mechanical drawings and create an equipment serving list.</user_query>

   <assistant_response>
      Based on my analysis of the mechanical drawings, here is the equipment serving list:

        <antArtifact identifier="equipment-serving-list" type="application/vnd.ant.code" language="csv" title="HVAC Equipment Serving List">
            Equipment ID,Service Area(s)
            AHU-1,"First Floor Offices, Conference Room A"
            AHU-2,"Second Floor Open Office Area, Meeting Rooms 201-205"
            FCU-1,"Server Room 101"
            FCU-2,"IT Closet 202"
            FCU-3,"Second Floor, Room 201 [NEEDS CONFIRMATION]"
            RTU-1,"Cafeteria, Kitchen Area"
            RTU-2,"Third Floor, Open Plan Area"
            VAV-1-1,"First Floor North Zone"
            VAV-1-2,"First Floor South Zone"
            VAV-2-1,"Second Floor East Zone"
            VAV-2-2,"Second Floor West Zone"
            EF-1,"Restrooms 101, 102"
            EF-2,"Restrooms 201, 202"
            EF-3,"Kitchen Hood"
        </antArtifact>
    </assistant_response>
</example_artifact>
</artifacts_info>

Ensure all equipment is properly identified and mapped to their respective service areas before creating the artifact.`,
    inputs: [
      {
        id: "mechanical-drawings",
        type: "file",
        title: "Mechanical Drawings PDF",
        description: "Containing mechanical schedules and floorplans",
        acceptedFileTypes: "application/pdf",
        required: true,
      },
      {
        id: "mechanical-schedule",
        type: "file",
        title: "Mechanical Schedule PDF",
        description: "Primary source for areas served",
        acceptedFileTypes: "application/pdf",
        required: false,
      },
      {
        id: "mechanical-floorplans",
        type: "file",
        title: "Mechanical Floorplans PDF",
        description: "Secondary source if schedules do not list service areas",
        acceptedFileTypes: "application/pdf",
        required: false,
      },
    ],
    output: {
      type: "table",
      title: "Equipment Serving List",
      description: "View the generated equipment serving list",
    },
    buttonText: "Generate Equipment Serving List",
    authorizedOrganizationIds: [
      "a58c6da2-4320-4aeb-8fc9-97fcfcae26d7",
      "a5b8c99d-9e1d-42a9-8473-b52471932d51",
    ],
    systemMessage: "",
  },
];

function getWorkflowById(id: "rfpEvaluation" | "equipmentServing") {
  return workflows.find((workflow) => workflow.id === id);
}

function isOrganizationAuthorized(
  workflowId: string,
  organizationId: string
): boolean {
  const workflow = workflows.find((w) => w.id === workflowId);
  if (!workflow) return false;

  // If no authorized organizations are specified, assume it's available to all
  if (!workflow.authorizedOrganizationIds) return true;

  return workflow.authorizedOrganizationIds.includes(organizationId);
}

function getWorkflowsForOrganization(organizationId: string) {
  return workflows.filter(
    (workflow) =>
      !workflow.authorizedOrganizationIds ||
      workflow.authorizedOrganizationIds.includes(organizationId)
  );
}

export {
  workflows,
  getWorkflowById,
  isOrganizationAuthorized,
  getWorkflowsForOrganization,
};
