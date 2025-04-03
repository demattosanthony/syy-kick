import { Attachment } from "ai";

type WorkflowAttachment = Attachment & {
  file_key: string;
  inputId: string;
};

export { WorkflowAttachment };
