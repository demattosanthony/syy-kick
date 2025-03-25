import { useParams } from "next/navigation";

interface DecodedPathParams {
  projectId: string;
  decodedPathArray: string[];
  currentPath: string;
}

/**
 * Custom hook to extract and decode path parameters from Next.js route
 * Used for project file navigation routes like /projects/[projectId]/tree/[...path]
 */
export function useDecodedPathParams(): DecodedPathParams {
  const params = useParams();
  const projectId = params.projectId as string;
  const pathArray = (params.path as string[]) || [];

  // Decode each path segment individually
  const decodedPathArray = pathArray.map((segment) =>
    decodeURIComponent(segment)
  );

  // Join the decoded segments to form the current path
  const currentPath = decodedPathArray.length ? decodedPathArray.join("/") : "";

  return {
    projectId,
    decodedPathArray,
    currentPath,
  };
}
