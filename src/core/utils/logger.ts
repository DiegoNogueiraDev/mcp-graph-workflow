function formatCtx(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  return (
    " " +
    Object.entries(ctx)
      .map(([k, v]) => `${k}="${String(v)}"`)
      .join(" ")
  );
}

export const logger = {
  info(msg: string, ctx?: Record<string, unknown>): void {
    console.error(`[INFO] ${msg}${formatCtx(ctx)}`);
  },
  warn(msg: string, ctx?: Record<string, unknown>): void {
    console.error(`[WARN] ${msg}${formatCtx(ctx)}`);
  },
  error(msg: string, ctx?: Record<string, unknown>): void {
    console.error(`[ERROR] ${msg}${formatCtx(ctx)}`);
  },
  success(msg: string, ctx?: Record<string, unknown>): void {
    console.error(`[OK] ${msg}${formatCtx(ctx)}`);
  },
  debug(msg: string, ctx?: Record<string, unknown>): void {
    if (process.env.MCP_GRAPH_DEBUG) {
      console.error(`[DEBUG] ${msg}${formatCtx(ctx)}`);
    }
  },
};
