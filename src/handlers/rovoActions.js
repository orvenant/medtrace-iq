import {
  buildProjectCockpitData,
  buildIssueComplianceData,
  performCreateCapa,
  performRegulatorySignOff,
  performVerifyAuditChain,
} from './orchestrator';
import { searchFdaDeviceRecalls } from '../services/openFdaService';
import { fetchProjectTeamworkGraph, fetchIssueTeamworkGraph } from '../services/teamworkGraphService';
import { getCurrentUser, getProjectDetails, getIssueDetails } from '../services/jiraService';
import { setCachedTwgSnapshot } from '../services/storageService';

function getActionContext(context) {
  return {
    cloudId: context?.cloudId || context?.installContext?.split('/').pop() || '',
    accountId: context?.accountId || context?.principal?.accountId || '',
  };
}

export async function actGetProjectReadiness(payload, context) {
  try {
    const projectKey = String(payload?.projectKey || '').trim().toUpperCase();
    if (!projectKey) {
      return { ok: false, error: 'Please provide a Jira projectKey (e.g., MED or PLAT).' };
    }
    const { cloudId, accountId } = getActionContext(context);
    const cockpit = await buildProjectCockpitData({ projectKey, cloudId, accountId });

    return {
      ok: true,
      project: { key: cockpit.project.key, name: cockpit.project.name },
      summary: cockpit.summary,
      topBlockedIssues: cockpit.evaluations
        .filter((e) => e.verdict !== 'SHIP_READY')
        .slice(0, 8)
        .map((e) => ({
          issueKey: e.issueKey,
          summary: e.summary,
          subsystem: e.subsystem.label,
          riskTier: e.riskTier,
          score: e.score,
          verdict: e.verdict,
          classIRecalls: e.classICount,
          blockingGaps: e.blockingGaps.slice(0, 3),
        })),
      teamworkGraph: {
        connected: cockpit.twg.connected,
        teams: cockpit.twg.teams.map((t) => t.displayName),
        confluenceSops: cockpit.twg.confluencePages.slice(0, 5).map((p) => ({
          title: p.title,
          owner: p.ownerName,
          space: p.spaceKey,
          url: p.webUrl,
        })),
        goals: cockpit.twg.goals.map((g) => ({ key: g.key, name: g.name })),
      },
      recentFdaSignals: cockpit.fda.allRecalls.slice(0, 5).map((r) => ({
        recallNumber: r.recallNumber,
        classification: r.classification,
        recallingFirm: r.recallingFirm,
        status: r.status,
        reason: r.reasonForRecall.slice(0, 160),
      })),
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to compute project readiness' };
  }
}

export async function actAnalyzeIssueCompliance(payload, context) {
  try {
    const issueKey = String(payload?.issueKey || '').trim().toUpperCase();
    if (!issueKey) {
      return { ok: false, error: 'Please provide a valid Jira issueKey (e.g., MED-12).' };
    }
    const { cloudId, accountId } = getActionContext(context);
    const data = await buildIssueComplianceData({ issueKey, cloudId, accountId });

    return {
      ok: true,
      issueKey: data.issue.key,
      summary: data.issue.summary,
      status: data.issue.status,
      subsystem: data.evaluation.subsystem,
      riskTier: data.evaluation.riskTier,
      shipConfidenceScore: data.evaluation.score,
      verdict: data.evaluation.verdict,
      pillars: data.evaluation.pillars,
      blockingGaps: data.evaluation.blockingGaps,
      positiveSignals: data.evaluation.positiveSignals,
      signOff: data.evaluation.signOff,
      matchedFdaRecalls: data.evaluation.matchedRecalls.slice(0, 4).map((r) => ({
        recallNumber: r.recallNumber,
        classification: r.classification,
        status: r.status,
        recallingFirm: r.recallingFirm,
        reasonForRecall: r.reasonForRecall.slice(0, 200),
      })),
      teamworkGraph: {
        connected: data.twg.connected,
        goals: data.twg.goals,
        teams: data.twg.teams,
        devArtifacts: data.twg.devArtifacts,
        confluenceSops: data.twg.confluencePages.slice(0, 5),
        recentComments: data.twg.comments.slice(0, 3),
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to analyze issue compliance' };
  }
}

export async function actSearchFdaRecalls(payload) {
  try {
    const keyword = String(payload?.keyword || 'infusion pump').trim();
    const classification = String(payload?.classification || '').trim();
    const limit = Number(payload?.limit) || 5;
    const result = await searchFdaDeviceRecalls({ keyword, classification, limit, ongoingPreferred: true });
    return {
      ok: true,
      source: result.source,
      keyword: result.keyword,
      classification: result.classification,
      totalAvailable: result.totalAvailable,
      recalls: result.recalls,
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'openFDA query failed' };
  }
}

export async function actQueryTeamworkGraph(payload, context) {
  try {
    const { cloudId, accountId } = getActionContext(context);
    const user = accountId ? { accountId } : await getCurrentUser();
    const effectiveAccountId = accountId || user.accountId;

    if (payload?.issueKey) {
      const issue = await getIssueDetails(String(payload.issueKey).trim().toUpperCase());
      const twg = await fetchIssueTeamworkGraph({
        cloudId,
        issueId: issue.id,
        accountId: effectiveAccountId,
      });
      return { ok: true, scope: 'issue', issueKey: issue.key, teamworkGraph: twg };
    }

    if (payload?.projectKey) {
      const project = await getProjectDetails(String(payload.projectKey).trim().toUpperCase());
      const twg = await fetchProjectTeamworkGraph({
        cloudId,
        projectId: project.id,
        accountId: effectiveAccountId,
      });
      await setCachedTwgSnapshot(project.key, twg);
      return { ok: true, scope: 'project', projectKey: project.key, teamworkGraph: twg };
    }

    const twg = await fetchProjectTeamworkGraph({
      cloudId,
      projectId: null,
      accountId: effectiveAccountId,
    });
    return { ok: true, scope: 'user', teamworkGraph: twg };
  } catch (err) {
    return { ok: false, error: err?.message || 'Teamwork Graph query failed' };
  }
}

export async function actCreateCapaTicket(payload) {
  try {
    const projectKey = String(payload?.projectKey || '').trim().toUpperCase();
    const title = String(payload?.title || '').trim();
    const severity = String(payload?.severity || 'High').trim();
    const rationale = String(payload?.rationale || '').trim();
    const sourceIssueKey = payload?.sourceIssueKey ? String(payload.sourceIssueKey).trim().toUpperCase() : '';
    const fdaRecallNumber = payload?.fdaRecallNumber ? String(payload.fdaRecallNumber).trim() : '';

    if (!projectKey || !title || !rationale) {
      return { ok: false, error: 'projectKey, title, and rationale are required to create a CAPA ticket.' };
    }

    const created = await performCreateCapa({
      projectKey,
      sourceIssueKey,
      title,
      severity,
      rationale,
      fdaRecallNumber,
    });
    return { ok: true, capa: created };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to create CAPA ticket' };
  }
}

export async function actRecordRegulatorySignoff(payload, context) {
  try {
    const issueKey = String(payload?.issueKey || '').trim().toUpperCase();
    const decision = String(payload?.decision || '').trim();
    const rationale = String(payload?.rationale || '').trim();
    if (!issueKey || !decision || !rationale) {
      return { ok: false, error: 'issueKey, decision (Approved/Conditional/Hold), and rationale are required.' };
    }
    const { cloudId } = getActionContext(context);
    const result = await performRegulatorySignOff({ issueKey, decision, rationale, cloudId });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to record regulatory sign-off' };
  }
}

export async function actVerifyAuditChain(payload) {
  try {
    const projectKey = String(payload?.projectKey || '').trim().toUpperCase();
    if (!projectKey) {
      return { ok: false, error: 'Please provide a Jira projectKey (e.g., MED) to verify its 21 CFR Part 11 audit chain.' };
    }
    const verification = await performVerifyAuditChain({ projectKey });
    return { ok: true, projectKey, verification };
  } catch (err) {
    return { ok: false, error: err?.message || 'Audit chain verification failed' };
  }
}
