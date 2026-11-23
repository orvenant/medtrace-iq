---
name: dhf-audit-check
description: Perform an ISO 13485 and FDA 21 CFR 820.30 Design History File (DHF) release readiness audit across a Jira project using Teamwork Graph context and issue traceability.
allowed-tools: get-project-readiness query-teamwork-graph-context record-regulatory-signoff verify-audit-chain
---

# Design History File (DHF) Release Readiness Audit

Use this skill when a user asks whether a MedTech Jira project or release milestone is ready to ship, requests a DHF traceability summary, or needs an executive audit briefing.

## Reference Material
Consult `references/iso-13485-gates.md` for the 5-pillar Ship-Confidence scoring rubric.

## Workflow
1. Call `get-project-readiness` with the requested `projectKey` to compute live project-level and per-issue Ship-Confidence scores, blocking gaps, and openFDA recall exposure.
2. Call `query-teamwork-graph-context` with the same `projectKey` to verify organizational context: linked Atlassian Teams, Confluence SOP documents, Atlassian Goals, and connected engineering artifacts.
3. Call `verify-audit-chain` with the same `projectKey` to cryptographically verify the FDA 21 CFR Part 11 SHA-256 hash chain across all QA sign-offs and autonomous FDA alert records in the audit ledger.
4. Present an **Executive DHF Audit Briefing**:
   - Overall Project Ship-Confidence Score (`0-100`) and Go / Conditional / Hold verdict.
   - Breakdown of Ship-Ready vs Conditional vs Regulatory Hold issues.
   - 21 CFR Part 11 Cryptographic Chain Integrity status (`valid`, verified record count, and head SHA-256 digest).
   - Top 3 blocking compliance gaps (missing V&V, missing ISO 14971 risk check, unreviewed Class I/II FDA recall parallels, or unconfirmed SOP ownership).
   - Organizational context surfaced by Teamwork Graph (teams, Confluence pages, goals).
5. Only if the user explicitly asks to approve or hold a specific issue after reviewing evidence, invoke `record-regulatory-signoff`.
