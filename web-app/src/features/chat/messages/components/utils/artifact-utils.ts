// Utility functions for artifact handling

export const getArtifactIcon = (type?: string): string => {
  if (!type) return "📑";
  if (type === "text/markdown" || type.includes("markdown")) return "📑";
  if (type === "text/csv" || type.includes("csv")) return "📊";
  if (type === "image/svg+xml") return "🎨";
  if (
    type.includes("code") ||
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("python")
  )
    return "💻";
  return "📑";
};

export const parseToolArgs = (tool: any, hasArgs: boolean) => {
  if (tool.argsText) {
    try {
      const partialArgs = JSON.parse(tool.argsText);
      return {
        content: partialArgs.content || partialArgs.data || "",
        title: partialArgs.title || partialArgs.fileName || "Untitled Artifact",
        type: partialArgs.type || partialArgs.mimeType || "",
      };
    } catch {
      // Fallback to regex parsing
      const contentMatch = tool.argsText.match(
        /"(?:content|data)"\s*:\s*"([^"]*)"/
      );
      const titleMatch = tool.argsText.match(
        /"(?:title|fileName)"\s*:\s*"([^"]*)"/
      );
      const typeMatch = tool.argsText.match(
        /"(?:type|mimeType)"\s*:\s*"([^"]*)"/
      );

      return {
        content: contentMatch
          ? contentMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
          : "",
        title: titleMatch ? titleMatch[1] : "Untitled Artifact",
        type: typeMatch ? typeMatch[1] : "",
      };
    }
  }

  // Fallback to parsed args
  if (hasArgs) {
    const args = tool.args as {
      identifier?: string;
      type?: string;
      title?: string;
      content?: string;
      data?: string;
      fileName?: string;
      mimeType?: string;
    };
    return {
      content: args.content || args.data || "",
      title: args.title || args.fileName || "Untitled Artifact",
      type: args.type || args.mimeType || "",
    };
  }

  return { content: "", title: "Untitled Artifact", type: "" };
};
