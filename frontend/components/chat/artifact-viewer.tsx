import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Artifact } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Check, Copy, X } from "lucide-react";
import MarkdownEditorViewer from "../viewers/markdown-viewer";
import { useState } from "react";
import { Message } from "ai";
import React from "react";
import { useAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";

export default function ArtifactViewer({
  artifact,
  splitPosition,
  messages,
}: {
  artifact: Artifact;
  splitPosition: number;
  messages: Message[];
}) {
  const [copied, setCopied] = useState(false);
  const [, setSelectedArtifact] = useAtom(selectedArtifactAtom);

  // Find the latest version of the selected artifact from all messages
  const { latestArtifactContent, artifactVersion } = React.useMemo(() => {
    // Look through all messages to find all versions of this artifact
    const artifactRegex = new RegExp(
      `<antArtifact\\s+identifier="${artifact.identifier}"[\\s\\S]*?>(([\\s\\S]*?)(?:<\\/antArtifact>|$))`,
      "g"
    );

    let latestContent = artifact.content;
    let totalVersions = 0;
    let currentVersion = 0;
    let allVersions = [];

    // Check each message for the artifact with matching identifier
    for (const message of messages) {
      if (typeof message.content === "string") {
        const matches = [...message.content.matchAll(artifactRegex)];

        for (const match of matches) {
          totalVersions++;
          const content = match[2]?.trim();
          allVersions.push(content);

          // If this content matches our artifact's content, this is our version
          if (content === artifact.content.trim()) {
            currentVersion = totalVersions;
          }

          // Always keep track of the latest content
          latestContent = content;
        }
      }
    }

    // If we didn't find a match, this might be the latest version
    if (currentVersion === 0 && artifact.content === latestContent) {
      currentVersion = totalVersions;
    }

    // If we still don't have a version, use the one from the artifact or default to 1
    if (currentVersion === 0) {
      currentVersion = artifact.version || 1;
    }

    return {
      latestArtifactContent: latestContent,
      artifactVersion: currentVersion,
    };
  }, [messages, artifact.identifier, artifact.content, artifact.version]);

  const handleCopy = () => {
    navigator.clipboard.writeText(latestArtifactContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.div
      className="h-full"
      style={{
        width: `${100 - splitPosition - 0.25}%`,
        minWidth: "450px",
      }}
      initial={{ opacity: 0, x: -50, scale: 0.95 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 25,
        },
      }}
      exit={{
        opacity: 0,
        x: -50,
        scale: 0.95,
        transition: {
          duration: 0.2,
        },
      }}
    >
      <motion.div
        className="flex-1 w-full h-full relative shadow-md"
        initial={{ boxShadow: "0 0 0 rgba(0,0,0,0)" }}
        animate={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          transition: { delay: 0.1, duration: 0.3 },
        }}
      >
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto ",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          )}
        >
          <div className="mx-auto">
            {/* Header with artifact name and copy button */}
            <div className="flex justify-between items-center sticky top-0 z-10 px-4 py-3 bg-background/80 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSelectedArtifact(null)}
                  size="icon"
                  variant="ghost"
                >
                  <X className="min-w-[18px] min-h-[18px]" />
                </Button>
                <h3 className="text-lg font-medium truncate max-w-[400px]">
                  {artifact.title || "Untitled Artifact"}
                </h3>
                <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
                  v{artifactVersion}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="w-[18px] h-[18px] text-green-500" />
                  ) : (
                    <Copy className="w-[18px] h-[18px]" />
                  )}
                </Button>
              </div>
            </div>
            <div className="p-4 px-6 flex justify-center">
              <div className="max-w-[800px] w-full">
                <MarkdownEditorViewer
                  initialContent={latestArtifactContent}
                  editable
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
