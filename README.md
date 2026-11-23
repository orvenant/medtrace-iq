# MedTrace IQ — FDA 21 CFR 820 & ISO 13485 Regulatory Context Engine for Atlassian

> **Codegeist 2026: "Build with context. Ship with confidence."**
> **Category:** Apps for Specialized Industries (Healthcare, MedTech & Life Sciences)
> **Bonus Integrations:** Rovo Agent + Reusable Rovo Skills (`rovo:agent`, `rovo:skill`) · Atlassian Rovo MCP (`rovo:mcp` + `SKILL.md`) · Atlassian Teamwork Graph Curated Queries (`requestTeamworkGraph`) · Atlassian Marketplace Free Listing

---

## Why MedTrace IQ?

Medical device, diagnostics, and biotech teams manage design controls in **Jira**, Standard Operating Procedures (SOPs) and Design History Files (DHFs) in **Confluence**, and field quality issues in **Jira Service Management**. Yet releases still stall—or fail FDA audits—because critical regulatory context is fragmented across silos:

- An engineer updates infusion-pump firmware in Jira without seeing that a **live US FDA Class I recall** just hit the same occlusion failure mode.
- A change alters a safety parameter without notifying the real Confluence SOP owner discovered via **Atlassian Teamwork Graph**.
- Auditors ask for Design History File (DHF) traceability and QA sign-off proof, triggering weeks of manual spreadsheet assembly.

**MedTrace IQ** unifies **Jira**, **Atlassian Teamwork Graph**, **Rovo Agents & Skills**, **Rovo MCP**, and **live US openFDA Medical Device Enforcement data** into a single zero-setup Forge cockpit—so MedTech teams truly **build with context and ship with confidence**.

---

## Key Capabilities

### 1. Ship-Confidence Engine (5-Pillar FDA 21 CFR 820 / ISO 13485 / ISO 14971 Scoring)
Every Jira work item is scored deterministically from **0 to 100** across 5 regulatory pillars:
1. **Design Controls (25 pts)** — Specification completeness & medical device subsystem classification
2. **Verification & Validation (25 pts)** — ISO 13485 V&V checklist, ISO 14971 risk review & linked PR/Deployment artifacts from Teamwork Graph
3. **SOP & Organizational Context (20 pts)** — Linked Confluence SOP owners, Atlassian Teams, and Goals surfaced via Teamwork Graph
4. **Live openFDA Recall Clearance (20 pts)** — Real-time screening against `https://api.fda.gov/device/enforcement.json` (unmitigated Class I parallel triggers an automatic **Regulatory Hold**)
5. **Formal QA Regulatory Sign-Off (10 pts)** — Immutable sign-off entries stored in Forge Storage (`@forge/kvs`) and written back as structured Jira audit comments

### 2. Interactive Context & Blast-Radius Graph (`jira:projectPage`)
Visualizes the live project topology across Jira design controls, CAPA tickets, Atlassian Teamwork Graph Teams/Goals/Confluence SOPs, and matched openFDA Class I/II/III recalls—with a click-to-inspect provenance panel and 1-click CAPA creation.

### 3. Contextual Issue Guardrail Panel (`jira:issuePanel`)
Lives directly inside every Jira ticket: displays radial Ship-Confidence gauge, 5-pillar breakdown, interactive ISO 13485 checklist toggles persisted to Forge KVS, live Teamwork Graph chips, matched openFDA recalls, 1-click QA Sign-Off, 1-click Linked CAPA creation, and 1-click launch of **MedTrace Compliance Copilot** via `@forge/bridge` `rovo.open()`.

### 4. Rovo Agent + 3 Reusable Skills (`rovo:agent` + `rovo:skill` + `action`)
**MedTrace Compliance Copilot** bundles 3 modular `rovo:skill` playbooks (complete with regulatory reference guides in `references/`) and 6 executable Forge actions:
- `fda-recall-impact` — Correlates live openFDA recalls with Jira work items and Teamwork Graph context
- `capa-triage` — Classifies nonconformances under FDA 21 CFR 820.100 and files linked Jira CAPAs
- `dhf-audit-check` — Runs project-wide Design History File release readiness audits

### 5. Atlassian Rovo MCP Server (`rovo:mcp` + Open-Source `SKILL.md`)
Exposes all 6 MedTrace IQ regulatory tools to both **Rovo Studio** and external MCP-compatible AI coding agents (Claude Code, Cursor, Antigravity, VS Code) via:
```
https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c
```
Pair with the included [SKILL.md](./SKILL.md) to run automated FDA/ISO pre-merge release gates directly inside your IDE.

### 6. Live Atlassian Teamwork Graph Integration
Executes typed **Teamwork Graph Curated Queries** via `api.asUser().requestTeamworkGraph`:
- `echo` (connectivity check)
- `atlassianTeamsBySpace`, `atlassianUserInTeams`
- `jiraSpaceWorkItems`, `jiraWorkItemGoals`, `jiraWorkItemComments`, `jiraWorkItemDevelopmentArtifacts`, `jiraWorkItemHierarchy`
- `atlassianUserContent`, `atlassianUserGoalsAndProjects`, `confluencePageLinkedConfluencePages`

### 7. 1-Click Judge Demo Seeder & DHF Audit Pack Export
Includes a 1-click idempotent **Seed MedTech Demo** button inside the app to populate 6 realistic cardiac pacemaker, infusion pump, ICU ventilator, ablation catheter, CGM, and AED CAPA work items on any Jira site—plus 1-click Markdown DHF Audit Pack export.

---

## Architecture & Privacy ("Runs on Atlassian")
- 100% native Atlassian Forge (`nodejs24.x` ARM64 runtime + `@forge/kvs` + Custom UI React 18).
- Zero customer data or PII ever leaves Atlassian Cloud—openFDA calls strictly pass generic medical device category keywords (e.g. `"infusion pump"`, `"pacemaker"`). See [PRIVACY.md](./PRIVACY.md).

---

## Development & Deployment

```bash
# 1. Install backend & Custom UI dependencies
npm install
cd static/ui && npm install && npm run build && cd ../..

# 2. Run unit tests
npm test

# 3. Validate Forge manifest, Rovo skills, MCP server & scopes
forge lint

# 4. Deploy & install to your Jira Cloud site
forge deploy
forge install --product jira
```

## License
Apache License 2.0 — see [LICENSE](./LICENSE).
