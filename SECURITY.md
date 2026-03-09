# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities by emailing **diegonogueiradev@gmail.com** or use GitHub's [private vulnerability reporting](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/security/advisories/new) feature.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Scope

The following areas are in scope for security reports:

- **SQLite database** — injection, unauthorized access, data corruption
- **File system** — path traversal, unauthorized file access
- **MCP server (HTTP)** — request handling, authentication bypass, injection
- **CLI input** — command injection, argument parsing vulnerabilities

### Response Timeline

- **Acknowledgment** — within 48 hours
- **Assessment** — within 7 days
- **Fix & disclosure** — coordinated with reporter, typically within 30 days

### Coordinated Disclosure

We follow a coordinated disclosure process. Please allow us reasonable time to address the vulnerability before making any public disclosure. We will credit reporters in the release notes (unless anonymity is requested).
