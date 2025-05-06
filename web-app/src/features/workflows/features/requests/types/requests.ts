export type WorkflowRequest = {
    title: string;
    description: string;
    requestedBy: string;
    attachments: Record<string, WorkflowRequestFile>;
    steps: WorkflowRequestStep[];
    notes?: string;
};

export type WorkflowRequestFile = {
    fileKey: string;
    mimeType: string;
    filename: string;
};

export type WorkflowRequestStep = {
    title: string;
    details: string;
    inputs: string[]; // ["attachementPdf"] to refer to the attachments
    dependsOn: string[]; // ["step-1"] to refer to the previous step
    outputDescription: string; // e.g. "A list of pdf pages"
};
