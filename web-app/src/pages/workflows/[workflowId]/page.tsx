import { WorkflowPageContent } from "@/features/workflows/components";
import { useParams } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { Slash } from "lucide-react";

import { useWorkflowQuery } from "@/features/workflows/api";

export function WorkflowPage() {
  const { workflowId } = useParams<{
    workflowId: string;
  }>();

  const { data: workflow, isLoading } = useWorkflowQuery(workflowId as string);

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-8">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <Link
                    to="/workflows"
                    className="hover:text-blue-500 hover:underline"
                  >
                    Workflows
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <Slash className="w-4 h-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <span className="font-bold truncate">{workflow?.name}</span>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
        <WorkflowPageContent
          workflowId={workflowId as string}
          isLoading={isLoading}
          workflow={workflow}
        />
      </div>
    </div>
  );
}
