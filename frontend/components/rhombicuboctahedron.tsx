import STLViewer from "./stl-viewer";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function useStlLoader() {
  const [stlFile, setStlFile] = useState<File | null>(null);

  function loadFile() {
    const path = "/Rhombicuboctahedron.stl";
    fetch(path)
      .then((response) => response.blob())
      .then((blob) => {
        setStlFile(new File([blob], "Rhombicuboctahedron.stl"));
      });
  }

  useEffect(() => {
    loadFile();
  }, []);

  return stlFile;
}

const Rhombicuboctahedron = React.memo(
  ({ size = 400, animate = true }: { size?: number; animate?: boolean }) => {
    const stlFile = useStlLoader();

    return (
      <div className={cn("flex-shrink-0", `w-${size} h-${size}`)}>
        <STLViewer file={stlFile} size={size} animate={animate} />
      </div>
    );
  }
);

Rhombicuboctahedron.displayName = "Rhombicuboctahedron";

export default Rhombicuboctahedron;
