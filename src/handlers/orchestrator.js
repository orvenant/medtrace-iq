import {
  getCurrentUser,
  getProjectDetails,
  getProjectIssues,
  getIssueDetails,
  createCapaIssue,
  addRegulatoryAuditComment,
  seedMedTechDemoIssues,
} from '../services/jiraService';
import {
  getProjectPolicy,
  saveProjectPolicy,
  getIssueChecklist,
  saveIssueChecklist,
  getIssueSignOff,
  recordSignOffEntry,
  getProjectAuditLedger,
  getIssueComplianceStateMap,
} from '../services/storageService';
import { fetchRecallsForSubsystems, searchFdaDeviceRecalls } from '../services/openFdaService';
import { fetchProjectTeamworkGraph, fetchIssueTeamworkGraph } from '../services/teamworkGraphService';
import {
  detectDeviceSubsystem,
  matchRecallsForIssue,
  evaluateIssueCompliance,
  buildBlastRadiusGraph,
  generateAuditMarkdown,
} from '../services/complianceEngine';

export async function buildProjectCockpitData({ projectKey, cloudId, accountId }) {
  const [user, project, issues, policy, ledger] = await Promise.all([
    accountId ? Promise.resolve({ accountId, displayName: 'Jira Reviewer' }) : getCurrentUser(),
    getProjectDetails(projectKey),
    getProjectIssues(projectKey, 35),
    getProjectPolicy(projectKey),
    getProjectAuditLedger(projectKey),
  ]);

  const effectiveAccountId = accountId || user.accountId;

  // Detect unique medical device subsystems across project issues
  const detectedSubsystems = issues.map((iss) => detectDeviceSubsystem(iss));
  const fdaKeywords = [
    ...new Set([
      ...detectedSubsystems.filter((s) => s.matchedDirectly).map((s) => s.fdaKeyword),
      ...(policy.defaultDeviceKeywords || []).slice(0, 3),
    ]),
  ].slice(0, 5);

  const [twg, fdaBundle, complianceMap] = await Promise.all([
    fetchProjectTeamworkGraph({
      cloudId,
      projectId: project.id,
      accountId: effectiveAccountId,
    }),
    fetchRecallsForSubsystems(fdaKeywords, 4),
    getIssueComplianceStateMap(issues.map((i) => i.key)),
  ]);

  const evaluations = issues.map((issue) => {
    const sub = detectDeviceSubsystem(issue);
    const matchedRecalls = matchRecallsForIssue(issue, sub, fdaBundle.allRecalls);
    const saved = complianceMap[issue.key] || {};
    return evaluateIssueCompliance({
      issue,
      checklist: saved.checklist || {},
      signOff: saved.signOff || null,
      matchedRecalls,
      twgSignals: {
        teams: twg.teams,
        confluencePages: twg.confluencePages,
        goals: twg.goals,
        devArtifacts: [],
      },
      policy,
    });
  });

  const totalIssues = evaluations.length;
  const averageScore = totalIssues
    ? Math.round(evaluations.reduce((acc, e) => acc + e.score, 0) / totalIssues)
    : 100;
  const shipReadyCount = evaluations.filter((e) => e.verdict === 'SHIP_READY').length;
  const conditionalCount = evaluations.filter((e) => e.verdict === 'CONDITIONAL').length;
  const holdCount = evaluations.filter((e) => e.verdict === 'HOLD').length;
  const capaCount = evaluations.filter((e) => e.isCapa).length;
  const classIExposure = evaluations.filter((e) => e.classICount > 0 && !e.checklist?.fdaRecallReviewed).length;

  let overallVerdict = 'SHIP_READY';
  if (holdCount > 0 || averageScore < 55) overallVerdict = 'HOLD';
  else if (conditionalCount > 0 || averageScore < (policy.minConfidenceToShip || 80)) overallVerdict = 'CONDITIONAL';

  const summary = {
    totalIssues,
    averageScore,
    overallVerdict,
    shipReadyCount,
    conditionalCount,
    holdCount,
    capaCount,
    classIExposure,
    twgConnected: twg.connected,
    twgTeamsCount: twg.teams.length,
    twgSopCount: twg.confluencePages.length,
    twgGoalsCount: twg.goals.length,
    fdaLiveCount: fdaBundle.allRecalls.length,
  };

  const graph = buildBlastRadiusGraph({
    project,
    evaluations,
    twg,
    fdaRecalls: fdaBundle.allRecalls,
  });

  const auditMarkdown = generateAuditMarkdown({
    project,
    summary,
    evaluations,
    twg,
    ledger,
  });

  return {
    project,
    policy,
    summary,
    evaluations,
    twg,
    fda: fdaBundle,
    graph,
    ledger,
    auditMarkdown,
    generatedAt: new Date().toISOString(),
  };
}

export async function buildIssueComplianceData({ issueKey, cloudId, accountId }) {
  const [user, issue] = await Promise.all([
    getCurrentUser(),
    getIssueDetails(issueKey),
  ]);

  const effectiveAccountId = accountId || user.accountId;
  const subsystem = detectDeviceSubsystem(issue);

  const [policy, checklist, signOff, twg, fdaResult] = await Promise.all([
    getProjectPolicy(issue.projectKey),
    getIssueChecklist(issue.key),
    getIssueSignOff(issue.key),
    fetchIssueTeamworkGraph({
      cloudId,
      issueId: issue.id,
      accountId: effectiveAccountId,
    }),
    searchFdaDeviceRecalls({ keyword: subsystem.fdaKeyword, limit: 6, ongoingPreferred: true }),
  ]);

  const evaluation = evaluateIssueCompliance({
    issue,
    checklist,
    signOff,
    matchedRecalls: fdaResult.recalls || [],
    twgSignals: twg,
    policy,
  });

  return {
    issue,
    policy,
    evaluation,
    twg,
    fda: fdaResult,
    reviewer: user,
    generatedAt: new Date().toISOString(),
  };
}

export async function performCreateCapa({ projectKey, sourceIssueKey, title, severity, rationale, fdaRecallNumber }) {
  return createCapaIssue({
    projectKey,
    sourceIssueKey,
    title,
    severity,
    rationale,
    fdaRecallNumber,
  });
}

export async function performRegulatorySignOff({ issueKey, decision, rationale, cloudId }) {
  const normalizedDecision = ['Approved', 'Conditional', 'Hold'].includes(decision) ? decision : 'Conditional';
  const [user, issue] = await Promise.all([getCurrentUser(), getIssueDetails(issueKey)]);
  const [policy, checklist] = await Promise.all([
    getProjectPolicy(issue.projectKey),
    getIssueChecklist(issue.key),
  ]);

  const preliminary = evaluateIssueCompliance({
    issue,
    checklist,
    signOff: { decision: normalizedDecision, actorName: user.displayName, rationale },
    matchedRecalls: [],
    twgSignals: {},
    policy,
  });

  const entry = await recordSignOffEntry({
    projectKey: issue.projectKey,
    issueKey: issue.key,
    decision: normalizedDecision,
    rationale,
    actorAccountId: user.accountId,
    actorName: user.displayName,
    scoreAtSignOff: preliminary.score,
  });

  const commentRes = await addRegulatoryAuditComment(issue.key, {
    decision: normalizedDecision,
    rationale,
    score: preliminary.score,
    actorName: user.displayName,
    recordedAt: entry.recordedAt,
    entryId: entry.id,
  });

  return {
    entry,
    jiraCommentPosted: commentRes.commented,
    updatedScoreEstimate: preliminary.score,
    cloudId,
  };
}

export async function performUpdateChecklist({ issueKey, patch }) {
  const user = await getCurrentUser();
  return saveIssueChecklist(issueKey, patch, user.displayName);
}

export async function performSavePolicy({ projectKey, patch }) {
  return saveProjectPolicy(projectKey, patch);
}

export async function performSeedDemo({ projectKey }) {
  return seedMedTechDemoIssues(projectKey);
}
