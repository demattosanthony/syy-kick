import { Skeleton } from '@/components/ui/skeleton';

import '../../../index.css';

import { AlertCircleIcon } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { VNextWorkflowGraphInner } from './v-next-workflow-graph-inner';
import { VNextWorkflowNestedGraphProvider } from '../context/v-next-workflow-nested-graph-context';
import { GetVNextWorkflowResponse } from '@mastra/client-js';

export function VNextWorkflowGraph({ vNextWorkflow, isLoading }: { vNextWorkflow?: GetVNextWorkflowResponse, isLoading: boolean }) {

    if (isLoading) {
        return (
            <div className="p-4">
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

    if (!vNextWorkflow) {
        return (
            <div className="grid h-full place-items-center">
                <div className="flex flex-col items-center gap-2">
                    <AlertCircleIcon />
                    <div>We couldn&apos;t find this workflow.</div>
                </div>
            </div>
        );
    }

    return (
        <VNextWorkflowNestedGraphProvider>
            <ReactFlowProvider>
                <VNextWorkflowGraphInner workflow={vNextWorkflow} />
            </ReactFlowProvider>
        </VNextWorkflowNestedGraphProvider>
    );
}