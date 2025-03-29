import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Project } from "@/types/project";
import { Slash } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment } from "react";

const ProjectNavBreadcrumbs = ({
  project,
  maxItems = 5, // Default max items to show
  maxLength = {
    project: { sm: 200, default: 120 },
    segment: { sm: 150, default: 100 },
    lastSegment: { sm: 200, default: 120 },
  },
}: {
  project: Project;
  maxItems?: number;
  maxLength?: {
    project: { sm: number; default: number };
    segment: { sm: number; default: number };
    lastSegment: { sm: number; default: number };
  };
}) => {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const totalItems = 3 + pathArray.length; // "Projects" + project name + path segments

  const firstBreadcrumb = project.site?.name ? project.site.name : "Projects";

  // Calculate how many items to show from the path
  const itemsToShow = Math.min(maxItems - 3, pathArray.length); // Reserve 2 for "Projects" and project name
  const showEllipsis = totalItems > maxItems && pathArray.length > itemsToShow;
  const visiblePathArray = showEllipsis
    ? pathArray.slice(-itemsToShow) // Take the last `itemsToShow` items
    : pathArray;

  // Helper function to create breadcrumb items
  const renderBreadcrumbItem = (
    content: React.ReactNode,
    isLink = false,
    href = "",
    maxWidth: { sm: number; default: number } = maxLength.segment,
    isBold = false
  ) => (
    <BreadcrumbItem
      className={`${isLink ? "flex-shrink min-w-0" : "flex-shrink-0"}`}
    >
      {isLink ? (
        <Link
          href={href}
          className={`hover:text-blue-500 hover:underline truncate max-w-[${maxWidth.default}px] sm:max-w-[${maxWidth.sm}px]`}
          prefetch={false}
          title={typeof content === "string" ? content : undefined}
        >
          {content}
        </Link>
      ) : (
        <span
          className={`${isBold ? "font-bold" : ""} truncate max-w-[${
            maxWidth.default
          }px] sm:max-w-[${maxWidth.sm}px]`}
          title={typeof content === "string" ? content : undefined}
        >
          {content}
        </span>
      )}
    </BreadcrumbItem>
  );

  // Helper function for separator
  const renderSeparator = () => (
    <BreadcrumbSeparator className="flex-shrink-0 w-5">
      <Slash className="w-4 h-4" />
    </BreadcrumbSeparator>
  );

  return (
    <Breadcrumb className="w-full">
      <BreadcrumbList className="flex items-center w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
        {renderBreadcrumbItem("Sites", true, "/sites")}
        {renderSeparator()}
        {renderBreadcrumbItem(
          firstBreadcrumb,
          true,
          "/projects?siteId=" + project?.siteId
        )}
        {renderSeparator()}

        {/* Project name */}
        {renderBreadcrumbItem(
          project?.name,
          true,
          `/projects/${project.id}`,
          maxLength.project
        )}

        {/* Path segments with max limit */}
        {pathArray.length > 0 && (
          <>
            {renderSeparator()}

            {/* Ellipsis if items are omitted */}
            {showEllipsis && (
              <>
                {renderBreadcrumbItem(
                  <span className="text-gray-500">...</span>
                )}
                {renderSeparator()}
              </>
            )}

            {visiblePathArray.map((segment, index) => {
              const isLastItem = index === visiblePathArray.length - 1;
              const decodedSegment = decodeURIComponent(segment);
              const originalIndex = showEllipsis
                ? pathArray.length - itemsToShow + index
                : index;
              const pathSoFar = pathArray.slice(0, originalIndex + 1).join("/");

              return (
                <Fragment key={decodedSegment}>
                  {isLastItem
                    ? renderBreadcrumbItem(
                        decodedSegment,
                        false,
                        "",
                        maxLength.lastSegment,
                        true
                      )
                    : renderBreadcrumbItem(
                        decodedSegment,
                        true,
                        `/projects/${project.id}/tree/${pathSoFar}`,
                        maxLength.segment
                      )}
                  {!isLastItem && renderSeparator()}
                </Fragment>
              );
            })}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default ProjectNavBreadcrumbs;
