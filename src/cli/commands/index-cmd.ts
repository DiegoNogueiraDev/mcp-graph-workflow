import { Command } from "commander";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexSerenaMemories } from "../../core/rag/serena-indexer.js";
import { indexCachedDocs } from "../../core/rag/docs-indexer.js";
import { indexAllEmbeddings } from "../../core/rag/rag-pipeline.js";

export function indexCommand(): Command {
  return new Command("index")
    .description("Reindex all knowledge sources (Serena, docs cache) and rebuild embeddings")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (opts: { dir: string; json: boolean }) => {
      const store = SqliteStore.open(opts.dir);

      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        const docsCacheStore = new DocsCacheStore(store.getDb());
        const embeddingStore = new EmbeddingStore(store);

        const serenaResult = await indexSerenaMemories(knowledgeStore, opts.dir);
        const docsResult = indexCachedDocs(knowledgeStore, docsCacheStore);

        embeddingStore.clear();
        const embeddingResult = await indexAllEmbeddings(store, embeddingStore);

        const totalKnowledge = knowledgeStore.count();

        if (opts.json) {
          console.log(JSON.stringify({
            serena: serenaResult,
            docs: docsResult,
            embeddings: embeddingResult,
            totalKnowledge,
          }, null, 2));
        } else {
          console.log("Knowledge indexing complete:");
          console.log(`  Serena memories: ${serenaResult.memoriesFound} found, ${serenaResult.documentsIndexed} indexed`);
          console.log(`  Docs cache: ${docsResult.docsFound} found, ${docsResult.documentsIndexed} indexed`);
          console.log(`  Embeddings: ${embeddingResult.nodes} nodes + ${embeddingResult.knowledge} knowledge`);
          console.log(`  Total knowledge documents: ${totalKnowledge}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
