import {
  WorkflowInputSchemaParsed,
  FileFormField,
  FormField,
} from "../workflows.types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FileUploadInput from "./workflow-file-input";
import { cn } from "@/lib/utils";

interface WorkflowFormFieldsProps {
  formSchema: WorkflowInputSchemaParsed["json"]["properties"];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  className?: string;
  projectId?: string;
}

export function WorkflowFormFields({
  formSchema,
  values,
  onChange,
  className,
  projectId,
}: WorkflowFormFieldsProps) {

  const renderField = (
    fieldId: string,
    field: FormField
  ) => {
    const commonProps = {
      id: fieldId,
      value: values[fieldId] || "",
      onChange: (e: any) => onChange(fieldId, e.target.value),
      required: true,
      className: "w-full",
    };

    console.log(JSON.stringify(field, null, 2), '<---- field.type.const')
    switch (field.properties.type.const) {
      case "file":
        const fileField = field.properties as FileFormField["properties"];
        console.log("---- case file")
        return (
          <div key={fieldId} className="space-y-2 p-4">
            <FileUploadInput
              input={{
                id: fieldId,
                title: fieldId,
                description: fieldId,
                acceptedFileTypes: fileField.value.properties.mimeType.const,
                required: true,
                maxFileSize: 50 * 1024 * 1024, // 50 MB par défaut
              }}
              file={values[fieldId] as File}
              onFileChange={(file) => onChange(fieldId, file)}
              projectId={projectId}
            />
          </div>
        );

      case "text":
        return (
          <div key={fieldId} className="space-y-2 p-4">
            <Label htmlFor={fieldId}>{fieldId}</Label>
            <Textarea {...commonProps} placeholder={"Enter text"} />
            <span className="text-sm text-red-500">Required</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {Object.entries(formSchema).map(([fieldId, field]) => {
        return renderField(fieldId, field)
      })}
    </div>
  );
}
