import AdmZip from "adm-zip";
import path from "node:path";
import { logger } from "../utils/logger.js";
import type { ExtractedFile } from "./translation-project-types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  "__MACOSX",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "__pycache__",
  ".next",
]);

const BINARY_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".jar",
  ".zip",
  ".gz",
  ".tar",
  ".png",
  ".jpg",
  ".gif",
  ".ico",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".o",
  ".a",
  ".lib",
  ".pyc",
  ".pyo",
  ".node",
]);

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".java": "java",
  ".cs": "csharp",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
  ".lua": "lua",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".hs": "haskell",
};

export function detectLanguageByExtension(ext: string): string | undefined {
  return EXTENSION_TO_LANGUAGE[ext.toLowerCase()];
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

function isBinaryFile(entry: AdmZip.IZipEntry): boolean {
  const ext = path.extname(entry.entryName).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // Inspect first 512 bytes for null bytes
  const buf = entry.getData();
  const checkLength = Math.min(buf.length, 512);
  for (let i = 0; i < checkLength; i++) {
    if (buf[i] === 0x00) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Path filtering helpers
// ---------------------------------------------------------------------------

function isInIgnoredDir(entryPath: string): boolean {
  const parts = entryPath.split(/[/\\]/);
  return parts.some((part) => IGNORED_DIRS.has(part));
}

function isHiddenFile(entryPath: string): boolean {
  const basename = path.basename(entryPath);
  return basename.startsWith(".");
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

export function extractZip(zipPath: string): ExtractedFile[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to open ZIP file: ${message}`, { zipPath });
    return [];
  }

  const entries = zip.getEntries();
  const extracted: ExtractedFile[] = [];
  let filteredCount = 0;

  for (const entry of entries) {
    // Skip directories
    if (entry.isDirectory) {
      continue;
    }

    const entryPath = entry.entryName;

    // Skip files in ignored directories
    if (isInIgnoredDir(entryPath)) {
      filteredCount++;
      continue;
    }

    // Skip hidden files
    if (isHiddenFile(entryPath)) {
      filteredCount++;
      continue;
    }

    // Skip files exceeding max size
    if (entry.header.size > MAX_FILE_SIZE_BYTES) {
      filteredCount++;
      logger.debug(`Skipping large file: ${entryPath}`, {
        sizeBytes: entry.header.size,
        maxBytes: MAX_FILE_SIZE_BYTES,
      });
      continue;
    }

    // Skip binary files
    try {
      if (isBinaryFile(entry)) {
        filteredCount++;
        continue;
      }
    } catch {
      filteredCount++;
      logger.debug(`Skipping unreadable entry: ${entryPath}`);
      continue;
    }

    // Read content as UTF-8
    let content: string;
    try {
      content = entry.getData().toString("utf-8");
    } catch {
      filteredCount++;
      logger.debug(`Failed to read entry as UTF-8: ${entryPath}`);
      continue;
    }

    const ext = path.extname(entryPath).toLowerCase();
    const detectedLanguage = detectLanguageByExtension(ext);

    extracted.push({
      relativePath: entryPath,
      content,
      extension: ext,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      ...(detectedLanguage !== undefined ? { detectedLanguage } : {}),
    });
  }

  logger.info(`ZIP extraction complete`, {
    zipPath,
    totalEntries: entries.length,
    filtered: filteredCount,
    extracted: extracted.length,
  });

  return extracted;
}
