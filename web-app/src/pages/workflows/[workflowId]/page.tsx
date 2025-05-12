import {
  useDeleteWorkflowMutation,
  useWorkflowQuery,
} from "@/features/workflows/api";
import { VNextWorkflowGraph, WorkflowPageContent } from "@/features/workflows/components";
import { useParams } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { Loader2, PencilIcon, Slash, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

export function WorkflowPage() {
  const navigate = useNavigate();
  const { workflowId } = useParams<{
    workflowId: string;
  }>();

  const { data: workflow, isLoading } = useWorkflowQuery(workflowId as string);
  const { mutate: deleteWorkflow, isPending: isDeleting } =
    useDeleteWorkflowMutation();

  const handleDeleteWorkflow = () => {
    deleteWorkflow(workflowId as string);
    navigate("/workflows");
  };

  const workflowDetails = useMemo(() => {
    // Temporary: make each steps' input after the first step be (referenceType: previousStep)
    // workflow?.steps.forEach((step, index) => {
    //   Object.keys(step.formSchema?.fields || {}).forEach((field) => {
    //     if (index > 0 && step.formSchema?.fields) {
    //       step.formSchema.fields[field].referenceType = "previousStep";
    //     }
    //   });
    // });
    return workflow;
  }, [workflow]);

  return (
    <VNextWorkflowGraph
      vNextWorkflow={workflowDetails}
      isLoading={isLoading}
    />
  )

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
            <div className="flex items-center gap-2">
              <Link to={`/workflows/${workflowId}/edit`}>
                <Button variant="ghost" size={"icon"}>
                  <PencilIcon className="w-4 h-4" />
                </Button>
              </Link>
              {isDeleting ? (
                <Button variant="ghost" size={"icon"} disabled>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size={"icon"}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the workflow "{workflow?.name}" and all its
                        history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteWorkflow}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
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
