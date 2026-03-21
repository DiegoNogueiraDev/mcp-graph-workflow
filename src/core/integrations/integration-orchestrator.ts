/**
 * Integration Orchestrator — registers event handlers on GraphEventBus
 * to create a reactive mesh between integrations.
 *
 * Handlers:
 * - import:completed → full reindex knowledge + embeddings
 * - knowledge:indexed → invalidate RAG cache
 * - node:created → detect stack for docs fetch
 */

import type { GraphEventBus } from "../events/event-bus.js";
import type { GraphEvent } from "../events/event-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { DocsCacheStore } from "../docs/docs-cache-store.js";
import { EmbeddingStore } from "../rag/embedding-store.js";
import { indexCachedDocs } from "../rag/docs-indexer.js";
import { indexAllEmbeddings } from "../rag/rag-pipeline.js";
import { logger } from "../utils/logger.js";

export interface OrchestratorOptions {
  /** Project base path */
  basePath?: string;
  /** Enable auto-reindex on import (default: true) */
  autoReindex?: boolean;
}

export interface IntegrationStatus {
  source: string;
  lastSync: string | null;
  documentCount: number;
  status: "idle" | "syncing" | "error";
  error?: string;
}

export class IntegrationOrchestrator {
  private store: SqliteStore;
  private eventBus: GraphEventBus;
  private basePath: string;
  private autoReindex: boolean;
  private statuses = new Map<string, IntegrationStatus>();

  constructor(
    store: SqliteStore,
    eventBus: GraphEventBus,
    options?: OrchestratorOptions,
  ) {
    this.store = store;
    this.eventBus = eventBus;
    this.basePath = options?.basePath ?? process.cwd();
    this.autoReindex = options?.autoReindex ?? true;

    this.initStatuses();
  }

  /**
   * Register all event handlers on the bus.
   */
  register(): void {
    if (this.autoReindex) {
      this.eventBus.on("import:completed", (event) => {
        void this.onImportCompleted(event);
      });
    }

    this.eventBus.on("knowledge:indexed", (event) => {
      this.onKnowledgeIndexed(event);
    });

    // Siebel integration events
    this.eventBus.on("siebel:sif_imported", (event) => {
      this.onSiebelSifImported(event);
    });

    this.eventBus.on("siebel:objects_indexed", (event) => {
      this.onSiebelObjectsIndexed(event);
    });

    logger.info("IntegrationOrchestrator registered", { autoReindex: this.autoReindex });
  }

  /**
   * Get status of all integrations.
   */
  getStatuses(): IntegrationStatus[] {
    // Refresh document counts
    const knowledgeStore = new KnowledgeStore(this.store.getDb());
    const sourceTypes = ["upload", "memory", "serena", "code_context", "docs", "web_capture", "siebel_sif", "siebel_composer"] as const;

    for (const st of sourceTypes) {
      const existing = this.statuses.get(st);
      if (existing) {
        existing.documentCount = knowledgeStore.count(st);
      }
    }

    return Array.from(this.statuses.values());
  }

  /**
   * Handle import:completed — reindex all knowledge + rebuild embeddings.
   */
  private async onImportCompleted(event: GraphEvent): Promise<void> {
    logger.info("Orchestrator: import completed, reindexing", event.payload);

    this.updateStatus("docs", "syncing");

    try {
      const knowledgeStore = new KnowledgeStore(this.store.getDb());
      const docsCacheStore = new DocsCacheStore(this.store.getDb());

      // Re-index docs cache
      const docsResult = indexCachedDocs(knowledgeStore, docsCacheStore);

      // Rebuild embeddings
      const embeddingStore = new EmbeddingStore(this.store);
      embeddingStore.clear();
      const embResult = await indexAllEmbeddings(this.store, embeddingStore);

      this.updateStatus("docs", "idle");

      this.eventBus.emitTyped("knowledge:indexed", {
        source: "import_reindex",
        documentsIndexed: docsResult.documentsIndexed + embResult.nodes + embResult.knowledge,
      });

      logger.info("Orchestrator: reindex complete", {
        docsIndexed: docsResult.documentsIndexed,
        embeddingNodes: embResult.nodes,
        embeddingKnowledge: embResult.knowledge,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateStatus("docs", "error", message);
      logger.error("Orchestrator: reindex failed", { error: message });
    }
  }

  /**
   * Handle knowledge:indexed — log and track.
   */
  private onKnowledgeIndexed(event: GraphEvent): void {
    const source = String(event.payload.source ?? "unknown");
    logger.info("Orchestrator: knowledge indexed", { source, count: event.payload.documentsIndexed });
  }

  /**
   * Handle siebel:sif_imported — track Siebel SIF imports.
   */
  private onSiebelSifImported(event: GraphEvent): void {
    const { fileName, objectCount } = event.payload;
    logger.info("Orchestrator: Siebel SIF imported", { fileName, objectCount });
    this.updateStatus("siebel_sif", "idle");
  }

  /**
   * Handle siebel:objects_indexed — track Siebel knowledge indexing.
   */
  private onSiebelObjectsIndexed(event: GraphEvent): void {
    const { source, documentsIndexed } = event.payload;
    logger.info("Orchestrator: Siebel objects indexed", { source, documentsIndexed });
    this.updateStatus("siebel_sif", "idle");
  }

  private initStatuses(): void {
    const sourceTypes = ["upload", "memory", "serena", "code_context", "docs", "web_capture", "siebel_sif", "siebel_composer"] as const;
    const knowledgeStore = new KnowledgeStore(this.store.getDb());

    for (const st of sourceTypes) {
      this.statuses.set(st, {
        source: st,
        lastSync: null,
        documentCount: knowledgeStore.count(st),
        status: "idle",
      });
    }
  }

  private updateStatus(source: string, status: IntegrationStatus["status"], error?: string): void {
    const existing = this.statuses.get(source);
    if (existing) {
      existing.status = status;
      existing.lastSync = status === "idle" ? new Date().toISOString() : existing.lastSync;
      existing.error = error;
    }
  }
}
