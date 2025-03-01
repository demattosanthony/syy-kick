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
import { Badge } from "../ui/badge";

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

  // Use the specific artifact content that was selected, not the latest version
  const artifactContent = artifact.content;

  // Find the version number of the selected artifact
  const artifactVersion = React.useMemo(() => {
    // Look through all messages to find all versions of this artifact
    const artifactRegex = new RegExp(
      `<antArtifact\\s+identifier="${artifact.identifier}"[\\s\\S]*?>(([\\s\\S]*?)(?:<\\/antArtifact>|$))`,
      "g"
    );

    let totalVersions = 0;
    let currentVersion = 0;

    // Check each message for the artifact with matching identifier
    for (const message of messages) {
      if (typeof message.content === "string") {
        const matches = [...message.content.matchAll(artifactRegex)];

        for (const match of matches) {
          totalVersions++;
          const content = match[2]?.trim();

          // If this content matches our artifact's content, this is our version
          if (content === artifact.content.trim()) {
            currentVersion = totalVersions;
          }
        }
      }
    }

    // If we didn't find a match, use the version from the artifact or default to 1
    return currentVersion || artifact.version || 1;
  }, [messages, artifact.identifier, artifact.content, artifact.version]);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifactContent);
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
                <Badge variant={"secondary"}>v{artifactVersion}</Badge>
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
                <MarkdownEditorViewer content={artifactContent} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
