import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, X, Check } from "lucide-react";
import { WorkflowRequest, WorkflowRequestFile } from "../types/requests";
import FileUploadInput from "../../../components/workflow-file-input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import { useCreateRequestMutation } from "../api";
import * as z from "zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useNavigate } from "react-router";

const requestSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    attachments: z.record(z.object({
        fileKey: z.string(),
        filename: z.string(),
        mimeType: z.string(),
    })),
    steps: z.array(z.object({
        title: z.string().min(1, "Step title is required"),
        details: z.string().min(1, "Step details are required"),
        inputs: z.array(z.string()),
        dependsOn: z.array(z.string()),
        outputDescription: z.string().min(1, "Output description is required"),
    })),
}).refine((data) => {
    if (data.steps.length > 0) {
        return data.steps[0].inputs.length > 0;
    }
    return true;
}, {
    message: "First step must have at least one attachment",
    path: ["steps", 0, "inputs"]
}).refine((data) => {
    if (data.steps.length > 0) {
        return data.steps[0].dependsOn.length === 0;
    }
    return true;
}, {
    message: "First step cannot have dependencies",
    path: ["steps", 0, "dependsOn"]
});

const RequestForm = () => {
    const navigate = useNavigate();
    const { mutate: createRequest, isPending } = useCreateRequestMutation();
    const [validationErrors, setValidationErrors] = useState<z.ZodError | null>(null);

    const [formData, setFormData] = useState<Omit<WorkflowRequest, "requestedBy">>(
        {
            title: "",
            description: "",
            attachments: {},
            steps: [],
            notes: ""
        }
    );

    const [attachments, setAttachments] = useState<File[]>([]);

    const handleInputChange = (
        field: keyof Omit<WorkflowRequest, "requestedBy">,
        value: string | Record<string, any>
    ) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleStepChange = (index: number, field: string, value: any) => {
        setFormData((prev) => {
            const newSteps = [...prev.steps];
            newSteps[index] = {
                ...newSteps[index],
                [field]: value,
            };
            return {
                ...prev,
                steps: newSteps,
            };
        });
    };

    const addStep = () => {
        setFormData((prev) => ({
            ...prev,
            steps: [
                ...prev.steps,
                {
                    title: "",
                    details: "",
                    inputs: [],
                    dependsOn: [],
                    outputDescription: "",
                },
            ],
        }));
    };

    const removeStep = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index),
        }));
    };

    const getFieldError = (path: (string | number)[]) => {
        if (!validationErrors) return null;
        return validationErrors.errors.find(error =>
            error.path.join(".") === path.join(".")
        )?.message;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors(null);

        try {
            const validatedData = requestSchema.parse(formData) as Omit<WorkflowRequest, "requestedBy">;

            // Upload all attachments
            const uploadPromises = attachments.map(async (attachment) => {
                const fieldId = Math.random().toString(36).substring(7);
                const fileKey = `uploads/${Date.now()}-${fieldId}-${attachment.name}`;
                const { url, file_metadata } = await api.uploads.getPresignedUrl(
                    attachment.name,
                    attachment.type,
                    attachment.size,
                    fileKey
                );

                await fetch(url, {
                    method: "PUT",
                    body: attachment,
                    headers: { "Content-Type": attachment.type },
                });

                return {
                    key: file_metadata.file_key,
                    metadata: {
                        fileKey: file_metadata.file_key,
                        filename: file_metadata.filename,
                        mimeType: file_metadata.mime_type,
                    }
                };
            });

            const uploadedFiles = await Promise.all(uploadPromises);

            // Add uploaded files to validatedData.attachments
            const updatedAttachments: Record<string, WorkflowRequestFile> = {};
            uploadedFiles.forEach(({ key, metadata }) => {
                updatedAttachments[key] = metadata;
            });

            validatedData.attachments = updatedAttachments;


            createRequest(validatedData, {
                onSuccess: (data) => {
                    toast.success(data.message);
                    navigate("/workflows");
                },
                onError: (error) => {
                    toast.error(error.message ?? "Failed to create workflow request");
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                setValidationErrors(error);
                error.errors.forEach((err) => {
                    toast.error(`Make sure to fill all the required fields`);
                });
            } else {
                toast.error("An error occurred while uploading files");
            }
        }
    };

    const handleAttachmentSelect = (stepIndex: number, fileName: string) => {
        // Find the file in the attachments array
        const selectedFile = attachments.find(file => file.name === fileName);
        if (!selectedFile) return;

        // Generate a unique key for this file
        const fileKey = `${Date.now()}-${fileName}`;

        setFormData((prev) => {
            // Add the file to the attachments if it doesn't already exist
            const newAttachments = { ...prev.attachments };
            if (!Object.values(newAttachments).some(att => att.filename === fileName)) {
                newAttachments[fileKey] = {
                    fileKey,
                    filename: fileName,
                    mimeType: selectedFile.type
                };
            }

            // Update the inputs of the step
            const newSteps = [...prev.steps];
            if (!newSteps[stepIndex].inputs.includes(fileKey)) {
                newSteps[stepIndex].inputs = [...newSteps[stepIndex].inputs, fileKey];
            }

            return {
                ...prev,
                attachments: newAttachments,
                steps: newSteps,
            };
        });
    };

    const handleStepOutputSelect = (stepIndex: number, previousStepIndex: string) => {
        setFormData((prev) => {
            const newSteps = [...prev.steps];
            if (!newSteps[stepIndex].dependsOn.includes(previousStepIndex)) {
                newSteps[stepIndex].dependsOn = [...newSteps[stepIndex].dependsOn, previousStepIndex];
            }
            return {
                ...prev,
                steps: newSteps,
            };
        });
    };

    const removeInput = (stepIndex: number, fileKey: string) => {
        setFormData((prev) => {
            const newSteps = [...prev.steps];
            newSteps[stepIndex].inputs = newSteps[stepIndex].inputs.filter(id => id !== fileKey);

            // Remove the file from the attachments if it's not used in any step
            const isFileUsedInOtherSteps = newSteps.some(
                (step, idx) => idx !== stepIndex && step.inputs.includes(fileKey)
            );

            const newAttachments = { ...prev.attachments };
            if (!isFileUsedInOtherSteps) {
                delete newAttachments[fileKey];
            }

            return {
                ...prev,
                steps: newSteps,
                attachments: newAttachments,
            };
        });
    };

    const removeDependency = (stepIndex: number, dependencyId: string) => {
        setFormData((prev) => {
            const newSteps = [...prev.steps];
            newSteps[stepIndex].dependsOn = newSteps[stepIndex].dependsOn.filter(id => id !== dependencyId);
            return {
                ...prev,
                steps: newSteps,
            };
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <Input
                            value={formData.title}
                            onChange={(e) => handleInputChange("title", e.target.value)}
                            placeholder="Request title"
                            // required
                            className={cn(
                                getFieldError(["title"]) && "border-destructive focus-visible:ring-destructive"
                            )}
                        />
                        {getFieldError(["title"]) && (
                            <p className="text-sm text-destructive mt-1">{getFieldError(["title"])}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange("description", e.target.value)}
                            placeholder="Detailed description of the request"
                            // required
                            className={cn(
                                getFieldError(["description"]) && "border-destructive focus-visible:ring-destructive"
                            )}
                        />
                        {getFieldError(["description"]) && (
                            <p className="text-sm text-destructive mt-1">{getFieldError(["description"])}</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                    <FileUploadInput
                        input={{
                            id: "attachments",
                            title: "Add attachments",
                            description: "Drag and drop or click to select files",
                            multiple: true,
                            acceptedFileTypes: ["application/pdf", "image/jpeg", "image/png", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "text/plain"],
                            maxFileSize: 50 * 1024 * 1024, // 50MB
                        }}
                        files={attachments}
                        onFileChange={(files) => {
                            if (files) {
                                const fileArray = Array.isArray(files) ? files : [files];
                                const validFiles = fileArray.filter((file): file is File => file instanceof File);
                                setAttachments(validFiles);
                            } else {
                                setAttachments([]);
                            }
                        }}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Workflow Steps</CardTitle>
                    <Button type="button" onClick={addStep} variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Step
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {formData.steps.map((step, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-4 relative group">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium">Step {index + 1}</h3>
                                <Button
                                    type="button"
                                    onClick={() => removeStep(index)}
                                    variant="ghost"
                                    size="sm"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Step Title</label>
                                <Input
                                    value={step.title}
                                    onChange={(e) => handleStepChange(index, "title", e.target.value)}
                                    placeholder="Step title"
                                    required
                                    className={cn(
                                        getFieldError(["steps", index, "title"]) && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                                {getFieldError(["steps", index, "title"]) && (
                                    <p className="text-sm text-destructive mt-1">{getFieldError(["steps", index, "title"])}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Details</label>
                                <Textarea
                                    value={step.details}
                                    onChange={(e) => handleStepChange(index, "details", e.target.value)}
                                    placeholder="Detailed description of the step"
                                    required
                                    className={cn(
                                        getFieldError(["steps", index, "details"]) && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                                {getFieldError(["steps", index, "details"]) && (
                                    <p className="text-sm text-destructive mt-1">{getFieldError(["steps", index, "details"])}</p>
                                )}
                            </div>
                            {index === 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Inputs</label>
                                    {getFieldError(["steps", 0, "inputs"]) && (
                                        <p className="text-sm text-destructive mt-1">{getFieldError(["steps", 0, "inputs"])}</p>
                                    )}
                                    <Select
                                        onValueChange={(value) => handleAttachmentSelect(index, value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an attachment" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {attachments.map((file, i) => (
                                                <SelectItem key={i} value={file.name}>
                                                    {file.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {step.inputs.map((fileKey) => (
                                            <Badge key={fileKey} variant="secondary">
                                                {formData.attachments[fileKey]?.filename || fileKey}
                                                <button
                                                    type="button"
                                                    onClick={() => removeInput(index, fileKey)}
                                                    className="ml-1"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {index > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Depends On</label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between"
                                            >
                                                {step.dependsOn.length > 0
                                                    ? `${step.dependsOn.length} step${step.dependsOn.length > 1 ? 's' : ''} selected`
                                                    : "Select items"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0">
                                            <Command>
                                                <CommandInput placeholder="Search steps..." />
                                                <CommandEmpty>No steps found.</CommandEmpty>
                                                <CommandGroup>
                                                    {formData.steps.slice(0, index).map((_, i) => {
                                                        const stepId = `step-${i + 1}`;
                                                        return (
                                                            <CommandItem
                                                                key={i}
                                                                onSelect={() => {
                                                                    if (step.dependsOn.includes(stepId)) {
                                                                        removeDependency(index, stepId);
                                                                    } else {
                                                                        handleStepOutputSelect(index, stepId);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span>Step {i + 1} Output</span>
                                                                    {step.dependsOn.includes(stepId) && (
                                                                        <Check className="h-4 w-4" />
                                                                    )}
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {step.dependsOn.map((depId) => (
                                            <Badge key={depId} variant="secondary">
                                                {depId}
                                                <button
                                                    type="button"
                                                    onClick={() => removeDependency(index, depId)}
                                                    className="ml-1"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1">Output Description</label>
                                <Textarea
                                    value={step.outputDescription}
                                    onChange={(e) =>
                                        handleStepChange(index, "outputDescription", e.target.value)
                                    }
                                    placeholder="Description of what comes out of this step"
                                    required
                                    className={cn(
                                        getFieldError(["steps", index, "outputDescription"]) && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                                {getFieldError(["steps", index, "outputDescription"]) && (
                                    <p className="text-sm text-destructive mt-1">{getFieldError(["steps", index, "outputDescription"])}</p>
                                )}
                            </div>
                            {index === formData.steps.length - 1 && (
                                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        type="button"
                                        onClick={addStep}
                                        size="icon"
                                        className="rounded-full bg-background shadow-md hover:shadow-lg"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {formData.steps.length === 0 && (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <p className="text-muted-foreground mb-4">No steps added yet</p>
                            <Button type="button" onClick={addStep} variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Step
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={formData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        placeholder="Additional notes about the workflow"
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                    {isPending ? "Creating..." : "Submit Request"}
                </Button>
            </div>
        </form>
    );
};

export default RequestForm;