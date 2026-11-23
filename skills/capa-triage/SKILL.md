---
name: capa-triage
description: Triage medical device quality nonconformances under FDA 21 CFR 820.100 and ISO 13485, create linked Jira CAPA tickets, and record regulatory hold decisions.
allowed-tools: analyze-issue-compliance create-capa-ticket record-regulatory-signoff
---

# FDA 21 CFR 820.100 / ISO 13485 CAPA Triage

Use this skill when a user wants to triage a compliance gap, escalate a field safety or design defect into a formal Corrective and Preventive Action (CAPA), or place a blocked ticket on Regulatory Hold.

## Reference Material
Consult `references/capa-checklist.md` for mandatory FDA 21 CFR 820.100 CAPA fields and severity tiers.

## Workflow
1. Call `analyze-issue-compliance` on the target `issueKey` to verify the exact compliance gaps, ISO 14971 risk tier, and any linked FDA recall parallels.
2. Determine severity (`Critical`, `High`, `Medium`, `Low`) using `references/capa-checklist.md`.
3. Call `create-capa-ticket` with:
   - `projectKey`: derived from the source issue key prefix (unless specified otherwise).
   - `sourceIssueKey`: the triggering Jira issue key so Jira links the CAPA automatically.
   - `title`: clear, audit-ready CAPA summary starting with `[CAPA]`.
   - `severity`: ISO 14971 risk severity.
   - `rationale`: structured root-cause hypothesis, affected regulation (21 CFR 820.100 / ISO 13485 Clause 8.5), and required containment + verification steps.
   - `fdaRecallNumber`: include if triggered by a live openFDA recall match.
4. If severity is `Critical` or `High` and the source ticket is not yet on hold, call `record-regulatory-signoff` with `decision: "Hold"` citing the newly created CAPA key.
5. Report the created CAPA Jira key, link status, and next verification milestones.
