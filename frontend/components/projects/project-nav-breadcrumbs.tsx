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
          <BreadcrumbLink href={`/projects/${project.id}`}>
            {project?.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathArray.map((segment, index) => {
          const isLastItem = index === pathArray.length - 1;
          return (
            <Fragment key={segment}>
              <BreadcrumbSeparator>
                <Slash />
              </BreadcrumbSeparator>
              <BreadcrumbItem key={segment}>
                {isLastItem ? (
                  <span>{segment}</span>
                ) : (
                  <BreadcrumbLink
                    href={`/projects/${project.id}/tree/main/${pathArray
                      .slice(0, index + 1)
                      .join("/")}`}
                  >
                    {segment}
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
