---
name: medtrace-iq-mcp
description: Connect any MCP-compatible AI coding agent (Claude Code, Cursor, Antigravity, VS Code) to MedTrace IQ's Atlassian Forge Rovo MCP server to run FDA 21 CFR 820 & ISO 13485 ship-confidence checks, live openFDA recall screening, Teamwork Graph context lookups, and automated CAPA creation before merging medical device code.
---

# MedTrace IQ — External Agent Skill for Atlassian Rovo MCP

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

## Pre-Merge MedTech Release Gate Workflow
Whenever a developer asks to verify regulatory readiness before opening a pull request or shipping a medical device firmware/software release:

1. Call `analyze-issue-compliance` with the Jira `issueKey` referenced in the branch or PR.
2. Call `query-teamwork-graph-context` with the `issueKey` and `projectKey` to inspect connected Atlassian teams, Confluence SOP pages, goals, and external deployments.
3. If the issue touches a regulated medical subsystem (infusion pump, pacemaker, catheter, ventilator, ECG, CGM, surgical robotics), call `search-fda-recalls` to check for ongoing FDA Class I or Class II recalls matching the subsystem.
4. If the Ship-Confidence score is below 80 or an unmitigated Class I FDA recall is detected:
   - Warn the developer **NOT** to merge until mitigation is logged.
   - Offer to invoke `create-capa-ticket` to file a linked ISO 13485 / FDA 21 CFR 820.100 CAPA in Jira.
5. Once QA reviews and approves verification evidence, invoke `record-regulatory-signoff` to record an immutable audit trail entry.
