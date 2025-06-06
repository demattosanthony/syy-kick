import { useSearchParams } from "react-router";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilesData } from "@/features/files/api/get-files";
import { getRelativeTimeString } from "@/lib/utils";
import { SyyclopsFile } from "@/features/files/types/files";
import { FileIcon, FolderIcon, ImageIcon } from "lucide-react";

export default function FilesList({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams();
  const search = searchParams[0].get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { files, hasMore, loadMore, isLoadingMore, isLoading } = useFilesData({
    search: search || undefined,
    limit: 20,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = scrollRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div>
      {files?.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg
            className="w-12 h-12 mb-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium text-muted-foreground">
            No files yet
          </p>
          <p className="text-sm text-muted-foreground">
            Upload files to get started
          </p>
        </div>
      ) : (
        <>
          {files?.map((file, i) => (
            <FileItem key={file.id} file={file} compact={compact} />
          ))}

          <div ref={scrollRef} className="h-10">
            {(isLoadingMore || isLoading) && (
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <FileSkeleton key={i} compact={compact} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getFileIcon(file: SyyclopsFile) {
  if (file.type === "folder") {
    return <FolderIcon className="w-5 h-5 text-blue-500" />;
  }

  if (file.type === "file") {
    // Check if it's an image
    if (
      file.url &&
      (file.url.includes(".jpg") ||
        file.url.includes(".png") ||
        file.url.includes(".gif") ||
        file.url.includes(".webp"))
    ) {
      return <ImageIcon className="w-5 h-5 text-green-500" />;
    }
  }

  return <FileIcon className="w-5 h-5 text-gray-500" />;
}

function formatFileSize(size: number): string {
  if (size === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function FileItem({
  file,
  compact = false,
}: {
  file: SyyclopsFile;
  compact?: boolean;
}) {
  const handleFileClick = () => {
    if (file.url) {
      window.open(file.url, "_blank");
    }
  };

  return (
    <div
      onClick={handleFileClick}
      className={`hover:bg-accent ${
        compact ? "p-2" : "p-4"
      } rounded-lg transition-colors max-w-full cursor-pointer`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex-shrink-0">{getFileIcon(file)}</div>
        <div className="flex-1 min-w-0">
          <div
            className={`${
              compact ? "text-sm font-medium" : "text-base font-semibold"
            } truncate`}
          >
            {file.name}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{file.type}</span>
            {file.size > 0 && (
              <>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
              </>
            )}
          </div>
          <time className="text-xs text-muted-foreground">
            {getRelativeTimeString(file.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}

export function FileSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${compact ? "p-2" : "p-4"}`}>
      <div className="flex items-start gap-4">
        <Skeleton
          className={`rounded flex-shrink-0 ${compact ? "w-5 h-5" : "w-5 h-5"}`}
        />
        <div className="flex-1">
          <Skeleton className={`h-4 w-1/3 mb-2 ${compact ? "h-3" : "h-4"}`} />
          <Skeleton className={`${compact ? "h-3" : "h-4"} w-1/4 mb-1`} />
          <Skeleton className={`${compact ? "h-2" : "h-3"} w-1/6`} />
        </div>
      </div>
    </div>
  );
}
