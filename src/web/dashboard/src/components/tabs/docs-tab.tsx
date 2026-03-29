import { useState, useMemo, useCallback } from "react";
import { useDocs } from "@/hooks/use-docs";

type DocsSection = "overview" | "tools" | "routes" | "guides" | "guide-content";

const CATEGORY_COLORS: Record<string, string> = {
  Core: "bg-blue-500/20 text-blue-400",
  "Siebel CRM": "bg-purple-500/20 text-purple-400",
  Translation: "bg-green-500/20 text-green-400",
  Knowledge: "bg-yellow-500/20 text-yellow-400",
  "Code Intelligence": "bg-cyan-500/20 text-cyan-400",
  Deprecated: "bg-red-500/20 text-red-400",
};

const METHOD_COLORS: Record<string, string> = {
  get: "bg-green-600/30 text-green-300",
  post: "bg-blue-600/30 text-blue-300",
  patch: "bg-yellow-600/30 text-yellow-300",
  put: "bg-orange-600/30 text-orange-300",
  delete: "bg-red-600/30 text-red-300",
};

export function DocsTab(): React.JSX.Element {
  const { tools, routes, docs, stats, loading, error, fetchDocContent } = useDocs();
  const [section, setSection] = useState<DocsSection>("overview");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [guideContent, setGuideContent] = useState<string>("");
  const [guideTitle, setGuideTitle] = useState<string>("");
  const [guideLoading, setGuideLoading] = useState(false);

  // Tool categories
  const categories = useMemo(() => {
    const cats = new Set(tools.map((t) => t.category));
    return ["all", ...Array.from(cats).sort()];
  }, [tools]);

  // Filtered tools
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tools, categoryFilter, search]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      if (search && !r.mountPath.toLowerCase().includes(search.toLowerCase()) && !r.routerName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [routes, search]);

  // Guide categories
  const guideCategories = useMemo(() => {
    const cats = new Map<string, typeof docs>();
    for (const doc of docs) {
      const list = cats.get(doc.category) ?? [];
      list.push(doc);
      cats.set(doc.category, list);
    }
    return cats;
  }, [docs]);

  const handleGuideClick = useCallback(async (category: string, slug: string, title: string) => {
    setGuideLoading(true);
    setGuideTitle(title);
    setSection("guide-content");
    try {
      const parts = slug.split("/");
      const content = await fetchDocContent(parts[0], parts[1]);
      setGuideContent(content);
    } catch {
      setGuideContent("Failed to load document.");
    } finally {
      setGuideLoading(false);
    }
  }, [fetchDocContent]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-400">Loading docs...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-400">Error: {error}</div>;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar Nav */}
      <nav className="w-56 shrink-0 border-r border-zinc-700 p-3 space-y-1 overflow-y-auto">
        <NavItem label="Overview" active={section === "overview"} onClick={() => setSection("overview")} count={null} />
        <NavItem label="MCP Tools" active={section === "tools"} onClick={() => setSection("tools")} count={stats?.tools.active ?? 0} />
        <NavItem label="API Routes" active={section === "routes"} onClick={() => setSection("routes")} count={stats?.routes.endpoints ?? 0} />
        <NavItem label="Guides" active={section === "guides" || section === "guide-content"} onClick={() => setSection("guides")} count={docs.length} />
      </nav>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Search bar (tools & routes) */}
        {(section === "tools" || section === "routes") && (
          <div className="mb-4">
            <input
              type="text"
              placeholder={`Search ${section}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {section === "overview" && <OverviewSection stats={stats} toolCount={tools.length} routeCount={routes.length} docCount={docs.length} />}
        {section === "tools" && <ToolsSection tools={filteredTools} categories={categories} categoryFilter={categoryFilter} onCategoryChange={setCategoryFilter} />}
        {section === "routes" && <RoutesSection routes={filteredRoutes} />}
        {section === "guides" && <GuidesSection categories={guideCategories} onGuideClick={handleGuideClick} />}
        {section === "guide-content" && <GuideContentSection title={guideTitle} content={guideContent} loading={guideLoading} onBack={() => setSection("guides")} />}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function NavItem({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number | null }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-blue-600/20 text-blue-400 font-medium" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
    >
      {label}
      {count !== null && <span className="ml-2 text-xs text-zinc-500">({count})</span>}
    </button>
  );
}

function OverviewSection({ stats, toolCount, routeCount, docCount }: { stats: { tools: { active: number; deprecated: number }; routes: { routers: number; endpoints: number }; docs: number } | null; toolCount: number; routeCount: number; docCount: number }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-100">mcp-graph Documentation</h2>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="MCP Tools" value={stats?.tools.active ?? toolCount} sub={`+ ${stats?.tools.deprecated ?? 0} deprecated`} />
        <StatCard label="API Endpoints" value={stats?.routes.endpoints ?? 0} sub={`${stats?.routes.routers ?? routeCount} routers`} />
        <StatCard label="Guides" value={stats?.docs ?? docCount} sub="markdown docs" />
      </div>
      <p className="text-zinc-400 text-sm">
        Use the sidebar to browse MCP tools, API routes, and project guides. All data is introspected live from the source code.
      </p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      <div className="text-sm font-medium text-zinc-300">{label}</div>
      <div className="text-xs text-zinc-500 mt-1">{sub}</div>
    </div>
  );
}

function ToolsSection({ tools, categories, categoryFilter, onCategoryChange }: { tools: Array<{ name: string; description: string; category: string; deprecated: boolean }>; categories: string[]; categoryFilter: string; onCategoryChange: (c: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${categoryFilter === cat ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
          >
            {cat === "all" ? "All" : cat}
          </button>
        ))}
      </div>
      <div className="text-xs text-zinc-500 mb-2">{tools.length} tools</div>
      <div className="space-y-1">
        {tools.map((tool) => (
          <div key={tool.name} className={`flex items-start gap-3 p-3 rounded-md ${tool.deprecated ? "opacity-50" : "hover:bg-zinc-800/50"}`}>
            <code className="text-sm font-mono text-blue-400 shrink-0 w-40">{tool.name}</code>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[tool.category] ?? "bg-zinc-700 text-zinc-300"}`}>{tool.category}</span>
            <span className="text-sm text-zinc-400 flex-1">{tool.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutesSection({ routes }: { routes: Array<{ routerName: string; mountPath: string; endpoints: Array<{ method: string; path: string }> }> }) {
  const totalEndpoints = routes.reduce((sum, r) => sum + r.endpoints.length, 0);

  return (
    <div className="space-y-4">
      <div className="text-xs text-zinc-500">{routes.length} routers, {totalEndpoints} endpoints</div>
      {routes.map((route) => (
        <div key={route.mountPath} className="border border-zinc-700 rounded-lg overflow-hidden">
          <div className="bg-zinc-800 px-4 py-2 flex items-center justify-between">
            <code className="text-sm font-mono text-green-400">{route.mountPath}</code>
            <span className="text-xs text-zinc-500">{route.endpoints.length} endpoints</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {route.endpoints.map((ep, i) => (
              <div key={`${ep.method}-${ep.path}-${i}`} className="px-4 py-2 flex items-center gap-3">
                <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${METHOD_COLORS[ep.method] ?? "bg-zinc-700 text-zinc-300"}`}>{ep.method}</span>
                <code className="text-sm text-zinc-300">{route.mountPath}{ep.path}</code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GuidesSection({ categories, onGuideClick }: { categories: Map<string, Array<{ slug: string; title: string; category: string }>>; onGuideClick: (category: string, slug: string, title: string) => void }) {
  return (
    <div className="space-y-6">
      {Array.from(categories).map(([category, guides]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2">{category}</h3>
          <div className="space-y-1">
            {guides.map((guide) => (
              <button
                key={guide.slug}
                onClick={() => onGuideClick(guide.category, guide.slug, guide.title)}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                {guide.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GuideContentSection({ title, content, loading, onBack }: { title: string; content: string; loading: boolean; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">
        &larr; Back to Guides
      </button>
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : (
        <pre className="whitespace-pre-wrap text-sm text-zinc-300 bg-zinc-900 rounded-lg p-4 border border-zinc-700 overflow-auto max-h-[70vh]">{content}</pre>
      )}
    </div>
  );
}
