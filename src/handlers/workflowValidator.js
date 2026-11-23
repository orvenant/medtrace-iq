import api, { route } from '@forge/api';
import { extractAdfText } from '../services/jiraService';
import { detectDeviceSubsystem, evaluateIssueCompliance } from '../services/complianceEngine';
import { searchFdaDeviceRecalls } from '../services/openFdaService';
import { getProjectPolicy, getIssueChecklist, getIssueSignOff } from '../services/storageService';

/**
 * Jira Workflow Validator Lambda (`jira:workflowValidator`).
 * Physically enforces MedTrace IQ FDA 21 CFR 820 / ISO 13485 Release Gates on workflow transitions
 * (supports both company-managed and team-managed Jira projects).
 */
export async function validateReleaseTransition(args) {
  try {
    const issueKey = args?.issue?.key;
    if (!issueKey) {
      return { result: true };
    }

    const projectKey = issueKey.split('-')[0];
    const [issueRes, policy, checklist, signOff] = await Promise.all([
      api.asApp().requestJira(
        route`/rest/api/3/issue/${issueKey}?fields=summary,description,labels,components,priority,status,assignee,issuelinks`
      ),
      getProjectPolicy(projectKey),
      getIssueChecklist(issueKey),
      getIssueSignOff(issueKey),
    ]);

    if (!issueRes.ok) {
      console.warn(`[validator] Jira read failed for ${issueKey} (${issueRes.status})`);
      return { result: true };
    }

    const raw = await issueRes.json();
    const f = raw.fields || {};
    const issue = {
      id: raw.id,
      key: issueKey,
      summary: f.summary || '',
      description: extractAdfText(f.description),
      status: f.status?.name || 'In Progress',
      statusCategory: f.status?.statusCategory?.key || 'indeterminate',
      priority: f.priority?.name || 'Medium',
      assigneeName: f.assignee?.displayName || 'Unassigned',
      assigneeAccountId: f.assignee?.accountId || null,
      labels: Array.isArray(f.labels) ? f.labels : [],
      components: Array.isArray(f.components) ? f.components.map((c) => c.name) : [],
      issueLinks: Array.isArray(f.issuelinks) ? f.issuelinks : [],
    };

    const subsystem = detectDeviceSubsystem(issue);
    const fdaRes = await searchFdaDeviceRecalls({
      keyword: subsystem.fdaKeyword,
      limit: 4,
      ongoingPreferred: true,
    });

    const evaluation = evaluateIssueCompliance({
      issue,
      checklist,
      signOff,
      matchedRecalls: fdaRes.recalls || [],
      twgSignals: {},
      policy,
    });

    if (evaluation.verdict === 'SHIP_READY') {
      return { result: true };
    }

    const topGap = evaluation.blockingGaps[0] || 'Required ISO 13485 release checks incomplete';
    return {
      result: false,
      errorMessage: `MedTrace IQ FDA 21 CFR 820 Release Gate Blocked (${issueKey}): Score ${evaluation.score}/100 [${evaluation.verdict}]. ${topGap}. Complete verification & QA Sign-Off in the MedTrace IQ panel before releasing.`,
    };
  } catch (err) {
    console.error('[validator] unexpected error:', err?.message);
    return {
      result: false,
      errorMessage: `MedTrace IQ Release Gate could not verify compliance (${err?.message || 'transient error'}). Please retry or check MedTrace IQ.`,
    };
  }
}
