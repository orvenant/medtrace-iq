# MedTrace IQ — Security Policy & Vulnerability Disclosure

**Publisher:** Orvenant Labs (`com.orvenant.medtrace.iq`)  
**Security Contact:** `am.ebrahimzadeh@gmail.com` (also registered on `ecosystem.atlassian.net`)  
**Effective Date:** November 25, 2026

## 1. Platform & Isolation Architecture
- **100% Native Atlassian Forge (`nodejs24.x`, ARM64):** MedTrace IQ executes exclusively within Atlassian's managed Forge runtime. It does not operate any remote backend servers (`Forge Remote: No`) and does not expose web triggers or external REST APIs.
- **Native Storage Only (`@forge/kvs`):** All governance policies, ISO 13485 checklists, and FDA 21 CFR Part 11 SHA-256 hash-chained audit ledger records are persisted inside Atlassian Forge Storage scoped strictly to each customer's Atlassian Cloud site.
- **Zero Customer PII Egress:** The only declared external fetch endpoint in `manifest.yml` is the public US Government openFDA API (`https://api.fda.gov`, marked `inScopeEUD: false`). Only generic medical device category keywords (e.g., `infusion pump`, `pacemaker`, `catheter`) are transmitted. Zero Jira issue keys, issue bodies, user PII, Confluence content, or Teamwork Graph records leave Atlassian Cloud.

## 2. Authentication, Authorization & Least Privilege
- **User-Initiated Operations (`api.asUser()`):** All interactive Custom UI resolvers, Rovo Agent actions, and Rovo MCP tools call Jira Cloud REST APIs and Atlassian Teamwork Graph strictly under the invoking user's permissions (`api.asUser()`).
- **System-Event Operations (`api.asApp()`):** `api.asApp()` is used strictly in Atlassian system-triggered modules where user impersonation context does not apply: `jira:workflowValidator` (evaluating release transition gates) and background `trigger` handlers (`avi:jira:created:issue` / `avi:jira:updated:issue`) to screen generic device terms against public openFDA Class I recalls and apply compliance alerts.
- **No Credential Collection:** MedTrace IQ never requests or stores Atlassian Personal Access Tokens (PATs), user passwords, or third-party API secrets.
- **Least-Privilege Scopes:** Permissions in `manifest.yml` are limited to the exact Jira, Forge Storage, and granular Teamwork Graph `read:graph:*` scopes required by the app's declared features.

## 3. Input Validation, Logging & Dependency Security
- **Input Sanitization:** All backend resolvers, Rovo actions, and Jira/openFDA query builders validate input shapes, sanitize Jira issue/project keys, escape JQL parameters, and use Atlassian Forge `route` tagged template literals to prevent injection and SSRF attacks. React JSX escaping is enforced across all UI components without `dangerouslySetInnerHTML`.
- **Safe Logging:** Forge runtime logs record operational event metadata only (e.g., error status codes and non-PII diagnostic summaries) and never log customer PII, tokens, credentials, or issue descriptions.
- **Automated Dependency Scanning:** Production and UI dependencies are audited with `npm audit` and maintained on current supported versions.

## 4. Reporting Security Vulnerabilities & Incident Response
Orvenant Labs follows the [Atlassian Marketplace Security Bug Fix Policy](https://developer.atlassian.com/platform/marketplace/security-bugfix-policy/) and [Atlassian Security Incident Management Guidelines](https://developer.atlassian.com/platform/marketplace/app-security-incident-management-guidelines/).

- **How to Report:** Email `am.ebrahimzadeh@gmail.com` with subject `[SECURITY] MedTrace IQ` or open a private report via Atlassian Ecosystem Support (`ecosystem.atlassian.net`).
- **Response & Notification SLA:** We acknowledge vulnerability reports within 24 hours, remediate verified vulnerabilities within Atlassian's Marketplace Bug Fix SLA windows, and promptly notify both Atlassian and affected customers in the event of any security incident or critical vulnerability.
