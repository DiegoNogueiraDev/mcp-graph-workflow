# REST API Reference

> 17 routers, 44 endpoints — all served from `mcp-graph serve`.

## Base URL

```
http://localhost:3377
```

Start the server:

```bash
mcp-graph serve          # or: npm run dev -- serve
```

---

## Project

### `GET /project`

Get current project info.

**Response:** Project object or `404` if not initialized.

### `POST /project/init`

Initialize a new project.

**Body:** `{ "name"?: string }`

**Response (201):** Project object.

---

## Nodes

### `GET /nodes`

List all nodes with optional filters.

**Query:** `type?` (NodeType), `status?` (NodeStatus)

**Response:** `GraphNode[]`

### `GET /nodes/:id`

Get a specific node.

**Response:** `GraphNode` or `404`

### `POST /nodes`

Create a new node.

**Body:**
```json
{
  "title": "string (required)",
  "type": "NodeType (required)",
  "description": "string",
  "status": "NodeStatus",
  "priority": "1-5",
  "xpSize": "XS|S|M|L|XL",
  "estimateMinutes": "number",
  "tags": ["string"],
  "parentId": "string|null",
  "sprint": "string|null",
  "blocked": "boolean",
  "acceptanceCriteria": ["string"],
  "metadata": {}
}
```

**Response (201):** Created node.

### `PATCH /nodes/:id`

Update a node (all fields optional).

**Response:** Updated node or `404`.

### `DELETE /nodes/:id`

Delete a node and its edges.

**Response:** `204` or `404`.

---

## Edges

### `GET /edges`

List all edges.

**Response:** `GraphEdge[]`

### `POST /edges`

Create an edge.

**Body:**
```json
{
  "from": "string (required)",
  "to": "string (required)",
  "relationType": "RelationType (required)",
  "reason": "string",
  "weight": "number"
}
```

**Response (201):** Created edge.

### `DELETE /edges/:id`

Delete an edge.

**Response:** `204` or `404`.

---

## Stats

### `GET /stats`

Get graph statistics (node/edge counts, status distribution, sprint metrics).

**Response:** Stats object.

---

## Search

### `GET /search?q=query&limit=20`

Full-text search across nodes.

**Query:** `q` (required), `limit?` (default 20)

**Response:** Matching `GraphNode[]`

---

## Graph

### `GET /graph`

Export full graph as JSON document (all nodes + edges).

**Response:** `{ nodes: GraphNode[], edges: GraphEdge[] }`

### `GET /graph/mermaid?format=flowchart&direction=TD`

Export graph as Mermaid diagram.

**Query:** `format?` (flowchart|mindmap), `direction?` (TD|LR), `status?` (comma-separated), `type?` (comma-separated)

**Response:** Plain text Mermaid code.

---

## Import

### `POST /import`

Import a PRD file via multipart upload.

**Content-Type:** `multipart/form-data`

**Fields:** `file` (required — .md, .txt, .pdf, .html), `force?` ("true" to re-import)

**Response (201):**
```json
{
  "ok": true,
  "sourceFile": "string",
  "nodesCreated": 5,
  "edgesCreated": 3,
  "reimported": false
}
```

**Error (409):** File already imported (use `force=true`).

---

## Knowledge

### `POST /knowledge`

Upload a knowledge document.

**Body:**
```json
{
  "title": "string (required)",
  "content": "string (required)",
  "sourceType": "upload|serena|code_context|docs|web_capture",
  "sourceId": "string",
  "metadata": {}
}
```

**Response (201):** `{ ok: true, documents: [...], chunksCreated: number }`

### `GET /knowledge?sourceType=serena&limit=20&offset=0`

List knowledge documents with optional filters.

**Response:** `{ documents: [...], total: number }`

### `POST /knowledge/search`

Full-text search knowledge.

**Body:** `{ "query": "string", "limit"?: 20 }`

**Response:** `{ query, results: [...], total: number }`

### `GET /knowledge/:id`

Get a specific knowledge document.

**Response:** Document or `404`.

### `DELETE /knowledge/:id`

Delete a knowledge document.

**Response:** `{ ok: true }` or `404`.

### `GET /knowledge/stats/summary`

Get knowledge store statistics.

**Response:** `{ total: number, bySource: { upload: 5, serena: 12, ... } }`

---

## RAG

### `POST /rag/query`

Semantic search via embeddings.

**Body:** `{ "query": "string", "limit"?: 10 }`

**Response:**
```json
{
  "query": "string",
  "results": [{ "id": "...", "text": "...", "similarity": 0.85, "source": "..." }],
  "totalIndexed": 150
}
```

### `POST /rag/reindex`

Rebuild embeddings index.

**Response:** `{ ok: true, indexed: 150, nodes: 50, knowledge: 100 }`

### `GET /rag/stats`

Get embedding statistics.

**Response:** `{ totalEmbeddings: 150, indexed: true }`

---

## Integrations

### `GET /integrations/status`

Check integration status (Serena, GitNexus).

### `GET /integrations/serena/memories`

List all Serena memories.

### `GET /integrations/serena/memories/:name`

Get a specific Serena memory.

### `GET /integrations/gitnexus/url`

Get GitNexus URL (or `503` if not running).

### `GET /integrations/enriched-context/:symbol`

Get enriched context combining Serena + GitNexus + Knowledge.

### `GET /integrations/knowledge-status`

Get knowledge sync status by source.

**Response:** `{ total: number, sources: [{ source: "serena", documentCount: 12 }, ...] }`

---

## GitNexus

### `GET /gitnexus/status`

Check GitNexus status.

**Response:** `{ indexed: boolean, running: boolean, port: number, url?: string }`

### `POST /gitnexus/query`

Query GitNexus code graph.

**Body:** `{ "query": "string" }`

### `POST /gitnexus/context`

Get symbol context from GitNexus.

**Body:** `{ "symbol": "string" }`

### `POST /gitnexus/impact`

Get impact analysis for a symbol.

**Body:** `{ "symbol": "string" }`

---

## Context

### `GET /context/preview?nodeId=abc123`

Build compact task context preview.

**Query:** `nodeId` (required)

**Response:** Compact context object with token metrics.

---

## Capture

### `POST /capture`

Capture web page content via Playwright.

**Body:**
```json
{
  "url": "string (required)",
  "selector": "string",
  "timeout": "number (1-60000ms)",
  "waitForSelector": "string"
}
```

---

## Insights

### `GET /insights/bottlenecks`

Detect workflow bottlenecks.

### `GET /insights/recommendations`

Get skill recommendations.

### `GET /insights/metrics`

Calculate workflow metrics (velocity, cycle time, completion rate).

---

## Docs Cache

### `GET /docs?lib=react`

List cached documentation (optionally filter by library).

### `GET /docs/:libId`

Get specific cached doc.

### `POST /docs/sync`

Sync docs for a library.

**Body:** `{ "lib": "string" }`

---

## Skills

### `GET /skills`

Scan and list available skills.

---

## Events (SSE)

### `GET /events`

Server-Sent Events stream for real-time updates.

**Content-Type:** `text/event-stream`

**Event format:** `event: {type}\ndata: {json}\n\n`

Event types: `node:created`, `node:updated`, `node:deleted`, `edge:created`, `edge:deleted`, `import:completed`, `knowledge:indexed`, `docs:synced`, `capture:completed`

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

Common status codes: `400` (validation), `404` (not found), `409` (conflict), `503` (integration unavailable).
