"use client";

import STLViewer from "@/components/stl-viewer";
import { Button } from "@/components/ui/button";
import { useStlLoader } from "./(app)/page";

export default function ErrorPage() {
  const stlFile = useStlLoader();
  return (
    <div className="h-[90%] flex items-center justify-center p-4">
      <div className="text-center space-y-4 items-center flex flex-col">
        <div className="flex-shrink-0">
          <STLViewer file={stlFile} size={125} />
        </div>
        <h1 className="text-4xl font-bold text-primary">
          Site Under Construction
        </h1>
        <p className="text-lg text-muted-foreground">
          We&apos;re working on some improvements. Please try again in a moment.
        </p>
        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
      </div>
    </div>
  );
}
