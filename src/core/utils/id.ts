import { randomBytes } from "node:crypto";

export function generateId(prefix: string = "node"): string {
  const hex = randomBytes(6).toString("hex");
  return `${prefix}_${hex}`;
}
