import { Router } from "express";
import { z } from "zod/v4";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { NodeType, NodeStatus } from "../../core/graph/graph-types.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { NodeTypeSchema, NodeStatusSchema, GraphNodeSchema } from "../../schemas/node.schema.js";
import { validateBody } from "../middleware/validate.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

const CreateNodeBodySchema = GraphNodeSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  id: z.string().optional(),
});

const UpdateNodeBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  type: NodeTypeSchema.optional(),
  status: NodeStatusSchema.optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  xpSize: z.enum(["XS", "S", "M", "L", "XL"]).nullable().optional(),
  estimateMinutes: z.number().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  parentId: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  blocked: z.boolean().optional(),
  acceptanceCriteria: z.array(z.string()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export function createNodesRouter(store: SqliteStore): Router {
  const router = Router();

  router.get("/", (req, res, next) => {
    try {
      const { type, status } = req.query;

      if (type) {
        const parsed = NodeTypeSchema.safeParse(type);
        if (!parsed.success) {
          res.status(400).json({ error: `Invalid type: ${type as string}` });
          return;
        }
        res.json(store.getNodesByType(parsed.data as NodeType));
        return;
      }

      if (status) {
        const parsed = NodeStatusSchema.safeParse(status);
        if (!parsed.success) {
          res.status(400).json({ error: `Invalid status: ${status as string}` });
          return;
        }
        res.json(store.getNodesByStatus(parsed.data as NodeStatus));
        return;
      }

      res.json(store.getAllNodes());
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", (req, res, next) => {
    try {
      const id = req.params.id as string;
      const node = store.getNodeById(id);
      if (!node) {
        throw new NodeNotFoundError(id);
      }
      res.json(node);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/",
    validateBody(CreateNodeBodySchema),
    (req, res, next) => {
      try {
        const timestamp = now();
        const node = {
          ...req.body,
          id: req.body.id ?? generateId("node"),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        store.insertNode(node);
        res.status(201).json(node);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch("/:id", validateBody(UpdateNodeBodySchema), (req, res, next) => {
    try {
      const id = req.params.id as string;
      const { status, ...fields } = req.body;

      let updated = store.updateNode(id, fields);

      if (status !== undefined) {
        updated = store.updateNodeStatus(id, status);
      }

      if (!updated && Object.keys(req.body).length > 0) {
        throw new NodeNotFoundError(id);
      }

      if (!updated) {
        const existing = store.getNodeById(id);
        if (!existing) throw new NodeNotFoundError(id);
        res.json(existing);
        return;
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", (req, res, next) => {
    try {
      const id = req.params.id as string;
      const deleted = store.deleteNode(id);
      if (!deleted) {
        throw new NodeNotFoundError(id);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
