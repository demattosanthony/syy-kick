import { useParams, useLocation } from "react-router";

interface DecodedPathParams {
  projectId: string;
  knowledgeBaseId: string;
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
  const knowledgeBaseId = params.kbId as string;
  const pathname = useLocation().pathname;
  const pathArray = pathname.split("/").slice(4);

  // Decode each path segment individually
  const decodedPathArray = pathArray.map((segment) =>
    decodeURIComponent(segment)
  );

  // Join the decoded segments to form the current path
  const currentPath = decodedPathArray.length ? decodedPathArray.join("/") : "";

  return {
    projectId,
    knowledgeBaseId,
    decodedPathArray,
    currentPath,
  };
}
