import {
  WorkflowExecutionInputValues,
  WorkflowFileExecutionInputValue,
  WorkflowNumberExecutionInputValue,
  WorkflowTextExecutionInputValue,
} from "@/features/workflows/workflows.types";
import { FileText } from "lucide-react";
import PdfThumbnail from "@/features/chat/messages/components/pdf-thumbnail";

interface WorkflowRunInputsProps {
  inputs: WorkflowExecutionInputValues;
}

export function WorkflowRunInputs({ inputs }: WorkflowRunInputsProps) {
  const inputEntries = Object.entries(inputs);

  if (inputEntries.length === 0) {
    return null; // Don't render anything if there are no inputs
  }

  return (
    <div className="flex ">
      <div className="space-y-4">
        {inputEntries.map(([inputId, inputData]) => (
          <div key={inputId} className="flex flex-col gap-1 items-start w-full">
            {/* <p className="text-sm font-medium">{inputData.label}</p> */}
            <div className="text-sm text-muted-foreground break-words w-full">
              {inputData.type === "text" &&
                (inputData.value as WorkflowTextExecutionInputValue).text}
              {inputData.type === "file" &&
                (() => {
                  const fileValue =
                    inputData.value as WorkflowFileExecutionInputValue;
                  const isPdf =
                    fileValue.mimeType?.startsWith("application/pdf");
                  const isImage = fileValue.mimeType?.startsWith("image/");

                  if (fileValue.url) {
                    return (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          {fileValue.filename}
                        </p>
                        {isPdf ? (
                          <div className="w-28 h-28 border rounded-lg overflow-hidden">
                            <PdfThumbnail url={fileValue.url} width={128} />
                          </div>
                        ) : (
                          <a
                            href={fileValue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-28 h-28 border rounded-lg overflow-hidden group relative hover:shadow-md transition-shadow"
                          >
                            {isImage ? (
                              <img
                                src={fileValue.url}
                                alt={fileValue.filename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
                                <FileText className="w-8 h-8 mb-1" />
                                <span className="text-xs px-1 text-center break-all overflow-hidden max-h-8 leading-tight">
                                  {fileValue.filename}
                                </span>
                              </div>
                            )}
                          </a>
                        )}
                      </div>
                    );
                  } else {
                    // Fallback for files without a URL (e.g., just show filename or a disabled state)
                    return (
                      <div className="w-28 h-28 border rounded-lg overflow-hidden flex flex-col items-center justify-center bg-muted text-muted-foreground">
                        <FileText className="w-8 h-8 mb-1" />
                        <span className="text-xs px-1 text-center break-all overflow-hidden max-h-8 leading-tight">
                          {fileValue.filename}
                        </span>
                      </div>
                    );
                  }
                })()}
              {inputData.type === "number" &&
                (inputData.value as WorkflowNumberExecutionInputValue).number}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
