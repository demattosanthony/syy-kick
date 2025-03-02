import { Message } from "ai/react";
import { Artifact } from "@/types/chat";

export interface SpecialContent {
  thinking: string | null;
  artifact: Artifact | null;
  cleanContent: string;
}

export const extractSpecialContent = (content: string): SpecialContent => {
  const thinkingMatch = content.match(
    /<antThinking>([\s\S]*?)(?:<\/antThinking>|$)/
  );
  const artifactMatch = content.match(
    /<antArtifact\s+identifier="([\s\S]*?)"\s+type="([\s\S]*?)"\s+title="([\s\S]*?)">([\s\S]*?)(?:<\/antArtifact>|$)/
  );

  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
  const artifact = artifactMatch
    ? {
        identifier: artifactMatch[1],
        type: artifactMatch[2],
        title: artifactMatch[3],
        content: artifactMatch[4].trim(),
        isComplete: content.includes("</antArtifact>"),
        rawContent: artifactMatch[4].trim(),
      }
    : null;

  const cleanContent = content
    .replace(/<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g, "")
    .replace(/<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g, "")
    .trim();

  return { thinking, artifact, cleanContent };
};

export const getArtifactVersionInfo = (
  artifact: Artifact,
  messages: Message[]
) => {
  const artifactRegex = new RegExp(
    `<antArtifact\\s+identifier="${artifact.identifier}"[\\s\\S]*?>(([\\s\\S]*?)(?:<\\/antArtifact>|$))`,
    "g"
  );

  // Count all versions of this artifact by identifier
  let allVersions: { content: string; messageIndex: number }[] = [];

  // Collect all instances of this artifact across messages
  messages.forEach((message, messageIndex) => {
    if (typeof message.content !== "string") return;

    const matches = [...message.content.matchAll(artifactRegex)];
    matches.forEach((match) => {
      allVersions.push({
        content: match[2]?.trim() || "",
        messageIndex,
      });
    });
  });

  // Sort versions by message index (chronological order)
  allVersions.sort((a, b) => a.messageIndex - b.messageIndex);

  // Find the current version
  const currentVersionIndex = allVersions.findIndex(
    (v) => v.content === artifact.content.trim()
  );

  // If we found the current version
  if (currentVersionIndex !== -1) {
    return {
      version: currentVersionIndex + 1,
      content: artifact.content,
      title: artifact.title || "Untitled Artifact",
    };
  }

  // If we didn't find the exact match, return the latest version
  return {
    version: allVersions.length > 0 ? allVersions.length : 1,
    content:
      allVersions.length > 0
        ? allVersions[allVersions.length - 1].content
        : artifact.content,
    title: artifact.title || "Untitled Artifact",
  };
};
