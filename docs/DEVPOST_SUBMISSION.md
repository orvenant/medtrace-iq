# MedTrace IQ v3.0 — Codegeist 2026 Devpost Submission Package

- **Project Name:** MedTrace IQ
- **Tagline (≤ 60 chars):** Autonomous FDA/ISO MedTech governance via Forge, Rovo & TWG
- **Primary Category:** Apps for Specialized Industries
- **Bonus Prizes Entered (All 4):**
  1. Best Agents — Rovo/Assignable agents (`rovo:agent` + 3 `rovo:skill` + 7 `action`)
  2. Best app with Atlassian MCP (`rovo:mcp` exposing 7 tools + open-source `SKILL.md`)
  3. Best apps with Teamwork Graph integration (`requestTeamworkGraph` 11 Curated Queries)
  4. Best Marketplace published app (Atlassian Marketplace Free Listing)
- **Built With:** Atlassian Forge (`nodejs24.x`), Forge Triggers (`avi:jira:created:issue` / `updated:issue`), Jira Workflow Validator (`jira:workflowValidator`), Jira Dashboard Gadget (`jira:dashboardGadget`), Atlassian Teamwork Graph API, Atlassian Rovo Agent & Skills, Atlassian Rovo MCP, Forge Storage (`@forge/kvs`), Node Crypto SHA-256 (`21 CFR Part 11`), Jira Cloud REST API v3, React 18, Vite, US openFDA Medical Device Enforcement API
- **GitHub Repository:** `https://github.com/orvenant/medtrace-iq`
- **Judge Installation Link (Atlassian Forge Production):** `https://developer.atlassian.com/console/install/f6caf1a8-53e4-49e6-8e26-f98807c8151c?signature=AYABeFNvIQsLhA7%2FZirSVA51cR0AAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBvocmitTesR%2BUvG4QHlequQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDEGlSNS8sKTAZAeFuwIBEIA7RDvCG1bsZAsGbrUdbNL5iKW5rsvVHg0QnoKqbuu4edsgJ2DAUDd%2FEHQTTwWIhQDpxnOgd4UgkbWiObAAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgHgUn3nFM7rEqT66K%2F81rMrAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMPsonb1uq5e9rUMQ4AgEQgDuokRhFoQn5FKSwcpiPJYplDgI%2Bnom3St%2BH7PSciJ7j3M6fsLr6i3M9ztY6%2BOzRbhDhdDt5ytT7fAfHNgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAdmgHFwDf2D6FkdNNKrscAsAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAzFkzO4n34BTBU7uKwCARCAO4yFh98eVCDK4mxHqFUKcOwQzKIn19wHudGtd5%2FvwKPkncQwZYDuVi2x1nlZbGndrbUaNgl8ggRYyBdMAgAAAAAMAAAQAAAAAAAAAAAAAAAAABqCr91KV%2BtjYv2PpkxSdCT%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADIprq5BjAnwbRM7FkjoQ4Vwa2ltDTON9v%2BEKfpbGgpX3xTZjoFPzm%2FmoJsexX41cw7p6hIpulWRjpF5hfbpuDLW6CI%3D&product=jira`
- **Privacy Policy:** `https://github.com/orvenant/medtrace-iq/blob/main/PRIVACY.md`
- **Third-Party Agent Skill (`SKILL.md`):** `https://github.com/orvenant/medtrace-iq/blob/main/SKILL.md`
- **Rovo MCP Endpoint:** `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c`

---

## Project Description (Copy-Paste to Devpost)

### Inspiration
When a medical device team modifies firmware on a volumetric infusion pump, cardiac pacemaker, or ICU ventilator, missing organizational context isn't just a productivity hiccup—it can cause a **Class I FDA recall**, a failed **ISO 13485 / FDA 21 CFR 820 audit**, or months of delayed patient care.

MedTech teams already track design controls in **Jira**, Standard Operating Procedures (SOPs) and Design History Files (DHFs) in **Confluence**, and quality complaints in **Jira Service Management**. Yet critical context stays trapped across silos: engineers change a pressure threshold in Jira without knowing which Confluence SOP owner needs to sign off, which Atlassian Teams or Goals are impacted, or that the US FDA just issued an active **Class I recall** on the exact same occlusion failure mode—and release workflows lack hard cryptographic enforcement.

**MedTrace IQ v3.0** brings Codegeist 2026's theme—*"Build with context. Ship with confidence."*—directly to regulated Healthcare & MedTech teams with **autonomous monitoring, physical release gates, and 21 CFR Part 11 cryptography**.

### What it does
MedTrace IQ is an enterprise-grade, 100% native Atlassian Forge regulatory governance platform spanning 15+ Forge modules:

1. **Autonomous Background openFDA Trigger Monitor (`trigger`):** Watches `avi:jira:created:issue` and `avi:jira:updated:issue` in real time. The moment an engineer creates or edits a ticket touching a medical device subsystem with an active US FDA Class I recall parallel, MedTrace IQ automatically applies the `medtrace-fda-hold` label, posts a structured ADF regulatory safety alert comment citing the exact FDA recall number, and records a **SHA-256 hash-chained** entry into the audit ledger (with loop protection and KVS deduplication).
2. **Physical Jira Workflow Release Gate (`jira:workflowValidator`):** Enforces real compliance on both Company-Managed and Team-Managed workflows—physically blocking Jira release transitions unless the work item's deterministic 5-pillar Ship-Confidence verdict equals `SHIP_READY`, surfacing the exact score and top blocking gap directly in Jira's transition banner.
3. **FDA 21 CFR Part 11 SHA-256 Cryptographic Audit Chain:** Every QA Regulatory Sign-Off and Autonomous FDA Alert is cryptographically hash-chained (`SHA-256`) in Forge Storage (`@forge/kvs`) and printed onto Jira audit comments with full digests. QA auditors, Rovo Copilot, or external MCP clients can invoke **`verify-audit-chain`** at any time to verify zero tampering and export both **Markdown DHF Audit Packs** and machine-readable **JSON (`21cfr11-evidence-pack.v3`)** evidence bundles.
4. **Executive Release Readiness Dashboard Gadget (`jira:dashboardGadget`):** Embeds live Ship-Confidence gauges, Ready/Conditional/Hold counts, Class I exposure alerts, and 21 CFR Part 11 SHA-256 integrity status onto any Jira Dashboard with native View/Edit configuration.
5. **Interactive Release Cockpit, 3×3 ISO 14971 Risk Matrix & Per-Gate What-If Simulator (`jira:projectPage`):**
   - **3×3 ISO 14971 Risk × Release Verdict Matrix:** Click any cell to cross-filter the release gate table.
   - **Real Semantic FDA 21 CFR 820.30 Rubric & 16 Regulated Device Categories:** Evaluates 4 explicit design-control specification elements (standard citation, quantitative tolerances, hazard controls, traceable protocol references) across 16 clinical device subsystems and scores **Direct Failure-Mode Overlap** against live openFDA enforcement recalls.
   - **Slide-Over Issue Audit Drawer + Per-Gate What-If Simulator:** Native `<dialog>` inspector letting engineers toggle individual open gates (`+15 V&V`, `+6 ISO 14971`, `+10 SOP`, `+18 openFDA`, `+10 QA`) to simulate exact score deltas and release verdict shifts live, inspect auto-matched Teamwork Graph Confluence SOPs, and update live Forge KVS checklists.
   - **Zero-Overlap 4-Column Blast-Radius & Teamwork Graph Topology:** Connects `openFDA Recalls` → `Jira Design Controls & CAPAs` → `TWG Confluence SOPs` (`TWG_GOVERNS_SOP`) → `TWG Teams & Goals`.
6. **Contextual Jira Issue Guardrail (`jira:issuePanel`):** Embedded inside every Jira work item with live Ship-Confidence gauge, 5-pillar bars, interactive ISO 13485 checklist, auto-matched Confluence SOP cards, matched openFDA recalls, SHA-256 QA sign-off badge, 1-click Linked CAPA creation, and 1-click Rovo launch.
7. **MedTrace QMS Copilot (`rovo:agent` + 3 `rovo:skill` + 7 `action`) & Rovo MCP Server (`rovo:mcp` + `SKILL.md`):** Bundles 3 modular `rovo:skill` playbooks (`fda-recall-impact`, `capa-triage`, `dhf-audit-check`) and exposes all **7 Forge tools** (including `verify-audit-chain`) via `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c` to Rovo Studio and external coding agents (Claude Code, Cursor, Antigravity, VS Code).

### How we built it
- **Atlassian Forge (`nodejs24.x`, ARM64):** Single-app Jira Forge architecture (enabling a Free Atlassian Marketplace listing) with zero external customer-data storage (`inScopeEUD: false`).
- **Live Atlassian Teamwork Graph Integration:** Calls `api.asUser().requestTeamworkGraph()` using 11 typed **Curated Queries** (`echo`, `atlassianTeamsBySpace`, `jiraSpaceWorkItems`, `atlassianUserInTeams`, `atlassianUserContent`, `atlassianUserGoalsAndProjects`, `confluencePageLinkedConfluencePages`, `jiraWorkItemGoals`, `jiraWorkItemComments`, `jiraWorkItemDevelopmentArtifacts`, `jiraWorkItemHierarchy`) with granular per-object `read:graph:*` scopes.
- **21 CFR Part 11 SHA-256 Cryptography:** Built with Node.js native `node:crypto` (`SHA-256` canonical serialization chaining `previousHash` → `entryHash` with genesis block and legacy pre-v3 record compatibility), verified by automated tamper-detection unit tests.
- **Live US openFDA Medical Device Enforcement Integration:** Queries `https://api.fda.gov/device/enforcement.json` using strictly generic medical device subsystem keywords (zero PII egress) with a 30-minute Forge KVS cache.
- **Modern Accessible Custom UI (React 18 + Vite):** Synchronized with Jira light/dark mode (`@forge/bridge` `view.theme.enable()` + CSS `color-scheme` / `light-dark()`), container-query responsive tables, accessible single-row tablist, and native `<dialog>` modals and slide-over drawers.

### How MedTrace IQ Meets Each Bonus Prize Requirement
- **Best Agents (Rovo):** Declares `rovo:agent` (`medtrace-copilot`), 3 reusable `rovo:skill` modules (`fda-recall-impact`, `capa-triage`, `dhf-audit-check`) with `references/` guides, 7 executable `action` modules, and programmatic launch via `@forge/bridge` `rovo.open()`.
- **Best app with Atlassian MCP:** Declares `rovo:mcp` (`medtrace-mcp`) exposing all 7 Forge tools at `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c` paired with an open-source third-party agent `SKILL.md` in the repository root.
- **Best apps with Teamwork Graph integration:** Executes 11 live Teamwork Graph Curated Queries across Jira, Confluence SOPs, Atlassian Teams, Atlassian Goals, and External Dev Artifacts, semantically linking Confluence SOPs to matching Jira design controls (`TWG_GOVERNS_SOP`) and displaying real-time per-query telemetry.
- **Best Marketplace published app:** Deployed cleanly to `production` (`forge lint`: 0 errors, 0 warnings; 11/11 unit tests passing) with full `PRIVACY.md` and Apache 2.0 `LICENSE`, submitted as a Free Atlassian Marketplace app.

---

## Judge Testing Instructions (Paste into Devpost Submission Form)
1. Click the **Installation Link** to install **MedTrace IQ** into your Jira Cloud site (and optionally connect Confluence for full Confluence SOP discovery via Teamwork Graph).
2. Open any Jira project → click **Apps → MedTrace IQ** in the project navigation bar.
3. Click **⚡ Seed MedTech Demo** in the top-right header to automatically populate 6 regulated medical device tickets (`Infusion Pump`, `Cardiac Pacemaker`, `ICU Ventilator`, `Ablation Catheter`, `CGM`, and `[CAPA] AED Battery`).
4. **Test the Autonomous openFDA Trigger:** Create a new Jira issue titled *"Infusion Pump Bolus Calibration Firmware v4.3"*. Within seconds, refresh the issue to see MedTrace IQ automatically add the `medtrace-fda-hold` label and post a structured `[MedTrace IQ Autonomous FDA Monitor]` Class I alert comment with a SHA-256 entry ID!
5. **Explore the 5-Tab Executive Cockpit:**
   - **Release Readiness Cockpit:** Click cells in the **3×3 ISO 14971 Risk × Release Verdict Matrix** to cross-filter; click **Inspect** on any issue to open the Slide-Over Audit Drawer and toggle the **What-If Simulator**.
   - **Blast-Radius & TWG Graph:** Inspect live `openFDA` → `Jira` → `TWG Confluence SOP` (`TWG_GOVERNS_SOP`) → `TWG Teams` provenance.
   - **Live openFDA Recall Radar:** Search live FDA recalls and click **+ Create Impact CAPA**.
   - **DHF · 21 CFR Part 11 · Policy:** Click **🔐 Verify Chain Now** to run live SHA-256 cryptographic chain verification and export both `.md` and `.json` audit packs.
   - **Rovo · MCP · Automation:** Inspect live Teamwork Graph telemetry (`ok=true`) and copy the 7-tool Rovo MCP config.
6. **Test the Executive Dashboard Gadget & Physical Release Gate:**
   - Open **Jira Dashboards → Add gadget → MedTrace IQ Executive Release Readiness**.
   - Optionally add **MedTrace IQ FDA/ISO Release Gate** under **Project Settings → Workflows → Transition Rules → Validators** to enforce physical release blocking.
7. **Test Rovo Copilot (7 Tools):** Open **Rovo Chat** → select **MedTrace QMS Copilot** → ask: *"Run a Ship-Confidence release readiness audit for project MED and verify our 21 CFR Part 11 SHA-256 audit chain."*
