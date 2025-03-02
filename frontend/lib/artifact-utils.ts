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

  let version = 0;
  let content = artifact.content;
  let title = artifact.title || "Untitled Artifact";
  let foundCurrent = false;

  for (const message of messages) {
    if (typeof message.content !== "string") continue;
    const matches = [...message.content.matchAll(artifactRegex)];
    for (const match of matches) {
      version++;
      if (!foundCurrent && match[2]?.trim() === artifact.content.trim()) {
        foundCurrent = true;
      } else if (!foundCurrent) {
        content = match[2]?.trim();
      }
    }
    if (foundCurrent) break;
  }

  return {
    version: foundCurrent ? version : version + 1,
    content: content || "",
    title,
  };
};
