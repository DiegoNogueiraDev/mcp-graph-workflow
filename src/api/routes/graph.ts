import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import type { NodeStatus, NodeType } from "../../core/graph/graph-types.js";
import { graphToMermaid } from "../../core/graph/mermaid-export.js";

export function createGraphRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.get("/mermaid", (req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();

      const format = (req.query.format as string) ?? "flowchart";
      const direction = (req.query.direction as string) ?? "TD";
      const filterStatus = req.query.status
        ? (req.query.status as string).split(",") as NodeStatus[]
        : undefined;
      const filterType = req.query.type
        ? (req.query.type as string).split(",") as NodeType[]
        : undefined;

      const mermaid = graphToMermaid(doc.nodes, doc.edges, {
        format: format as "flowchart" | "mindmap",
        direction: direction as "TD" | "LR",
        filterStatus,
        filterType,
      });

      res.type("text/plain").send(mermaid);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
