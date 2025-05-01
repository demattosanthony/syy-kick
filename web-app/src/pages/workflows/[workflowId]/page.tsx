import { useWorkflowQuery } from "@/features/workflows/api";
import { WorkflowPageContent } from "@/features/workflows/components";
import { useParams } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { PencilIcon, Slash } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export function WorkflowPage() {
  const { workflowId } = useParams<{
    workflowId: string;
  }>();

  const { data: workflow, isLoading } = useWorkflowQuery(workflowId as string);

  const workflowDetails = useMemo(() => {
    // Temporary: make each steps' input after the first step be (referenceType: previousStep)
    workflow?.steps.forEach((step, index) => {
      Object.keys(step.formSchema?.fields || {}).forEach((field) => {
        if (index > 0 && step.formSchema?.fields) {
          step.formSchema.fields[field].referenceType = "previousStep";
        }
      });
    });
    return workflow;
  }, [workflow]);

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
            <Link to={`/workflows/${workflowId}/edit`}>
              <Button variant="ghost" size={"icon"}>
                <PencilIcon className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
        <WorkflowPageContent
          workflowId={workflowId as string}
          workflow={workflowDetails}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
