---
name: medtrace-iq-mcp
description: Connect any MCP-compatible AI coding agent (Claude Code, Cursor, Antigravity, VS Code) to MedTrace IQ's Atlassian Forge Rovo MCP server (7 regulatory tools) to run FDA 21 CFR 820 & ISO 13485 ship-confidence checks, live openFDA recall screening, Teamwork Graph context lookups, SHA-256 21 CFR Part 11 audit chain verification, and automated CAPA creation before merging medical device code.
---

# MedTrace IQ — External Agent Skill for Atlassian Rovo MCP (v3.0)

## Setup
1. Install **MedTrace IQ** in your Atlassian Jira Cloud site and enable external MCP exposure in **Atlassian Administration → Apps → Sites → Connected apps → MedTrace IQ**.
2. Add your site's MedTrace MCP remote server URL to your AI coding agent's MCP configuration:
   ```json
   {
     "mcpServers": {
       "medtrace-iq": {
         "url": "https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c"
       }
     }
   }
   ```
3. Complete the OAuth 2.1 consent flow when prompted.

## Available MCP Tools (7)
- `get-project-readiness` — Project-wide Ship-Confidence scores, Risk Matrix analytics, and FDA exposure
- `analyze-issue-compliance` — 5-pillar FDA 21 CFR 820 / ISO 13485 compliance audit on a specific Jira issue
- `search-fda-recalls` — Live US openFDA Class I/II/III device enforcement recall search
- `query-teamwork-graph-context` — Live Atlassian Teamwork Graph lookup for Teams, Confluence SOPs, Goals & PRs
- `create-capa-ticket` — Creates a linked ISO 13485 / FDA 21 CFR 820.100 CAPA issue in Jira
- `record-regulatory-signoff` — Appends a SHA-256 hash-chained 21 CFR Part 11 QA sign-off and Jira audit comment
- `verify-audit-chain` — Cryptographically verifies the SHA-256 hash chain integrity of a project's regulatory audit ledger

## Pre-Merge MedTech Release Gate Workflow
Whenever a developer asks to verify regulatory readiness before opening a pull request or shipping a medical device firmware/software release:

1. Call `analyze-issue-compliance` with the Jira `issueKey` referenced in the branch or PR.
2. Call `query-teamwork-graph-context` with the `issueKey` and `projectKey` to inspect connected Atlassian teams, Confluence SOP pages, goals, and external deployments.
3. If the issue touches a regulated medical subsystem (infusion pump, pacemaker, catheter, ventilator, ECG, CGM, surgical robotics), call `search-fda-recalls` to check for ongoing FDA Class I or Class II recalls matching the subsystem.
4. Call `verify-audit-chain` with the `projectKey` to confirm the project's 21 CFR Part 11 SHA-256 electronic audit chain is intact (`valid: true`).
5. If the Ship-Confidence score is below 80 or an unmitigated Class I FDA recall is detected:
   - Warn the developer **NOT** to merge until mitigation is logged (and note that Jira's `MedTrace IQ FDA/ISO Release Gate` workflow validator will physically block release transitions).
   - Offer to invoke `create-capa-ticket` to file a linked ISO 13485 / FDA 21 CFR 820.100 CAPA in Jira.
6. Once QA reviews and approves verification evidence, invoke `record-regulatory-signoff` to append a cryptographically chained 21 CFR Part 11 audit trail entry.
