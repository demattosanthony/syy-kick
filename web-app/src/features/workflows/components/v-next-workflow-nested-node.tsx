import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Workflow } from 'lucide-react';


import { cn } from '@/lib/utils';
import { useContext } from 'react';
import { VNextWorkflowNestedGraphContext } from '../context/v-next-workflow-nested-graph-context';
import { StepFlowEntry } from '@mastra/core/workflows/vNext';

export type NestedNode = Node<
  {
    label: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
    stepGraph: StepFlowEntry[];
  },
  'nested-node'
>;

export function VNextWorkflowNestedNode({ data }: NodeProps<NestedNode>) {
  const { label, withoutTopHandle, withoutBottomHandle, stepGraph } = data;
  const { showNestedGraph } = useContext(VNextWorkflowNestedGraphContext);
  return (
    <div className={cn('bg-[rgba(29,29,29,0.5)] rounded-md h-full overflow-scroll w-[274px]')}>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div className="p-2 cursor-pointer" onClick={() => showNestedGraph({ label, stepGraph })}>
        <div className="text-sm bg-mastra-bg-9 flex items-center gap-1.5 rounded-sm p-2 cursor-pointer">
          <Workflow className="text-current w-4 h-4" />
          <p className="text-mastra-el-6 capitalize text-xs font-medium">
            {label}
          </p>
        </div>
      </div>
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </div>
  );
}