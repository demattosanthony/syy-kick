import { ToolCallUnion, ToolResultUnion } from "ai";
import { createToolSet } from "./tools.registry";

export type ToolSet = ReturnType<typeof createToolSet>;
export type ToolName = keyof ToolSet;
export type ToolCall = ToolCallUnion<ToolSet>;
export type ToolResult = ToolResultUnion<ToolSet>;
