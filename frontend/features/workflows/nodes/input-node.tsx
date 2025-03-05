import { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { InputNodeConfig } from "@/types/workflow-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, PlusIcon, TrashIcon, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function InputNode({ data, id }: NodeProps) {
  // We receive onDeleteNode, onUpdateNode, plus config, etc. from the parent
  const { nodeId, config, onDeleteNode, onUpdateNode } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [nodeConfig, setNodeConfig] = useState<InputNodeConfig>(
    config || { fields: [] }
  );

  const handleSave = () => {
    // Update via parent's callback
    onUpdateNode(nodeId, { config: nodeConfig });
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDeleteNode(nodeId);
  };

  const addField = () => {
    const newField = {
      id: `field-${Date.now()}`,
      label: "New Field",
      type: "text" as const,
      required: false,
    };
    setNodeConfig({
      ...nodeConfig,
      fields: [...(nodeConfig.fields || []), newField],
    });
  };

  const removeField = (fieldId: string) => {
    setNodeConfig({
      ...nodeConfig,
      fields: (nodeConfig.fields || []).filter((field) => field.id !== fieldId),
    });
  };

  const updateField = (
    fieldId: string,
    updates: Partial<NonNullable<InputNodeConfig["fields"]>[number]>
  ) => {
    setNodeConfig({
      ...nodeConfig,
      fields: (nodeConfig.fields || []).map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field
      ),
    });
  };

  return (
    <Card className="min-w-[300px] max-w-[400px] shadow-md overflow-hidden">
      <CardHeader className="bg-blue-50 flex flex-row items-center justify-between p-3">
        <CardTitle className="text-sm font-medium">Input Form</CardTitle>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="h-6 w-6 p-0"
          >
            {isEditing ? (
              <X className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-6 w-6 p-0 text-red-500"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Form Fields</h3>

              {(nodeConfig.fields || []).map((field) => (
                <div key={field.id} className="border rounded-md p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{field.label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field.id)}
                      className="h-5 w-5 p-0 text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          updateField(field.id, { label: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) =>
                          updateField(field.id, {
                            type: value as "text" | "file",
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="file">File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`required-${field.id}`}
                      checked={field.required}
                      onCheckedChange={(checked) =>
                        updateField(field.id, { required: checked === true })
                      }
                    />
                    <Label htmlFor={`required-${field.id}`} className="text-xs">
                      Required
                    </Label>
                  </div>

                  {field.type === "file" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Accept</Label>
                        <Input
                          value={field.accept || ""}
                          onChange={(e) =>
                            updateField(field.id, { accept: e.target.value })
                          }
                          placeholder=".pdf,.docx"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id={`multiple-${field.id}`}
                          checked={field.multiple}
                          onCheckedChange={(checked) =>
                            updateField(field.id, {
                              multiple: checked === true,
                            })
                          }
                        />
                        <Label
                          htmlFor={`multiple-${field.id}`}
                          className="text-xs"
                        >
                          Multiple
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addField}
                className="w-full mt-2 text-xs h-7"
              >
                <PlusIcon className="h-3 w-3 mr-1" /> Add Field
              </Button>
            </div>

            <Button onClick={handleSave} size="sm" className="w-full">
              Save
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Form Fields</h3>
            {(nodeConfig.fields || []).length > 0 ? (
              <ul className="space-y-1">
                {(nodeConfig.fields || []).map((field) => (
                  <li key={field.id} className="text-xs">
                    <span className="font-medium">{field.label}</span>
                    <span className="text-gray-500 ml-1">
                      ({field.type}
                      {field.required ? ", required" : ""})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No fields configured</p>
            )}
          </div>
        )}
      </CardContent>

      {/* Handles for connections */}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </Card>
  );
}
