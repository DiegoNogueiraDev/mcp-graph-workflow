import { access, constants } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file safely — rejects paths outside the project directory.
 * Prevents path traversal attacks (similar to readPrdFile in read-file.ts).
 */
export function safeReadFileSync(
  filePath: string,
  allowedExtensions?: Set<string>,
): string {
  const absolutePath = path.resolve(filePath);
  const projectRoot = process.cwd();

  if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
    throw new Error(`Path outside project directory: ${filePath}`);
  }

  if (allowedExtensions) {
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext && !allowedExtensions.has(ext)) {
      throw new Error(`Unsupported file extension: ${ext}. Allowed: ${[...allowedExtensions].join(", ")}`);
    }
  }

  return readFileSync(absolutePath, "utf-8");
}

/**
 * Validate that a path is within the project directory.
 * Throws if the path escapes the project root.
 */
export function assertPathInsideProject(targetPath: string): string {
  const absolutePath = path.resolve(targetPath);
  const projectRoot = process.cwd();

  if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
    throw new Error(`Path outside project directory: ${targetPath}`);
  }

  return absolutePath;
}
