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
}: {
  project: Project;
}) => {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link
            href={`/projects`}
            className="hover:text-blue-500 hover:underline"
            prefetch={false}
          >
            Projects
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <Slash />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <Link
            href={`/projects/${project.id}`}
            className="hover:text-blue-500 hover:underline"
            prefetch={false}
          >
            {project?.name}
          </Link>
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
                  <Link
                    href={`/projects/${project.id}/tree/${pathArray
                      .slice(0, index + 1)
                      .join("/")}`}
                    className="hover:text-blue-500 hover:underline"
                    prefetch={false}
                  >
                    {decodedSegment}
                  </Link>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default ProjectNavBreadcrumbs;