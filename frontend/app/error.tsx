"use client";

import { Button } from "@/components/ui/button";
import Syyclops3dEye from "@/components/syy-eye";

export default function ErrorPage() {
  return (
    <div className="h-[90%] flex items-center justify-center p-4">
      <div className="text-center space-y-4 items-center flex flex-col">
        <Syyclops3dEye size={125} />
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
