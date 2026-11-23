# MedTrace IQ — Codegeist 2026 Devpost Submission Package

- **Project Name:** MedTrace IQ
- **Tagline (≤ 60 chars):** FDA/ISO MedTech release context via TWG, Rovo & MCP
- **Primary Category:** Apps for Specialized Industries
- **Bonus Prizes Entered (All 4):**
  1. Best Agents — Rovo/Assignable agents (`rovo:agent` + 3 `rovo:skill` + 6 `action`)
  2. Best app with Atlassian MCP (`rovo:mcp` + open-source `SKILL.md`)
  3. Best apps with Teamwork Graph integration (`requestTeamworkGraph` Curated Queries)
  4. Best Marketplace published app (Atlassian Marketplace Free Listing)
- **Built With:** Atlassian Forge (`nodejs24.x`), Atlassian Teamwork Graph API, Atlassian Rovo Agent & Skills, Atlassian Rovo MCP, Forge Storage (`@forge/kvs`), Jira Cloud REST API v3, React 18, Vite, US openFDA Medical Device Enforcement API
- **GitHub Repository:** `https://github.com/vizral/medtrace-iq`
- **Privacy Policy:** `https://github.com/vizral/medtrace-iq/blob/main/PRIVACY.md`
- **Third-Party Agent Skill (`SKILL.md`):** `https://github.com/vizral/medtrace-iq/blob/main/SKILL.md`
- **Rovo MCP Endpoint:** `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c`

---

## Project Description (Copy-Paste to Devpost)

### Inspiration
When a medical device team modifies firmware on a volumetric infusion pump, cardiac pacemaker, or ICU ventilator, missing organizational context isn't just a productivity hiccup—it can cause a **Class I FDA recall**, a failed **ISO 13485 / FDA 21 CFR 820 audit**, or months of delayed patient care.

MedTech teams already track design controls in **Jira**, Standard Operating Procedures (SOPs) and Design History Files (DHFs) in **Confluence**, and quality complaints in **Jira Service Management**. Yet critical context stays trapped across silos: engineers change a pressure threshold in Jira without knowing which Confluence SOP owner needs to sign off, which Atlassian Teams or Goals are impacted, or that the US FDA just issued an active **Class I recall** on the exact same occlusion failure mode.

**MedTrace IQ** brings Codegeist 2026's theme—*"Build with context. Ship with confidence."*—directly to regulated Healthcare & MedTech teams.

### What it does
MedTrace IQ is an Atlassian Forge regulatory context, blast-radius, and ship-confidence engine installed directly into Jira:

1. **Deterministic 5-Pillar Ship-Confidence Engine (0–100):** Evaluates every Jira work item against **FDA 21 CFR 820.30**, **ISO 13485**, and **ISO 14971** across five weighted pillars: Design Control Completeness (25 pts), Verification & Validation Evidence (25 pts), SOP & Organizational Context from Teamwork Graph (20 pts), Live openFDA Recall Clearance (20 pts), and Formal QA Regulatory Sign-Off (10 pts). Unmitigated live **FDA Class I** recall parallels trigger an automatic **Regulatory Hold** cap (`≤ 49/100`).
2. **Interactive Blast-Radius & Teamwork Graph Cockpit (`jira:projectPage`):** A 5-tab Custom UI command center featuring a live SVG topology graph linking Jira Design Controls, CAPA tickets, Atlassian Teamwork Graph Teams/Goals/Confluence SOP owners, and live US openFDA Class I/II/III enforcement signals—plus a click-to-inspect provenance panel and 1-click **Design History File (DHF) Markdown Audit Pack** export.
3. **Contextual Jira Issue Guardrail (`jira:issuePanel`):** Embedded inside every Jira work item with a radial Ship-Confidence gauge, 5-pillar bars, interactive ISO 13485 checklist persisted in `@forge/kvs`, live Teamwork Graph context chips, matched openFDA recalls, 1-click linked **ISO 13485 CAPA** creation, and immutable **QA Regulatory Sign-Off** (logged both to Forge Storage and as structured Jira audit comments).
4. **MedTrace QMS Copilot (`rovo:agent` + 3 `rovo:skill` + 6 `action`):** A dedicated Rovo Agent equipped with three modular `rovo:skill` playbooks (`fda-recall-impact`, `capa-triage`, `dhf-audit-check`)—complete with regulatory reference guides in `references/`—capable of auditing entire projects, inspecting issues, searching live openFDA recalls, filing linked Jira CAPAs, and recording QA sign-offs.
5. **Atlassian Rovo MCP Server (`rovo:mcp` + Open-Source `SKILL.md`):** Exposes all 6 regulatory tools via `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c` to both Rovo Studio and external MCP-compatible AI coding agents (Claude Code, Cursor, Antigravity, VS Code) for automated pre-merge FDA compliance gating.
6. **1-Click MedTech Judge Demo Seeder:** Any reviewer installing MedTrace IQ on a fresh Jira project can click **⚡ Seed MedTech Demo** to populate 6 realistic cardiac, infusion pump, ventilator, catheter, CGM, and AED CAPA tickets in seconds.

### How we built it
- **Atlassian Forge (`nodejs24.x`, ARM64):** Single-app Jira Forge architecture (enabling a free Atlassian Marketplace listing) with zero external customer-data storage (`inScopeEUD: false`).
- **Live Atlassian Teamwork Graph Integration:** Calls `api.asUser().requestTeamworkGraph()` using typed **Curated Queries** (`echo`, `atlassianTeamsBySpace`, `jiraSpaceWorkItems`, `atlassianUserInTeams`, `atlassianUserContent`, `atlassianUserGoalsAndProjects`, `confluencePageLinkedConfluencePages`, `jiraWorkItemGoals`, `jiraWorkItemComments`, `jiraWorkItemDevelopmentArtifacts`, `jiraWorkItemHierarchy`) with granular per-object `read:graph:*` scopes.
- **Live US openFDA Medical Device Enforcement Integration:** Queries `https://api.fda.gov/device/enforcement.json` using strictly generic medical device subsystem terms (never sending Jira PII or proprietary text) with a 30-minute Forge KVS cache.
- **Modern Accessible Custom UI (React 18 + Vite):** Theme-synchronized with Jira light/dark mode (`@forge/bridge` `view.theme.enable()` + CSS `color-scheme` / `light-dark()`), container-query responsive tables, accessible single-row tablist, and native `<dialog>` modals.

### How MedTrace IQ Meets Each Bonus Prize Requirement
- **Best Agents (Rovo):** Declares `rovo:agent` (`medtrace-copilot`), 3 reusable `rovo:skill` modules (`fda-recall-impact`, `capa-triage`, `dhf-audit-check`) with `references/` guides, 6 executable `action` modules, and programmatic launch via `@forge/bridge` `rovo.open()`.
- **Best app with Atlassian MCP:** Declares `rovo:mcp` (`medtrace-mcp`) exposing all 6 Forge actions at `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c` paired with an open-source third-party agent `SKILL.md` in the repository root.
- **Best apps with Teamwork Graph integration:** Executes 11 live Teamwork Graph Curated Queries across Jira, Confluence SOPs, Atlassian Teams, Atlassian Goals, and External Dev Artifacts, displaying live per-query telemetry inside the app and rendering discovered nodes in the interactive Blast-Radius Graph.
- **Best Marketplace published app:** Deployed cleanly to `production` (`forge lint`: 0 errors, 0 warnings) with full `PRIVACY.md` and Apache 2.0 `LICENSE`, submitted as a Free Atlassian Marketplace app.

---

## Judge Testing Instructions (Paste into Devpost Submission Form)
1. Click the **Installation Link** to install **MedTrace IQ** into your Jira Cloud site (and optionally connect Confluence for full Confluence SOP discovery via Teamwork Graph).
2. Open any Jira project → click **Apps → MedTrace IQ** in the project navigation bar.
3. Click **⚡ Seed MedTech Demo** in the top-right header to automatically populate 6 regulated medical device tickets (`Infusion Pump`, `Cardiac Pacemaker`, `ICU Ventilator`, `Ablation Catheter`, `CGM`, and `[CAPA] AED Battery`).
4. Explore all 5 tabs:
   - **Release Readiness Cockpit:** Filter by `Hold` and inspect live Class I FDA recall exposure.
   - **Blast-Radius & TWG Graph:** Click red openFDA, blue Jira, and teal Teamwork Graph SOP nodes to inspect provenance.
   - **Live openFDA Recall Radar:** Search live FDA recalls (e.g., `"ventilator"` or `"catheter"`) and click **+ Create Impact CAPA**.
   - **DHF Matrix & Governance:** Customize release gate thresholds and download the Markdown DHF Audit Pack.
   - **Rovo Agent · MCP · Demo Setup:** Inspect live Teamwork Graph per-query telemetry (`ok=true`) and copy the Rovo MCP config.
5. Open any seeded Jira issue → click **Apps → MedTrace IQ Regulatory Guardrail** → toggle ISO 13485 checklist items and click **QA Sign-Off** to see the live score update and audit comment posted to Jira.
6. Open **Rovo Chat** → select **MedTrace QMS Copilot** → ask: *"Run a Ship-Confidence release readiness audit for this project and inspect Teamwork Graph context."*
