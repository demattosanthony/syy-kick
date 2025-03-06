export const AssistantSkeletonMessage = () => (
  <div className="mb-4 flex flex-col justify-start">
    <div className="flex gap-2">
      <div className="mr-[1px] w-[32px] h-[32px]">
        <div className="w-[32px] h-[32px] bg-muted rounded-full animate-pulse"></div>
      </div>
      <div className="relative flex flex-col rounded-lg p-4 bg-background max-w-full animate-pulse">
        <div className="h-5 w-64 bg-muted rounded mb-3"></div>
        <div className="h-5 w-80 bg-muted rounded mb-3"></div>
        <div className="h-5 w-48 bg-muted rounded"></div>
      </div>
    </div>
  </div>
);

export const UserSkeletonMessage = () => (
  <div className="mb-4">
    <div className="group flex w-full justify-end">
      <div className="relative flex flex-col rounded-lg p-4 bg-primary/20 max-w-[85%] animate-pulse">
        <div className="h-5 w-64 bg-muted rounded mb-3"></div>
        <div className="h-5 w-48 bg-muted rounded"></div>
      </div>
    </div>
  </div>
);
