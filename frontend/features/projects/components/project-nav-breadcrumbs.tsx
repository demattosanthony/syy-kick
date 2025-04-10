"use client";

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

interface BaseResource {
  id: string;
  name: string;
  siteId?: string;
  site?: {
    name: string;
  };
}

const ResourceNavBreadcrumbs = ({
  resource,
  contentType = "project",
  maxItems = 5, // Default max items to show
  maxLength = {
    resource: { sm: 200, default: 120 },
    segment: { sm: 150, default: 100 },
    lastSegment: { sm: 200, default: 120 },
  },
}: {
  resource: BaseResource;
  contentType: "project" | "knowledge-base";
  maxItems?: number;
  maxLength?: {
    resource: { sm: number; default: number };
    segment: { sm: number; default: number };
    lastSegment: { sm: number; default: number };
  };
}) => {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const totalItems = 3 + pathArray.length; // "Root" + resource name + path segments

  // Set up config based on resource type
  const config = {
    project: {
      rootLabel: resource.site?.name ? resource.site.name : "Projects",
      rootHref: "/projects?siteId=" + resource?.siteId,
      parentLabel: "Sites",
      parentHref: "/sites",
      resourcesPath: "/projects",
    },
    "knowledge-base": {
      rootLabel: "Knowledge Bases",
      rootHref: "/knowledge-bases",
      parentLabel: "Knowledge Bases",
      parentHref: "/knowledge-bases",
      resourcesPath: "/knowledge-bases",
    },
  };

  const { rootLabel, rootHref, parentLabel, parentHref, resourcesPath } =
    config[contentType];

  // Calculate how many items to show from the path
  const itemsToShow = Math.min(maxItems - 3, pathArray.length); // Reserve 2 for root and resource name
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
        {renderBreadcrumbItem(parentLabel, true, parentHref)}
        {renderSeparator()}
        {contentType === "project" && resource.site?.name && (
          <>
            {renderBreadcrumbItem(rootLabel, true, rootHref)}
            {renderSeparator()}
          </>
        )}

        {/* Resource name */}
        {pathArray.length === 0
          ? renderBreadcrumbItem(
              resource?.name,
              false, // Not a link
              "", // No href
              maxLength.resource,
              true // Bold
            )
          : renderBreadcrumbItem(
              resource?.name,
              true, // Is a link
              `${resourcesPath}/${resource.id}`,
              maxLength.resource
              // isBold defaults to false
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
                        `${resourcesPath}/${resource.id}/tree/${pathSoFar}`,
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

// For backward compatibility, export with the original name as well
const ProjectNavBreadcrumbs = (props: {
  project: Project;
  maxItems?: number;
  maxLength?: {
    project: { sm: number; default: number };
    segment: { sm: number; default: number };
    lastSegment: { sm: number; default: number };
  };
}) => {
  const { project, maxItems, maxLength } = props;
  const renamedMaxLength = maxLength
    ? {
        resource: maxLength.project,
        segment: maxLength.segment,
        lastSegment: maxLength.lastSegment,
      }
    : undefined;

  return (
    <ResourceNavBreadcrumbs
      resource={project}
      contentType="project"
      maxItems={maxItems}
      maxLength={renamedMaxLength}
    />
  );
};

export default ProjectNavBreadcrumbs;
export { ResourceNavBreadcrumbs };
