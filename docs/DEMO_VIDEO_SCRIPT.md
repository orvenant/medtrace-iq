# MedTrace IQ — Codegeist 2026 Demo Video Script (< 4:30)

**Target Length:** 4 minutes 00 seconds (Codegeist limit: strictly under 5:00 — public on YouTube)
**Theme:** *"Build with context. Ship with confidence."*
**Category:** Apps for Specialized Industries (Healthcare & MedTech)
**Bonus Prizes Showcased Live:**
1. **Best Agents — Rovo (`rovo:agent` + 3 `rovo:skill` playbooks + 6 `action` tools)**
2. **Best app with Atlassian MCP (`rovo:mcp` + open-source `SKILL.md`)**
3. **Best apps with Teamwork Graph integration (`requestTeamworkGraph` Curated Queries)**
4. **Best Marketplace published app (Atlassian Marketplace listing)**

---

## Shot-by-Shot Storyboard

### 0:00 – 0:30 | Hook: The High-Stakes MedTech Context Problem
- **Visual:** Open Jira project **`MED` (MedTrace Cardiac & Infusion Devices)** → click **MedTrace IQ** in the left sidebar (`jira:projectPage`).
- **Narration:**
  > *"When a medical device team ships an infusion pump or pacemaker firmware update, missing context isn't just a bug—it's an FDA recall or audit failure. Teams manage design controls in Jira, SOPs in Confluence, and safety reviews across silos. Meet **MedTrace IQ**: an Atlassian Forge regulatory context engine that connects Jira, Atlassian Teamwork Graph, Rovo, MCP, and live US openFDA recall data so MedTech teams build with context and ship with confidence."*

### 0:30 – 1:15 | Live Cockpit, 1-Click Seeder & 5-Pillar Ship-Confidence Gate
- **Visual:** Show the **Release Readiness Cockpit** KPI strip (Ship Confidence gauge, Design Controls Audited, Live openFDA Signals, Teamwork Graph Context, CAPA Ledger). Point out the 6 seeded MedTech issues (Infusion Pump, Pacemaker, ICU Ventilator, Ablation Catheter, CGM, AED CAPA).
- Click filter **Hold** → highlight the **Infusion Pump Occlusion Sensor** ticket capped at `49/100` (`Regulatory Hold`) because of a **live FDA Class I recall parallel**.
- **Narration:**
  > *"Every Jira work item is scored deterministically from 0 to 100 across five FDA 21 CFR 820 and ISO 13485 pillars. Notice MedTrace automatically detected a live Class I FDA recall parallel for our infusion pump subsystem and enforced a Regulatory Hold."*

### 1:15 – 2:00 | Interactive Blast-Radius & Live Atlassian Teamwork Graph
- **Visual:** Click tab **Blast-Radius & TWG Graph**. Click a **red openFDA node**, a **blue Jira node**, and a **teal Teamwork Graph Confluence SOP node** (`SOP-QMS-104`) showing real owner provenance in the right-hand Context Inspector.
- Switch briefly to tab **Live openFDA Recall Radar** → search `"ventilator"` or `"catheter"` live → click **+ Create Impact CAPA** → submit native modal → show the new linked **`[CAPA]`** Jira ticket created automatically!
- **Narration:**
  > *"Here is our live Blast-Radius Graph powered by Atlassian Teamwork Graph curated queries—linking Jira design controls, Atlassian Teams, Goals, and Confluence SOP owners directly to live US openFDA enforcement recalls. With one click, QA creates a structured ISO 13485 CAPA ticket linked straight back to the impacted work item."*

### 2:00 – 2:45 | Contextual Issue Guardrail Panel & Immutable QA Sign-Off
- **Visual:** Open the **Infusion Pump** Jira issue → expand **MedTrace IQ Regulatory Guardrail** (`jira:issuePanel`).
- Show the 5-pillar bars, live Teamwork Graph chips, and matched openFDA recalls.
- Check off the ISO 13485 checklist boxes (watch the score update dynamically!) → click **QA Sign-Off** → select **Approved** with rationale → show the score jump to **Ship Ready** AND scroll down to show the structured **MedTrace IQ Regulatory Audit Sign-Off** comment posted automatically in Jira!
- **Narration:**
  > *"Inside every Jira issue, engineers and QA see their exact Ship-Confidence score, Teamwork Graph context, and interactive ISO 13485 gate checklist persisted in Forge Storage. Recording a QA Sign-Off updates our immutable ledger and posts an auditor-ready comment directly onto the ticket."*

### 2:45 – 3:35 | Rovo Agent + 3 Reusable Skills + Atlassian Rovo MCP
- **Visual:** Click **✦ Ask MedTrace Rovo** (or open Rovo Chat → select **MedTrace QMS Copilot**).
- Ask: *"Run a Ship-Confidence release readiness audit for project MED and check live FDA Class I recalls for infusion pumps."*
- Watch **MedTrace QMS Copilot** invoke our `dhf-audit-check` / `fda-recall-impact` `rovo:skill` playbooks and live Forge actions, returning a structured Go/Hold audit report!
- Switch back to tab **Rovo Agent · MCP · Demo Setup** → show the live **Teamwork Graph Telemetry** (`echo`, `atlassianTeamsBySpace`, `jiraSpaceWorkItems`, `atlassianUserContent`, `atlassianUserGoalsAndProjects`) and the **Atlassian Rovo MCP Endpoint** (`https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c`) + open-source `SKILL.md` for IDE pre-merge gates.
- **Narration:**
  > *"MedTrace QMS Copilot bundles three reusable Rovo Skills—fda-recall-impact, capa-triage, and dhf-audit-check—and exposes all six actions via Atlassian Rovo MCP so external AI coding agents can verify FDA compliance before merging code."*

### 3:35 – 4:00 | DHF Audit Pack Export & Closing
- **Visual:** Open tab **DHF Matrix & Governance** → click **⬇ Export Audit Pack (.md)** → briefly show the downloaded FDA 21 CFR 820 / ISO 13485 traceability report + mention Atlassian Marketplace listing.
- **Narration:**
  > *"One click exports a complete FDA 21 CFR 820 and ISO 13485 Design History File audit pack. MedTrace IQ is built natively on Forge, listed on the Atlassian Marketplace, and ready for regulated MedTech teams today—Build with context. Ship with confidence."*
