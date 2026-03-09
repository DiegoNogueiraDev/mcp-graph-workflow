import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../utils/fs.js";
import { FileNotFoundError } from "../utils/errors.js";

export interface PrdFileResult {
  content: string;
  absolutePath: string;
  sizeBytes: number;
}

export async function readPrdFile(filePath: string): Promise<PrdFileResult> {
  const absolutePath = path.resolve(filePath);

  if (!(await fileExists(absolutePath))) {
    throw new FileNotFoundError(absolutePath);
  }

  const content = await readFile(absolutePath, "utf-8");

  return {
    content,
    absolutePath,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
  };
}
