# MedTrace IQ v3.0 — Codegeist 2026 Demo Video Script (< 4:30)

**Target Length:** 4 minutes 15 seconds (Codegeist limit: strictly under 5:00 — public on YouTube)
**Theme:** *"Build with context. Ship with confidence."*
**Category:** Apps for Specialized Industries (Healthcare & MedTech)
**Bonus Prizes Showcased Live:**
1. **Best Agents — Rovo (`rovo:agent` + 3 `rovo:skill` playbooks + 7 `action` tools)**
2. **Best app with Atlassian MCP (`rovo:mcp` 7 tools + open-source `SKILL.md`)**
3. **Best apps with Teamwork Graph integration (`requestTeamworkGraph` 11 Curated Queries)**
4. **Best Marketplace published app (Atlassian Marketplace Free Listing)**

---

## Shot-by-Shot Storyboard

### 0:00 – 0:30 | Hook: The High-Stakes MedTech Context & Enforcement Problem
- **Visual:** Open Jira project **`MED` (MedTrace Cardiac & Infusion Devices)** → click **MedTrace IQ** in the left sidebar (`jira:projectPage`). Show the KPI strip, the **3×3 ISO 14971 Risk × Release Verdict Matrix**, and **5-Pillar FDA 21 CFR 820 Coverage** bars.
- **Narration:**
  > *"When a medical device team ships an infusion pump or pacemaker firmware update, missing context isn't just a bug—it's a Class I FDA recall or failed ISO 13485 audit. Meet **MedTrace IQ v3.0**: an autonomous Atlassian Forge governance engine uniting Jira, Background Triggers, Physical Workflow Release Gates, Teamwork Graph, Rovo, MCP, 21 CFR Part 11 cryptography, and live US openFDA recall data—so MedTech teams build with context and ship with confidence."*

### 0:30 – 1:15 | Live Autonomous openFDA Trigger & Slide-Over What-If Simulator
- **Visual:**
  1. Show a newly created Infusion Pump issue where MedTrace IQ's **Autonomous Background Trigger** (`avi:jira:created:issue`) automatically applied the `medtrace-fda-hold` label and posted a live Class I FDA safety alert comment (`Z-0316-2027`) with zero human intervention!
  2. Back in the Cockpit, click a red cell in the **3×3 ISO 14971 Risk Matrix** to filter `Critical × HOLD`, then click **Inspect** on `MED-1` to slide open the **Issue Audit Drawer**.
  3. Toggle **What-If Simulator** → watch the radial gauge animate from `HOLD` to projected `SHIP_READY`, showing auto-matched Confluence SOP **`SOP-QMS-104`** (from Teamwork Graph) and live Class I openFDA recalls.
- **Narration:**
  > *"The moment an engineer creates a regulated ticket, our autonomous Forge trigger screens live openFDA Class I recalls, auto-applies `medtrace-fda-hold`, and posts an audit alert. From the interactive Risk Matrix, leads open our slide-over Audit Drawer to inspect auto-matched Confluence SOPs and simulate release readiness before shipping."*

### 1:15 – 2:00 | Interactive Blast-Radius Graph & Teamwork Graph Context
- **Visual:** Click tab **Blast-Radius & TWG Graph**. Show the zero-overlap 4-column swimlane (`Live openFDA Recalls` → `Jira Design Controls` → `TWG Confluence SOPs` → `TWG Teams & Goals`). Click a red openFDA node and teal `SOP-QMS-104` node (`TWG_GOVERNS_SOP` edge) showing real Confluence owner provenance in the right-hand inspector.
- Switch briefly to **Live openFDA Recall Radar** → click **+ Create Impact CAPA** → submit native modal → show linked `[CAPA]` Jira ticket created live!
- **Narration:**
  > *"Powered by 11 live Atlassian Teamwork Graph curated queries, our Blast-Radius Graph semantically connects live openFDA enforcement recalls to Jira design controls, Confluence SOP owners, and Atlassian Teams—and lets QA spin up a linked ISO 13485 CAPA in one click."*

### 2:00 – 2:45 | 21 CFR Part 11 SHA-256 Cryptographic Chain, Physical Release Gate & Dashboard Gadget
- **Visual:**
  1. Open tab **DHF · 21 CFR Part 11 · Policy** → click **🔐 Verify Chain Now** → highlight the green **VERIFIED INTACT (SHA-256)** banner, head digest, and chained QA Sign-Off + Autonomous Trigger entries. Click **⬇ Export (.md)** and **⬇ Evidence (.json)**.
  2. Switch briefly to a **Jira Dashboard** showing the live **MedTrace IQ Executive Release Readiness** gadget (`jira:dashboardGadget`) AND flash the **MedTrace IQ FDA/ISO Release Gate** workflow validator (`jira:workflowValidator`) blocking non-`SHIP_READY` transitions.
- **Narration:**
  > *"Every QA sign-off and autonomous alert is cryptographically SHA-256 hash-chained for FDA 21 CFR Part 11 tamper-evidence. Our Jira Workflow Validator physically blocks unready releases, while our Executive Dashboard Gadget gives VP QA real-time release visibility across projects."*

### 2:45 – 3:45 | Rovo Agent (`rovo:agent` + 3 `rovo:skill` + 7 Tools) & Rovo MCP (`rovo:mcp`)
- **Visual:** Open **Rovo Chat** → select **MedTrace QMS Copilot**.
- Ask: *"Run a Ship-Confidence release readiness audit for project MED, inspect Teamwork Graph SOPs, and verify our 21 CFR Part 11 SHA-256 audit chain."*
- Watch **MedTrace QMS Copilot** invoke our `dhf-audit-check` skill, live `get-project-readiness`, `query-teamwork-graph-context`, and 7th action **`verify-audit-chain`**, returning an executive Go/Hold report + verified SHA-256 head digest!
- Switch back to tab **Rovo · MCP · Automation** → highlight live **Teamwork Graph Telemetry (`ok=true`)** and the **7-tool Atlassian Rovo MCP Endpoint** (`https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c`) + `SKILL.md` for Claude Code / Cursor / Antigravity pre-merge gates.
- **Narration:**
  > *"MedTrace QMS Copilot bundles three reusable Rovo Skills and exposes all seven regulatory tools—including live SHA-256 chain verification—over Atlassian Rovo MCP so AI coding agents can run FDA release gates right inside the IDE."*

### 3:45 – 4:15 | Closing: 100% Native Forge, Zero-PII Privacy & Marketplace Ready
- **Visual:** Show `PRIVACY.md` / zero-PII openFDA architecture + Atlassian Marketplace Free listing status + `1-Click Seed MedTech Demo`.
- **Narration:**
  > *"100% native Atlassian Forge, zero PII egress, listed free on the Atlassian Marketplace, and ready to test on any Jira site in one click. MedTrace IQ: Build with context. Ship with confidence."*
