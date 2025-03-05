import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  WorkflowWithRelations,
  WorkflowNode as WorkflowNodeType,
} from "@/types/workflow-types";
import {
  useCreateNodeMutation,
  useUpdateNodeMutation,
  useDeleteNodeMutation,
  useCreateEdgeMutation,
  useDeleteEdgeMutation,
} from "@/queries/queries";

import InputNode from "./nodes/input-node";
import LlmAgentNode from "./nodes/llm-agent-node";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
      <div className="flex gap-2 mb-4">
        <Button
          onClick={() => addNode("input")}
          variant="outline"
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Input Node
        </Button>
        <Button
          onClick={() => addNode("llm_agent")}
          variant="outline"
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add LLM Agent
        </Button>
      </div>

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
