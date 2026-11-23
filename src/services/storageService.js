import { kvs } from '@forge/kvs';
import { appendChainedAuditEntry, verifyAuditChain } from './auditCryptoService';

const DEFAULT_POLICY = {
  regulatoryStandard: 'FDA 21 CFR 820 + ISO 13485 + ISO 14971 + 21 CFR Part 11',
  minConfidenceToShip: 80,
  blockOnUnmitigatedClassI: true,
  requireQaSignOff: true,
  autonomousFdaMonitor: true,
  defaultDeviceKeywords: ['infusion pump', 'pacemaker', 'catheter', 'ventilator', 'glucose'],
  updatedAt: null,
};

const DEFAULT_CHECKLIST = {
  designVerification: false,
  iso14971RiskReview: false,
  sopOwnerVerified: false,
  fdaRecallReviewed: false,
  linkedSopReference: '',
  mitigationNotes: '',
  updatedAt: null,
  updatedBy: null,
};

const FDA_CACHE_TTL_MS = 30 * 60 * 1000;

function safeKey(prefix, raw) {
  return `${prefix}:${String(raw || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}`;
}

export async function getProjectPolicy(projectKey) {
  try {
    const saved = await kvs.get(safeKey('policy', projectKey));
    return { ...DEFAULT_POLICY, ...(saved || {}) };
  } catch (err) {
    console.warn('[storage] getProjectPolicy fallback:', err?.message);
    return { ...DEFAULT_POLICY };
  }
}

export async function saveProjectPolicy(projectKey, patch) {
  const current = await getProjectPolicy(projectKey);
  const next = {
    ...current,
    ...patch,
    minConfidenceToShip: Math.max(50, Math.min(98, Number(patch?.minConfidenceToShip ?? current.minConfidenceToShip) || 80)),
    blockOnUnmitigatedClassI: Boolean(patch?.blockOnUnmitigatedClassI ?? current.blockOnUnmitigatedClassI),
    requireQaSignOff: Boolean(patch?.requireQaSignOff ?? current.requireQaSignOff),
    autonomousFdaMonitor: Boolean(patch?.autonomousFdaMonitor ?? current.autonomousFdaMonitor),
    updatedAt: new Date().toISOString(),
  };
  await kvs.set(safeKey('policy', projectKey), next);
  return next;
}

export async function getIssueChecklist(issueKey) {
  try {
    const saved = await kvs.get(safeKey('chk', issueKey));
    return { ...DEFAULT_CHECKLIST, ...(saved || {}) };
  } catch (err) {
    console.warn('[storage] getIssueChecklist fallback:', err?.message);
    return { ...DEFAULT_CHECKLIST };
  }
}

export async function saveIssueChecklist(issueKey, patch, actorName = 'QA Reviewer') {
  const current = await getIssueChecklist(issueKey);
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
  await kvs.set(safeKey('chk', issueKey), next);
  return next;
}

export async function getIssueSignOff(issueKey) {
  try {
    return (await kvs.get(safeKey('signoff', issueKey))) || null;
  } catch (err) {
    console.warn('[storage] getIssueSignOff fallback:', err?.message);
    return null;
  }
}

export async function getProjectAuditLedger(projectKey) {
  try {
    return (await kvs.get(safeKey('ledger', projectKey))) || [];
  } catch (err) {
    console.warn('[storage] getProjectAuditLedger fallback:', err?.message);
    return [];
  }
}

/**
 * Append a cryptographically SHA-256 hash-chained QA Sign-Off record (FDA 21 CFR Part 11).
 */
export async function recordSignOffEntry({ projectKey, issueKey, decision, rationale, actorAccountId, actorName, scoreAtSignOff }) {
  const ledgerKey = safeKey('ledger', projectKey);
  const existing = (await kvs.get(ledgerKey)) || [];
  const { entry, ledger } = appendChainedAuditEntry(existing, {
    id: `SO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    eventType: 'QA_SIGNOFF',
    projectKey,
    issueKey,
    decision,
    rationale,
    actorAccountId: actorAccountId || 'unknown',
    actorName: actorName || 'QA Approver',
    scoreAtSignOff,
  });

  await Promise.all([
    kvs.set(safeKey('signoff', issueKey), entry),
    kvs.set(ledgerKey, ledger),
  ]);

  return entry;
}

/**
 * Append an autonomous background trigger alert into the SHA-256 hash-chained audit ledger.
 */
export async function recordAutonomousAlertEntry({ projectKey, issueKey, fdaRecallNumber, rationale }) {
  const ledgerKey = safeKey('ledger', projectKey);
  const existing = (await kvs.get(ledgerKey)) || [];
  const { entry, ledger } = appendChainedAuditEntry(existing, {
    id: `TRG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    eventType: 'AUTONOMOUS_FDA_ALERT',
    projectKey,
    issueKey,
    decision: 'Auto-Hold Alert',
    rationale,
    actorAccountId: 'medtrace-autonomous-monitor',
    actorName: 'MedTrace Autonomous FDA Monitor',
    fdaRecallNumber,
  });

  await kvs.set(ledgerKey, ledger);
  return entry;
}

export async function verifyProjectAuditChain(projectKey) {
  const ledger = await getProjectAuditLedger(projectKey);
  return verifyAuditChain(ledger);
}

export async function hasTriggerAlerted(issueKey, recallNumber) {
  try {
    const found = await kvs.get(safeKey('trgalert', `${issueKey}_${recallNumber}`));
    return Boolean(found);
  } catch {
    return false;
  }
}

export async function markTriggerAlerted(issueKey, recallNumber) {
  try {
    await kvs.set(safeKey('trgalert', `${issueKey}_${recallNumber}`), {
      issueKey,
      recallNumber,
      alertedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[storage] markTriggerAlerted warning:', err?.message);
  }
}

export async function isDemoPortfolioCalibrated(projectKey) {
  try {
    return Boolean(await kvs.get(safeKey('democal', projectKey)));
  } catch {
    return false;
  }
}

export async function markDemoPortfolioCalibrated(projectKey) {
  try {
    await kvs.set(safeKey('democal', projectKey), { calibratedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('[storage] markDemoPortfolioCalibrated warning:', err?.message);
  }
}

export async function getIssueComplianceStateMap(issueKeys = []) {
  const entries = await Promise.all(
    issueKeys.map(async (key) => {
      const [checklist, signOff] = await Promise.all([
        getIssueChecklist(key),
        getIssueSignOff(key),
      ]);
      return [key, { checklist, signOff }];
    })
  );
  return Object.fromEntries(entries);
}

export async function getCachedFdaQuery(cacheSlug) {
  try {
    const cached = await kvs.get(safeKey('fda', cacheSlug));
    if (!cached || !cached.fetchedAt) return null;
    if (Date.now() - cached.fetchedAt > FDA_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

export async function setCachedFdaQuery(cacheSlug, payload) {
  try {
    await kvs.set(safeKey('fda', cacheSlug), {
      ...payload,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[storage] setCachedFdaQuery warning:', err?.message);
  }
}

const TWG_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCachedTwgSnapshot(projectKey) {
  try {
    const cached = await kvs.get(safeKey('twg', projectKey));
    if (!cached || !cached.cachedAt) return null;
    if (Date.now() - cached.cachedAt > TWG_SNAPSHOT_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

export async function setCachedTwgSnapshot(projectKey, twg) {
  try {
    if (!twg) return;
    const prev = (await getCachedTwgSnapshot(projectKey)) || {};
    const teams = twg.teams?.length ? twg.teams.slice(0, 20) : prev.teams || [];
    const confluencePages = twg.confluencePages?.length ? twg.confluencePages.slice(0, 20) : prev.confluencePages || [];
    const goals = twg.goals?.length ? twg.goals.slice(0, 15) : prev.goals || [];
    const graphWorkItems = twg.graphWorkItems?.length ? twg.graphWorkItems.slice(0, 25) : prev.graphWorkItems || [];
    const linkedPageRelations = twg.linkedPageRelations?.length
      ? twg.linkedPageRelations.slice(0, 20)
      : prev.linkedPageRelations || [];
    if (teams.length + confluencePages.length + goals.length === 0) return;
    await kvs.set(safeKey('twg', projectKey), {
      teams,
      confluencePages,
      goals,
      graphWorkItems,
      linkedPageRelations,
      cachedAt: Date.now(),
      cachedIso: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[storage] setCachedTwgSnapshot warning:', err?.message);
  }
}
