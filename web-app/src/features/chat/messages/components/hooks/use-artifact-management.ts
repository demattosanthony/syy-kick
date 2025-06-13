import { useEffect, useRef, useState } from "react";
import { useSetAtom, useAtom } from "jotai";
import { ToolInvocation } from "ai";
import {
  selectedArtifactAtom,
  alreadyAutoSelectedArtifactAtom,
  userClosedArtifactsAtom,
  artifactSelectionModeAtom,
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
  const [artifactSelectionMode, setArtifactSelectionMode] = useAtom(
    artifactSelectionModeAtom
  );

  // Track the current streaming artifact for this tool
  const [currentStreamingArtifact, setCurrentStreamingArtifact] =
    useState<Artifact | null>(null);

  // Use refs to avoid stale closures
  const selectedArtifactRef = useRef(selectedArtifact);
  const userClosedArtifactsRef = useRef(userClosedArtifacts);
  const artifactSelectionModeRef = useRef(artifactSelectionMode);

  selectedArtifactRef.current = selectedArtifact;
  userClosedArtifactsRef.current = userClosedArtifacts;
  artifactSelectionModeRef.current = artifactSelectionMode;

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

        // Always update the current streaming artifact for this tool
        setCurrentStreamingArtifact(streamingArtifact);

        // Check if user has manually closed this specific artifact
        const userHasClosed =
          userClosedArtifactsRef.current.has(streamingIdentifier) ||
          userClosedArtifactsRef.current.has(`streaming-${tool.toolCallId}`);

        // Only auto-switch to new streaming artifacts if:
        // 1. User hasn't explicitly closed this artifact, AND
        // 2. Either no artifact is selected OR current selection is in "auto" mode OR
        //    current selection is the same streaming artifact (continue updating even in manual mode)
        const currentMode = artifactSelectionModeRef.current;
        const currentSelected = selectedArtifactRef.current;

        const isSameArtifact =
          currentSelected &&
          (currentSelected.identifier === streamingIdentifier ||
            currentSelected.identifier.startsWith(
              `streaming-${tool.toolCallId}`
            ));

        const shouldAutoOpen =
          !userHasClosed &&
          (!currentSelected || currentMode === "auto" || isSameArtifact);

        if (shouldAutoOpen) {
          setSelectedArtifact(streamingArtifact);
          setAlreadyAutoSelected(streamingIdentifier);
          // Only change mode to auto if no artifact was selected or it was already auto
          // Keep manual mode if user manually selected this same streaming artifact
          if (!currentSelected || currentMode === "auto") {
            setArtifactSelectionMode("auto");
          }
        }
      }
    } else if (!isStreaming) {
      // Clear streaming artifact when streaming stops
      setCurrentStreamingArtifact(null);
    }
  }, [
    streamingTool.argsText,
    tool.state,
    tool.toolCallId,
    setSelectedArtifact,
    setAlreadyAutoSelected,
    setArtifactSelectionMode,
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

      // Clear streaming artifact when completed
      setCurrentStreamingArtifact(null);

      // Check if user has manually closed this artifact
      const userHasClosed =
        userClosedArtifactsRef.current.has(result.identifier) ||
        userClosedArtifactsRef.current.has(`streaming-${tool.toolCallId}`);

      // Auto-select completed artifacts only if:
      // 1. User hasn't closed this artifact, AND
      // 2. This completion corresponds to the currently selected streaming artifact
      const currentSelected = selectedArtifactRef.current;
      const currentMode = artifactSelectionModeRef.current;

      const shouldAutoSelect =
        !userHasClosed &&
        currentSelected &&
        (currentSelected.identifier === result.identifier ||
          currentSelected.identifier.startsWith(
            `streaming-${tool.toolCallId}`
          )) &&
        currentMode === "auto"; // Only auto-complete if in auto mode

      if (shouldAutoSelect) {
        setSelectedArtifact(completedArtifact);
        setAlreadyAutoSelected(result.identifier);
        // Keep mode as "auto" since this is completing an auto-selected artifact
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
    setArtifactSelectionMode,
  ]);

  // Manual artifact selection function
  const selectArtifact = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setArtifactSelectionMode("manual"); // Mark as manually selected
    setUserClosedArtifacts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(artifact.identifier);
      newSet.delete(`streaming-${tool.toolCallId}`);
      return newSet;
    });
  };

  // Function to select the current streaming artifact (with latest content)
  const selectCurrentStreamingArtifact = () => {
    if (currentStreamingArtifact) {
      selectArtifact(currentStreamingArtifact);
    }
  };

  // Function to switch back to auto mode (for new streams)
  const switchToAutoMode = () => {
    setArtifactSelectionMode("auto");
  };

  return {
    selectArtifact,
    selectCurrentStreamingArtifact,
    switchToAutoMode,
    artifactSelectionMode,
    currentStreamingArtifact,
  };
};
