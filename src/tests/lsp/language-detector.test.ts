import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import { detectProjectLanguages } from '../../core/lsp/language-detector.js';
import type { ServerRegistry } from '../../core/lsp/server-registry.js';

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

/** Create a lightweight mock that satisfies the ServerRegistry contract. */
function createMockRegistry(extensionMap: Record<string, string>): ServerRegistry {
  return {
    getLanguageForExtension(ext: string): string | undefined {
      return extensionMap[ext];
    },
  } as ServerRegistry;
}

/** Extensions use bare format (no leading dot), matching real ServerRegistry behavior. */
const defaultRegistry = createMockRegistry({
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'typescript',
  'jsx': 'typescript',
  'py': 'python',
  'go': 'go',
  'rs': 'rust',
  'java': 'java',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'cpp': 'cpp',
  'c': 'cpp',
  'lua': 'lua',
  'kt': 'kotlin',
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('detectProjectLanguages', () => {
  it('should detect TypeScript via tsconfig.json', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'tsconfig.json', isFile: () => true, isDirectory: () => false },
          { name: 'src', isFile: () => false, isDirectory: () => true },
          { name: 'index.ts', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      if (p === '/project/src') {
        return [
          { name: 'app.ts', isFile: () => true, isDirectory: () => false },
          { name: 'utils.ts', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const ts = result.find(r => r.languageId === 'typescript');
    expect(ts).toBeDefined();
    expect(ts!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(ts!.detectedVia).toBe('config_file');
    expect(ts!.configFile).toBe('tsconfig.json');
  });

  it('should detect Python via pyproject.toml', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'pyproject.toml', isFile: () => true, isDirectory: () => false },
          { name: 'main.py', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const py = result.find(r => r.languageId === 'python');
    expect(py).toBeDefined();
    expect(py!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(py!.detectedVia).toBe('config_file');
  });

  it('should detect Rust via Cargo.toml', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'Cargo.toml', isFile: () => true, isDirectory: () => false },
          { name: 'src', isFile: () => false, isDirectory: () => true },
        ] as unknown as fs.Dirent[];
      }
      if (p === '/project/src') {
        return [
          { name: 'main.rs', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const rust = result.find(r => r.languageId === 'rust');
    expect(rust).toBeDefined();
    expect(rust!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(rust!.detectedVia).toBe('config_file');
  });

  it('should detect Go via go.mod', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'go.mod', isFile: () => true, isDirectory: () => false },
          { name: 'main.go', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const go = result.find(r => r.languageId === 'go');
    expect(go).toBeDefined();
    expect(go!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(go!.detectedVia).toBe('config_file');
  });

  it('should detect by extension when no config file is present', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'main.py', isFile: () => true, isDirectory: () => false },
          { name: 'utils.py', isFile: () => true, isDirectory: () => false },
          { name: 'lib', isFile: () => false, isDirectory: () => true },
        ] as unknown as fs.Dirent[];
      }
      if (p === '/project/lib') {
        return [
          { name: 'helper.py', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const py = result.find(r => r.languageId === 'python');
    expect(py).toBeDefined();
    expect(py!.detectedVia).toBe('file_extension');
    expect(py!.confidence).toBeLessThan(0.9);
  });

  it('should detect multiple languages sorted by fileCount', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'tsconfig.json', isFile: () => true, isDirectory: () => false },
          { name: 'pyproject.toml', isFile: () => true, isDirectory: () => false },
          { name: 'a.ts', isFile: () => true, isDirectory: () => false },
          { name: 'b.ts', isFile: () => true, isDirectory: () => false },
          { name: 'c.ts', isFile: () => true, isDirectory: () => false },
          { name: 'x.py', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    expect(result.length).toBeGreaterThanOrEqual(2);
    const ts = result.find(r => r.languageId === 'typescript');
    const py = result.find(r => r.languageId === 'python');
    expect(ts).toBeDefined();
    expect(py).toBeDefined();
    // Sorted by fileCount descending — TS has 3 files, Python has 1
    expect(result[0].languageId).toBe('typescript');
    expect(result[0].fileCount).toBe(3);
  });

  it('should ignore node_modules, dist, and .git directories', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return [
          { name: 'node_modules', isFile: () => false, isDirectory: () => true },
          { name: 'dist', isFile: () => false, isDirectory: () => true },
          { name: '.git', isFile: () => false, isDirectory: () => true },
          { name: 'src', isFile: () => false, isDirectory: () => true },
        ] as unknown as fs.Dirent[];
      }
      if (p === '/project/src') {
        return [
          { name: 'app.ts', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      // These should never be called — ignored dirs are skipped
      if (p === '/project/node_modules' || p === '/project/dist' || p === '/project/.git') {
        return [
          { name: 'hidden.ts', isFile: () => true, isDirectory: () => false },
          { name: 'another.ts', isFile: () => true, isDirectory: () => false },
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const ts = result.find(r => r.languageId === 'typescript');
    // Only 1 file from src/, ignoring node_modules/dist/.git
    expect(ts?.fileCount).toBe(1);
  });

  it('should return empty array for empty project', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    mockedReaddirSync.mockImplementation(() => {
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    expect(result).toEqual([]);
  });

  it('should report accurate fileCount', () => {
    // Arrange
    const mockedReaddirSync = vi.mocked(fs.readdirSync);

    const tsFiles = Array.from({ length: 10 }, (_, i) => ({
      name: `file${i}.ts`,
      isFile: () => true,
      isDirectory: () => false,
    }));

    mockedReaddirSync.mockImplementation((dirPath: unknown) => {
      const p = String(dirPath);
      if (p === '/project') {
        return tsFiles as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Act
    const result = detectProjectLanguages('/project', defaultRegistry);

    // Assert
    const ts = result.find(r => r.languageId === 'typescript');
    expect(ts).toBeDefined();
    expect(ts!.fileCount).toBe(10);
  });
});
