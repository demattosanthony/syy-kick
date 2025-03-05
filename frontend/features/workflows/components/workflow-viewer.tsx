"use client";

import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  WorkflowWithRelations,
  WorkflowNode as WorkflowNodeType,
} from "@/types/workflow-types";

import InputNode from "./nodes/input-node";
import LlmAgentNode from "./nodes/llm-agent-node";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCreateEdgeMutation,
  useCreateNodeMutation,
  useDeleteEdgeMutation,
  useDeleteNodeMutation,
  useUpdateNodeMutation,
} from "../api";

interface WorkflowViewerProps {
  workflow: WorkflowWithRelations;
}

// Define custom node types
const nodeTypes: NodeTypes = {
  input: InputNode,
  llm_agent: LlmAgentNode,
};

export default function WorkflowViewer({ workflow }: WorkflowViewerProps) {
  // Convert workflow nodes to react-flow nodes
  const initialNodes = workflow.nodes.map((node: WorkflowNodeType) => ({
    id: node.id,
    type: node.type,
    position: { x: node.positionX, y: node.positionY },
    data: {
      nodeId: node.id,
      workflowId: workflow.id,
      config: node.config,
    },
    style: {
      background: "transparent",
      border: "none",
      boxShadow: "none",
      // optional if you want to remove any padding
      padding: 0,
    },
  }));

  // Convert workflow edges to react-flow edges
  const initialEdges = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
  }));

  // Local state for nodes/edges
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Mutations
  const createNodeMutation = useCreateNodeMutation();
  const updateNodeMutation = useUpdateNodeMutation();
  const deleteNodeMutation = useDeleteNodeMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const deleteEdgeMutation = useDeleteEdgeMutation();

  // -- Callbacks --

  // Handle connecting nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        createEdgeMutation.mutate({
          workflowId: workflow.id,
          edgeData: {
            sourceNodeId: connection.source,
            targetNodeId: connection.target,
          },
        });
        setEdges((eds) => addEdge(connection, eds));
      }
    },
    [createEdgeMutation, workflow.id, setEdges]
  );

  // Handle node position changes
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNodeMutation.mutate({
        workflowId: workflow.id,
        nodeId: node.id,
        nodeData: {
          positionX: node.position.x,
          positionY: node.position.y,
        },
      });
    },
    [updateNodeMutation, workflow.id]
  );

  // Add new node
  const addNode = useCallback(
    (type: "input" | "llm_agent") => {
      const position = {
        x: Math.random() * 400,
        y: Math.random() * 400,
      };

      const defaultConfig =
        type === "input"
          ? { fields: [] }
          : { prompt: "", system: "", model: "gpt-4" };

      createNodeMutation.mutate(
        {
          workflowId: workflow.id,
          nodeData: {
            type,
            positionX: position.x,
            positionY: position.y,
            config: defaultConfig,
          },
        },
        {
          onSuccess: (newNode) => {
            // Add the new node to local ReactFlow state
            const reactFlowNode = {
              id: newNode.node.id,
              type: newNode.node.type,
              position: {
                x: newNode.node.positionX,
                y: newNode.node.positionY,
              },
              data: {
                nodeId: newNode.node.id,
                workflowId: workflow.id,
                config: newNode.node.config,
              },
              style: {
                background: "transparent",
                border: "none",
                boxShadow: "none",
                padding: 0,
              },
            };
            setNodes((nds) => [...nds, reactFlowNode]);
          },
        }
      );
    },
    [createNodeMutation, workflow.id, setNodes]
  );

  // Immediately remove a node (and any related edges) when user deletes
  // and then call the server mutation
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      // Remove from local state first (immediate UI update)
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );

      // Also call backend
      deleteNodeMutation.mutate({ workflowId: workflow.id, nodeId });
    },
    [deleteNodeMutation, workflow.id, setNodes, setEdges]
  );

  // Update node data on the server
  const handleUpdateNode = useCallback(
    (nodeId: string, updateData: Partial<WorkflowNodeType>) => {
      updateNodeMutation.mutate({
        workflowId: workflow.id,
        nodeId,
        nodeData: updateData,
      });
    },
    [updateNodeMutation, workflow.id]
  );

  // Augment each node’s `data` with callbacks for updating & deleting
  const nodesWithCallbacks = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onDeleteNode: handleDeleteNode,
      onUpdateNode: handleUpdateNode,
    },
  }));

  return (
    <div className="h-[calc(100vh-200px)] w-full">
      <div className="flex justify-start p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Node{" "}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => addNode("input")}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">Input Node</span>
                <span className="text-xs text-muted-foreground">
                  Collect user input data
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => addNode("llm_agent")}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">LLM Agent</span>
                <span className="text-xs text-muted-foreground">
                  Process data with AI models
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        attributionPosition="bottom-right"
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
