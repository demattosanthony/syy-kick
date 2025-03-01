import { motion } from "framer-motion";
import MarkdownViewer from "../viewers/markdown-viewer";
import { Button } from "../ui/button";
import { File, Maximize, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { Artifact } from "@/types/chat";
import { useAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";
import { useEffect } from "react";

const ArtifactPreview = ({ artifact }: { artifact: Artifact }) => {
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const { setOpen } = useSidebar();

  const isSelectedArtifact =
    selectedArtifact && selectedArtifact.identifier === artifact.identifier;

  // Auto-select new artifacts if nothing is currently selected
  useEffect(() => {
    if (!selectedArtifact) {
      setSelectedArtifact(artifact);
      setOpen(false); // Optionally close sidebar when auto-selecting
    }
  }, [artifact, selectedArtifact, setSelectedArtifact, setOpen]);

  return (
    <motion.div
      className={cn("rounded-lg border overflow-hidden w-fit")}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {/* Document Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          isSelectedArtifact && "border-primary/20"
        )}
      >
        <div className="flex items-center gap-2">
          <File
            className={cn(
              "w-4 h-4",
              isSelectedArtifact ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "text-sm truncate max-w-[400px]",
              isSelectedArtifact ? "font-medium text-primary" : "font-normal"
            )}
          >
            {artifact.title || "Artifact"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className={cn(
              "rounded-md transition-colors text-muted-foreground",
              isSelectedArtifact ? "ml-1 h-7 w-7" : "hover:bg-secondary"
            )}
            title={isSelectedArtifact ? "Minimize" : "Expand full screen"}
            variant={"ghost"}
            size={"icon"}
            onClick={() => {
              if (isSelectedArtifact) {
                setSelectedArtifact(null);
              } else {
                setOpen(false);
                setSelectedArtifact(artifact);
              }
            }}
          >
            {isSelectedArtifact ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Document Content Preview - only show if not selected */}
      {!isSelectedArtifact && (
        <motion.div
          className={cn(
            "px-4 max-h-[320px] overflow-y-auto max-w-[740px] mx-auto",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <MarkdownViewer initialContent={artifact.content} />
        </motion.div>
      )}
    </motion.div>
  );
};

export default ArtifactPreview;
