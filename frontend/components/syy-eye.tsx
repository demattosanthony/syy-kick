import STLViewer from "./viewers/stl-viewer";
import React from "react";
import { cn } from "@/lib/utils";
import { useStlLoader } from "@/hooks/useStlLoader";

const Syyclops3dEye = React.memo(
  ({ size = 400, animate = true }: { size?: number; animate?: boolean }) => {
    const stlFile = useStlLoader("/syy-eye-3d.stl");

    return (
      <div className={cn("flex-shrink-0", `w-${size} h-${size}`)}>
        <STLViewer
          file={stlFile}
          size={size}
          animate={animate}
          //   color="#ff6f09"
        />
      </div>
    );
  }
);

Syyclops3dEye.displayName = "Syyclops3dEye";

export default Syyclops3dEye;
