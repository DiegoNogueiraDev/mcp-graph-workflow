# REST API Reference

> 25 routers, 128+ endpoints — all served from `mcp-graph serve`.

## Base URL

```
http://localhost:3000
```

> **Nota:** E2E tests usam porta 3377 via test-server. A porta padrão do servidor é 3000.

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
  "sourceType": "upload|memory|code_context|docs|web_capture",
  "sourceId": "string",
  "metadata": {}
}
```

**Response (201):** `{ ok: true, documents: [...], chunksCreated: number }`

### `GET /knowledge?sourceType=memory&limit=20&offset=0`

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

**Response:** `{ total: number, bySource: { upload: 5, memory: 12, ... } }`

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

Check integration status (Memories, Code Graph).

### `GET /integrations/memories`

List all project memories.

### `GET /integrations/memories/:name`

Get a specific memory.

> **Legacy:** `/integrations/serena/memories` and `/integrations/serena/memories/:name` are still supported for backward compatibility but deprecated.

### `GET /integrations/enriched-context/:symbol`

Get enriched context combining Memories + Code Graph + Knowledge.

### `GET /integrations/knowledge-status`

Get knowledge sync status by source.

**Response:** `{ total: number, sources: [{ source: "memory", documentCount: 12 }, ...] }`

---

## Folder

### `GET /folder`

Get current project folder path and recent folders list.

**Response:**
```json
{
  "currentPath": "/home/user/my-project",
  "recentFolders": ["/home/user/project-a", "/home/user/project-b"]
}
```

### `POST /folder/open`

Switch the active project folder at runtime (hot-swap the database).

**Body:** `{ "path": "/home/user/other-project" }`

**Response (200):**
```json
{
  "ok": true,
  "basePath": "/home/user/other-project",
  "recentFolders": ["..."]
}
```

**Error (400):**
```json
{
  "ok": false,
  "error": "Directory does not exist: /invalid/path"
}
```

> The previous store is safely closed only after the new one opens successfully. If opening fails, the original project remains active — no data is lost.

### `GET /folder/browse?path=/home/user`

Browse directories at a given path. Returns only directories (no files, no hidden dirs). Directories containing a graph database are flagged with `hasGraph: true` and sorted first.

**Query:** `path` (required)

**Response (200):**
```json
{
  "path": "/home/user",
  "parent": "/home",
  "entries": [
    { "name": "my-project", "path": "/home/user/my-project", "isDirectory": true, "hasGraph": true },
    { "name": "other-dir", "path": "/home/user/other-dir", "isDirectory": true, "hasGraph": false }
  ]
}
```

**Error (400):** Directory does not exist or is not readable.

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

---

## Journey Maps

Website journey mapping — screen flows, form fields, CTAs, A/B variants.

### Maps

| Method | Path | Description |
|--------|------|-------------|
| GET | `/journey/maps` | List all journey maps |
| POST | `/journey/maps` | Create a journey map (`{ name, url?, description? }`) |
| GET | `/journey/maps/:id` | Get map with screens, edges, variants |
| DELETE | `/journey/maps/:id` | Delete map (cascades to screens/edges/variants) |
| POST | `/journey/maps/import` | Bulk import from JSON (`{ journey, screens[], edges[], variants? }`) |

### Screens

| Method | Path | Description |
|--------|------|-------------|
| POST | `/journey/maps/:id/screens` | Add screen (`{ title, screenType, url?, fields?, ctas?, metadata? }`) |
| PATCH | `/journey/screens/:id` | Update screen (`{ title?, positionX?, positionY? }`) |
| DELETE | `/journey/screens/:id` | Delete screen |

### Edges

| Method | Path | Description |
|--------|------|-------------|
| POST | `/journey/maps/:id/edges` | Add edge (`{ from, to, label?, type? }`) |
| DELETE | `/journey/edges/:id` | Delete edge |

### Screenshots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/journey/screenshots` | List available screenshot files |
| GET | `/journey/screenshots/:mapId/:filename` | Serve a screenshot image |

---

## Docs Reference (`/docs-reference`)

Live introspection of MCP tools, API routes, and project documentation.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/docs-reference` | List available markdown docs |
| GET | `/docs-reference/tools` | Introspected MCP tool catalog |
| GET | `/docs-reference/routes` | Introspected API route catalog |
| GET | `/docs-reference/stats` | Aggregated counts (tools, routes, docs) |
| GET | `/docs-reference/:category/:slug` | Read a specific markdown doc |

### Examples

**GET /docs-reference/stats**

```json
{
  "tools": { "active": 45, "deprecated": 6 },
  "routes": { "routers": 25, "endpoints": 128 },
  "docs": 26
}
```

**GET /docs-reference/tools** (truncated)

```json
{
  "total": 51,
  "active": 45,
  "deprecated": 6,
  "tools": [
    {
      "name": "init",
      "description": "Initialize a new project graph...",
      "category": "Core",
      "deprecated": false,
      "sourceFile": "init.ts"
    },
    {
      "name": "siebel_analyze",
      "description": "Analyze Siebel objects...",
      "category": "Siebel CRM",
      "deprecated": false,
      "sourceFile": "siebel-analyze.ts"
    }
  ]
}
```

**GET /docs-reference/routes** (truncated)

```json
{
  "totalRouters": 25,
  "totalEndpoints": 128,
  "routes": [
    {
      "routerName": "nodes",
      "mountPath": "/nodes",
      "endpoints": [
        { "method": "get", "path": "/" },
        { "method": "post", "path": "/" },
        { "method": "get", "path": "/:id" },
        { "method": "patch", "path": "/:id" },
        { "method": "delete", "path": "/:id" }
      ],
      "sourceFile": "nodes.ts"
    }
  ]
}
```

**GET /docs-reference/guides/GETTING-STARTED**

```json
{
  "slug": "guides/GETTING-STARTED",
  "content": "# Getting Started\n\n## Quick Start\n..."
}
```

---

## Knowledge Export/Import (`/knowledge`)

Package and share RAG knowledge between project instances.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/knowledge/export` | Export knowledge package (JSON) |
| POST | `/knowledge/import` | Import knowledge package |
| POST | `/knowledge/preview` | Preview import diff before confirming |
| POST | `/knowledge/:id/feedback` | Rate a document (helpful/unhelpful/outdated) |

### Examples

**POST /knowledge/export**

Request:
```json
{
  "sources": ["memory", "docs"],
  "minQuality": 0.5,
  "includeMemories": true
}
```

Response:
```json
{
  "ok": true,
  "package": { "version": "1.0.0", "documents": [...], "memories": [...] },
  "stats": {
    "documents": 459,
    "memories": 18,
    "relations": 0,
    "translationEntries": 0
  }
}
```

**POST /knowledge/preview**

Request:
```json
{
  "package": { "version": "1.0.0", "documents": [...], "memories": [...] }
}
```

Response:
```json
{
  "ok": true,
  "preview": {
    "newDocuments": 12,
    "existingDocuments": 447,
    "newMemories": 3,
    "existingMemories": 15,
    "sourceTypes": ["memory", "docs", "sprint_plan"]
  }
}
```

**POST /knowledge/import**

Request: same as preview. Response:
```json
{
  "ok": true,
  "result": {
    "documentsImported": 12,
    "documentsSkipped": 447,
    "memoriesImported": 3,
    "memoriesSkipped": 15,
    "relationsImported": 0,
    "translationEntriesImported": 0
  }
}
```

**POST /knowledge/:id/feedback**

Request:
```json
{
  "action": "helpful",
  "query": "how to configure lifecycle phases",
  "context": "This doc answered my question about set_phase"
}
```

Response:
```json
{
  "ok": true,
  "docId": "kdoc_abc123",
  "action": "helpful"
}
