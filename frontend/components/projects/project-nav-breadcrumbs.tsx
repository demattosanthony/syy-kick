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

export default function ProjectNavBreadcrumbs({
  project,
}: {
  project: Project;
}) {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link
            href={`/projects/${project.id}`}
            className="hover:text-blue-500 hover:underline"
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
                    href={`/projects/${project.id}/tree/main/${pathArray
                      .slice(0, index + 1)
                      .join("/")}`}
                    className="hover:text-blue-500 hover:underline"
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
