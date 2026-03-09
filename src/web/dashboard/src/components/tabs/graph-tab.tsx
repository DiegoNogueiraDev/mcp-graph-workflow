import type { GraphDocument } from "@/lib/types";
import { WorkflowGraph } from "@/components/graph/workflow-graph";

interface GraphTabProps {
  graph: GraphDocument;
}

export function GraphTab({ graph }: GraphTabProps): React.JSX.Element {
  return (
    <div className="h-full">
      <WorkflowGraph graph={graph} />
    </div>
  );
}
