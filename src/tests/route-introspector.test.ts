import { describe, it, expect } from "vitest";
import path from "node:path";
import { introspectRoutes, type RouteInfo } from "../core/docs/route-introspector.js";

const API_DIR = path.resolve(__dirname, "../api");

describe("route-introspector", () => {
  let routes: RouteInfo[];

  it("should extract routers from router.ts", () => {
    routes = introspectRoutes(API_DIR);

    expect(routes.length).toBeGreaterThanOrEqual(19);
  });

  it("should include known routers", () => {
    routes = introspectRoutes(API_DIR);
    const paths = routes.map((r) => r.mountPath);

    expect(paths).toContain("/project");
    expect(paths).toContain("/nodes");
    expect(paths).toContain("/knowledge");
    expect(paths).toContain("/rag");
    expect(paths).toContain("/siebel");
  });

  it("should extract endpoints per router", () => {
    routes = introspectRoutes(API_DIR);
    const knowledgeRouter = routes.find((r) => r.mountPath === "/knowledge");

    expect(knowledgeRouter).toBeDefined();
    expect(knowledgeRouter!.endpoints.length).toBeGreaterThanOrEqual(4);
  });

  it("should detect HTTP methods", () => {
    routes = introspectRoutes(API_DIR);
    const nodesRouter = routes.find((r) => r.mountPath === "/nodes");

    expect(nodesRouter).toBeDefined();
    const methods = nodesRouter!.endpoints.map((e) => e.method);
    expect(methods).toContain("get");
  });

  it("should have routerName, mountPath, endpoints, sourceFile", () => {
    routes = introspectRoutes(API_DIR);

    for (const route of routes) {
      expect(route.routerName).toBeTruthy();
      expect(route.mountPath).toBeTruthy();
      expect(route.sourceFile).toBeTruthy();
      expect(Array.isArray(route.endpoints)).toBe(true);
    }
  });

  it("should count total endpoints across all routers", () => {
    routes = introspectRoutes(API_DIR);
    const totalEndpoints = routes.reduce((sum, r) => sum + r.endpoints.length, 0);

    expect(totalEndpoints).toBeGreaterThanOrEqual(50);
  });
});
