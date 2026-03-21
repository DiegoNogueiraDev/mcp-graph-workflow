export type GraphEventType =
  | "node:created"
  | "node:updated"
  | "node:deleted"
  | "edge:created"
  | "edge:deleted"
  | "import:completed"
  | "bulk:updated"
  | "knowledge:indexed"
  | "knowledge:deleted"
  | "phase:transitioned"
  | "log:entry"
  | "error:detected"
  | "healing:memory_created"
  | "siebel:sif_imported"
  | "siebel:composer_action"
  | "siebel:objects_indexed"
  | "siebel:sif_generated";

export interface GraphEvent {
  type: GraphEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface NodeCreatedEvent extends GraphEvent {
  type: "node:created";
  payload: { nodeId: string; title: string; nodeType: string };
}

export interface NodeUpdatedEvent extends GraphEvent {
  type: "node:updated";
  payload: { nodeId: string; fields: string[] };
}

export interface NodeDeletedEvent extends GraphEvent {
  type: "node:deleted";
  payload: { nodeId: string };
}

export interface EdgeCreatedEvent extends GraphEvent {
  type: "edge:created";
  payload: { edgeId: string; from: string; to: string; relationType: string };
}

export interface EdgeDeletedEvent extends GraphEvent {
  type: "edge:deleted";
  payload: { edgeId: string };
}

export interface ImportCompletedEvent extends GraphEvent {
  type: "import:completed";
  payload: { nodesCreated: number; edgesCreated: number };
}

export interface BulkUpdatedEvent extends GraphEvent {
  type: "bulk:updated";
  payload: { count: number; operation: string };
}

export interface KnowledgeIndexedEvent extends GraphEvent {
  type: "knowledge:indexed";
  payload: { source: string; documentsIndexed: number };
}

export interface KnowledgeDeletedEvent extends GraphEvent {
  type: "knowledge:deleted";
  payload: { source: string; documentsDeleted: number };
}

export interface PhaseTransitionedEvent extends GraphEvent {
  type: "phase:transitioned";
  payload: {
    fromPhase: string;
    toPhase: string;
    forced: boolean;
    nodesCount: number;
    doneTasksCount: number;
  };
}

export interface LogEntryEvent extends GraphEvent {
  type: "log:entry";
  payload: { id: number; level: string; message: string; context?: Record<string, unknown> };
}

export interface ErrorDetectedEvent extends GraphEvent {
  type: "error:detected";
  payload: { toolName: string; errorMessage: string; errorCategory: string; errorHash: string };
}

export interface HealingMemoryCreatedEvent extends GraphEvent {
  type: "healing:memory_created";
  payload: { memoryName: string; errorCategory: string; errorHash: string };
}

export interface SiebelSifImportedEvent extends GraphEvent {
  type: "siebel:sif_imported";
  payload: { fileName: string; objectCount: number; dependencyCount: number; nodesCreated: number };
}

export interface SiebelComposerActionEvent extends GraphEvent {
  type: "siebel:composer_action";
  payload: { action: string; envName: string; success: boolean; objectName?: string };
}

export interface SiebelObjectsIndexedEvent extends GraphEvent {
  type: "siebel:objects_indexed";
  payload: { source: string; documentsIndexed: number };
}

export interface SiebelSifGeneratedEvent extends GraphEvent {
  type: "siebel:sif_generated";
  payload: { objectCount: number; requestDescription: string; validationStatus: string };
}
