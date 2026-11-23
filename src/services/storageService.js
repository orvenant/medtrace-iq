import { kvs } from '@forge/kvs';

const DEFAULT_POLICY = {
  regulatoryStandard: 'FDA 21 CFR 820 + ISO 13485 + ISO 14971',
  minConfidenceToShip: 80,
  blockOnUnmitigatedClassI: true,
  requireQaSignOff: true,
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

export async function recordSignOffEntry({ projectKey, issueKey, decision, rationale, actorAccountId, actorName, scoreAtSignOff }) {
  const entry = {
    id: `SO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    projectKey,
    issueKey,
    decision,
    rationale,
    actorAccountId: actorAccountId || 'unknown',
    actorName: actorName || 'QA Approver',
    scoreAtSignOff: typeof scoreAtSignOff === 'number' ? scoreAtSignOff : null,
    recordedAt: new Date().toISOString(),
  };

  await kvs.set(safeKey('signoff', issueKey), entry);

  const ledgerKey = safeKey('ledger', projectKey);
  const existing = (await kvs.get(ledgerKey)) || [];
  const updatedLedger = [entry, ...existing].slice(0, 100);
  await kvs.set(ledgerKey, updatedLedger);

  return entry;
}

export async function getProjectAuditLedger(projectKey) {
  try {
    return (await kvs.get(safeKey('ledger', projectKey))) || [];
  } catch (err) {
    console.warn('[storage] getProjectAuditLedger fallback:', err?.message);
    return [];
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
