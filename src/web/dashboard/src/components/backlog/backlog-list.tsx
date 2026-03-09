import { memo, useMemo } from "react";
import type { GraphDocument, GraphNode } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";

interface BacklogListProps {
  graph: GraphDocument;
  onNodeClick: (node: GraphNode) => void;
}

export const BacklogList = memo(function BacklogList({ graph, onNodeClick }: BacklogListProps) {
  const { groups, nextTask, nodeMap } = useMemo(() => {
    const tasks = graph.nodes.filter((n) => n.type === "task" || n.type === "subtask");
    const nMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const doneIds = new Set(graph.nodes.filter((n) => n.status === "done").map((n) => n.id));

    // Find next task
    const unblocked = tasks.filter((t) => {
      if (t.status !== "backlog" && t.status !== "ready") return false;
      if (t.blocked) return false;
      const deps = graph.edges.filter((e) => e.from === t.id && e.relationType === "depends_on");
      return deps.every((e) => doneIds.has(e.to));
    });
    unblocked.sort((a, b) => a.priority - b.priority);

    // Group by parent
    const byParent = new Map<string, GraphNode[]>();
    for (const task of tasks) {
      const key = task.parentId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(task);
    }
    for (const group of byParent.values()) {
      group.sort((a, b) => a.priority - b.priority);
    }

    return { groups: byParent, nextTask: unblocked[0] || null, nodeMap: nMap };
  }, [graph]);

  if (graph.nodes.filter((n) => n.type === "task" || n.type === "subtask").length === 0) {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
        No tasks in backlog.
      </div>
    );
  }

  return (
    <div className="p-2">
      {nextTask && (
        <div className="mb-3 px-3 py-2 bg-[var(--color-accent)]10 border border-[var(--color-accent)] rounded-lg">
          <span className="text-xs font-medium text-[var(--color-accent)]">Next:</span>{" "}
          <span className="text-sm font-semibold">{nextTask.title}</span>
        </div>
      )}

      {Array.from(groups.entries()).map(([parentId, tasks]) => {
        const parent = parentId !== "__root__" ? nodeMap.get(parentId) : null;
        const label = parent ? parent.title : "Ungrouped Tasks";
        const doneCount = tasks.filter((t) => t.status === "done").length;
        const pct = Math.round((doneCount / tasks.length) * 100);

        return (
          <div key={parentId} className="mb-3">
            <div className="flex items-center justify-between px-2 py-1">
              <h4 className="text-xs font-semibold truncate">{label}</h4>
              <span className="text-[10px] text-[var(--color-text-muted)]">{doneCount}/{tasks.length}</span>
            </div>
            <div className="h-1 mx-2 mb-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: STATUS_COLORS.done }}
              />
            </div>

            {tasks.map((task) => {
              const isNext = nextTask?.id === task.id;
              const color = STATUS_COLORS[task.status] || "#9e9e9e";
              const deps = graph.edges.filter((e) => e.from === task.id && e.relationType === "depends_on");
              const depNames = deps.map((e) => nodeMap.get(e.to)?.title || e.to);

              return (
                <div
                  key={task.id}
                  onClick={() => onNodeClick(task)}
                  className={`mx-1 mb-1 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                    isNext ? "ring-1 ring-[var(--color-accent)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] px-1 py-0.5 rounded font-medium shrink-0"
                      style={{ background: `${color}20`, color }}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                    <span className="text-xs truncate flex-1">{task.title}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">P{task.priority}</span>
                    {task.xpSize && (
                      <span className="text-[10px] text-[var(--color-text-muted)]">{task.xpSize}</span>
                    )}
                  </div>
                  {depNames.length > 0 && (
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate pl-1">
                      Depends on: {depNames.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});
