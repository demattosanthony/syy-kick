import {
  WorkflowInputSchemaParsed,
  FileFormField,
  FormField,
} from "../workflows.types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FileUploadInput from "./workflow-file-input";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface WorkflowFormFieldsProps {
  formSchema: WorkflowInputSchemaParsed["json"]["properties"];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any, type: string) => void;
  className?: string;
  requiredFields: string[];
}

export function WorkflowFormFields({
  formSchema,
  values,
  onChange,
  className,
  requiredFields,
}: WorkflowFormFieldsProps) {
  const renderField = (fieldId: string, field: FormField) => {
    const commonProps = {
      id: fieldId,
      value: values[fieldId] || "",
      required: true,
      className: "w-full",
    };

    switch (field.properties.type.const) {
      case "file":
        const fileField = field.properties as FileFormField["properties"];
        return (
          <div key={fieldId} className="space-y-2 p-4">
            <FileUploadInput
              input={{
                id: fieldId,
                title: field.properties.label.const,
                description: fieldId,
                acceptedFileTypes: fileField.value.properties.mimeType.const,
                required: true,
                maxFileSize: 50 * 1024 * 1024, // 50 MB par défaut
              }}
              file={values[fieldId] as File}
              onFileChange={(file) => onChange(fieldId, file, "file")}
            />
            {requiredFields.includes(fieldId) && (
              <span className="text-sm text-red-500">Required</span>
            )}
          </div>
        );

      case "text":
        return (
          <div key={fieldId} className="space-y-2 p-4">
            <Label htmlFor={fieldId}>{field.properties.label.const}</Label>
            <Textarea
              {...commonProps}
              onChange={(e) => onChange(fieldId, e.target.value, "text")}
              placeholder={"Enter text"}
            />
            {requiredFields.includes(fieldId) && (
              <span className="text-sm text-red-500">Required</span>
            )}
          </div>
        );

      case "number":
        return (
          <div key={fieldId} className="space-y-2 p-4">
            <Label htmlFor={fieldId}>{field.properties.label.const}</Label>
            <Input
              {...commonProps}
              onChange={(e) => {
                const value = e.target.value;

                if (isNaN(Number(value))) {
                  return;
                }

                onChange(fieldId, parseFloat(value), "number");
              }}
              placeholder={"Enter number"}
            />
            {requiredFields.includes(fieldId) && (
              <span className="text-sm text-red-500">Required</span>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("", className)}>
      {Object.entries(formSchema).map(([fieldId, field]) => {
        return renderField(fieldId, field);
      })}
    </div>
  );
}
