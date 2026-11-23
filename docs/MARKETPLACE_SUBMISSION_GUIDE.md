# MedTrace IQ — Judge Sharing Link, External MCP & Atlassian Marketplace Checklist

- **App Name:** MedTrace IQ
- **App ID:** `ari:cloud:ecosystem::app/f6caf1a8-53e4-49e6-8e26-f98807c8151c`
- **App UUID:** `f6caf1a8-53e4-49e6-8e26-f98807c8151c`
- **Developer Space:** `MedTrace Labs` (`75371d10-fc3a-4eeb-a0e3-5348e9299ce2`)
- **Live Demo Site:** `https://one-atlas-ypfd.atlassian.net`
- **Demo MedTech Project:** `https://one-atlas-ypfd.atlassian.net/jira/software/projects/MED`
- **Rovo MCP Endpoint:** `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c`

## 1. Enable Judge Sharing Link (Required by Codegeist 2026)
1. Open Developer Console: `https://developer.atlassian.com/console/myapps/f6caf1a8-53e4-49e6-8e26-f98807c8151c/distribution`
2. Click **Edit** → switch Distribution Status to **Sharing** → fill Vendor Name (`MedTrace Labs`), Privacy Policy URL (link to `PRIVACY.md` in your public GitHub repo), and save.
3. Copy the generated **Installation Link** (`https://developer.atlassian.com/console/install/...`) and paste it into the Codegeist Devpost Submission Form.

## 2. Enable External Rovo MCP Exposure (For Bonus Prize Verification)
1. Open Atlassian Administration for `one-atlas-ypfd.atlassian.net` → **Apps → Sites → one-atlas-ypfd → Connected apps**.
2. Select **MedTrace IQ** → toggle on external MCP tool exposure for all 6 tools (`get-project-readiness`, `analyze-issue-compliance`, `search-fda-recalls`, `query-teamwork-graph-context`, `create-capa-ticket`, `record-regulatory-signoff`).
3. Verify OAuth 2.1 connection to `https://mcp.atlassian.com/forge/f6caf1a8-53e4-49e6-8e26-f98807c8151c`.

## 3. Submit Free App Listing to Atlassian Marketplace (Bonus Prize: 6 × $1,500)
1. Go to `https://marketplace.atlassian.com/manage/vendors` (create your free Marketplace Partner vendor profile if first time).
2. Click **Publish a new app** → choose **Forge app** → select **MedTrace IQ** (`production` environment).
3. Pricing: **Free** (zero billing friction; full compatibility with single-app Jira listing).
4. Provide:
   - App Summary & Description (from `README.md`)
   - Privacy Policy URL (`https://github.com/<user>/medtrace-iq/blob/main/PRIVACY.md`)
   - Support Email (`am.ebrahimzadeh@gmail.com`)
   - 3 crisp screenshots captured from `one-atlas-ypfd.atlassian.net` (Cockpit, Blast-Radius Graph, Issue Guardrail + Rovo).
5. Submit for Marketplace review and copy the **AMKT review ticket URL** or live Marketplace listing URL into the Codegeist 2026 Devpost submission form!
