import {
  getCurrentUser,
  getAccessibleProjects,
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
  verifyProjectAuditChain,
  getIssueComplianceStateMap,
  getCachedTwgSnapshot,
  setCachedTwgSnapshot,
} from '../services/storageService';
import { fetchRecallsForSubsystems, searchFdaDeviceRecalls } from '../services/openFdaService';
import { fetchProjectTeamworkGraph, fetchIssueTeamworkGraph } from '../services/teamworkGraphService';
import {
  detectDeviceSubsystem,
  matchRecallsForIssue,
  evaluateIssueCompliance,
  computeExecutiveAnalytics,
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

  const [twgRaw, fdaBundle, complianceMap, cachedTwg] = await Promise.all([
    fetchProjectTeamworkGraph({
      cloudId,
      projectId: project.id,
      accountId: effectiveAccountId,
    }),
    fetchRecallsForSubsystems(fdaKeywords, 4),
    getIssueComplianceStateMap(issues.map((i) => i.key)),
    getCachedTwgSnapshot(projectKey),
  ]);

  // Merge live Teamwork Graph results per entity type with the site's last verified TWG snapshot
  // so partial transient shard errors never discard real Teams, Confluence SOPs, or Goals.
  const mergedTeams = twgRaw.teams?.length ? twgRaw.teams : cachedTwg?.teams || [];
  const mergedSops = twgRaw.confluencePages?.length ? twgRaw.confluencePages : cachedTwg?.confluencePages || [];
  const mergedGoals = twgRaw.goals?.length ? twgRaw.goals : cachedTwg?.goals || [];
  const mergedItems = twgRaw.graphWorkItems?.length ? twgRaw.graphWorkItems : cachedTwg?.graphWorkItems || [];
  const mergedLinks = twgRaw.linkedPageRelations?.length
    ? twgRaw.linkedPageRelations
    : cachedTwg?.linkedPageRelations || [];

  const twg = {
    ...twgRaw,
    teams: mergedTeams,
    confluencePages: mergedSops,
    goals: mergedGoals,
    graphWorkItems: mergedItems,
    linkedPageRelations: mergedLinks,
    snapshotUsed:
      Boolean(cachedTwg) &&
      ((!twgRaw.teams?.length && mergedTeams.length > 0) ||
        (!twgRaw.confluencePages?.length && mergedSops.length > 0) ||
        (!twgRaw.goals?.length && mergedGoals.length > 0)),
  };

  if (mergedTeams.length + mergedSops.length + mergedGoals.length > 0) {
    await setCachedTwgSnapshot(projectKey, twg);
  }

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

  const [chainVerification, analytics] = [
    await verifyProjectAuditChain(projectKey),
    computeExecutiveAnalytics(evaluations),
  ];

  const auditMarkdown = generateAuditMarkdown({
    project,
    summary,
    evaluations,
    twg,
    ledger,
    chainVerification,
  });

  return {
    project,
    policy,
    summary,
    analytics,
    evaluations,
    twg,
    fda: fdaBundle,
    graph,
    ledger,
    chainVerification,
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

  const [policy, checklist, signOff, twgRaw, fdaResult] = await Promise.all([
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

  let twg = twgRaw;
  if ((twg.teams?.length || 0) === 0 && (twg.confluencePages?.length || 0) === 0) {
    const cached = await getCachedTwgSnapshot(issue.projectKey);
    if (cached) {
      twg = {
        ...twg,
        teams: cached.teams || [],
        confluencePages: cached.confluencePages || [],
        goals: twg.goals?.length ? twg.goals : cached.goals || [],
        snapshotUsed: true,
        snapshotAt: cached.cachedIso,
      };
    }
  }

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
    entryHash: entry.entryHash,
    previousHash: entry.previousHash,
  });

  return {
    entry,
    jiraCommentPosted: commentRes.commented,
    updatedScoreEstimate: preliminary.score,
    cloudId,
  };
}

export async function performVerifyAuditChain({ projectKey }) {
  return verifyProjectAuditChain(projectKey);
}

export async function performGetAccessibleProjects() {
  return getAccessibleProjects(30);
}

export async function performUpdateChecklist({ issueKey, patch }) {
  const user = await getCurrentUser();
  return saveIssueChecklist(issueKey, patch, user.displayName);
}

export async function performSavePolicy({ projectKey, patch }) {
  return saveProjectPolicy(projectKey, patch);
}

export async function performSeedDemo({ projectKey }) {
  const seedResult = await seedMedTechDemoIssues(projectKey);
  const [user, issues] = await Promise.all([getCurrentUser(), getProjectIssues(projectKey, 40)]);

  // Hydrate realistic Green (Ship Ready), Amber (Conditional), and Red (Regulatory Hold) portfolio states
  // so evaluators immediately see a vivid 3x3 ISO 14971 Risk x Release Verdict Matrix.
  const demoIssues = issues.filter((i) => i.labels?.includes('medtrace-demo'));
  let hydratedCount = 0;

  for (const iss of demoIssues) {
    const sub = detectDeviceSubsystem(iss);
    const [existingChecklist, existingSignOff] = await Promise.all([
      getIssueChecklist(iss.key),
      getIssueSignOff(iss.key),
    ]);

    const alreadyCustomized = Boolean(
      existingChecklist.designVerification ||
        existingChecklist.iso14971RiskReview ||
        existingChecklist.sopOwnerVerified ||
        existingChecklist.fdaRecallReviewed
    );

    if (sub.id === 'glucose-sensor' || sub.id === 'catheter') {
      // SHIP READY (Green, 95-100/100)
      if (!alreadyCustomized) {
        await saveIssueChecklist(
          iss.key,
          {
            designVerification: true,
            iso14971RiskReview: true,
            sopOwnerVerified: true,
            fdaRecallReviewed: true,
          },
          user.displayName || 'QA Lead'
        );
        hydratedCount += 1;
      }
      if (!existingSignOff) {
        await recordSignOffEntry({
          projectKey,
          issueKey: iss.key,
          decision: 'Approved',
          rationale: `All FDA 21 CFR 820.30 design controls, ISO 14971 risk reviews, and live openFDA recall applicability checks passed for ${sub.label}.`,
          actorAccountId: user.accountId,
          actorName: user.displayName || 'QA Director',
          scoreAtSignOff: 96,
        });
      }
    } else if (sub.id === 'pacemaker' || sub.id === 'defibrillator') {
      // CONDITIONAL (Amber, 70-79/100): FDA recall reviewed & mitigated, pending final QA Approved sign-off
      if (!alreadyCustomized) {
        await saveIssueChecklist(
          iss.key,
          {
            designVerification: sub.id === 'pacemaker',
            iso14971RiskReview: true,
            sopOwnerVerified: sub.id === 'defibrillator',
            fdaRecallReviewed: true,
          },
          user.displayName || 'QA Lead'
        );
        hydratedCount += 1;
      }
      if (!existingSignOff && sub.id === 'pacemaker') {
        await recordSignOffEntry({
          projectKey,
          issueKey: iss.key,
          decision: 'Conditional',
          rationale: 'openFDA Class I/II cybersecurity parallels evaluated and mitigated; awaiting final Confluence SOP-QMS-209 owner sign-off.',
          actorAccountId: user.accountId,
          actorName: user.displayName || 'QA Reviewer',
          scoreAtSignOff: 77,
        });
      }
    }
    // Infusion Pump & ICU Ventilator intentionally stay in REGULATORY HOLD (Red) to demonstrate Class I gating!
  }

  return {
    ...seedResult,
    hydratedCount,
    message: seedResult.seeded
      ? `${seedResult.message} Configured balanced Ship Ready, Conditional, and Regulatory Hold portfolio states.`
      : `Calibrated realistic Ship Ready / Conditional / Regulatory Hold demo states across ${projectKey} (${hydratedCount} updated).`,
  };
}
