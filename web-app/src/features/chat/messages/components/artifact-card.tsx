import React from "react";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";
import { Artifact } from "@/types/chat";
import { getArtifactIcon } from "./utils/artifact-utils";

interface ArtifactCardProps {
  title: string;
  type?: string;
  isStreaming?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const ArtifactCard: React.FC<ArtifactCardProps> = ({
  title,
  type,
  isStreaming = false,
  onClick,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden w-full max-w-[400px]  transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
        isStreaming
          ? "border-primary/30 bg-primary/5 shadow-primary/10 hover:shadow-primary/20 hover:bg-primary/10"
          : "hover:border-border hover:bg-card/80 hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      {/* Background gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="relative flex items-center p-4 gap-3">
        {/* Icon container with enhanced styling */}
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg shrink-0 text-xl font-medium shadow-sm ring-1 ring-inset transition-all duration-200",
            isStreaming
              ? "bg-primary/20 text-primary ring-primary/30 group-hover:bg-primary/30"
              : "bg-muted/80 text-muted-foreground ring-border/20 group-hover:bg-muted group-hover:scale-105"
          )}
        >
          {getArtifactIcon(type)}
        </div>

        {/* Content area */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2 mb-1">
            <h3
              className={cn(
                "text-sm font-semibold leading-tight truncate max-w-[275px]",
                isStreaming
                  ? "text-primary"
                  : "text-foreground group-hover:text-foreground"
              )}
            >
              {title}
            </h3>
            {/* {!isStreaming && (
              <Badge
                variant="secondary"
                className="shrink-0 text-xs font-medium bg-muted/60 hover:bg-muted/80 transition-colors"
              >
                v1
              </Badge>
            )} */}
          </div>
          {children && (
            <div className="text-xs text-muted-foreground/80 leading-relaxed">
              {children}
            </div>
          )}
        </div>

        {/* Streaming indicator with enhanced animation */}
        {isStreaming && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0ms]"></div>
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:150ms]"></div>
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:300ms]"></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom accent line for completed artifacts */}
      {!isStreaming && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      )}
    </div>
  );
};

export const LoadingArtifactCard: React.FC = () => (
  <div className="w-full max-w-[480px]">
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <Loader variant="text-shimmer" text="Creating artifact..." size="lg" />
    </div>
  </div>
);

export const StreamingArtifactCard: React.FC<{
  title: string;
  type: string;
  onClick: () => void;
}> = ({ title, type, onClick }) => (
  <ArtifactCard title={title} type={type} isStreaming onClick={onClick} />
);

export const CompletedArtifactCard: React.FC<{
  artifact: Artifact;
  onClick: () => void;
}> = ({ artifact, onClick }) => (
  <ArtifactCard title={artifact.title} type={artifact.type} onClick={onClick}>
    <span className="inline-flex items-center gap-1.5">
      <span>Click to open document</span>
      <svg
        className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </span>
  </ArtifactCard>
);

export default ArtifactCard;
