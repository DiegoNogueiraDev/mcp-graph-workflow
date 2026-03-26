/**
 * SiebelDetailPanel — Shows object properties, children, and dependencies.
 * Follows the NodeDetailPanel pattern from the workflow graph.
 */

import { useMemo } from "react";
import { SIEBEL_TYPE_COLORS } from "@/lib/constants";
import type { SiebelObjectData, SiebelDependencyData } from "./siebel-graph-utils";

interface SiebelDetailPanelProps {
  object: SiebelObjectData;
  dependencies: SiebelDependencyData[];
  onClose: () => void;
  onShowImpact: (type: string, name: string) => void;
  impactTarget: { type: string; name: string } | null;
}

export function SiebelDetailPanel({
  object,
  dependencies,
  onClose,
  onShowImpact,
  impactTarget,
}: SiebelDetailPanelProps): React.JSX.Element {
  const typeColor = SIEBEL_TYPE_COLORS[object.type] || "#6b7280";

  const outgoing = useMemo(
    () => dependencies.filter((d) => d.from.name === object.name && d.from.type === object.type),
    [dependencies, object],
  );

  const incoming = useMemo(
    () => dependencies.filter((d) => d.to.name === object.name && d.to.type === object.type),
    [dependencies, object],
  );

  const isImpactActive = impactTarget?.name === object.name && impactTarget?.type === object.type;

  return (
    <aside className="w-80 flex-shrink-0 border-l border-edge bg-surface-alt overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-edge flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: `${typeColor}20`, color: typeColor }}
            >
              {object.type.replace(/_/g, " ")}
            </span>
            {object.inactive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted">
                inactive
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold truncate">{object.name}</h3>
          {object.project && (
            <p className="text-xs text-muted">{object.project}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          className="p-1 text-muted hover:text-foreground cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Impact button */}
      <div className="px-4 py-2 border-b border-edge">
        <button
          onClick={() => {
            if (isImpactActive) return;
            onShowImpact(object.type, object.name);
          }}
          disabled={isImpactActive}
          aria-label="Show impact analysis"
          className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-opacity cursor-pointer ${
            isImpactActive
              ? "bg-orange-500/20 text-orange-400 cursor-default"
              : "bg-accent text-white hover:opacity-90"
          }`}
        >
          {isImpactActive ? "Impact Analysis Active" : "Show Impact"}
        </button>
      </div>

      {/* Properties */}
      {object.properties.length > 0 && (
        <div className="px-4 py-3 border-b border-edge">
          <h4 className="text-[10px] font-semibold uppercase text-muted mb-2 tracking-wider">
            Properties ({object.properties.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {object.properties.map((prop, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="font-mono text-muted flex-shrink-0">{prop.name}</span>
                <span className="text-foreground truncate">{prop.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Children */}
      {object.children.length > 0 && (
        <div className="px-4 py-3 border-b border-edge">
          <h4 className="text-[10px] font-semibold uppercase text-muted mb-2 tracking-wider">
            Children ({object.children.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {object.children.map((child, i) => {
              const childColor = SIEBEL_TYPE_COLORS[child.type] || "#6b7280";
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded flex-shrink-0"
                    style={{ background: `${childColor}20`, color: childColor }}
                  >
                    {child.type}
                  </span>
                  <span className="truncate">{child.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outgoing Dependencies */}
      {outgoing.length > 0 && (
        <div className="px-4 py-3 border-b border-edge">
          <h4 className="text-[10px] font-semibold uppercase text-muted mb-2 tracking-wider">
            Depends On ({outgoing.length})
          </h4>
          <div className="space-y-1">
            {outgoing.map((dep, i) => {
              const depColor = SIEBEL_TYPE_COLORS[dep.to.type] || "#6b7280";
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded flex-shrink-0"
                    style={{ background: `${depColor}20`, color: depColor }}
                  >
                    {dep.to.type.replace(/_/g, " ")}
                  </span>
                  <span className="truncate">{dep.to.name}</span>
                  <span className="text-[9px] text-muted ml-auto flex-shrink-0">
                    {dep.relationType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming Dependencies */}
      {incoming.length > 0 && (
        <div className="px-4 py-3">
          <h4 className="text-[10px] font-semibold uppercase text-muted mb-2 tracking-wider">
            Referenced By ({incoming.length})
          </h4>
          <div className="space-y-1">
            {incoming.map((dep, i) => {
              const depColor = SIEBEL_TYPE_COLORS[dep.from.type] || "#6b7280";
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded flex-shrink-0"
                    style={{ background: `${depColor}20`, color: depColor }}
                  >
                    {dep.from.type.replace(/_/g, " ")}
                  </span>
                  <span className="truncate">{dep.from.name}</span>
                  <span className="text-[9px] text-muted ml-auto flex-shrink-0">
                    {dep.relationType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
