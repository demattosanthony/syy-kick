import { useEffect, useRef } from "react";
import { useSetAtom, useAtom } from "jotai";
import { ToolInvocation } from "ai";
import {
  selectedArtifactAtom,
  alreadyAutoSelectedArtifactAtom,
  userClosedArtifactsAtom,
} from "@/atoms/chat";
import { Artifact } from "@/types/chat";

type StreamingTool = ToolInvocation & {
  argsText?: string;
};

// Custom hook for artifact management
export const useArtifactManagement = (tool: ToolInvocation) => {
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const [selectedArtifact] = useAtom(selectedArtifactAtom);
  const [, setAlreadyAutoSelected] = useAtom(alreadyAutoSelectedArtifactAtom);
  const [userClosedArtifacts, setUserClosedArtifacts] = useAtom(
    userClosedArtifactsAtom
  );

  // Use refs to avoid stale closures
  const selectedArtifactRef = useRef(selectedArtifact);
  const userClosedArtifactsRef = useRef(userClosedArtifacts);

  selectedArtifactRef.current = selectedArtifact;
  userClosedArtifactsRef.current = userClosedArtifacts;

  const streamingTool = tool as StreamingTool;

  // Handle streaming artifacts
  useEffect(() => {
    const isStreaming = tool.state === "partial-call" || tool.state === "call";
    const hasStreamingText =
      streamingTool.argsText && streamingTool.argsText.length > 0;

    if (isStreaming && hasStreamingText && streamingTool.argsText) {
      // Parse streaming content
      let streamingContent = "";
      let streamingTitle = "Untitled Artifact";
      let streamingType = "text/markdown";
      let streamingIdentifier = `streaming-${tool.toolCallId || Date.now()}`;

      try {
        const partialArgs = JSON.parse(streamingTool.argsText);
        streamingContent = partialArgs.content || partialArgs.data || "";
        streamingTitle =
          partialArgs.title || partialArgs.fileName || "Untitled Artifact";
        streamingType =
          partialArgs.type || partialArgs.mimeType || "text/markdown";
        streamingIdentifier = partialArgs.identifier || streamingIdentifier;
      } catch {
        // Fallback regex parsing
        const contentMatch = streamingTool.argsText.match(
          /"(?:content|data)"\s*:\s*"([^"]*(?:\\.[^"]*)*)/
        );
        const titleMatch = streamingTool.argsText.match(
          /"(?:title|fileName)"\s*:\s*"([^"]*)"/
        );
        const typeMatch = streamingTool.argsText.match(
          /"(?:type|mimeType)"\s*:\s*"([^"]*)"/
        );
        const identifierMatch = streamingTool.argsText.match(
          /"identifier"\s*:\s*"([^"]*)"/
        );

        if (contentMatch) {
          streamingContent = contentMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\t/g, "\t")
            .replace(/\\r/g, "\r");
        }
        if (titleMatch) streamingTitle = titleMatch[1];
        if (typeMatch) streamingType = typeMatch[1];
        if (identifierMatch) streamingIdentifier = identifierMatch[1];
      }

      // Only create/update artifact if we have meaningful content
      if (
        streamingContent.length > 10 ||
        streamingTitle !== "Untitled Artifact"
      ) {
        const streamingArtifact: Artifact = {
          identifier: streamingIdentifier,
          type: streamingType,
          title: streamingTitle,
          content: streamingContent,
          isComplete: false,
        };

        // Check if should auto-open
        const currentSelected = selectedArtifactRef.current;
        const shouldAutoOpen =
          !currentSelected ||
          (currentSelected.identifier === streamingIdentifier &&
            !currentSelected.isComplete);

        // Check if user closed this artifact
        const userHasClosed =
          userClosedArtifactsRef.current.has(streamingIdentifier) ||
          userClosedArtifactsRef.current.has(`streaming-${tool.toolCallId}`);

        if (shouldAutoOpen && !userHasClosed) {
          setSelectedArtifact(streamingArtifact);
          setAlreadyAutoSelected(streamingIdentifier);
        }
      }
    }
  }, [
    streamingTool.argsText,
    tool.state,
    tool.toolCallId,
    setSelectedArtifact,
    setAlreadyAutoSelected,
  ]);

  // Handle completed artifacts
  useEffect(() => {
    if (tool.state === "result" && (tool as any).result) {
      const result = (tool as any).result as {
        identifier: string;
        type: string;
        title: string;
        content: string;
      };

      const completedArtifact: Artifact = {
        identifier: result.identifier,
        type: result.type,
        title: result.title,
        content: result.content,
        isComplete: true,
      };

      // Check if should auto-select
      const currentSelected = selectedArtifactRef.current;
      const shouldAutoSelect =
        !currentSelected ||
        currentSelected.identifier === result.identifier ||
        currentSelected.identifier.startsWith(`streaming-${tool.toolCallId}`);

      // Check if user closed this artifact
      const userHasClosed =
        userClosedArtifactsRef.current.has(result.identifier) ||
        userClosedArtifactsRef.current.has(`streaming-${tool.toolCallId}`);

      if (shouldAutoSelect && !userHasClosed) {
        setSelectedArtifact(completedArtifact);
        setAlreadyAutoSelected(result.identifier);
      }

      // Clean up closed artifacts set
      setUserClosedArtifacts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(result.identifier);
        newSet.delete(`streaming-${tool.toolCallId}`);
        return newSet;
      });
    }
  }, [
    tool.state,
    tool.toolCallId,
    setSelectedArtifact,
    setAlreadyAutoSelected,
    setUserClosedArtifacts,
  ]);

  // Manual artifact reopen function
  const reopenArtifact = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setUserClosedArtifacts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(artifact.identifier);
      newSet.delete(`streaming-${tool.toolCallId}`);
      return newSet;
    });
  };

  return { reopenArtifact };
};
