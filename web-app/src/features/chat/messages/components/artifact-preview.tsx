import { cn } from "@/lib/utils";
import { useSetAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";
import { Badge } from "../../../../components/ui/badge";
import { getArtifactVersionInfo } from "@/lib/artifact-utils";
import { Artifact } from "@/types/chat";
import { Message } from "ai";

const ArtifactPreview: React.FC<{
  artifact: Artifact;
  messages: Message[];
}> = ({ artifact, messages }) => {
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const { version, title } = getArtifactVersionInfo(artifact, messages);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden w-full max-w-[500px] hover:border-2 transition-all"
      )}
      onClick={() => {
        setSelectedArtifact({ ...artifact, version });
      }}
    >
      <div className="flex items-center p-3 cursor-pointer">
        <div className="p-1 mr-2 text-2xl">📑</div>
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-medium mr-2">{title}</h3>
            <Badge variant="secondary">v{version}</Badge>
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
