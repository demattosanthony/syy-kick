import { Step } from "../../workflows.types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Agent, Tool } from "../../features/agents/types";
import { Model } from "@/types/model";
import FormField from "./form-field";
import ModelSelector from "./model-selector";
import { stepSchema } from "../../schemas/workflow.schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import {
  FileText,
  Type,
  Hash,
  Calendar,
  List,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { z, ZodError } from "zod";
import { agentsTypesLabels } from "../../utils/agents/translations";

const fieldTypes = [
  {
    type: "text",
    label: "Text Field",
    icon: Type,
    description: "A simple text input field",
  },
  {
    type: "number",
    label: "Number Field",
    icon: Hash,
    description: "A field for numeric values",
  },
  {
    type: "date",
    label: "Date Field",
    icon: Calendar,
    description: "A field for date selection",
  },
  {
    type: "file",
    label: "File Upload",
    icon: FileText,
    description: "A field for file uploads",
  },
  {
    type: "select",
    label: "Select Field",
    icon: List,
    description: "A dropdown selection field",
  },
];

const WorkflowStep = ({
  step,
  agents,
  index,
  onUpdateStepField,
  onUpdateStepAgent,
  models,
  tools,
  errors,
}: {
  step: Step;
  agents: Agent[];
  index: number;
  onUpdateStepField: (stepId: string, field: string, value: any) => void;
  onUpdateStepAgent: (stepId: string, agentId: string) => void;
  models: Model[];
  tools: Tool[];
  errors: ZodError[];
}) => {
  const [isFieldTypeDialogOpen, setIsFieldTypeDialogOpen] = useState(false);

  const isCustomAgent = !step.agentId;

  const validateStep = () => {
    try {
      stepSchema.parse(step);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          errors[path] = err.message;
        });
      }
      return false;
    }
  };

  const getFieldError = (fieldPath: string[]) => {
    return errors[0]?.issues.find(
      (err) =>
        err.path.length === fieldPath.length + 2 &&
        err.path[0] === "workflowSteps" &&
        err.path[1] === index &&
        err.path.slice(2).every((segment, i) => segment === fieldPath[i])
    );
  };

  const hasErrors =
    errors[0]?.issues.some(
      (err) => err.path[0] === "workflowSteps" && err.path[1] === index
    ) || false;

  const handleFieldChange = (field: string, value: any) => {
    onUpdateStepField(step.id, field, value);
    // Valider après chaque changement
    validateStep();
  };

  const handleAddField = (fieldType: string) => {
    const newFieldKey = `field_${Date.now()}`;
    const updatedFormSchema = {
      fields: {
        ...(step.formSchema?.fields || {}),
        [newFieldKey]: {
          type: fieldType,
          label: "",
          required: false,
          ...(fieldType === "select" ? { options: [] } : {}),
        },
      },
    };
    onUpdateStepField(step.id, "formSchema", updatedFormSchema);
    setIsFieldTypeDialogOpen(false);
  };

  const handleDeleteField = (fieldKey: string) => {
    const updatedFormSchema = {
      ...step.formSchema,
      fields: {
        ...step.formSchema!.fields,
      },
    };
    delete updatedFormSchema.fields[fieldKey];
    onUpdateStepField(step.id, "formSchema", updatedFormSchema);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue={step.agentId ? "agent" : "custom"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            value="agent"
            onClick={() => onUpdateStepField(step.id, "agentId", null)}
          >
            Use Existing Agent
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            onClick={() => onUpdateStepField(step.id, "agentId", null)}
          >
            Custom Agent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="space-y-4">
          <div className="mb-4">
            <Label>Agent</Label>
            <Select
              value={step.agentId || ""}
              onValueChange={(value) => onUpdateStepAgent(step.id, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(agentsTypesLabels).map(
                  ([type, { label, icon: Icon }]) => {
                    const typeAgents =
                      agents?.filter((agent) => agent.type === type) || [];
                    if (typeAgents.length === 0) return null;

                    return (
                      <SelectGroup key={type}>
                        <SelectLabel className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </SelectLabel>
                        {typeAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  }
                )}
              </SelectContent>
            </Select>
          </div>

          {step.formSchema && (
            <div className="mt-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">
                  Agent Input Fields
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure the input fields that will be shown to users during
                  workflow execution.
                </p>
              </div>
              <div className="space-y-4">
                {Object.entries(step.formSchema.fields).map(
                  ([fieldKey, field]) => (
                    <FormField
                      key={fieldKey}
                      fieldKey={fieldKey}
                      field={field}
                      stepId={step.id}
                      stepIndex={index}
                      onFieldChange={(key, updatedField) => {
                        const updatedFormSchema = {
                          ...step.formSchema,
                          fields: {
                            ...step.formSchema!.fields,
                            [key]: updatedField,
                          },
                        };
                        onUpdateStepField(
                          step.id,
                          "formSchema",
                          updatedFormSchema
                        );
                      }}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {hasErrors && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Validation errors</span>
              </div>
              <ul className="text-sm text-destructive/80 space-y-1">
                {errors[0]?.issues
                  .filter(
                    (err) =>
                      err.path[0] === "workflowSteps" && err.path[1] === index
                  )
                  .map((err, i) => (
                    <li key={i}>• {err.message}</li>
                  ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Agent configuration</h3>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Name
                {isCustomAgent && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={step.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Enter step name"
                className={cn(getFieldError(["name"]) && "border-destructive")}
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
                {isCustomAgent && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={step.description}
                onChange={(e) =>
                  handleFieldChange("description", e.target.value)
                }
                placeholder="Enter step description"
                className={cn(
                  getFieldError(["description"]) && "border-destructive"
                )}
              />
              {getFieldError(["description"]) && (
                <p className="text-sm text-destructive mt-1">
                  {getFieldError(["description"])?.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Instructions
                {isCustomAgent && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={step.instructions}
                onChange={(e) =>
                  handleFieldChange("instructions", e.target.value)
                }
                placeholder="Enter step instructions"
                className={cn(
                  getFieldError(["instructions"]) && "border-destructive"
                )}
              />
              {getFieldError(["instructions"]) && (
                <p className="text-sm text-destructive mt-1">
                  {getFieldError(["instructions"])?.message}
                </p>
              )}
            </div>

            <ModelSelector
              step={step}
              models={models || []}
              onModelChange={(modelName) =>
                handleFieldChange("model", modelName)
              }
              hasError={!!getFieldError(["model"])}
            />
            {getFieldError(["model"]) && (
              <p className="text-sm text-destructive mt-1">
                {getFieldError(["model"])?.message}
              </p>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">Active Tools</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      getFieldError(["activeTools"]) && "border-destructive"
                    )}
                  >
                    {step.activeTools.length > 0
                      ? `${step.activeTools.length} tool${
                          step.activeTools.length > 1 ? "s" : ""
                        } selected`
                      : "Select tools"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search tools..." />
                    <CommandEmpty>No tools found.</CommandEmpty>
                    <CommandGroup>
                      {tools?.map((tool) => (
                        <CommandItem
                          key={tool.id}
                          onSelect={() => {
                            const currentTools = step.activeTools;
                            if (currentTools.includes(tool.id)) {
                              onUpdateStepField(
                                step.id,
                                "activeTools",
                                currentTools.filter((t) => t !== tool.id)
                              );
                            } else {
                              onUpdateStepField(step.id, "activeTools", [
                                ...currentTools,
                                tool.id,
                              ]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{tool.name}</span>
                            {step.activeTools.includes(tool.id) && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {step.activeTools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {step.activeTools.map((toolId) => {
                    const tool = tools?.find((t) => t.id === toolId);
                    return tool ? (
                      <div
                        key={toolId}
                        className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
                      >
                        {tool.name}
                        <button
                          onClick={() => {
                            const currentTools = step.activeTools;
                            onUpdateStepField(
                              step.id,
                              "activeTools",
                              currentTools.filter((t) => t !== toolId)
                            );
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Agent Input Fields</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFieldTypeDialogOpen(true)}
                >
                  Add Field
                </Button>
              </div>

              <Dialog
                open={isFieldTypeDialogOpen}
                onOpenChange={setIsFieldTypeDialogOpen}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Select Field Type</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {fieldTypes.map((fieldType) => {
                      const Icon = fieldType.icon;
                      return (
                        <button
                          key={fieldType.type}
                          onClick={() => handleAddField(fieldType.type)}
                          className="flex items-start gap-4 p-4 rounded-lg border hover:bg-accent transition-colors text-left"
                        >
                          <div className="p-2 bg-secondary rounded-md">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-medium">{fieldType.label}</h4>
                            <p className="text-sm text-muted-foreground">
                              {fieldType.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>

              {step.formSchema?.fields &&
                Object.entries(step.formSchema.fields).map(
                  ([fieldKey, field]) => (
                    <FormField
                      key={fieldKey}
                      fieldKey={fieldKey}
                      field={field}
                      stepId={step.id}
                      stepIndex={index}
                      onFieldChange={(key, updatedField) => {
                        const updatedFormSchema = {
                          ...step.formSchema,
                          fields: {
                            ...step.formSchema!.fields,
                            [key]: updatedField,
                          },
                        };
                        onUpdateStepField(
                          step.id,
                          "formSchema",
                          updatedFormSchema
                        );
                      }}
                      onDeleteField={
                        !step.agentId ? handleDeleteField : undefined
                      }
                    />
                  )
                )}
            </div>
            {step.formSchema &&
              Object.keys(step.formSchema?.fields || {}).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No fields added yet.
                </p>
              )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowStep;
