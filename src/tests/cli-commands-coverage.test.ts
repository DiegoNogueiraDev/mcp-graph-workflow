import { describe, it, expect } from "vitest";
import { doctorCommand } from "../cli/commands/doctor.js";
import { initCommand } from "../cli/commands/init.js";
import { statsCommand } from "../cli/commands/stats.js";
import { importCommand } from "../cli/commands/import-cmd.js";
import { serveCommand } from "../cli/commands/serve.js";
import { indexCommand } from "../cli/commands/index-cmd.js";

// ── doctor command ───────────────────────────────────────

describe("doctorCommand", () => {
  it("should return a Command instance", () => {
    const cmd = doctorCommand();
    expect(cmd).toBeDefined();
    expect(typeof cmd.name).toBe("function");
  });

  it("should have correct name", () => {
    const cmd = doctorCommand();
    expect(cmd.name()).toBe("doctor");
  });

  it("should have a description that mentions validation", () => {
    const cmd = doctorCommand();
    expect(cmd.description()).toContain("Validate");
  });

  it("should have --dir and --json options", () => {
    const cmd = doctorCommand();
    // Options are registered — check via option definitions
    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--dir");
    expect(optionNames).toContain("--json");
  });
});

// ── init command ─────────────────────────────────────────

describe("initCommand", () => {
  it("should return a Command instance", () => {
    const cmd = initCommand();
    expect(cmd).toBeDefined();
  });

  it("should have correct name", () => {
    const cmd = initCommand();
    expect(cmd.name()).toBe("init");
  });

  it("should have a description that mentions initialize", () => {
    const cmd = initCommand();
    expect(cmd.description()).toContain("Initialize");
  });

  it("should have --dir and --name options", () => {
    const cmd = initCommand();
    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--dir");
    expect(optionNames).toContain("--name");
  });
});

// ── stats command ────────────────────────────────────────

describe("statsCommand", () => {
  it("should return a Command instance", () => {
    const cmd = statsCommand();
    expect(cmd).toBeDefined();
  });

  it("should have correct name", () => {
    const cmd = statsCommand();
    expect(cmd.name()).toBe("stats");
  });

  it("should have a description that mentions statistics", () => {
    const cmd = statsCommand();
    expect(cmd.description()).toContain("statistic");
  });

  it("should have --dir and --json options", () => {
    const cmd = statsCommand();
    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--dir");
    expect(optionNames).toContain("--json");
  });
});

// ── import command ───────────────────────────────────────

describe("importCommand", () => {
  it("should return a Command instance", () => {
    const cmd = importCommand();
    expect(cmd).toBeDefined();
  });

  it("should have correct name", () => {
    const cmd = importCommand();
    expect(cmd.name()).toBe("import");
  });

  it("should have a description that mentions PRD", () => {
    const cmd = importCommand();
    expect(cmd.description()).toContain("PRD");
  });

  it("should have --dir option", () => {
    const cmd = importCommand();
    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--dir");
  });

  it("should require a file argument", () => {
    const cmd = importCommand();
    // Commander stores registered arguments
    const args = cmd.registeredArguments ?? [];
    expect(args.length).toBeGreaterThan(0);
    expect(args[0].name()).toBe("file");
    expect(args[0].required).toBe(true);
  });
});

// ── serve command ────────────────────────────────────────

describe("serveCommand", () => {
  it("should return a Command instance", () => {
    const cmd = serveCommand();
    expect(cmd).toBeDefined();
  });

  it("should have correct name", () => {
    const cmd = serveCommand();
    expect(cmd.name()).toBe("serve");
  });

  it("should have a description that mentions dashboard or server", () => {
    const cmd = serveCommand();
    const desc = cmd.description().toLowerCase();
    expect(desc).toMatch(/dashboard|server/);
  });

  it("should have --port option", () => {
    const cmd = serveCommand();
    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--port");
  });

  it("should default port to 3000", () => {
    const cmd = serveCommand();
    const portOpt = cmd.options.find((o) => o.long === "--port");
    expect(portOpt).toBeDefined();
    expect(portOpt!.defaultValue).toBe("3000");
  });
});

// ── index command ────────────────────────────────────────

describe("indexCommand", () => {
  it("should return a Command instance", () => {
    const cmd = indexCommand();
    expect(cmd).toBeDefined();
  });

  it("should have correct name", () => {
    const cmd = indexCommand();
    expect(cmd.name()).toBe("index");
  });

  it("should have a description that mentions reindex or knowledge", () => {
    const cmd = indexCommand();
    const desc = cmd.description().toLowerCase();
    expect(desc).toMatch(/reindex|knowledge/);
  });

  it("should have --dir and --json options", () => {
    const cmd = indexCommand();
    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--dir");
    expect(optionNames).toContain("--json");
  });
});

// ── Cross-command consistency ────────────────────────────

describe("cross-command consistency", () => {
  it("all commands with --dir should use process.cwd() as default", () => {
    const commands = [
      doctorCommand(),
      initCommand(),
      statsCommand(),
      importCommand(),
      serveCommand(),
      indexCommand(),
    ];

    for (const cmd of commands) {
      const dirOpt = cmd.options.find((o) => o.long === "--dir");
      if (dirOpt) {
        expect(dirOpt.defaultValue).toBe(process.cwd());
      }
    }
  });

  it("all commands should have unique names", () => {
    const commands = [
      doctorCommand(),
      initCommand(),
      statsCommand(),
      importCommand(),
      serveCommand(),
      indexCommand(),
    ];
    const names = commands.map((c) => c.name());
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("all commands should have non-empty descriptions", () => {
    const commands = [
      doctorCommand(),
      initCommand(),
      statsCommand(),
      importCommand(),
      serveCommand(),
      indexCommand(),
    ];
    for (const cmd of commands) {
      expect(cmd.description().length).toBeGreaterThan(0);
    }
  });
});
