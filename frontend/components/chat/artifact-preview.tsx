import { motion } from "framer-motion";
import { File } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { Artifact } from "@/types/chat";
import { useAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";
import { useEffect } from "react";
import React from "react";
import { Message } from "ai";

const ArtifactPreview = ({
  artifact,
  messages,
}: {
  artifact: Artifact;
  messages: Message[];
}) => {
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const { setOpen } = useSidebar();
  const processedArtifactRef = React.useRef(new Set<string>());

  const isSelectedArtifact =
    selectedArtifact && selectedArtifact.identifier === artifact.identifier;

  // Calculate the version of this specific artifact instance
  const artifactVersion = React.useMemo(() => {
    if (!messages) return 1;

    let version = 0;
    let foundCurrentArtifact = false;

    // We need to find which version this specific artifact instance is
    for (const message of messages) {
      if (typeof message.content === "string") {
        // Extract all artifacts from this message
        const artifactRegex = new RegExp(
          `<antArtifact\\s+identifier="${artifact.identifier}"[\\s\\S]*?>(([\\s\\S]*?)(?:<\\/antArtifact>|$))`,
          "g"
        );

        const matches = [...message.content.matchAll(artifactRegex)];

        for (const match of matches) {
          version++;

          // If this artifact's content matches the current match, this is our artifact
          if (match[2]?.trim() === artifact.content.trim()) {
            foundCurrentArtifact = true;
          }
        }
      }

      // If we found our artifact, we can stop looking
      if (foundCurrentArtifact) {
        break;
      }
    }

    // If we didn't find a match, this might be the latest version
    return foundCurrentArtifact ? version : version + 1;
  }, [artifact.identifier, artifact.content, messages]);

  // Auto-select new artifacts if nothing is currently selected
  useEffect(() => {
    // Check if we've seen this artifact identifier before
    const isNewArtifact = !processedArtifactRef.current.has(
      `${artifact.identifier}-${artifact.content}`
    );

    // If this is a new artifact and nothing is selected, select it
    if (isNewArtifact && !selectedArtifact) {
      setSelectedArtifact({
        ...artifact,
        version: artifactVersion, // Set the calculated version
      });
      setOpen(false); // Close sidebar when auto-selecting
    }

    // Mark this specific artifact instance as processed
    processedArtifactRef.current.add(
      `${artifact.identifier}-${artifact.content}`
    );
  }, [
    artifact,
    selectedArtifact,
    setSelectedArtifact,
    setOpen,
    artifactVersion,
  ]);

  return (
    <motion.div
      className={cn("rounded-lg border overflow-hidden w-full max-w-[500px]")}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      }}
      onClick={() => {
        setOpen(false);
        setSelectedArtifact({
          ...artifact,
          version: artifactVersion,
        });
      }}
    >
      <div className="flex items-center p-3 cursor-pointer">
        <div className="bg-muted/20 p-2 rounded-md mr-3">
          <File className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-medium">
              {artifact.title || "Artifact"}
            </h3>
            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
              v{artifactVersion}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Click to open document
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ArtifactPreview;
