import STLViewer from "./viewers/stl-viewer";
import React from "react";
import { cn } from "@/lib/utils";
import { useStlLoader } from "@/hooks/useStlLoader";

const Rhombicuboctahedron = React.memo(
  ({ size = 400, animate = true }: { size?: number; animate?: boolean }) => {
    const stlFile = useStlLoader("/Rhombicuboctahedron.stl");

    return (
      <div className={cn("flex-shrink-0", `w-${size} h-${size}`)}>
        <STLViewer file={stlFile} size={size} animate={animate} />
      </div>
    );
  }
);

Rhombicuboctahedron.displayName = "Rhombicuboctahedron";

export default Rhombicuboctahedron;
