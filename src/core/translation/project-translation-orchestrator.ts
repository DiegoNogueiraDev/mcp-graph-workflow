/**
 * Project Translation Orchestrator — coordinates full project translation
 * by delegating to TranslationOrchestrator for each file.
 *
 * Flow: createFromZip → analyzeProject → prepareFile → (AI generates) → finalizeFile → generateDownloadZip
 */

import AdmZip from "adm-zip";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { TranslationError } from "../utils/errors.js";
import { TranslationOrchestrator } from "./translation-orchestrator.js";
import { TranslationProjectStore } from "./translation-project-store.js";
import { TranslationStore } from "./translation-store.js";
import { extractZip } from "./zip-extractor.js";
import type {
  TranslationProject,
  TranslationProjectSummary,
} from "./translation-project-types.js";
import type { TranslationAnalysis } from "./translation-types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;

const UCR_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Maps source language to its canonical file extension for translated output.
 */
const LANGUAGE_TO_EXTENSION: Record<string, string> = {
  typescript: ".ts",
  javascript: ".js",
  python: ".py",
  java: ".java",
  csharp: ".cs",
  go: ".go",
  rust: ".rs",
  ruby: ".rb",
  php: ".php",
  swift: ".swift",
  kotlin: ".kt",
  scala: ".scala",
  cpp: ".cpp",
  lua: ".lua",
  dart: ".dart",
  elixir: ".ex",
  haskell: ".hs",
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class ProjectTranslationOrchestrator {
  constructor(
    private readonly orchestrator: TranslationOrchestrator,
    private readonly projectStore: TranslationProjectStore,
    private readonly translationStore: TranslationStore,
  ) {}

  /**
   * Create a translation project from a ZIP file.
   * Extracts files, creates the project, and adds each file to the store.
   */
  createFromZip(
    projectId: string,
    zipPath: string,
    targetLanguage: string,
    name?: string,
  ): TranslationProject {
    const files = extractZip(zipPath);

    if (files.length === 0) {
      throw new TranslationError("ZIP file contains no translatable source files");
    }

    const projectName = name ?? path.basename(zipPath, path.extname(zipPath));

    const project = this.projectStore.createProject({
      projectId,
      name: projectName,
      targetLanguage,
      totalFiles: files.length,
    });

    for (const file of files) {
      this.projectStore.addFile({
        translationProjectId: project.id,
        filePath: file.relativePath,
        sourceCode: file.content,
        sourceLanguage: file.detectedLanguage,
      });
    }

    this.projectStore.updateProject(project.id, { totalFiles: files.length });

    logger.info("project-translation:createFromZip", {
      translationProjectId: project.id,
      projectId,
      zipPath,
      targetLanguage,
      fileCount: files.length,
    });

    return this.projectStore.getProject(project.id) as TranslationProject;
  }

  /**
   * Analyze all files in the project, processing in batches.
   * Updates each file with analysis results and computes project-level confidence.
   */
  analyzeProject(translationProjectId: string): TranslationProject {
    const project = this.projectStore.getProject(translationProjectId);
    if (!project) {
      throw new TranslationError(`Translation project not found: ${translationProjectId}`);
    }

    const files = this.projectStore.getFiles(translationProjectId);

    logger.info("project-translation:analyzeProject:start", {
      translationProjectId,
      fileCount: files.length,
    });

    this.projectStore.updateProject(translationProjectId, { status: "analyzing" });

    let processedCount = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);

      for (const file of batch) {
        try {
          this.projectStore.updateFile(file.id, { status: "analyzing" });

          const analysis = this.orchestrator.analyzeSource(
            file.sourceCode,
            { languageHint: file.sourceLanguage, targetLanguage: project.targetLanguage },
            file.filePath,
            project.projectId,
          );

          const isDeterministic = this.isFileDeterministic(analysis);

          this.projectStore.updateFile(file.id, {
            status: "analyzed",
            analysis: analysis as unknown as Record<string, unknown>,
            confidenceScore: analysis.estimatedTranslatability,
            deterministic: isDeterministic,
            sourceLanguage: file.sourceLanguage ?? analysis.detectedLanguage,
          });

          processedCount++;

          logger.debug("project-translation:analyzeProject:file", {
            translationProjectId,
            fileId: file.id,
            filePath: file.filePath,
            translatability: analysis.estimatedTranslatability,
            deterministic: isDeterministic,
            progress: `${processedCount}/${files.length}`,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("project-translation:analyzeProject:fileError", {
            translationProjectId,
            fileId: file.id,
            filePath: file.filePath,
            error: message,
          });

          this.projectStore.updateFile(file.id, {
            status: "failed",
            errorMessage: message,
          });
        }
      }
    }

    const confidence = this.projectStore.computeProjectConfidence(translationProjectId);

    this.projectStore.updateProject(translationProjectId, {
      status: "ready",
      processedFiles: processedCount,
      overallConfidence: confidence.overallConfidence,
      deterministicPct: confidence.deterministicPct,
    });

    logger.info("project-translation:analyzeProject:done", {
      translationProjectId,
      processedFiles: processedCount,
      totalFiles: files.length,
      overallConfidence: confidence.overallConfidence,
      deterministicPct: confidence.deterministicPct,
    });

    return this.projectStore.getProject(translationProjectId) as TranslationProject;
  }

  /**
   * Prepare a single file for translation.
   * Validates file status, creates a translation job, and returns the prompt.
   */
  prepareFile(
    translationProjectId: string,
    fileId: string,
  ): { jobId: string; prompt: string } {
    const project = this.projectStore.getProject(translationProjectId);
    if (!project) {
      throw new TranslationError(`Translation project not found: ${translationProjectId}`);
    }

    const file = this.projectStore.getFile(fileId);
    if (!file) {
      throw new TranslationError(`Translation project file not found: ${fileId}`);
    }

    if (file.translationProjectId !== translationProjectId) {
      throw new TranslationError(
        `File ${fileId} does not belong to project ${translationProjectId}`,
      );
    }

    if (file.status !== "analyzed" && file.status !== "failed") {
      throw new TranslationError(
        `File ${fileId} is in status '${file.status}', expected 'analyzed' or 'failed'`,
      );
    }

    const result = this.orchestrator.prepareTranslation({
      projectId: project.projectId,
      sourceCode: file.sourceCode,
      sourceLanguage: file.sourceLanguage,
      targetLanguage: project.targetLanguage,
      scope: "module",
    });

    this.projectStore.updateFile(fileId, {
      status: "translating",
      jobId: result.jobId,
    });

    return { jobId: result.jobId, prompt: result.prompt };
  }

  /**
   * Finalize a translated file with the AI-generated code.
   * Updates file status to done and recomputes project confidence.
   */
  finalizeFile(
    translationProjectId: string,
    fileId: string,
    generatedCode: string,
  ): { job: { id: string; status: string; targetCode?: string; confidenceScore?: number }; evidence: unknown } {
    const project = this.projectStore.getProject(translationProjectId);
    if (!project) {
      throw new TranslationError(`Translation project not found: ${translationProjectId}`);
    }

    const file = this.projectStore.getFile(fileId);
    if (!file) {
      throw new TranslationError(`Translation project file not found: ${fileId}`);
    }

    if (file.translationProjectId !== translationProjectId) {
      throw new TranslationError(
        `File ${fileId} does not belong to project ${translationProjectId}`,
      );
    }

    if (!file.jobId) {
      throw new TranslationError(
        `File ${fileId} has no jobId — was prepareFile called?`,
      );
    }

    const result = this.orchestrator.finalizeTranslation(file.jobId, generatedCode);

    this.projectStore.updateFile(fileId, {
      status: "done",
      confidenceScore: result.evidence.confidenceScore,
    });

    const confidence = this.projectStore.computeProjectConfidence(translationProjectId);
    this.projectStore.updateProject(translationProjectId, {
      overallConfidence: confidence.overallConfidence,
      deterministicPct: confidence.deterministicPct,
    });

    return result;
  }

  /**
   * Compute and return a summary of the translation project.
   */
  getProjectSummary(translationProjectId: string): TranslationProjectSummary {
    const project = this.projectStore.getProject(translationProjectId);
    if (!project) {
      throw new TranslationError(`Translation project not found: ${translationProjectId}`);
    }

    const files = this.projectStore.getFiles(translationProjectId);

    let pendingFiles = 0;
    let analyzingFiles = 0;
    let analyzedFiles = 0;
    let translatingFiles = 0;
    let translatedFiles = 0;
    let failedFiles = 0;

    for (const file of files) {
      switch (file.status) {
        case "pending":
          pendingFiles++;
          break;
        case "analyzing":
          analyzingFiles++;
          break;
        case "analyzed":
          analyzedFiles++;
          break;
        case "translating":
          translatingFiles++;
          break;
        case "done":
          translatedFiles++;
          break;
        case "failed":
          failedFiles++;
          break;
      }
    }

    const confidence = this.projectStore.computeProjectConfidence(translationProjectId);

    return {
      overallConfidence: confidence.overallConfidence,
      deterministicPct: confidence.deterministicPct,
      totalFiles: files.length,
      analyzedFiles: analyzedFiles + translatingFiles + translatedFiles,
      translatedFiles,
      failedFiles,
      pendingFiles: pendingFiles + analyzingFiles,
    };
  }

  /**
   * Generate a downloadable ZIP with translated files and prompts for untranslated ones.
   */
  generateDownloadZip(translationProjectId: string): Buffer {
    const project = this.projectStore.getProject(translationProjectId);
    if (!project) {
      throw new TranslationError(`Translation project not found: ${translationProjectId}`);
    }

    const files = this.projectStore.getFiles(translationProjectId);
    const zip = new AdmZip();

    logger.info("project-translation:generateDownloadZip", {
      translationProjectId,
      fileCount: files.length,
    });

    for (const file of files) {
      if (file.status === "done" && file.jobId) {
        const job = this.translationStore.getJob(file.jobId);
        if (job?.targetCode) {
          const targetExt = LANGUAGE_TO_EXTENSION[project.targetLanguage] ?? path.extname(file.filePath);
          const targetPath = this.replaceExtension(file.filePath, targetExt);
          zip.addFile(targetPath, Buffer.from(job.targetCode, "utf-8"));
          continue;
        }
      }

      // Not done — add original source + prompt sidecar
      zip.addFile(file.filePath, Buffer.from(file.sourceCode, "utf-8"));

      try {
        const prepared = this.orchestrator.prepareTranslation({
          projectId: project.projectId,
          sourceCode: file.sourceCode,
          sourceLanguage: file.sourceLanguage,
          targetLanguage: project.targetLanguage,
          scope: "module",
        });
        const sidecarPath = file.filePath + ".prompt.md";
        zip.addFile(sidecarPath, Buffer.from(prepared.prompt, "utf-8"));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.debug("project-translation:generateDownloadZip:promptError", {
          fileId: file.id,
          filePath: file.filePath,
          error: message,
        });
      }
    }

    return zip.toBuffer();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Determine if a file is fully deterministic based on analysis results.
   * A file is deterministic if it has no ambiguous constructs.
   */
  private isFileDeterministic(analysis: TranslationAnalysis & { cacheHit: boolean }): boolean {
    if (analysis.ambiguousConstructs && analysis.ambiguousConstructs.length > 0) {
      return false;
    }

    return analysis.estimatedTranslatability >= UCR_CONFIDENCE_THRESHOLD;
  }

  /**
   * Replace the file extension in a path.
   */
  private replaceExtension(filePath: string, newExt: string): string {
    const parsed = path.parse(filePath);
    return path.join(parsed.dir, parsed.name + newExt);
  }
}
