import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Project } from "@/types/project";
import { Slash } from "lucide-react";
import { useParams } from "next/navigation";
import { Fragment } from "react";

export default function ProjectNavBreadcrumbs({
  project,
}: {
  project: Project;
}) {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];

  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            href={`/projects/${project.id}`}
            className="hover:text-blue-500 hover:underline"
          >
            {project?.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathArray.map((segment, index) => {
          const isLastItem = index === pathArray.length - 1;
          const decodedSegment = decodeURIComponent(segment);
          return (
            <Fragment key={decodedSegment}>
              <BreadcrumbSeparator>
                <Slash />
              </BreadcrumbSeparator>
              <BreadcrumbItem key={decodedSegment}>
                {isLastItem ? (
                  <span className="font-bold">{decodedSegment}</span>
                ) : (
                  <BreadcrumbLink
                    href={`/projects/${project.id}/tree/main/${pathArray
                      .slice(0, index + 1)
                      .join("/")}`}
                    className="hover:text-blue-500 hover:underline"
                  >
                    {decodedSegment}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
