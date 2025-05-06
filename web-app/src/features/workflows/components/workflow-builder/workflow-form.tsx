import { useGetAgentsQuery } from "../../features/agents/api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useGetToolsQuery } from "../../features/tools/api";
import { useModelsQuery } from "@/features/commons/models/api";
import { Step, Workflow, WorkflowStepUpdateInput } from "../../workflows.types";
import WorkflowStep from "./workflow-step";
import { workflowBuilderSchema } from "../../schemas/workflow.schema";
import { ZodError } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
} from "../../api";
import { toast } from "sonner";
import { useNavigate } from "react-router";

interface WorkflowFormProps {
  initialData?: Workflow;
}

// Type reflecting Zod schema output for a step
type ValidatedWorkflowStep = {
  id: string;
  agentId?: string | null | undefined;
  name?: string;
  description?: string;
  instructions?: string;
  model?: string;
  activeTools?: string[];
  formSchema?: { fields: Record<string, any> }; // Adjust based on actual schema if needed
};

const mapApiStepToFormStep = (apiStep: Workflow["steps"][0]): Step => ({
  id: apiStep.id,
  agentId: apiStep.agentId,
  name: apiStep.name || "",
  description: apiStep.description || "",
  instructions: apiStep.instructions || "",
  model: apiStep.model || "",
  activeTools: apiStep.activeTools || [],
  formSchema: apiStep.formSchema || { fields: {} },
});

const mapFormStepToApiUpdateStep = (
  formStep: ValidatedWorkflowStep // Updated input type
): WorkflowStepUpdateInput => {
  const { id, ...rest } = formStep;
  // Ensure agentId is explicitly null if not provided or undefined
  // Also provide default values for other potentially undefined fields
  return {
    agentId: rest.agentId || null,
    name: rest.name || "",
    description: rest.description || "",
    instructions: rest.instructions || "",
    model: rest.model || "",
    activeTools: rest.activeTools || [],
    formSchema: rest.formSchema || { fields: {} },
  };
};

// Helper to convert validated step to the Step type expected by createWorkflow
const mapValidatedStepToStep = (validatedStep: ValidatedWorkflowStep): Step => {
  return {
    ...validatedStep,
    agentId: validatedStep.agentId || null, // Explicitly set null if undefined/null
    name: validatedStep.name || "",
    description: validatedStep.description || "",
    instructions: validatedStep.instructions || "",
    model: validatedStep.model || "",
    activeTools: validatedStep.activeTools || [],
    formSchema: validatedStep.formSchema || { fields: {} },
  };
};

const WorkflowForm = ({ initialData }: WorkflowFormProps) => {
  const navigate = useNavigate();
  const isEditing = !!initialData;
  const workflowId = initialData?.id;

  const { data: agents } = useGetAgentsQuery();
  const { data: tools } = useGetToolsQuery();
  const { data: models } = useModelsQuery();

  const [steps, setSteps] = useState<Step[]>(() => {
    return initialData?.steps?.map(mapApiStepToFormStep) || [];
  });
  const [errors, setErrors] = useState<ZodError[]>([]);
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );

  const { mutate: createWorkflow, ...createMutation } =
    useCreateWorkflowMutation();
  const { mutate: updateWorkflow, ...updateMutation } =
    useUpdateWorkflowMutation();

  const mutation = isEditing ? updateMutation : createMutation;
  const { isPending, isError, error, data, isSuccess } = mutation;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setSteps(initialData.steps?.map(mapApiStepToFormStep) || []);
      setErrors([]);
    } else {
      setName("");
      setDescription("");
      setSteps([]);
    }
  }, [initialData]);

  useEffect(() => {
    if (isSuccess && data) {
      toast.success(data.message);
      if (isEditing && workflowId) {
        navigate(`/workflows/${workflowId}`);
      } else {
        navigate(`/workflows`);
      }
    }

    if (isError && error) {
      toast.error(error.message || "An unknown error occurred.");
    }
  }, [isSuccess, data, isError, error, isEditing, workflowId, navigate]);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: Date.now().toString(),
        agentId: null,
        name: "",
        description: "",
        instructions: "",
        model: "",
        activeTools: [],
        formSchema: {
          fields: {},
        },
      },
    ]);
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((step) => step.id !== stepId));
  };

  const updateStepAgent = (stepId: string, agentId: string) => {
    const agent = agents?.find((a) => a.id === agentId);
    if (agent) {
      setSteps(
        steps.map((step) =>
          step.id === stepId
            ? {
              ...step,
              agentId,
              name: step.name || agent.name || "",
              description: step.description || agent.description || "",
              instructions: step.instructions || agent.instructions || "",
              model: step.model || agent.model || "",
              activeTools:
                step.activeTools?.length > 0
                  ? step.activeTools
                  : agent.activeTools || [],
              formSchema: step.formSchema ||
                agent.formSchema || { fields: {} },
            }
            : step
        )
      );
    } else {
      setSteps(
        steps.map((step) =>
          step.id === stepId ? { ...step, agentId: null } : step
        )
      );
    }
  };

  const updateStepField = (stepId: string, field: keyof Step | string, value: any) => {
    setSteps(
      steps.map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step
      )
    );
  };

  const insertStep = (index: number) => {
    const newStep = {
      id: Date.now().toString(),
      agentId: null,
      name: "",
      description: "",
      instructions: "",
      model: "",
      activeTools: [],
      formSchema: {
        fields: {},
      },
    };

    setSteps([
      ...steps.slice(0, index + 1),
      newStep,
      ...steps.slice(index + 1)
    ]);
  };

  const handleSubmit = () => {
    const dataToValidate = {
      name,
      description,
      workflowSteps: steps,
    };

    setErrors([]);

    const validationResult = workflowBuilderSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      setErrors([validationResult.error]);
      toast.error("Please fix the errors in the form.");
      return;
    }

    const validatedData = validationResult.data;

    if (isEditing && workflowId) {
      const updatePayload = {
        name: validatedData.name,
        description: validatedData.description,
        workflowSteps: validatedData.workflowSteps.map(
          mapFormStepToApiUpdateStep
        ),
      };
      updateWorkflow({ workflowId, data: updatePayload });
    } else {
      // Map validated steps to the Step type expected by createWorkflow
      const createPayload = {
        ...validatedData,
        workflowSteps: validatedData.workflowSteps.map(mapValidatedStepToStep),
      };
      createWorkflow(createPayload);
    }
  };

  const formErrors = errors[0]?.issues || [];

  const getFieldError = (fieldPath: (string | number)[]) => {
    return formErrors.find(
      (err) =>
        err.path.length === fieldPath.length &&
        err.path.every((segment, index) => segment === fieldPath[index])
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? "Edit Workflow" : "Workflow Configuration"}
      </h1>

      <div className="space-y-4 mb-8">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Name
            <span className="text-destructive">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter workflow name"
            className={getFieldError(["name"]) ? "border-destructive" : ""}
          />
          {getFieldError(["name"]) && (
            <p className="text-sm text-destructive mt-1">
              {getFieldError(["name"])?.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Description
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter workflow description"
            className={
              getFieldError(["description"]) ? "border-destructive" : ""
            }
          />
          {getFieldError(["description"]) && (
            <p className="text-sm text-destructive mt-1">
              {getFieldError(["description"])?.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="relative group">
            <WorkflowStep
              step={step}
              agents={agents || []}
              index={index}
              onUpdateStepField={updateStepField}
              onUpdateStepAgent={updateStepAgent}
              models={models || []}
              tools={tools || []}
              errors={errors}
              onInsertStep={insertStep}
            />
            <Button
              variant="outline"
              size="icon"
              className="absolute -right-12 top-0"
              onClick={() => removeStep(step.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 mt-8">
        {steps.length === 0 && <Button
          onClick={addStep}
          variant="outline"
          className="w-full h-24 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 text-muted-foreground"
        >
          Add Step
        </Button>}
        {steps.length > 0 && (
          <Button variant="default" onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
                ? "Update Workflow"
                : "Create Workflow"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkflowForm;
