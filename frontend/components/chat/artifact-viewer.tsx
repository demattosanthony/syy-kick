import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";
import { Check, Copy, X } from "lucide-react";
import MarkdownEditorViewer from "../viewers/markdown-viewer";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { getArtifactVersionInfo } from "@/lib/artifact-utils";
import { Artifact } from "@/types/chat";
import { Message } from "ai";

const ArtifactViewer: React.FC<{
  artifact: Artifact;
  splitPosition: number;
  messages: Message[];
}> = ({ artifact, splitPosition, messages }) => {
  const [copied, setCopied] = useState(false);
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const { version, content, title } = getArtifactVersionInfo(
    artifact,
    messages
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="h-full"
      style={{ width: `${100 - splitPosition - 0.25}%`, minWidth: "450px" }}
      initial={{ opacity: 0, x: -50, scale: 0.95 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 },
      }}
      exit={{ opacity: 0, x: -50, scale: 0.95, transition: { duration: 0.2 } }}
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
            "absolute inset-0 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          )}
        >
          <div className="mx-auto">
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
                  {title}
                </h3>
                <Badge variant="secondary">v{version}</Badge>
              </div>
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
            <div className="p-4 px-6 flex justify-center">
              <div className="max-w-[800px] w-full">
                <MarkdownEditorViewer content={content} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ArtifactViewer;
