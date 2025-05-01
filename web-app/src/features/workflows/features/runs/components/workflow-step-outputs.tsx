import { FileText } from "lucide-react";
import PdfThumbnail from "@/features/chat/messages/components/pdf-thumbnail";
import { WorkflowRunStepOutput } from "../../../workflows.types";

interface WorkflowStepOutputsProps {
  outputs: WorkflowRunStepOutput[];
}

export function WorkflowStepOutputs({ outputs }: WorkflowStepOutputsProps) {
  if (!outputs || outputs.length === 0) {
    return null;
  }

  const fileOutputs = outputs.filter(
    (output) => output.file && output.file.url
  );

  if (fileOutputs.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-sm font-medium text-muted-foreground mb-2">Outputs</p>
      <div className="flex flex-wrap justify-center gap-4 p-4 rounded-md bg-background/50">
        {fileOutputs.map((output) => {
          const { id, name, mimeType, url } = output.file;

          const isPdf = mimeType?.startsWith("application/pdf");
          const isImage = mimeType?.startsWith("image/");

          return (
            <a
              key={id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-24 h-24 border rounded overflow-hidden group relative hover:shadow-md transition-shadow bg-muted"
              title={name}
            >
              {isPdf ? (
                <PdfThumbnail url={url} width={96} />
              ) : isImage ? (
                <img
                  src={url}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-1">
                  <FileText className="w-8 h-8 mb-1 flex-shrink-0" />
                  <span className="text-xs text-center break-all overflow-hidden max-h-8 leading-tight">
                    {name}
                  </span>
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
