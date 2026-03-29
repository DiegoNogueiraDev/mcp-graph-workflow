# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.26.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.25.0...mcp-graph-v5.26.0) (2026-03-29)


### Features

* **language-convert:** Language Convert v2 — full project conversion, deterministic indicator, knowledge tab ([c77d555](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c77d555a1f1e607c4ea60fa7bc67d4bfe06d1288))


### Bug Fixes

* **code-graph:** improve indexer coverage for barrel files, arrow functions, and file metrics ([2cb352e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2cb352e499d703ee1cc7122689ae352a5857f546))
* **language-convert:** index translation evidence on finalize + real data in Graph tab ([20034bc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/20034bc49db41e2cc684cb786e24bef4f0a2e5ec))
* **reindex:** correct SQL column names in code symbol reindex query ([7bb4b41](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7bb4b41d452c3cc18a88bce512aa8012a3e85a7e))

## [5.25.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.24.1...mcp-graph-v5.25.0) (2026-03-29)


### Features

* **knowledge:** Knowledge Package export/import for team collaboration ([#107](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/107)) ([80d3948](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/80d39480d0e239c56f004e18cd1488183c54122e))

## [5.24.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.24.0...mcp-graph-v5.24.1) (2026-03-29)


### Bug Fixes

* Resolve lint errors from CI pipeline ([a6f1337](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a6f133729b5b256cf5c26a66eaeb39c0fd159343))
* Windows compatibility for browse path validation ([7da85d2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7da85d275436d73e109522952141c6eed37cad1d))

## [5.24.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.23.0...mcp-graph-v5.24.0) (2026-03-29)


### Features

* Backend audit wave 3 — language parsers, detection, large files, dashboard ([#104](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/104)) ([83d23b3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/83d23b3549cdf838f3e56e1c4386a5bdee5f68cd))

## [5.23.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.22.1...mcp-graph-v5.23.0) (2026-03-29)


### Features

* Backend audit wave 2 — 9 fixes across translation, MCP, dashboard, parser ([#102](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/102)) ([9a7210a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9a7210a277475d0b50056881135bec0a6be71d24))

## [5.22.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.22.0...mcp-graph-v5.22.1) (2026-03-29)


### Bug Fixes

* Backend security, reliability, and consistency audit (19 fixes) ([#100](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/100)) ([46d141e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/46d141ebb9affee85a72882b6213de46afb2eb5f))

## [5.22.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.21.0...mcp-graph-v5.22.0) (2026-03-29)


### Features

* UX overhaul for all remaining dashboard tabs (12/12 complete) ([32a7562](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/32a75628a8a9ca769783d99ccd5a9e58e5aceb18))
* UX overhaul for Graph, Insights, Context, Benchmark tabs ([7f21fe7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7f21fe7f88ee85ec1ccd59ae1444da6e8d85ac4e))

## [5.21.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.20.1...mcp-graph-v5.21.0) (2026-03-29)


### Features

* UX overhaul for Languages tab — interactive feedback & usability ([b9db43e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b9db43e0c3868ce3575b0a9580333d4afd69f53a))


### Bug Fixes

* prevent SSE-triggered remount of Languages tab during analysis ([9f61129](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9f6112958c3853fb4c1d12306c0eb505fc129113))

## [5.20.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.20.0...mcp-graph-v5.20.1) (2026-03-29)


### Bug Fixes

* resolve Languages tab bugs found during E2E testing ([1187b30](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1187b304d5bee8eab65ad5c21f904e74eac7108d))

## [5.20.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.19.3...mcp-graph-v5.20.0) (2026-03-29)


### Features

* add IR canonical representation and declarative rule engine (sprint-2, tasks 4.1+4.2) ([42b9e1d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42b9e1daf1f1c9996cd39f6e35e23ebd7041d123))
* add multi-language parsers and translation memory (sprint-3, 6 tasks) ([2c0f2a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2c0f2a8a7ba39ce4ddf7ebd9fbbe18af54f56921))
* add validators, repair loop, and translation pipeline (sprint-2, tasks 4.3+4.4+4.5) ([b13480d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b13480d8f0912e64509ba4ab36d7c459e8950847))
* implement cache layer optimization (sprint-1-cache, 9 tasks) ([3f9e03b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3f9e03bbdcc240ac66c6663ff083ad2910ccd568))


### Bug Fixes

* resolve code review findings (W1-W3, W7, W8, W10, W6) ([628794e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/628794e22b6f7dfcc1ba1a3a0ed4993e6435e1c7))
* resolve lint errors from VALIDATE phase ([a29d324](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a29d32445932ba551e50b60f4a47f28b21d1ae16))
* update mcp-graph dependency to version 5.19.3 and adjust required workflow steps ([2e7db46](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2e7db4681e2db8bc0b31caea67be9fac4b988c6c))

## [5.19.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.19.2...mcp-graph-v5.19.3) (2026-03-28)


### Bug Fixes

* resolve remaining critical bugs [#001](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/001)/[#002](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/002)/NEW-2, [#038](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/038), [#071](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/071) ([ec9ae78](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ec9ae78616adb7aa00e2045adbe0ea05a1796c4d))

## [5.19.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.19.1...mcp-graph-v5.19.2) (2026-03-28)


### Bug Fixes

* resolve 9 remaining bugs from v5.19.1 retesting ([f88711a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f88711adee8fb60dc9340937b286f96f3a7ef389))

## [5.19.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.19.0...mcp-graph-v5.19.1) (2026-03-28)


### Bug Fixes

* remaining bug verification tests + rag-context/snapshot hardening ([4b99099](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4b99099e8af7bac9e1b9378a5b0aa9284325d80e))
* **security:** path traversal prevention + input validation hardening ([1334ed3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1334ed3d40b98ef0ca7e73e09bab13554788f62f))
* **test:** normalize Windows path in assertPathInsideProject test ([e516061](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e516061c44bdec124ad6abd174b8ee46c13de2b2))

## [5.19.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.18.3...mcp-graph-v5.19.0) (2026-03-28)


### Features

* **lsp:** auto-detect and check LSP language server dependencies ([9ca3527](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9ca3527709feeebcb2cf51ab13d59a94df727bde))


### Bug Fixes

* **deps:** sync package-lock.json with intelephense optionalDependency ([fd20eef](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fd20eefbb7ea282c940a675b8c6677a0ddcfa79f))

## [5.18.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.18.2...mcp-graph-v5.18.3) (2026-03-28)


### Bug Fixes

* **lsp:** prevent unhandled error on spawn failure + Windows path fixes ([0d32d9d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0d32d9df427d21e7a2bfc7c9fc03272681accf30))
* **test:** increase timeout for reindex tests (30s for coverage mode) ([d66befe](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d66befe57936c72a1855341f3073883c926f69c1))

## [5.18.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.18.1...mcp-graph-v5.18.2) (2026-03-28)


### Bug Fixes

* **lsp:** normalize Windows path separators in LSP bridge and tests ([2c607a1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2c607a14050a6c25d68824a943db41fc9bccef23))
* **lsp:** Windows path compatibility in bridge and tests ([2d555c3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d555c3787fa57b08a524db50441345944f42bcb))

## [5.18.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.18.0...mcp-graph-v5.18.1) (2026-03-28)


### Bug Fixes

* **docs:** reorganize documentation paths + update references ([7def7f7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7def7f7ff3941d8a717a787f86ae8a62ab813f7f))
* **security:** upgrade path-to-regexp and yaml to fix audit vulnerabilities ([461fbfd](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/461fbfdb44c815420b3224d6d5191488cc6ee9b4))

## [5.18.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.17.0...mcp-graph-v5.18.0) (2026-03-28)


### Features

* **dashboard:** Languages tab UI — 2-phase translation workflow ([4181d6b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4181d6b6de50150f1792c60837acbde82263e398))
* **siebel:** batch import via directory param in siebel_import_sif MCP tool ([4525852](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4525852152aaa9e1769d952568f52a4a51e035e2))
* **siebel:** WSDL contract validation — field conformance scoring ([b72a27c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b72a27cbb78962f8961e5b83aa633675142d8bf3))
* **siebel:** WSDL documentation generator — Markdown with Mermaid diagrams ([a171c02](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a171c02b58994844003578df5eed937e13a79c16))
* **translation:** knowledge store integration — translation_indexer.ts ([628a07d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/628a07dfba7e4ec14c824c11c9f209c5a48dddd4))
* **translation:** MCP tools — translate_code + analyze_translation ([ece23a7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ece23a7c2bb0069c58dfc13cb67ce6a1b89a6bb9))
* **translation:** SSE integration — real-time translation events ([17f7f5a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/17f7f5a9fb8cf2ab0a27ab750e6338eb3f4ab005))


### Bug Fixes

* resolve 95 of 101 reported bugs — zero regressions ([28ea9e8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/28ea9e8a98d0938d8d3894d83bb1801c07fff70e))
* resolve final 6 bugs — 101/101 complete, zero regressions ([d0bd6d9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d0bd6d943e8b5d96208736807eceade820b6bd5c))

## [5.17.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.16.0...mcp-graph-v5.17.0) (2026-03-28)


### Features

* **dashboard:** API client + types for translation — 7 methods, 8 interfaces ([4ef753e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4ef753e1ce33d92b9ebf53960160af9c7ebc4a00))
* **dashboard:** register Languages tab — sidebar + lazy load + placeholder component ([8a3de4e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8a3de4e89c3b6f4de002274e5c58f61f3e52e2a0))
* **dashboard:** translation hooks — useTranslation (2-phase workflow) + useTranslationHistory ([e6481e8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e6481e85fbc07f31d241f93bd9b19d332dd9b4ea))
* **events:** translation event types — job_created, analyzed, finalized, error ([da1baa2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/da1baa232ffcdc41b5e4e7fa7449331c3ba815ca))
* **lifecycle:** tool prerequisites enforcement — mandatory tool gates per phase ([1b20916](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1b20916196bbf7b7367673d66695596c344cdb4b))
* **lsp:** edit applier — atomic workspace edits with rollback, code-intelligence write ops ([6e507ec](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6e507ecac5a322545ab41ef66836bef82d57c60d))
* **mcp:** code intelligence auto-enforcement wrapper — strict/advisory/off modes ([e776624](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e7766248e722aab78e49c326f53e5883119b2934))
* **perf:** cache layer optimization — SQLite PRAGMAs, eliminate N+1 queries, fix LRU, extend RAG cache ([bfbd012](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bfbd0124d7a6221a00a4ef102a0a336d1cc9282c))
* **translation:** prompt builder, orchestrator, API routes — sprint-lang-1 complete ([63f1bd9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/63f1bd90772406c0e0acd70b5e491c2fde6ef5e4))
* **translation:** scorer, ambiguity, parsers, generators, store, language detection — 8 tasks done ([c71afd3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c71afd31211027b6921086cd50cb21c0c5f64d1f))
* **translation:** UCR foundation — construct types, registry, seed data (12 langs), migration v15 ([984ca4b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/984ca4b5ab27da01bb8ed20ee0d64fbc8d3ea844))

## [5.16.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.15.1...mcp-graph-v5.16.0) (2026-03-28)


### Features

* **lsp:** rename UI, warm-up, auto-refresh status ([26ca3d6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/26ca3d6d5877c6e09ced378ad5b499f9fd4df33d))

## [5.15.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.15.0...mcp-graph-v5.15.1) (2026-03-28)


### Bug Fixes

* **lsp:** add didOpen to callHierarchy methods, fix empty results ([772555d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/772555dd8185cc5b762234302dfa905415cd7651))

## [5.15.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.14.1...mcp-graph-v5.15.0) (2026-03-28)


### Features

* **lsp:** LSP/CodeGraph fixes, performance, bundled language server ([ec45a40](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ec45a40c3463982a98c46f6e0da229b580599904))

## [5.14.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.14.0...mcp-graph-v5.14.1) (2026-03-27)


### Bug Fixes

* **lsp:** multi-language support — Kotlin/Swift, C# detection, didOpen lifecycle ([da3103e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/da3103ea3c93ee5e5446a8f1c6f9f3aad656f2b8))
* **lsp:** multi-language support bugs — Kotlin/Swift mapping, C# detection, didOpen lifecycle ([c87d69c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c87d69cc4d0b91cbb560bd593e0068024aed971c))

## [5.14.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.13.0...mcp-graph-v5.14.0) (2026-03-27)


### Features

* **dashboard:** LSP tab — language server status, symbol explorer, diagnostics ([883648d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/883648d582a9a913e455e2a06d51a213b007d332))
* **dashboard:** LSP tab — language server status, symbol explorer, diagnostics ([bd1d2fb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bd1d2fb66259e9ab65b4993fb65ac5dd4c38620d))

## [5.13.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.12.0...mcp-graph-v5.13.0) (2026-03-27)


### Features

* **siebel:** Sprint 8 Dashboard — expose all 19 API endpoints in UI ([0f1170a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0f1170ab57e3c71a0d75a2be152c66bb08ba7687))

## [5.12.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.11.0...mcp-graph-v5.12.0) (2026-03-27)


### Features

* **lsp:** Multi-language LSP integration ([42ad8ad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42ad8ada67eda547303b8b2adb21d52d8203835e))
* **lsp:** Multi-language LSP integration — code intelligence via Language Server Protocol ([bfa5f35](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bfa5f358d488eecdf04f4e1790952363517f9954))

## [5.11.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.10.0...mcp-graph-v5.11.0) (2026-03-27)


### Features

* **siebel:** Sprint 1 Foundation — expand SIF parser + 6 new core modules ([89573c5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/89573c5a3389c5be95abc6212b78c8d7a5bd8860))
* **siebel:** Sprint 2 Intelligence — eScript indexing, WSDL knowledge, health check ([96009c2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/96009c2aecd45438a53bc59d4a7dda8ef4a2460d))
* **siebel:** Sprint 3 Analysis + Knowledge — 7 new analysis modules ([205248b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/205248b65cef507aefaaf74302fe2604cc8d9288))
* **siebel:** Sprint 4 Generation & Validation — 7 new modules for scaffolding, cloning, diff, validation ([09acbb3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/09acbb3744ac45e777231e8cfeb28496850a29d1))
* **siebel:** Sprint 5 Automation & Quality — 4 new modules for auto-wiring, refactoring, code review, migration ([3537993](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3537993c5388581542015e63477b546a85d203ea))
* **siebel:** Sprint 6 Completion — field suggestion, troubleshooting, integration tests, WSDL→SIF ([e0d7bbc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e0d7bbcea51d3e67a7c3cb80a85cf37f45f50ddc))
* **siebel:** Sprint 7 Final — skills, knowledge, dashboard, lifecycle gates ([08c2721](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/08c272129e0a787f9a058bfa96e4105c5162db79))

## [5.10.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.9.1...mcp-graph-v5.10.0) (2026-03-26)


### Features

* **dashboard:** redesign with sidebar navigation, modern UI, and responsive layout ([b827410](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b827410ce1f1a919074cf02560ecdeea5f8ec533))

## [5.9.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.9.0...mcp-graph-v5.9.1) (2026-03-26)


### Bug Fixes

* improve entity mention cleanup on deletion and enhance edge case handling for corrupted rows ([2ab984d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2ab984d7725b8c487fe5ac964fc2fcae044a8fa6))
* multi-project node indexing and knowledge cleanup ordering ([5a08945](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5a08945692fbb19065c28c20f52dd2948ade2071))
* optimize node indexing by capturing existing IDs before merge ([31ec23d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/31ec23d208d46631f3cd631b4215064e15ea36e7))

## [5.9.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.8.0...mcp-graph-v5.9.0) (2026-03-25)


### Features

* add Knowledge Graph entity extraction and graph-based RAG retrieval ([3405949](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/340594923d19d3957ed8e9bf6de6647b91305ce9))
* close RAG indexing gaps — graph nodes, code symbols, skills, clone, import ([7cab61c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7cab61c8ad75858fbed766510230ee6a22a7b87b))
* integrate Knowledge Graph entity indexing into all MCP tools and data sources ([0cae6ae](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0cae6aee6a8d06ad502919cb541665f899727f24))
* merge Knowledge Graph entity extraction and graph-based RAG retrieval ([bd7e419](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bd7e419741867045309c405cdeb627b2325298cd))


### Bug Fixes

* remove unused makeEdge import to pass CI lint ([4b30d6b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4b30d6b6f8fa6bca5542caddb83048355aabf10e))

## [5.8.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.7.0...mcp-graph-v5.8.0) (2026-03-25)


### Features

* integrate RAG pipeline modules into production code path ([d956fd8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d956fd8e0c39f1a59d8fc3414fa7aab313acf478))

## [5.7.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.6.1...mcp-graph-v5.7.0) (2026-03-25)


### Features

* add import_graph MCP tool for collaborative graph merging ([9d6ac4c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9d6ac4c2a477b5473093821d5a39dcc917c62bb6))
* implement end-to-end RAG architecture with 8 new pipeline modules ([6da39a0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6da39a0d48b1ad68055a6a694ddcf1e0ba97f741))
* merge import_graph MCP tool for collaborative graph merging ([44f5bd0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/44f5bd0edfe8102d1db71131f601c3f02bb2dbf0))
* merge RAG architecture with 8 new pipeline modules ([dcf3634](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dcf3634240a8fb515706443329e7bdafb2c46e83))


### Bug Fixes

* resolve lint errors from RAG architecture merge ([abbb715](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/abbb715b051e67027176d29b361010ba21c2b4cd))

## [5.6.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.6.0...mcp-graph-v5.6.1) (2026-03-24)


### Bug Fixes

* code graph indexing returns 0 symbols when typescript unavailable ([b69f69e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b69f69eaf67e5032e88e21fb07091d262d5b4f7f))

## [5.6.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.5.3...mcp-graph-v5.6.0) (2026-03-23)


### Features

* add journey MCP tool and RAG knowledge indexer ([be09f8a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/be09f8a55d65980ea7041a850994338520309057))
* add Journey tab for website screen mapping with React Flow ([52e7613](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/52e761382e0a4b0712a91b8fc26729e184ce0d55))
* add journey tests (store + API completeness) and update docs ([9ace186](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9ace1863d013d0b3ef7c844af9aaf4c2e6abc207))
* add knowledge quality engine with scoring, decay, and usage tracking (Phases 1-2) ([489f772](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/489f772344f302a3662314d7358c1e988225856f))
* add red Beta badge to Journey tab in navigation ([1798bc8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1798bc848a45f56a4142420916f6f50b964c446d))
* add Siebel CRM 15 integration with SIF parser, Composer automation, and 6 MCP tools ([65356cc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/65356cc62bb516edf4b4a22113ed0811898aec39))
* add SIF generation pipeline with RAG context, dashboard Siebel tab (Beta), and 4 new API endpoints ([f12ffb4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f12ffb4de8508d1a6d79681628fe3912260dd430))
* add Swagger/WSDL parser, DOC/DOCX parser, and import docs MCP tool (Phase 3B) ([c46d7e6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c46d7e61afa0dfd872ffb507a7812aea3f14fb48))
* auto-capture knowledge from AI decisions, validations, and code analysis (Phase 3) ([ab8c353](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ab8c353e1bd1df52758ca19d51d7ffa4cbda3cae))
* content-type-aware smart chunking for RAG pipeline (Phase 4) ([f8499e3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f8499e329bd968cd2086bbb9ab5ae23ea24b05e8))
* cross-source knowledge linking via shared nodeId and tags (Phase 5) ([f9a1749](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f9a174971127542aac7e49a9d8f8f4eaec98e3eb))
* incremental embedding updates and multi-strategy retrieval (Phases 6-7) ([65e42d9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/65e42d9be799febb44114d4c8a79cb6733f78194))
* knowledge feedback loop and enhanced MCP tools (Phase 8) ([ad8360a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ad8360a2ac33cf2b24cbbb3a387dacf2ab937e62))
* multi-strategy retrieval with RRF fusion and source diversity (Phase 6) ([6d2adcb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6d2adcb26ce3010235008ef3077efdf08c53b3e6))
* self-learning knowledge synthesizer for pattern detection (Phase 5B) ([288d958](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/288d958ca09b3aeffe644f8847683fda2b2876c9))


### Bug Fixes

* lint errors — remove unused imports, use const for non-reassigned vars ([42b2419](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42b24198d6fd366a671544674a144bdd339fa24e))
* polish Siebel integration gaps for master readiness ([aead8c6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/aead8c6304da57b541beddf82c214a2f39203ba8))

## [5.6.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.5.3...mcp-graph-v5.6.0) (2026-03-23)


### Features

* add journey MCP tool and RAG knowledge indexer ([be09f8a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/be09f8a55d65980ea7041a850994338520309057))
* add Journey tab for website screen mapping with React Flow ([52e7613](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/52e761382e0a4b0712a91b8fc26729e184ce0d55))
* add journey tests (store + API completeness) and update docs ([9ace186](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9ace1863d013d0b3ef7c844af9aaf4c2e6abc207))
* add knowledge quality engine with scoring, decay, and usage tracking (Phases 1-2) ([489f772](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/489f772344f302a3662314d7358c1e988225856f))
* add red Beta badge to Journey tab in navigation ([1798bc8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1798bc848a45f56a4142420916f6f50b964c446d))
* add Siebel CRM 15 integration with SIF parser, Composer automation, and 6 MCP tools ([65356cc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/65356cc62bb516edf4b4a22113ed0811898aec39))
* add SIF generation pipeline with RAG context, dashboard Siebel tab (Beta), and 4 new API endpoints ([f12ffb4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f12ffb4de8508d1a6d79681628fe3912260dd430))
* add Swagger/WSDL parser, DOC/DOCX parser, and import docs MCP tool (Phase 3B) ([c46d7e6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c46d7e61afa0dfd872ffb507a7812aea3f14fb48))
* auto-capture knowledge from AI decisions, validations, and code analysis (Phase 3) ([ab8c353](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ab8c353e1bd1df52758ca19d51d7ffa4cbda3cae))
* content-type-aware smart chunking for RAG pipeline (Phase 4) ([f8499e3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f8499e329bd968cd2086bbb9ab5ae23ea24b05e8))
* cross-source knowledge linking via shared nodeId and tags (Phase 5) ([f9a1749](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f9a174971127542aac7e49a9d8f8f4eaec98e3eb))
* incremental embedding updates and multi-strategy retrieval (Phases 6-7) ([65e42d9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/65e42d9be799febb44114d4c8a79cb6733f78194))
* knowledge feedback loop and enhanced MCP tools (Phase 8) ([ad8360a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ad8360a2ac33cf2b24cbbb3a387dacf2ab937e62))
* multi-strategy retrieval with RRF fusion and source diversity (Phase 6) ([6d2adcb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6d2adcb26ce3010235008ef3077efdf08c53b3e6))
* self-learning knowledge synthesizer for pattern detection (Phase 5B) ([288d958](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/288d958ca09b3aeffe644f8847683fda2b2876c9))


### Bug Fixes

* lint errors — remove unused imports, use const for non-reassigned vars ([42b2419](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42b24198d6fd366a671544674a144bdd339fa24e))
* polish Siebel integration gaps for master readiness ([aead8c6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/aead8c6304da57b541beddf82c214a2f39203ba8))

## [5.5.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.5.2...mcp-graph-v5.5.3) (2026-03-20)


### Bug Fixes

* resolve 29 parser, graph, lifecycle and algorithm bugs (BUG-01 to BUG-29) ([e522ede](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e522ede4e101c6bdfdc7e5b011b0ab120c9a9021))

## [5.5.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.5.1...mcp-graph-v5.5.2) (2026-03-20)


### Bug Fixes

* resolve 20 analysis and data integrity bugs (BUG-01 to BUG-20) ([6cfe16f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6cfe16fbe032e24af3e8e4bc81451da9c9e93cfb))
* resolve 8 analysis module bugs (BUG-21 to BUG-29) ([6af0edb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6af0edbf576684eaf95b9a8c400bab3f48663373))

## [5.5.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.5.0...mcp-graph-v5.5.1) (2026-03-20)


### Bug Fixes

* update documentation for 5.5.0 release (tool consolidation, hierarchy) ([89ba0d9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/89ba0d92b6af3f3ba560367f15349f9fd26726ba))

## [5.5.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.4.0...mcp-graph-v5.5.0) (2026-03-20)


### Features

* **code:** improve ts-analyzer resilience and init-project robustness ([146ea54](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/146ea540005ba01498525c17f0d1ff00078521a3))
* **graph:** fix hierarchy and relationships in PRD import and graph operations ([6da62a6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6da62a68b13999ae6a501b6e3bb9bdfb46fa0779))
* **tools:** consolidate node and validate tools with deprecation shim ([912a560](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/912a5601f6e2d74f9b11a28d96ba8bcf969e9a6e))


### Bug Fixes

* remove unused variables to pass lint ([eeb4726](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eeb4726de0e9a01836c36fed570bdc6794bab852))

## [5.4.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.3.0...mcp-graph-v5.4.0) (2026-03-18)


### Features

* **dashboard:** add skills management UI, context budget tab, and modals ([fe10580](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fe10580c0015f7c6979b9b2b9ab093b97810a0fa))
* **skills:** add custom skill CRUD, preferences, and self-healing listener ([3f58c02](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3f58c02e7e983fa58df804b4d69fc9ceb219799e))

## [5.3.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.2.0...mcp-graph-v5.3.0) (2026-03-18)


### Features

* add built-in skills system with list_skills tool ([b433038](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b4330380fbb87bb45dc9533e457e66fa765b2e93))
* add Insights dashboard with health score and bottleneck detection ([9a17e72](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9a17e72de71a47a32d307bb7919c3a5fc5f2b85a))
* add layered context compression and tool token tracking ([fd8bc68](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fd8bc68255fc0752fe31ac3c3d9fbe698ed75127))
* add native Code Intelligence engine with AST analysis and impact tracking ([90c2bbe](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/90c2bbe27a89a1d7b51f89ee12fdd424f3f85051))
* add native memory system replacing Serena MCP ([7709301](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/77093017eb598cec109b5c790c77c1993a7de16c))
* **dashboard:** Add Skills tab with token estimation ([ed1e67c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ed1e67c736041db80fe4edfdb62f8b1dda4bfd43))
* remove GitNexus MCP in favor of native Code Intelligence ([0fc8371](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fc8371d72ba7923158c7c691c12ee50e6307d27))
* update dashboard with project enhancements and new components ([3f0e565](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3f0e5654e623c61f23155a8f354398a313240d14))


### Bug Fixes

* Resolve CI failures for graphology dep and Windows path separators ([f39118c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f39118c79c84bb53fbc0922af331e66e29170f93))
* resolve lint errors in code intelligence and insights modules ([66601d3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66601d3a74a155f3e9c18cb216962c1d501a1dbd))
* **test:** resolve flaky gitnexus basePath tracking test in CI ([5e9f44c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5e9f44c702c642becb299ed7fe57b35d684e5852))

## [5.2.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.5...mcp-graph-v5.2.0) (2026-03-17)


### Features

* add phase-aware knowledge mesh across lifecycle phases ([3535f0f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3535f0f03c1d5567b1a50cfba1fac2f29de16789))
* add phase-aware knowledge mesh across lifecycle phases ([256030e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/256030e4715e5d3bde9dd64f99c3868d0c0f6aa7))
* enrich lifecycle gates VALIDATE, REVIEW, HANDOFF, LISTENING with composite checks ([c52a914](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c52a914e67d702b713c8e742a6b533f1bdbe8891))

## [5.1.5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.4...mcp-graph-v5.1.5) (2026-03-17)


### Bug Fixes

* default lifecycle strictness mode to strict instead of advisory ([fd87bd4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fd87bd47890ab1dacde9373cdccb2ec4c3951267))
* GitNexus tracks active project basePath instead of always using mcp-graph cwd ([bd58f9f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bd58f9fdfa0534cf2eb83a03a8a44a0b57c5a2ba))
* remove unused imports flagged by lint (GraphEdge, vi) ([73f0b4d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/73f0b4de5ceb859c8909520cf63d6011113dba80))

## [5.1.4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.3...mcp-graph-v5.1.4) (2026-03-16)


### Bug Fixes

* auto-merge any pending release PR regardless of release-please output ([5e190a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5e190a85509b1f3d32b0d830600fbdb62f92fb44))
* use PAT for release PR auto-merge to trigger publish workflow ([b6d9aa2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b6d9aa226240c922a7cabe881c873eb4704edc4b))
* use PAT for release-please action to create releases with branch protection ([6640192](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6640192500fa469490bf1e6715cba572afa25cda))

## [5.1.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.2...mcp-graph-v5.1.3) (2026-03-16)


### Bug Fixes

* add checkout step before gh pr merge in release workflow ([4e3aeac](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4e3aeac57920f8ee4adcc7d0db91362a9af4d7ec))
* extract PR number from release-please JSON output ([759d985](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/759d985e1ab06415e6d049cce919422fa862b4c2))
* fallback to direct merge when no branch protection rules exist ([472eeb6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/472eeb6c310ffa7f925cb72ae747c9d3bcdf2008))
* replace non-null assertion with explicit guard in docs-cache-store ([f7a1d86](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f7a1d8694fb6e557e4819a5a8e343f6cd8a2c2d1))

## [5.1.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.1...mcp-graph-v5.1.2) (2026-03-16)


### Bug Fixes

* increase doctor-checks test timeouts for slow CI runners ([e7a7b48](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e7a7b482f034653d740981650a9ae9261e49c5d0))

## [5.1.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.0...mcp-graph-v5.1.1) (2026-03-16)


### Bug Fixes

* relax findNextTask benchmark threshold for slow CI runners ([4184f11](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4184f11574a3397c5a937e35e9319dc73e00fca9))

## [5.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.5...mcp-graph-v5.1.0) (2026-03-16)


### Features

* add `mcp-graph doctor` command and lifecycle MCP agent suggestions ([13b31b4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/13b31b499424d8a44461a02543e9553cf6dfc86a))


### Bug Fixes

* make doctor and tool-status tests cross-platform (Windows CI) ([8c786c1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8c786c1048c84a3bcfd8f79cbe534036f2b5a01b))

## [5.0.5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.4...mcp-graph-v5.0.5) (2026-03-16)


### Bug Fixes

* correct token savings calculation in benchmark ([1f94e56](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1f94e565f52eaef6c2d5d523a1e9fa3bad296190))

## [5.0.4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.3...mcp-graph-v5.0.4) (2026-03-15)


### Bug Fixes

* allow dashboard to swap project DB at runtime via Open Folder ([#31](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/31)) ([a4d4ea7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a4d4ea795a699eb09aa6545ec8cb834ec6f3cd67))

## [5.0.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.2...mcp-graph-v5.0.3) (2026-03-15)


### Bug Fixes

* reset release manifest to re-trigger 5.0.3 publish ([6358944](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6358944bb542c3e1ef47dbeac26141a8938522f1))
* sanitize all color paths in GitNexus nodeReducer and clean stale dashboard bundles ([ea95fc4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea95fc43451adcfdc64f341612a28aeb7958a889))

## [5.0.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.2...mcp-graph-v5.0.3) (2026-03-15)


### Bug Fixes

* sanitize all color paths in GitNexus nodeReducer and clean stale dashboard bundles ([ea95fc4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea95fc43451adcfdc64f341612a28aeb7958a889))

## [5.0.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.1...mcp-graph-v5.0.2) (2026-03-15)


### Bug Fixes

* resolve favicon 404 and GitNexus tab invalid canvas color ([31844a0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/31844a010d841376e2495bdbdbdba1f913f94cae))

## [5.0.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.0...mcp-graph-v5.0.1) (2026-03-15)


### Bug Fixes

* prevent GitNexus tab blank screen on node click in Safari ([0d734a0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0d734a0cc86c9267ac866412dca76abeebe20c29))
* prevent GitNexus tab blank screen on node click in Safari ([8056adc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8056adcbc8738477e5558d7ca67a627a5e60632f))

## [5.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.4.0...mcp-graph-v5.0.0) (2026-03-14)


### ⚠ BREAKING CHANGES

* Package renamed from @diegonogueiradev_/mcp-graph to @mcp-graph-workflow/mcp-graph. Version bumped to 3.0.0.

### Features

* add lifecycle management to MCP tools and enhance project handling in dashboard ([67870b0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/67870b01536991f7d42b96458366a7e517034255))
* add npm publish job to release workflow ([dbaaa39](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dbaaa39230ba9995b08ef35d0373aa5b073cd1a1))
* add real-time logs tab to dashboard ([#15](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/15)) ([345fa20](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/345fa20ffc3db812bfeb81d93d5fbd5ef5302194))
* add update notifier for CLI users ([f3a27a5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f3a27a5a0ec5abf98df0093b1c8d25d874ade115))
* auto-open dashboard in browser when MCP starts via stdio ([ed7fcf0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ed7fcf04d600354fe649d1a2caaaaa55f0792926))
* automate releases with release-please ([8748a8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8748a8c2d08d99902a8e07bcadba6c791b123bc2))
* CI security pipeline, ESLint + security plugin, code quality ([#10](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/10)) ([742490a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/742490afdae5c0f9116ce18d3295abea2fbee376))
* **cli:** improve stdio detection and update docs ([e5f15ba](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e5f15ba96e78285866971bba4ff323cad39b5413))
* consolidate MCP tools (31→26), fix RAG budget, add Benchmark tab & API ([cb78bbc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cb78bbce6b59826139ca9f39678a24cee0bd0fc1))
* cross-platform support, logger instrumentation, and dashboard tab refactor ([66dcb75](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66dcb759632201e92bd75c36a1dd5ace0b071916))
* **dashboard:** add GitNexus on-demand activation and edge relationship management ([656124a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/656124a0d6aa3cbdbd8996ff41700f1e1385cff0))
* **dashboard:** GitNexus on-demand + edge relationships ([9597fde](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9597fde1fd0855929845390d3c0246df52ac114f))
* enhance code graph tab with symbol exploration and impact analysis ([3534c41](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3534c41e40fdc055d680435c97fb93ca756c5204))
* enhance lifecycle system with HANDOFF/LISTENING auto-detection, warnings, and phase override ([29053e1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/29053e18ad97d0acd773e8761f257552cd177b67))
* fix multi-project isolation and add parte-3 notebook (scenarios 25-35) ([8986a43](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8986a431b46aaf739ad0be53315c732631a0fda0))
* migrate npm scope from [@diegonogueiradev](https://github.com/diegonogueiradev)_ to [@mcp-graph-workflow](https://github.com/mcp-graph-workflow) ([efa9d9a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/efa9d9a7f5c203be8fc05320a58b40dd533ba942))
* **tests:** add 12 E2E benchmark scenarios with Playwright MCP (cenários 13-24) ([58d5c0f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/58d5c0f8dfe007882023111c0684107ad29e8559))
* **tests:** enhance e2e tests for import modal, PRD backlog, and SSE events ([46a901c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/46a901c028f34dcb3a705e4ffc710b0628d1ddcc))
* update .claudeignore to include additional build and test artifacts ([7e54ccc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7e54ccc95ca5c2a3d0a4175c7b365b267064fa63))


### Bug Fixes

* drop Node 18 from CI matrix (Tailwind v4 requires Node &gt;= 20) ([3bf5eda](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3bf5eda964f429bbc535355f13d26a1ca1f3f1c6))
* **gitnexus:** cross-platform binary resolution and query proxy ([f79cc1e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f79cc1edd4339ea5189363f40f3f3dea41993200))
* platform tests use vi.resetModules for cross-platform support ([f279342](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f279342c2460cc153bb1189b0b27ef8de1948212))
* prevent data loss + auto-open dashboard on MCP start ([19ea018](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/19ea018b4f793a419cef9cfb56a84e7d5fc0cdad))
* prevent initProject from creating duplicate projects ([50bd7a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/50bd7a80cfdc2b0f35d83de5aeab1f78931f783b))
* remove npm test from prepublishOnly to unblock publish ([dc4797b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dc4797b05cc1ef53dd9fd401f6d61244b865623f))
* update CI workflow trigger from main to master ([c29fed9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c29fed985e3db15391d9f212ef09b8d6348dd086))
* update npm and node badges to correct scope ([1bf3404](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1bf3404a0b189add3ce9347aa13f41f81fefcf82))
* update undici to patch high severity vulnerabilities ([#24](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/24)) ([ea43ff6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea43ff68d91f6f73651bad259d37715a7de36ef1))
* use cross-platform copy-dashboard script for Windows CI ([c2792e5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c2792e540e712f077d208aaa4145b74b0168fd4c))
* use relative path in Serena MCP server config ([#19](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/19)) ([0fc62f0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fc62f076bb81091f29f14c3c4b9c7ed5b45bcde))


### Performance

* optimize dashboard tab switching and reduce DOM overhead ([86e3ae2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/86e3ae21642d539c34a265a54ee3f481ad9bf601))

## [4.4.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.3.1...mcp-graph-v4.4.0) (2026-03-14)


### Features

* auto-open dashboard in browser when MCP starts via stdio ([ed7fcf0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ed7fcf04d600354fe649d1a2caaaaa55f0792926))


### Bug Fixes

* prevent data loss + auto-open dashboard on MCP start ([19ea018](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/19ea018b4f793a419cef9cfb56a84e7d5fc0cdad))
* prevent initProject from creating duplicate projects ([50bd7a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/50bd7a80cfdc2b0f35d83de5aeab1f78931f783b))

## [4.3.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.3.0...mcp-graph-v4.3.1) (2026-03-12)


### Bug Fixes

* use relative path in Serena MCP server config ([#19](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/19)) ([0fc62f0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fc62f076bb81091f29f14c3c4b9c7ed5b45bcde))

## [4.3.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.2.0...mcp-graph-v4.3.0) (2026-03-12)


### Features

* enhance lifecycle system with HANDOFF/LISTENING auto-detection, warnings, and phase override ([29053e1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/29053e18ad97d0acd773e8761f257552cd177b67))

## [4.2.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.1.0...mcp-graph-v4.2.0) (2026-03-11)


### Features

* add real-time logs tab to dashboard ([#15](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/15)) ([345fa20](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/345fa20ffc3db812bfeb81d93d5fbd5ef5302194))

## [4.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.0.0...mcp-graph-v4.1.0) (2026-03-11)


### Features

* CI security pipeline, ESLint + security plugin, code quality ([#10](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/10)) ([742490a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/742490afdae5c0f9116ce18d3295abea2fbee376))


### Bug Fixes

* platform tests use vi.resetModules for cross-platform support ([f279342](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f279342c2460cc153bb1189b0b27ef8de1948212))
* update npm and node badges to correct scope ([1bf3404](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1bf3404a0b189add3ce9347aa13f41f81fefcf82))
* use cross-platform copy-dashboard script for Windows CI ([c2792e5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c2792e540e712f077d208aaa4145b74b0168fd4c))

## [4.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v3.0.0...mcp-graph-v4.0.0) (2026-03-11)


### ⚠ BREAKING CHANGES

* Package renamed from @diegonogueiradev_/mcp-graph to @mcp-graph-workflow/mcp-graph. Version bumped to 3.0.0.

### Features

* add lifecycle management to MCP tools and enhance project handling in dashboard ([67870b0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/67870b01536991f7d42b96458366a7e517034255))
* add npm publish job to release workflow ([dbaaa39](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dbaaa39230ba9995b08ef35d0373aa5b073cd1a1))
* add update notifier for CLI users ([f3a27a5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f3a27a5a0ec5abf98df0093b1c8d25d874ade115))
* automate releases with release-please ([8748a8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8748a8c2d08d99902a8e07bcadba6c791b123bc2))
* **cli:** improve stdio detection and update docs ([e5f15ba](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e5f15ba96e78285866971bba4ff323cad39b5413))
* consolidate MCP tools (31→26), fix RAG budget, add Benchmark tab & API ([cb78bbc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cb78bbce6b59826139ca9f39678a24cee0bd0fc1))
* cross-platform support, logger instrumentation, and dashboard tab refactor ([66dcb75](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66dcb759632201e92bd75c36a1dd5ace0b071916))
* **dashboard:** add GitNexus on-demand activation and edge relationship management ([656124a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/656124a0d6aa3cbdbd8996ff41700f1e1385cff0))
* **dashboard:** GitNexus on-demand + edge relationships ([9597fde](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9597fde1fd0855929845390d3c0246df52ac114f))
* enhance code graph tab with symbol exploration and impact analysis ([3534c41](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3534c41e40fdc055d680435c97fb93ca756c5204))
* fix multi-project isolation and add parte-3 notebook (scenarios 25-35) ([8986a43](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8986a431b46aaf739ad0be53315c732631a0fda0))
* migrate npm scope from [@diegonogueiradev](https://github.com/diegonogueiradev)_ to [@mcp-graph-workflow](https://github.com/mcp-graph-workflow) ([efa9d9a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/efa9d9a7f5c203be8fc05320a58b40dd533ba942))
* **tests:** add 12 E2E benchmark scenarios with Playwright MCP (cenários 13-24) ([58d5c0f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/58d5c0f8dfe007882023111c0684107ad29e8559))
* **tests:** enhance e2e tests for import modal, PRD backlog, and SSE events ([46a901c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/46a901c028f34dcb3a705e4ffc710b0628d1ddcc))
* update .claudeignore to include additional build and test artifacts ([7e54ccc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7e54ccc95ca5c2a3d0a4175c7b365b267064fa63))


### Bug Fixes

* drop Node 18 from CI matrix (Tailwind v4 requires Node &gt;= 20) ([3bf5eda](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3bf5eda964f429bbc535355f13d26a1ca1f3f1c6))
* **gitnexus:** cross-platform binary resolution and query proxy ([f79cc1e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f79cc1edd4339ea5189363f40f3f3dea41993200))
* remove npm test from prepublishOnly to unblock publish ([dc4797b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dc4797b05cc1ef53dd9fd401f6d61244b865623f))
* update CI workflow trigger from main to master ([c29fed9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c29fed985e3db15391d9f212ef09b8d6348dd086))


### Performance

* optimize dashboard tab switching and reduce DOM overhead ([86e3ae2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/86e3ae21642d539c34a265a54ee3f481ad9bf601))

## [Unreleased]

### Added
- Benchmark tab no dashboard com métricas de token economy
- `GET /api/v1/benchmark` endpoint na REST API
- Testes unitários para `graph-utils.ts` (24 testes: toFlowNodes, toFlowEdges, computeLayoutKey, shouldSkipLayout)
- Testes E2E de performance dos filtros do Graph tab (`graph-filters-perf.spec.ts`)
- GitNexus auto-analyze on startup (detecta `.git/`, indexa codebase, inicia serve)
- Configuração `gitnexusAutoStart` e variável de ambiente `GITNEXUS_AUTO_START`

### Changed
- MCP tools consolidados de 31 → 26 (edge, snapshot, export como multi-action)
- Dashboard Graph tab: `useDeferredValue` para filtros, `computeLayoutKey` (hash numérico), `shouldSkipLayout` (skip Dagre), ReactFlow `nodesDraggable=false`/`nodesConnectable=false`
- Dashboard PRD & Backlog tab: ReactFlow read-only props
- Dashboard node table: paginação (50/page)
- Testes E2E atualizados para seletores React (substituídos #mermaid-output, #btn-apply-filters, etc.)

### Fixed
- RAG budget enforcement: hard cap via `Math.min` em `ragBuildContext`
- Layout cache key: hash numérico em vez de string concatenation (evita alocação de strings grandes)

## [2.1.0] - 2026-03-09

### Added

- All 8 edge types fully active: `related_to`, `implements`, `derived_from`, `parent_of`, `child_of`, `priority_over` integrated across context builder, planner, and bottleneck detector
- CI/CD workflows (GitHub Actions) for build, test, lint, and release
- Issue and PR templates for structured community contributions
- Security policy (SECURITY.md)
- README badges (CI status, npm version, Node.js, license, TypeScript, PRs welcome)

### Changed

- CONTRIBUTING.md rewritten for code contributions (TDD, development workflow, code standards)
- CHANGELOG.md updated with full version history

## [2.0.1] - 2026-03-07

### Fixed

- Add missing shebang (`#!/usr/bin/env node`) to mcp-graph-server entry point

## [2.0.0] - 2026-03-06

### Added

- Web dashboard with 5 tabs (Graph, PRD & Backlog, Code Graph, Knowledge, Insights)
- REST API with Express (full CRUD + search + import + insights)
- SSE real-time event bus
- Configuration schema and loader
- Docs cache syncer
- FTS5 + TF-IDF search with reranking
- Bottleneck detection and metrics insights
- Dashboard build via Vite
- 54 tests with shared factory infrastructure covering LIFECYCLE phases
- Snapshot create/restore/list functionality
- Bulk status update, node clone, node move operations
- Velocity and dependency analysis tools
- Mermaid export (flowchart and mindmap)
- Graph export as JSON

### Changed

- **Breaking:** Project directory paths updated in configuration and README
- Test infrastructure rewritten with shared factories (breaking test compatibility)

### Fixed

- Project directory paths in configuration

## [1.0.0] - 2026-03-05

### Added

- MCP server with HTTP and Stdio transports
- 10 MCP tools: init, import_prd, list, show, next, update_status, update_node, delete_node, stats, context
- PRD parser pipeline: normalize, segment, classify, extract
- PRD to graph conversion with 5 passes (nodes, hierarchy, constraints, priority, dependency inference)
- SQLite persistence with WAL mode, migrations, and snapshots
- Next-task routing engine with 5-criteria sort (priority, blocked, xpSize, estimate, createdAt)
- Compact context builder with token reduction metrics (70-85% reduction)
- Node management: add, clone, move, delete, export
- Snapshot listing and restore functionality
- Initialization command with MCP config generation (.mcp.json, .vscode/mcp.json)
- Zod v4 validation schemas for nodes and edges
- 6 test suites with ~60+ assertions (Vitest)
- Full TypeScript strict mode with ESM modules

### Fixed

- Transitive blockers detection optimized to avoid redundant visits
- Package name updated in init command to include npm scope
