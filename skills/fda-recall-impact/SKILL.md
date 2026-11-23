---
name: fda-recall-impact
description: Correlate live US openFDA medical device recalls with Jira engineering work items and Atlassian Teamwork Graph context to assess regulatory blast radius before release.
allowed-tools: search-fda-recalls analyze-issue-compliance query-teamwork-graph-context
---

# FDA Recall Impact & Blast-Radius Analysis

Use this skill whenever a user asks about FDA recalls, field safety parallels, device subsystem risks, or whether an active medical device recall affects their Jira project or release candidate.

## Reference Material
Consult `references/fda-recall-classes.md` for official FDA Class I, Class II, and Class III severity definitions and mandatory escalation rules.

## Workflow
1. If a specific Jira issue key is provided, call `analyze-issue-compliance` first to identify its detected device subsystem, current Ship-Confidence score, and automatically matched recalls.
2. Call `search-fda-recalls` with the specific medical device subsystem or keyword (for example `infusion pump`, `pacemaker`, `catheter`, `ventilator`, `glucose`, `defibrillator`, `surgical robot`). Filter by `classification: "Class I"` first if the user asks for critical or life-threatening risks.
3. Call `query-teamwork-graph-context` for the relevant project or issue to discover connected Atlassian teams, Confluence SOP documents, linked goals, and external deployments or pull requests in the blast radius.
4. Synthesize an **FDA Blast-Radius Brief**:
   - List top matched recalls with exact `recall_number`, `classification`, `recalling_firm`, `status`, and `reason_for_recall`.
   - Map each recall failure mode to the team's Jira work items and Teamwork Graph context.
   - Recommend whether a CAPA under 21 CFR 820.100 or a release hold is warranted.

## Error Handling
- If `search-fda-recalls` returns zero results for a narrow phrase, retry once with a broader device family noun (for example retry `infusion` instead of `smart WiFi infusion cartridge v4`).
- If Teamwork Graph returns empty linked objects, state clearly which graph relationships had no linked records on this site and rely on Jira + openFDA findings.
