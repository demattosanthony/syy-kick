import { WorkflowStepFormSchema, WorkflowProjectFile } from "../workflows.types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import FileUploadInput from "./workflow-file-input";
import { Card } from "@/components/ui/card";
import { ArrowRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkflowFormFieldsProps {
    formSchema: WorkflowStepFormSchema;
    values: Record<string, any>;
    onChange: (fieldId: string, value: any) => void;
    onHoverPreviousStepOutputRef: (fieldId: string) => void;
    onLeavePreviousStepOutputRef: () => void;
    className?: string;
    projectId?: string;
}

export function WorkflowFormFields({
    formSchema,
    values,
    onChange,
    onHoverPreviousStepOutputRef,
    onLeavePreviousStepOutputRef,
    className,
    projectId,
}: WorkflowFormFieldsProps) {
    const renderField = (fieldId: string, field: WorkflowStepFormSchema["fields"][string]) => {
        const commonProps = {
            id: fieldId,
            value: values[fieldId] || "",
            onChange: (e: any) => onChange(fieldId, e.target.value),
            required: field.required,
            className: "w-full",
        };

        if (field.referenceType === "previousStep") {
            return (
                <Card key={fieldId} className="p-4 bg-muted/50 border-dashed relative group" onMouseEnter={() => {
                    onHoverPreviousStepOutputRef(fieldId)
                }} onMouseLeave={() => {
                    onLeavePreviousStepOutputRef()
                }}>
                    <div className="flex items-start gap-3">
                        <div className="mt-1">
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor={fieldId} className="text-base font-medium">
                                    {field.label}
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This input will be automatically populated with the output from the previous step</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            {field.description && (
                                <p className="text-sm text-muted-foreground">
                                    {field.description}
                                </p>
                            )}
                            <div className="text-sm text-muted-foreground italic">
                                Will be populated automatically
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-lg">
                        <p className="text-white font-medium text-center px-4">
                            This step will receive the data from the previous step
                        </p>
                    </div>
                </Card>
            );
        }

        switch (field.type) {
            case "file":
                return (
                    <Card key={fieldId} className="space-y-2 p-4">
                        <FileUploadInput
                            input={{
                                id: fieldId,
                                title: field.label,
                                description: field.description,
                                acceptedFileTypes: field.acceptedFileTypes,
                                required: field.required,
                                maxFileSize: 50 * 1024 * 1024, // 50 MB par défaut
                            }}
                            file={values[fieldId] as File | WorkflowProjectFile | null}
                            onFileChange={(file) => onChange(fieldId, file)}
                            projectId={projectId}
                        />
                    </Card>
                );

            case "text":
                return (
                    <Card key={fieldId} className="space-y-2 p-4">
                        <Label htmlFor={fieldId}>{field.label}</Label>
                        <Textarea
                            {...commonProps}
                            placeholder={field.description}
                        />
                        {field.required && (
                            <span className="text-sm text-red-500">Required</span>
                        )}
                    </Card>
                );

            case "number":
                return (
                    <Card key={fieldId} className="space-y-2 p-4">
                        <Label htmlFor={fieldId}>{field.label}</Label>
                        <Input
                            {...commonProps}
                            type="number"
                            placeholder={field.description}
                        />
                        {field.required && (
                            <span className="text-sm text-red-500">Required</span>
                        )}
                    </Card>
                );

            case "select":
                return (
                    <Card key={fieldId} className="space-y-2 p-4">
                        <Label htmlFor={fieldId}>{field.label}</Label>
                        <Select
                            value={values[fieldId] || ""}
                            onValueChange={(value) => onChange(fieldId, value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={field.description} />
                            </SelectTrigger>
                            <SelectContent>
                                {field.options?.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {field.required && (
                            <span className="text-sm text-red-500">Required</span>
                        )}
                    </Card>
                );

            case "date":
                return (
                    <Card key={fieldId} className="space-y-2 p-4">
                        <Label htmlFor={fieldId}>{field.label}</Label>
                        <Input
                            {...commonProps}
                            type="date"
                            placeholder={field.description}
                        />
                        {field.required && (
                            <span className="text-sm text-red-500">Required</span>
                        )}
                    </Card>
                );

            default:
                return null;
        }
    };

    return (
        <div className={cn("space-y-6", className)}>
            {Object.entries(formSchema.fields).map(([fieldId, field]) => renderField(fieldId, field))}
        </div>
    );
} 