import { useGetAgentsQuery } from "../features/agents/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Agent, AgentFormSchema } from "../features/agents/types/agents";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUploadInput from "./workflow-file-input";
import { Trash2, Check } from "lucide-react";
import { useGetToolsQuery } from "../features/tools/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useModelsQuery } from "@/features/commons/models/api";
import { Model } from "@/types/model";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getModelIconPath } from "@/features/chat/messages/utils";

interface Step {
    id: string;
    agentId: string | null;
    name: string;
    description: string;
    instructions: string;
    model: string;
    activeTools: string[];
    formSchema: AgentFormSchema | null;
    formData: Record<string, any>;
}


const getModelImage = (provider: string) => {
    const iconPath = getModelIconPath(provider);
    if (iconPath) {
        return <img src={iconPath} alt={provider} className="h-4 w-4" />;
    }
    return null;
};

const WorkflowForm = () => {
    const { data: agents } = useGetAgentsQuery();
    const { data: tools } = useGetToolsQuery();
    const { data: models } = useModelsQuery();
    const [steps, setSteps] = useState<Step[]>([]);
    const [modelSelectorOpen, setModelSelectorOpen] = useState<Record<string, boolean>>({});

    const addStep = () => {
        setSteps([...steps, {
            id: Date.now().toString(),
            agentId: null,
            name: "",
            description: "",
            instructions: "",
            model: "",
            activeTools: [],
            formSchema: null,
            formData: {}
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
                        name: agent.name,
                        description: agent.description || "",
                        instructions: agent.instructions || "",
                        model: agent.model,
                        activeTools: agent.activeTools,
                        formSchema: agent.formSchema,
                        formData: {}
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

    const updateStepFormData = (stepId: string, fieldKey: string, value: any) => {
        setSteps(steps.map(step =>
            step.id === stepId
                ? { ...step, formData: { ...step.formData, [fieldKey]: value } }
                : step
        ));
    };

    const getSelectedAgent = (stepId: string): Agent | undefined => {
        const step = steps.find(s => s.id === stepId);
        return agents?.find(agent => agent.id === step?.agentId);
    };

    const renderFormField = (
        fieldKey: string,
        field: AgentFormSchema['fields'][string],
        stepId: string,
        stepIndex: number
    ) => {
        const isFileField = field.type === 'file';
        const previousSteps = steps.slice(0, stepIndex);

        return (
            <div key={fieldKey} className="mb-4">
                <Label className="text-lg font-semibold" htmlFor={fieldKey}>{field.label}</Label>
                {field.description && (
                    <p className="text-sm text-muted-foreground mb-2">{field.description}</p>
                )}
                
                {field.type === 'text' && (
                    <Input
                        id={fieldKey}
                        value={steps.find(s => s.id === stepId)?.formData[fieldKey] || ''}
                        onChange={(e) => updateStepFormData(stepId, fieldKey, e.target.value)}
                        required={field.required}
                        multiple={true}
                    />
                )}

                {field.type === 'number' && (
                    <Input
                        id={fieldKey}
                        type="number"
                        value={steps.find(s => s.id === stepId)?.formData[fieldKey] || ''}
                        onChange={(e) => updateStepFormData(stepId, fieldKey, e.target.value)}
                        required={field.required}
                    />
                )}

                {field.type === 'select' && field.options && (
                    <Select
                        value={steps.find(s => s.id === stepId)?.formData[fieldKey] || ''}
                        onValueChange={(value) => updateStepFormData(stepId, fieldKey, value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                            {field.options.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {isFileField && (
                    <div className="space-y-4">
                        {stepIndex > 0 && (
                            <div className="mb-4">
                                <Label>Or use a previous step's file(s) output</Label>
                                <Select
                                    value={steps.find(s => s.id === stepId)?.formData[`${fieldKey}_source`] || ''}
                                    onValueChange={(value) => updateStepFormData(stepId, `${fieldKey}_source`, value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a previous step" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {previousSteps.map((prevStep, idx) => (
                                            <SelectItem key={prevStep.id} value={prevStep.id}>
                                                Step {idx + 1} - {prevStep.name || agents?.find(a => a.id === prevStep.agentId)?.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        
                        <FileUploadInput
                            input={{
                                id: fieldKey,
                                title: "",
                                acceptedFileTypes: field.acceptedFileTypes?.join(','),
                                required: field.required,
                                maxFileSize: 50 * 1024 * 1024 // 50 MB
                            }}
                            file={steps.find(s => s.id === stepId)?.formData[fieldKey] || null}
                            onFileChange={(file) => updateStepFormData(stepId, fieldKey, file)}
                        />
                    </div>
                )}
            </div>
        );
    };

    const renderModelSelector = (step: Step) => {
        const selectedModel = models?.find(m => m.name === step.model) || models?.[0];

        return (
            <div>
                <Label>Model</Label>
                <Popover 
                    open={modelSelectorOpen[step.id] || false} 
                    onOpenChange={(open) => setModelSelectorOpen(prev => ({ ...prev, [step.id]: open }))}
                >
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={modelSelectorOpen[step.id]}
                            className="w-full justify-between"
                        >
                            {selectedModel ? (
                                <div className="flex items-center">
                                    {getModelImage(selectedModel.provider)}
                                    <span className="ml-2">{selectedModel.name}</span>
                                </div>
                            ) : (
                                "Select model..."
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] h-[300px] p-0">
                        <Command className="h-full">
                            <CommandInput placeholder="Search model..." />
                            <CommandEmpty>No model found.</CommandEmpty>
                            <CommandGroup className="overflow-y-auto max-h-[calc(300px-40px)]">
                                {models?.map((model) => (
                                    <HoverCard key={model.name} openDelay={0.5} closeDelay={0}>
                                        <HoverCardTrigger>
                                            <CommandItem
                                                value={model.name}
                                                onSelect={() => {
                                                    updateStepField(step.id, "model", model.name);
                                                    setModelSelectorOpen(prev => ({ ...prev, [step.id]: false }));
                                                }}
                                            >
                                                <div className="flex items-center">
                                                    {getModelImage(model.provider || "")}
                                                    <span className="ml-2">{model.name}</span>
                                                </div>
                                                <Check
                                                    className={cn(
                                                        "ml-auto h-4 w-4",
                                                        step.model === model.name
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        </HoverCardTrigger>
                                        <HoverCardContent
                                            side="left"
                                            align="center"
                                            className="w-[400px]"
                                        >
                                            <div className="flex justify-between space-x-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage
                                                        src={getModelIconPath(model.provider || "") || ""}
                                                    />
                                                    <AvatarFallback>
                                                        {model.provider.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="space-y-3">
                                                    <h4 className="text-sm">
                                                        {model.provider.charAt(0).toUpperCase() +
                                                            model.provider.slice(1)}{" "}
                                                        / <span className="font-semibold">{model.name}</span>
                                                    </h4>

                                                    <p className="text-xs text-muted-foreground">
                                                        {model.description}
                                                    </p>

                                                    <div className="flex gap-1">
                                                        {model.supportedMimeTypes?.some((type) =>
                                                            type.startsWith("image/")
                                                        ) && <Badge>Image Upload</Badge>}
                                                        {model.supportedMimeTypes?.some(
                                                            (type) => type === "application/pdf"
                                                        ) && <Badge>File Upload</Badge>}
                                                        {(model.name.includes("online") ||
                                                            model.name.includes("sonar")) && (
                                                            <Badge>Web Search</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>
                                ))}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        );
    };

    const renderStepContent = (step: Step, index: number) => {
        return (
            <div className="space-y-6">
                <Tabs defaultValue={step.agentId ? "agent" : "custom"} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="agent" onClick={() => updateStepField(step.id, "agentId", null)}>
                            Use Existing Agent
                        </TabsTrigger>
                        <TabsTrigger value="custom" onClick={() => updateStepField(step.id, "agentId", null)}>
                            Custom Step
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="agent" className="space-y-4">
                        <div className="mb-4">
                            <Label>Agent</Label>
                            <Select
                                value={step.agentId || ""}
                                onValueChange={(value) => updateStepAgent(step.id, value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an agent" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents?.map(agent => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {getSelectedAgent(step.id)?.formSchema && (
                            <div className="mt-4">
                                {Object.entries(getSelectedAgent(step.id)!.formSchema!.fields).map(([fieldKey, field]) => 
                                    renderFormField(fieldKey, field, step.id, index)
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="custom" className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <Label>Name</Label>
                                <Input
                                    value={step.name}
                                    onChange={(e) => updateStepField(step.id, "name", e.target.value)}
                                    placeholder="Enter step name"
                                    required
                                />
                            </div>

                            <div>
                                <Label>Description</Label>
                                <Textarea
                                    value={step.description}
                                    onChange={(e) => updateStepField(step.id, "description", e.target.value)}
                                    placeholder="Enter step description"
                                />
                            </div>

                            <div>
                                <Label>Instructions</Label>
                                <Textarea
                                    value={step.instructions}
                                    onChange={(e) => updateStepField(step.id, "instructions", e.target.value)}
                                    placeholder="Enter step instructions"
                                    required
                                />
                            </div>

                            {renderModelSelector(step)}

                            <div>
                                <Label>Active Tools</Label>
                                <Select
                                    value={step.activeTools[0] || ""}
                                    onValueChange={(value) => {
                                        const currentTools = step.activeTools;
                                        if (currentTools.includes(value)) {
                                            updateStepField(step.id, "activeTools", currentTools.filter(t => t !== value));
                                        } else {
                                            updateStepField(step.id, "activeTools", [...currentTools, value]);
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select tools" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tools?.map(tool => (
                                            <SelectItem key={tool.id} value={tool.id}>
                                                {tool.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {step.activeTools.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {step.activeTools.map(toolId => {
                                            const tool = tools?.find(t => t.id === toolId);
                                            return tool ? (
                                                <div key={toolId} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
                                                    {tool.name}
                                                    <button
                                                        onClick={() => {
                                                            const currentTools = step.activeTools;
                                                            updateStepField(step.id, "activeTools", currentTools.filter(t => t !== toolId));
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

                            <div>
                                <Label>Document (Optional)</Label>
                                <FileUploadInput
                                    input={{
                                        id: "custom-document",
                                        title: "",
                                        description: "Upload a document to use in this step",
                                        acceptedFileTypes: "application/pdf",
                                        required: false,
                                        maxFileSize: 50 * 1024 * 1024 // 50 MB
                                    }}
                                    file={step.formData["document"] || null}
                                    onFileChange={(file) => updateStepFormData(step.id, "document", file)}
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Workflow configuration</h1>
            
            {steps.map((step, index) => (
                <div key={step.id} className="mb-8 p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Step {index + 1}</h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStep(step.id)}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                    
                    {renderStepContent(step, index)}
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
                    <Button variant="default">
                        Create Workflow
                    </Button>
                )}
            </div>
        </div>
    );
};

export default WorkflowForm;