import { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { LlmAgentConfig } from "@/types/workflow-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Trash, X } from "lucide-react";
import ModelSelector from "@/components/ModelSelector";

// A simple pencil icon, can be inlined or replaced
function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

export default function LlmAgentNode({ data, id }: NodeProps) {
  // We receive onDeleteNode, onUpdateNode, plus config, etc. from the parent
  const { nodeId, config, onDeleteNode, onUpdateNode } = data;

  const [isEditing, setIsEditing] = useState(false);
  const [nodeConfig, setNodeConfig] = useState<LlmAgentConfig>(
    config || {
      prompt: "",
      system: "",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 1000,
    }
  );

  const handleSave = () => {
    // Call parent's update callback
    onUpdateNode(nodeId, { config: nodeConfig });
    setIsEditing(false);
  };

  const handleDelete = () => {
    // Immediately remove node from the UI (via parent's callback)
    onDeleteNode(nodeId);
  };

  const updateConfig = (updates: Partial<LlmAgentConfig>) => {
    setNodeConfig({ ...nodeConfig, ...updates });
  };

  return (
    <Card className="min-w-[300px] max-w-[400px] shadow-md overflow-hidden">
      <CardHeader className="bg-purple-50 flex flex-row items-center justify-between p-3">
        <CardTitle className="text-sm font-medium">LLM Agent</CardTitle>
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
              <PencilIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-6 w-6 p-0 text-red-500"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {isEditing ? (
          <div className="space-y-3">
            {/* Editing form */}
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Model</Label>
                <ModelSelector
                  variant="with-name"
                  value={{
                    name: nodeConfig.model || "gpt-4",
                    provider: getProviderFromModel(nodeConfig.model || "gpt-4"),
                  }}
                  triggerClassName="border shadow-sm"
                  onChange={(model) => updateConfig({ model: model.name })}
                  showAuto={false}
                  className="w-full"
                  buttonClassName="w-full justify-start h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">System Message</Label>
                <Textarea
                  value={nodeConfig.system || ""}
                  onChange={(e) => updateConfig({ system: e.target.value })}
                  placeholder="You are a helpful assistant..."
                  className="text-xs min-h-[80px]"
                />
              </div>

              <div>
                <Label className="text-xs">Prompt Template</Label>
                <Textarea
                  value={nodeConfig.prompt || ""}
                  onChange={(e) => updateConfig({ prompt: e.target.value })}
                  placeholder="Use {{input}} to reference user input"
                  className="text-xs min-h-[80px]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <Label className="text-xs">
                    Temperature: {nodeConfig.temperature?.toFixed(1) ?? "0.7"}
                  </Label>
                </div>
                <Slider
                  value={[nodeConfig.temperature || 0.7]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(value) =>
                    updateConfig({ temperature: value[0] })
                  }
                  className="py-2"
                />
              </div>

              <div>
                <Label className="text-xs">Max Tokens</Label>
                <Input
                  type="number"
                  value={nodeConfig.maxTokens || 1000}
                  onChange={(e) =>
                    updateConfig({ maxTokens: parseInt(e.target.value) })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <Button onClick={handleSave} size="sm" className="w-full">
              Save
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Display mode */}
            <div className="flex justify-between">
              <span className="text-xs font-medium">Model:</span>
              <span className="text-xs">{nodeConfig.model || "gpt-4"}</span>
            </div>

            {nodeConfig.system && (
              <div>
                <span className="text-xs font-medium">System:</span>
                <p className="text-xs truncate max-w-[250px]">
                  {nodeConfig.system}
                </p>
              </div>
            )}

            {nodeConfig.prompt && (
              <div>
                <span className="text-xs font-medium">Prompt:</span>
                <p className="text-xs truncate max-w-[250px]">
                  {nodeConfig.prompt}
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-xs font-medium">Temperature:</span>
              <span className="text-xs">
                {nodeConfig.temperature?.toFixed(1) || "0.7"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-xs font-medium">Max Tokens:</span>
              <span className="text-xs">{nodeConfig.maxTokens || 1000}</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </Card>
  );
}

// Helper function to determine provider from model name
function getProviderFromModel(modelName: string): string {
  if (modelName.startsWith("gpt")) return "openai";
  if (modelName.startsWith("claude")) return "anthropic";
  if (modelName.startsWith("gemini")) return "google";
  if (modelName.startsWith("grok")) return "xai";
  // Add more mappings as needed
  return "openai"; // Default fallback
}
