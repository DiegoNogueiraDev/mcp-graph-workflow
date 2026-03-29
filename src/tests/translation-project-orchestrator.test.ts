import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { TranslationProjectStore } from "../core/translation/translation-project-store.js";
import { TranslationStore } from "../core/translation/translation-store.js";
import { ProjectTranslationOrchestrator } from "../core/translation/project-translation-orchestrator.js";
import { TranslationOrchestrator } from "../core/translation/translation-orchestrator.js";
import { ConstructRegistry } from "../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../core/translation/ucr/construct-seed.js";

describe("ProjectTranslationOrchestrator", () => {
  let db: Database.Database;
  let projectStore: TranslationProjectStore;
  let translationStore: TranslationStore;
  let orchestrator: TranslationOrchestrator;
  let projectOrchestrator: ProjectTranslationOrchestrator;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);

    const registry = new ConstructRegistry(db);
    loadAndSeedRegistry(registry);
    translationStore = new TranslationStore(db);
    orchestrator = new TranslationOrchestrator(registry, translationStore);
    projectStore = new TranslationProjectStore(db);
    projectOrchestrator = new ProjectTranslationOrchestrator(
      orchestrator,
      projectStore,
      translationStore,
    );
  });

  afterEach(() => {
    db.close();
  });

  it("should get project summary with zero files", () => {
    // Arrange
    const project = projectStore.createProject({
      projectId: "test-proj",
      name: "Empty Project",
      targetLanguage: "typescript",
    });

    // Act
    const summary = projectOrchestrator.getProjectSummary(project.id);

    // Assert
    expect(summary.totalFiles).toBe(0);
    expect(summary.analyzedFiles).toBe(0);
    expect(summary.translatedFiles).toBe(0);
    expect(summary.failedFiles).toBe(0);
    expect(summary.pendingFiles).toBe(0);
    expect(summary.overallConfidence).toBe(0);
    expect(summary.deterministicPct).toBe(0);
  });

  it("should get project summary with files in various statuses", () => {
    // Arrange
    const project = projectStore.createProject({
      projectId: "test-proj",
      name: "Mixed Project",
      targetLanguage: "typescript",
    });

    const _pendingFile = projectStore.addFile({
      translationProjectId: project.id,
      filePath: "src/pending.py",
      sourceCode: "x = 1",
      sourceLanguage: "python",
    });

    const analyzedFile = projectStore.addFile({
      translationProjectId: project.id,
      filePath: "src/analyzed.py",
      sourceCode: "y = 2",
      sourceLanguage: "python",
    });
    projectStore.updateFile(analyzedFile.id, {
      status: "analyzed",
      confidenceScore: 0.8,
    });

    const doneFile = projectStore.addFile({
      translationProjectId: project.id,
      filePath: "src/done.py",
      sourceCode: "z = 3",
      sourceLanguage: "python",
    });
    projectStore.updateFile(doneFile.id, {
      status: "done",
      confidenceScore: 0.95,
    });

    const failedFile = projectStore.addFile({
      translationProjectId: project.id,
      filePath: "src/failed.py",
      sourceCode: "w = 4",
      sourceLanguage: "python",
    });
    projectStore.updateFile(failedFile.id, {
      status: "failed",
      errorMessage: "parse error",
    });

    // Act
    const summary = projectOrchestrator.getProjectSummary(project.id);

    // Assert
    expect(summary.totalFiles).toBe(4);
    expect(summary.pendingFiles).toBe(1); // pending
    expect(summary.analyzedFiles).toBe(2); // analyzed + done
    expect(summary.translatedFiles).toBe(1); // done
    expect(summary.failedFiles).toBe(1); // failed
  });

  it("should generate download zip buffer", () => {
    // Arrange
    const project = projectStore.createProject({
      projectId: "test-proj",
      name: "Zip Project",
      targetLanguage: "typescript",
    });

    const job = translationStore.createJob({
      projectId: "test-proj",
      sourceLanguage: "python",
      targetLanguage: "typescript",
      sourceCode: "def hello(): pass",
      scope: "module" as const,
    });

    translationStore.updateJob(job.id, {
      status: "done",
      targetCode: "function hello() {}",
      confidenceScore: 0.9,
    });

    const file = projectStore.addFile({
      translationProjectId: project.id,
      filePath: "src/hello.py",
      sourceCode: "def hello(): pass",
      sourceLanguage: "python",
    });
    projectStore.updateFile(file.id, {
      status: "done",
      jobId: job.id,
      confidenceScore: 0.9,
    });

    // Act
    const zipBuffer = projectOrchestrator.generateDownloadZip(project.id);

    // Assert
    expect(Buffer.isBuffer(zipBuffer)).toBe(true);
    expect(zipBuffer.length).toBeGreaterThan(0);
  });

  it("should return empty zip for project with no files", () => {
    // Arrange
    const project = projectStore.createProject({
      projectId: "test-proj",
      name: "Empty Zip Project",
      targetLanguage: "typescript",
    });

    // Act
    const zipBuffer = projectOrchestrator.generateDownloadZip(project.id);

    // Assert
    expect(Buffer.isBuffer(zipBuffer)).toBe(true);
    // An empty ZIP is still a valid buffer with header bytes
    expect(zipBuffer.length).toBeGreaterThan(0);
  });
});
