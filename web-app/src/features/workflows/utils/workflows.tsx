import { FileCode, FileAudio, FileVideo, File } from "lucide-react"
import { type WorkflowRunStepOutput, type WorkflowFile, type StepOutputValue, type StepContext, type TreeNode, StepStatus, CustomWorkflowRun, VNextWorkflowRunState } from "@/features/workflows/workflows.types"
import { SerializedStep, SerializedStepFlowEntry } from "@mastra/core/workflows/vNext"
import { GetVNextWorkflowResponse } from "@mastra/client-js"
import excel from "@/assets/logos/excel.svg"
import word from "@/assets/logos/ms-word.svg"
import pptx from "@/assets/logos/pptx.svg"
import pdf from "@/assets/logos/pdf.png"

export function getFileIcon(mimeType: string, url: string) {
  switch (true) {
    case mimeType.startsWith("image/"):
      return <img src={url} alt="File Icon" className="h-16 w-16" />

    case mimeType.startsWith("audio/"):
      return <FileAudio className="h-16 w-16" />

    case mimeType.startsWith("video/"):
      return <FileVideo className="h-16 w-16" />

    case ["application/pdf"].includes(mimeType):
      return <img src={pdf} alt="PDF" className="h-16 w-16 object-cover" />

    case ["application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword", "text/plain", "text/markdown"].includes(mimeType):
      return <img src={word} alt="File Icon" className="h-16 w-16" />

    case ["application/json",
      "text/html",
      "text/css",
      "application/javascript"].includes(mimeType):
      return <FileCode className="h-16 w-16" />

    case ["application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"].includes(mimeType):
      return <img src={excel} alt="File Icon" className="h-16 w-16" />

    case ["application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint"].includes(mimeType):
      return <img src={pptx} alt="File Icon" className="h-16 w-16" />

    default:
      return <File className="h-16 w-16" />
  }
}

export function renderStepOutput(output: StepOutputValue | unknown) {

  // Handle array of outputs
  if (Array.isArray(output)) {
    return renderOutputArray(output, "Output")
  }

  // Handle single output
  return renderSingleOutput(output)
}

export function renderSingleOutput(output: StepOutputValue | unknown) {
  // Case text|file|number
  if (output && typeof output === "object" && "type" in output) {
    const typed = output as WorkflowRunStepOutput;
    switch (typed.type) {
      case "text":
        return (
          <div className="text-sm">
            <span className="font-medium">Text:</span>{" "}
            {typed.text?.length! > 100
              ? typed.text!.slice(0, 100) + "..."
              : typed.text}
          </div>
        );
      case "file":
        return typed.file ? (
          renderFile(typed.file)
        ) : (
          <div className="text-sm text-muted-foreground">Invalid file data</div>
        );
      case "number":
        return (
          <div className="text-sm">
            <span className="font-medium">Number:</span> {typed.number}
          </div>
        );
      default:
        return <div className="text-sm text-muted-foreground">Unknown</div>;
    }
  }

  // Cas object non-array
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    const entries = Object.entries(obj);

    // If ALL values are WorkflowRunStepOutput, render them individually
    if (
      entries.length > 0 &&
      entries.every(
        ([, v]) => v && typeof v === "object" && "type" in (v as any)
      )
    ) {
      return (
        <div className="space-y-4">
          {entries.map(([key, v]) => (
            <div key={key}>
              <div className="text-sm font-medium mb-1">
                {formatKeyToLabel(key)}
              </div>
              {renderSingleOutput(v)}
            </div>
          ))}
        </div>
      );
    }

    // Otherwise, look at arrays as before
    const arrayEntries = entries.filter(
      ([, val]) => Array.isArray(val) && (val as any[]).length > 0
    );
    if (arrayEntries.length > 0) {
      return (
        <div className="space-y-4">
          {arrayEntries.map(([key, val]) => (
            <div key={key}>
              <div className="text-sm font-medium mb-1">
                {formatKeyToLabel(key)}
              </div>
              {renderOutputArray(val as any[], formatKeyToLabel(key))}
            </div>
          ))}
        </div>
      );
    }

    // Fallback JSON if no WorkflowRunStepOutput
    return (
      <pre className="text-xs overflow-auto max-h-[200px] bg-muted/50 p-2 rounded-md">
        {JSON.stringify(output, null, 2)}
      </pre>
    );
  }

  // Primitives if no WorkflowRunStepOutput
  if (typeof output === "string") {
    return (
      <div className="text-sm">
        <span className="font-medium">Text:</span>{" "}
        {output.length > 100 ? output.slice(0, 100) + "..." : output}
      </div>
    );
  }
  if (typeof output === "number") {
    return (
      <div className="text-sm">
        <span className="font-medium">Number:</span> {output}
      </div>
    );
  }
  if (typeof output === "boolean") {
    return (
      <div className="text-sm">
        <span className="font-medium">Boolean:</span>{" "}
        {output ? "True" : "False"}
      </div>
    );
  }

  // Last fallback if no WorkflowRunStepOutput
  return (
    <pre className="text-xs overflow-auto max-h-[200px] bg-muted/50 p-2 rounded-md">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}


// Helper function to render a file
export function renderFile(file: WorkflowFile) {
  return (
    <div className="flex flex-col items-center gap-4 text-sm w-32 bg-muted/50 p-2 rounded-md">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center hover:cursor-pointer w-full"
      >
        <div className="mb-2">
          {getFileIcon(file.mimeType, file.url || '')}
        </div>
        <div className="text-center w-full">
          <div className="line-clamp-2 text-sm break-words max-w-full">{file.fileName}</div>
          {file.fileSize && (
            <div className="text-xs text-muted-foreground">
              ({formatFileSize(file.fileSize)})
            </div>
          )}
        </div>
      </a>
    </div>
  )
}

// Helper function to render arrays of outputs
function renderOutputArray(array: any[], label: string) {
  // Check if this is an array of our schema types
  const containsSchemaTypes = array.some(
    (item) => item && typeof item === "object" && "type" in item && ["text", "file", "number"].includes(item.type),
  )

  if (containsSchemaTypes) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {array.map((item, index) => (
            renderSingleOutput(item)
          ))}
        </div>
      </div>
    )
  }

  // For other arrays, show as JSON
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {label} ({array.length} items):
      </p>
      <pre className="text-xs overflow-auto max-h-[200px] bg-muted/50 p-2 rounded-md">
        {JSON.stringify(array, null, 2)}
      </pre>
    </div>
  )
}

// Helper function to format keys to readable labels
function formatKeyToLabel(key: string): string {
  // Convert camelCase to Title Case with spaces
  const formatted = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())

  return formatted
}


export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB"
  else return (bytes / 1073741824).toFixed(1) + " GB"
}

export function buildTree(
  graph: SerializedStepFlowEntry[],
  ctx: Record<string, StepContext>,
  parentPath = '',
): TreeNode[] {
  const nodes: TreeNode[] = [];

  const pushStep = (
    entry: SerializedStep,
    type: TreeNode['type'],
    extra: Partial<TreeNode> = {},
  ) => {
    const id = entry.id;
    const stepCtx = ctx[id] ?? {};
    const basePath = parentPath ? `${parentPath}.${id}` : id;

    nodes.push({
      path: basePath,
      stepId: id,
      type,
      description: entry.description,
      status: stepCtx.status ?? StepStatus.Pending,
      startedAt: (stepCtx as any).startedAt ?? null,
      finishedAt: (stepCtx as any).finishedAt ?? null,
      output: stepCtx.output,
      error: stepCtx.error,
      ...extra,
    });
  };

  graph.forEach((entry) => {
    switch (entry.type) {
      case 'step':
        pushStep(entry.step, 'step');
        break;

      case 'parallel':
      case 'conditional':
        nodes.push(
          ...buildTree(entry.steps, ctx, parentPath),
        );
        break;

      case 'loop':
        pushStep(entry.step, 'loop', { loopType: entry.loopType });
        break;

      case 'foreach':
        pushStep(entry.step, 'foreach', { foreachConcurrency: entry.opts.concurrency });
        break;
    }
  });

  return nodes;
}


export function flatten(graph: SerializedStepFlowEntry[]): SerializedStep[] {
  const list: SerializedStep[] = [];
  const walk = (e: SerializedStepFlowEntry) => {
    switch (e.type) {
      case "step":
        list.push(e.step); break;
      case "parallel":
      case "conditional":
        e.steps.forEach(walk); break;
      case "loop":
      case "foreach":
        list.push(e.step); break;
    }
  };
  graph.forEach(walk);
  return list;
}

export function buildOptimisticRun(def: GetVNextWorkflowResponse, runId: string): CustomWorkflowRun {
  const steps = flatten(def.stepGraph);
  const firstId = steps[0]?.id;

  const ctx: Record<string, StepContext> = {};
  steps.forEach((s) => {
    ctx[s.id] = {
      status: s.id === firstId ? StepStatus.Running : StepStatus.Pending,
    };
  });

  return {
    runId,
    workflowName: def.name,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: def,
    snapshot: {
      runId,
      timestamp: Date.now(),
      value: {},
      context: { inputs: {}, ...ctx } as any,
    },
  };
}

export function formatStepName(stepId: string): string {
  return stepId.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
}