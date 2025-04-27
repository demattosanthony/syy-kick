import { useEffect, useState } from "react";

export function useStlLoader(path: string) {
  const [stlFile, setStlFile] = useState<File | null>(null);

  function loadFile() {
    fetch(path)
      .then((response) => response.blob())
      .then((blob) => {
        setStlFile(new File([blob], path));
      });
  }

  useEffect(() => {
    loadFile();
  }, []);

  return stlFile;
}
