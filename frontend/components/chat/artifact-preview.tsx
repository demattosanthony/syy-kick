import { cn } from "@/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { Artifact } from "@/types/chat";
import { useAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";
import React from "react";
import { Message } from "ai";
import { Badge } from "../ui/badge";

const ArtifactPreview = ({
  artifact,
  messages,
}: {
  artifact: Artifact;
  messages: Message[];
}) => {
  const [, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const { setOpen } = useSidebar();

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

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden w-full max-w-[500px] hover:border-2 transition-all"
      )}
      onClick={() => {
        setOpen(false);
        setSelectedArtifact({
          ...artifact,
          version: artifactVersion,
        });
      }}
    >
      <div className="flex items-center p-3 cursor-pointer ">
        <div className="p-1 mr-2 text-2xl">📑</div>
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-medium">
              {artifact.title || "Artifact"}
            </h3>
            <Badge variant={"secondary"}>v{artifactVersion}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Click to open document
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArtifactPreview;
