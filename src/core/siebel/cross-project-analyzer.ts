/**
 * Cross-Project Dependency Analyzer — identifies dependencies between different Siebel projects.
 */

import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

export interface CrossProjectDep {
  fromProject: string;
  toProject: string;
  fromObject: string;
  fromType: string;
  toObject: string;
  toType: string;
  relationType: string;
}

export interface ProjectSummary {
  project: string;
  objectCount: number;
  inboundCrossRefs: number;
  outboundCrossRefs: number;
}

export interface CrossProjectResult {
  crossProjectDeps: CrossProjectDep[];
  projectSummary: ProjectSummary[];
  mermaidDiagram: string;
  deployRisks: string[];
}

/**
 * Analyze dependencies that cross project boundaries.
 */
export function analyzeCrossProjectDeps(
  objects: SiebelObject[],
  dependencies: SiebelDependency[],
): CrossProjectResult {
  // Build object→project index
  const objectProject = new Map<string, string>();
  for (const obj of objects) {
    if (obj.project) {
      objectProject.set(`${obj.type}:${obj.name}`, obj.project);
    }
  }

  // Find cross-project dependencies
  const crossDeps: CrossProjectDep[] = [];
  for (const dep of dependencies) {
    const fromKey = `${dep.from.type}:${dep.from.name}`;
    const toKey = `${dep.to.type}:${dep.to.name}`;
    const fromProject = objectProject.get(fromKey);
    const toProject = objectProject.get(toKey);

    if (fromProject && toProject && fromProject !== toProject) {
      crossDeps.push({
        fromProject,
        toProject,
        fromObject: dep.from.name,
        fromType: dep.from.type,
        toObject: dep.to.name,
        toType: dep.to.type,
        relationType: dep.relationType,
      });
    }
  }

  // Build project summary
  const projectObjects = new Map<string, number>();
  for (const obj of objects) {
    if (obj.project && !obj.parentName) {
      projectObjects.set(obj.project, (projectObjects.get(obj.project) ?? 0) + 1);
    }
  }

  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (const dep of crossDeps) {
    outbound.set(dep.fromProject, (outbound.get(dep.fromProject) ?? 0) + 1);
    inbound.set(dep.toProject, (inbound.get(dep.toProject) ?? 0) + 1);
  }

  const projectSummary: ProjectSummary[] = Array.from(projectObjects.entries()).map(([project, count]) => ({
    project,
    objectCount: count,
    inboundCrossRefs: inbound.get(project) ?? 0,
    outboundCrossRefs: outbound.get(project) ?? 0,
  }));

  // Generate Mermaid diagram
  const mermaidDiagram = generateMermaid(crossDeps, projectSummary);

  // Generate deploy risks
  const deployRisks = generateDeployRisks(crossDeps);

  return { crossProjectDeps: crossDeps, projectSummary, mermaidDiagram, deployRisks };
}

function generateMermaid(deps: CrossProjectDep[], summary: ProjectSummary[]): string {
  const lines: string[] = ["graph LR"];

  const projects = new Set<string>();
  for (const dep of deps) {
    projects.add(dep.fromProject);
    projects.add(dep.toProject);
  }
  for (const s of summary) {
    projects.add(s.project);
  }

  // Node definitions
  for (const p of projects) {
    const s = summary.find((x) => x.project === p);
    const label = s ? `${p} (${s.objectCount} objects)` : p;
    const safeId = p.replace(/\s+/g, "_");
    lines.push(`  ${safeId}["${label}"]`);
  }

  // Edge definitions (deduplicated by project pair)
  const edgeSet = new Set<string>();
  for (const dep of deps) {
    const key = `${dep.fromProject}→${dep.toProject}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      const fromId = dep.fromProject.replace(/\s+/g, "_");
      const toId = dep.toProject.replace(/\s+/g, "_");
      const count = deps.filter((d) => d.fromProject === dep.fromProject && d.toProject === dep.toProject).length;
      lines.push(`  ${fromId} -->|${count} deps| ${toId}`);
    }
  }

  return lines.join("\n");
}

function generateDeployRisks(deps: CrossProjectDep[]): string[] {
  const risks: string[] = [];
  const byTarget = new Map<string, CrossProjectDep[]>();

  for (const dep of deps) {
    const key = dep.toProject;
    const list = byTarget.get(key) ?? [];
    list.push(dep);
    byTarget.set(key, list);
  }

  for (const [project, projectDeps] of byTarget) {
    const sources = [...new Set(projectDeps.map((d) => d.fromProject))];
    if (sources.length > 0) {
      risks.push(
        `Deploying "${project}" may affect ${sources.length} dependent project(s): ${sources.join(", ")}. ` +
        `${projectDeps.length} cross-project reference(s) could break.`
      );
    }
  }

  return risks;
}
