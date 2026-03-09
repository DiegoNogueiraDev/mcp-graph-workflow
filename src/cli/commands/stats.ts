import { Command } from "commander";
import { SqliteStore } from "../../core/store/sqlite-store.js";

export function statsCommand(): Command {
  return new Command("stats")
    .description("Show graph statistics")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--json", "Output as JSON")
    .action((opts: { dir: string; json: boolean }) => {
      const store = SqliteStore.open(opts.dir);

      try {
        const stats = store.getStats();
        const project = store.getProject();

        if (opts.json) {
          console.log(JSON.stringify({ project: project?.name, ...stats }, null, 2));
        } else {
          console.log(`Project: ${project?.name ?? "(not initialized)"}`);
          console.log(`Total nodes: ${stats.totalNodes}`);
          console.log(`By type:`);
          for (const [type, count] of Object.entries(stats.byType ?? {})) {
            console.log(`  ${type}: ${count}`);
          }
          console.log(`By status:`);
          for (const [status, count] of Object.entries(stats.byStatus ?? {})) {
            console.log(`  ${status}: ${count}`);
          }
          console.log(`Total edges: ${stats.totalEdges}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
