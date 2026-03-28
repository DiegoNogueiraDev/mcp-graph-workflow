import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../utils/fs.js";
import { FileNotFoundError } from "../utils/errors.js";

export interface PrdFileResult {
  content: string;
  absolutePath: string;
  sizeBytes: number;
}

const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".html", ".pdf", ".prd"]);

export async function readPrdFile(filePath: string): Promise<PrdFileResult> {
  const absolutePath = path.resolve(filePath);

  // Security: reject paths outside the project directory (Bug #004)
  const projectRoot = process.cwd();
  if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
    throw new Error(`Path outside project directory: ${filePath}`);
  }

  // Security: reject unexpected file extensions
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file extension: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
  }

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
