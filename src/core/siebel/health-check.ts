/**
 * Health Check — validates connectivity with configured Siebel environments.
 */

import { logger } from "../utils/logger.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

export type HealthStatus = "online" | "offline" | "degraded";

export interface HealthCheckOptions {
  timeoutMs?: number;
}

export interface HealthCheckResult {
  environmentName: string;
  url: string;
  status: HealthStatus;
  responseTimeMs: number;
  error?: string;
  checkedAt: string;
}

/**
 * Check connectivity with a Siebel environment.
 */
export async function checkEnvironmentHealth(
  env: SiebelEnvironment,
  options?: HealthCheckOptions,
): Promise<HealthCheckResult> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(env.url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;

    const status: HealthStatus = response.ok ? "online" : "degraded";

    logger.info("Health check complete", {
      environment: env.name,
      status,
      responseTime: String(responseTimeMs),
    });

    return {
      environmentName: env.name,
      url: env.url,
      status,
      responseTimeMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    logger.warn("Health check failed", {
      environment: env.name,
      error,
    });

    return {
      environmentName: env.name,
      url: env.url,
      status: "offline",
      responseTimeMs,
      error,
      checkedAt: new Date().toISOString(),
    };
  }
}
