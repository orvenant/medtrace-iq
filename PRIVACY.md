# MedTrace IQ — Privacy Policy & Data Handling

**Effective Date:** November 23, 2026

## 1. Architecture & Data Residency
MedTrace IQ is built 100% natively on **Atlassian Forge** (`nodejs24.x`). All application logic executes inside Atlassian's managed serverless infrastructure, and all persistent regulatory checklists, governance policies, and SHA-256 hash-chained **FDA 21 CFR Part 11** audit logs are stored exclusively in **Atlassian Forge Storage (`@forge/kvs`)** pinned to your Atlassian Cloud site.

## 2. Data Accessed
- **Jira Cloud REST API & Atlassian Teamwork Graph API:** Read on demand under the invoking user's permissions (`api.asUser()`) for interactive UI, Rovo Agent, and Rovo MCP calls. Autonomous background issue triggers (`avi:jira:created:issue`, `avi:jira:updated:issue`) and Jira workflow release validators (`jira:workflowValidator`) execute inside Atlassian's scoped app context (`api.asApp()`) solely to screen regulated device keywords, apply the `medtrace-fda-hold` label, post structured safety alert comments, and validate release readiness transitions.
- **No Third-Party Storage of Customer Data:** MedTrace IQ does **not** transmit, store, or log your Jira issue descriptions, Confluence pages, user PII, or Teamwork Graph data to any external server.

## 3. External API Communication (openFDA)
MedTrace IQ queries the public US Government **openFDA Medical Device Enforcement API** (`https://api.fda.gov`) strictly using generic medical device category keywords (for example `"infusion pump"`, `"pacemaker"`, `"catheter"`, `"ventilator"`). No Jira issue keys, customer names, personal data, or proprietary text are sent to openFDA.

## 4. Data Deletion & GDPR
Uninstalling MedTrace IQ from your Atlassian site removes access immediately and triggers standard Atlassian Forge app storage lifecycle cleanup. Site administrators can also clear app governance and checklist records at any time from inside the app or contact the developer at `am.ebrahimzadeh@gmail.com`.

## 5. Regulatory Disclaimer
MedTrace IQ is a decision-support, traceability, and workflow acceleration tool designed to assist MedTech quality and engineering teams working under FDA 21 CFR 820, ISO 13485, and ISO 14971. Final regulatory determinations remain the responsibility of qualified Quality Assurance and Regulatory Affairs personnel.
