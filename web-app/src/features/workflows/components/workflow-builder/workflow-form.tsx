import { useGetAgentsQuery } from "../../features/agents/api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useGetToolsQuery } from "../../features/tools/api";
import { useModelsQuery } from "@/features/commons/models/api";
import { Step } from "../../workflows.types";
import WorkflowStep from "./workflow-step";
import { workflowBuilderSchema } from "../../schemas/workflow.schema";
import { ZodError } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkflowMutation } from "../../api";
import { toast } from "sonner";
import { useNavigate } from "react-router";

const WorkflowForm = () => {
    const navigate = useNavigate();
    const { data: agents } = useGetAgentsQuery();
    const { data: tools } = useGetToolsQuery();
    const { data: models } = useModelsQuery();
    const [steps, setSteps] = useState<Step[]>([]);
    const [errors, setErrors] = useState<ZodError[]>([]);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const { mutate: createWorkflow, isPending, isError, error, data, isSuccess } = useCreateWorkflowMutation();


    useEffect(() => {
        if (isSuccess && data) {
            toast.success(data.message);
            // redirect to the workflow page
            navigate(`/workflows`);
        }

        if (isError && error) {
            toast.error(error.message);
        }
    }, [isSuccess, data, isError, error])

    const addStep = () => {
        setSteps([...steps, {
            id: Date.now().toString(),
            agentId: null,
            name: "",
            description: "",
            instructions: "",
            model: "",
            activeTools: [],
            formSchema: {
                fields: {}
            }
        }]);
    };

    const removeStep = (stepId: string) => {
        setSteps(steps.filter(step => step.id !== stepId));
    };

    const updateStepAgent = (stepId: string, agentId: string) => {
        const agent = agents?.find(a => a.id === agentId);
        if (agent) {
            setSteps(steps.map(step =>
                step.id === stepId
                    ? {
                        ...step,
                        agentId,
                        name: agent.name || "",
                        description: agent.description || "",
                        instructions: agent.instructions || "",
                        model: agent.model,
                        activeTools: agent.activeTools,
                        formSchema: agent.formSchema
                    }
                    : step
            ));
        }
    };

    const updateStepField = (stepId: string, field: keyof Step, value: any) => {
        setSteps(steps.map(step =>
            step.id === stepId
                ? { ...step, [field]: value }
                : step
        ));
    };

    const handleCreateWorkflow = () => {
        const workflowData = {
            name,
            description,
            workflowSteps: steps
        };
        const validationErrors = workflowBuilderSchema.safeParse(workflowData);
        if (validationErrors.error) {
            setErrors([validationErrors.error]);
        }

        if (validationErrors.success) {
            createWorkflow(workflowData);
        }
    };

    const formErrors = errors[0]?.issues || [];

    const getFieldError = (fieldPath: string[]) => {
        return formErrors.find(err =>
            err.path.length === fieldPath.length &&
            err.path.every((segment, index) => segment === fieldPath[index])
        );
    };


    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Workflow configuration</h1>

            <div className="space-y-4 mb-8">
                <div>
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

                <div>
                    <Label className="flex items-center gap-2">
                        Description
                        <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter workflow description"
                        className={getFieldError(["description"]) ? "border-destructive" : ""}
                    />
                    {getFieldError(["description"]) && (
                        <p className="text-sm text-destructive mt-1">
                            {getFieldError(["description"])?.message}
                        </p>
                    )}
                </div>
            </div>

            {steps.map((step, index) => (
                <div key={step.id} className="mb-8 p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">{`Step ${index + 1}`}</h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStep(step.id)}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                    <WorkflowStep
                        step={step}
                        agents={agents || []}
                        index={index}
                        onUpdateStepField={(stepId, field, value) => updateStepField(stepId, field as keyof Step, value)}
                        onUpdateStepAgent={updateStepAgent}
                        models={models || []}
                        tools={tools || []}
                        errors={errors}
                    />
                </div>
            ))}
            <div className="flex flex-col gap-4">
                <Button
                    onClick={addStep}
                    variant="outline"
                    className="w-full h-24 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 text-muted-foreground"
                >
                    Add Step
                </Button>
                {steps.length > 0 && (
                    <Button variant="default" onClick={handleCreateWorkflow} disabled={isPending}>
                        {isPending ? "Creating..." : "Create Workflow"}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default WorkflowForm;