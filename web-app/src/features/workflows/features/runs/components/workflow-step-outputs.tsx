import { FileText } from "lucide-react";
import msWordLogo from "@/assets/logos/ms-word.svg";
import excelLogo from "@/assets/logos/excel.svg";
import pptxLogo from "@/assets/logos/pptx.svg";
import pdfLogo from "@/assets/logos/pdf.png";
import { cn } from "@/lib/utils";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDocx from "remark-docx";

// Types
interface FileOutput {
  type: string;
  file: {
    fileKey: string;
    mimeType: string;
    fileName: string;
    url: string;
  };
}

interface WorkflowStepOutputsProps {
  outputs: Record<string, FileOutput[]> | null;
  isLastStep?: boolean;
}

// Constants
const MIME_TYPES = {
  PDF: "application/pdf",
  CSV: "text/csv",
  WORD: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ] as const,
  PPT: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ] as const,
  MARKDOWN: "text/markdown",
  PLAIN_TEXT: "text/plain",
} as const;


// Components
const FileIcon = ({ mimeType, url, fileName }: { mimeType: string; url: string; fileName: string }) => {
  const isPdf = mimeType?.startsWith(MIME_TYPES.PDF);
  const isImage = mimeType?.startsWith("image/");
  const isCsv = mimeType === MIME_TYPES.CSV;
  const isWord = MIME_TYPES.WORD.some(type => mimeType === type);
  const isPpt = MIME_TYPES.PPT.some(type => mimeType === type);
  const isMarkdown = mimeType === MIME_TYPES.MARKDOWN;

  if (isPdf) return <img src={pdfLogo} alt="PDF logo" className="w-16 h-16" />;
  if (isImage) return <img src={url} alt={fileName} className="w-full h-full object-cover" />;
  if (isCsv) return <img src={excelLogo} alt="Excel logo" className="w-16 h-16" />;
  if (isWord || isMarkdown) return <img src={msWordLogo} alt="Word logo" className="w-16 h-16" />;
  if (isPpt) return <img src={pptxLogo} alt="PowerPoint logo" className="w-16 h-16" />;
  return <FileText className="w-16 h-16 text-muted-foreground" />;
};

const FileCard = ({ file, isLastStep, onFileClick }: {
  file: FileOutput['file'];
  isLastStep?: boolean;
  onFileClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) => {
  const { fileName, mimeType, url } = file;

  return (
    <div className="flex flex-col gap-1 w-32">
      <div
        className="block w-28 h-28 border rounded-lg overflow-hidden group relative hover:shadow-md transition-shadow bg-muted cursor-pointer"
        title={fileName}
      >
        <div className="h-full flex items-center justify-center p-2" onClick={onFileClick}>
          <FileIcon mimeType={mimeType} url={url} fileName={fileName} />
        </div>
      </div>
      <p className={cn("text-xs text-center w-full", isLastStep ? "line-clamp-2" : "line-clamp-6")}>
        {fileName}
      </p>
    </div>
  );
};

// Main component
export function WorkflowStepOutputs({ outputs, isLastStep }: WorkflowStepOutputsProps) {

  if (!outputs) return null;

  const allFiles = Object.values(outputs).flatMap(files => files);
  if (allFiles.length === 0) return null;

  const handleFileClick = async (
    event: React.MouseEvent<HTMLDivElement>,
    url: string,
    fileName: string,
    mimeType: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (mimeType === "text/markdown") {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdownText = await response.text();

        const processor = unified()
          .use(remarkParse)
          .use(remarkDocx as any, { output: "blob" } as any);

        const doc = await processor.process(markdownText);
        const blob = (await doc.result) as Blob;

        const docxFileName =
          fileName.replace(/\.(md|markdown)$/i, ".docx") || "document.docx";

        // Create a download link and trigger it
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = docxFileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
      } catch (error) {
        console.error("Error processing markdown file:", error);
        alert(
          "Failed to convert Markdown to DOCX. Please check the console for details."
        );
      }
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="w-full flex flex-col">
      <div className="flex flex-wrap gap-4 p-4 rounded-md bg-background/50">
        {allFiles.map((output, index) =>
        (
          <FileCard
            key={`${output.file.fileName}-${index}`}
            file={output.file}
            isLastStep={isLastStep}
            onFileClick={(e) => handleFileClick(e, output.file.url, output.file.fileName, output.file.mimeType)}
          />
        )
        )}
      </div>
    </div>
  );
}
