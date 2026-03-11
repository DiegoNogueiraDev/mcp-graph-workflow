import { Command } from "commander";
import path from "node:path";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { logger } from "../../core/utils/logger.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

export function importCommand(): Command {
  return new Command("import")
    .description("Import a PRD file into the graph")
    .argument("<file>", "Path to PRD file (.md, .txt, .pdf, .html)")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .action(async (file: string, opts: { dir: string }) => {
      const filePath = path.resolve(file);
      const store = SqliteStore.open(opts.dir);

      if (!store.getProject()) {
        store.initProject(path.basename(opts.dir));
        logger.info("Project initialized", { name: path.basename(opts.dir) });
      }

      try {
        const result = await readFileContent(filePath);
        const entities = extractEntities(result.text);
        const graph = convertToGraph(entities, filePath);

        store.bulkInsert(graph.nodes, graph.edges);
        store.createSnapshot();

        output(`Imported: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
        output(`Source: ${filePath}`);
      } catch (err) {
        logger.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
