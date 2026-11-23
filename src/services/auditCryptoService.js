import crypto from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

/**
 * Compute deterministic SHA-256 hash for a 21 CFR Part 11 electronic audit ledger record.
 */
export function computeAuditEntryHash(entry, previousHash = GENESIS_HASH) {
  const canonicalPayload = [
    previousHash || GENESIS_HASH,
    entry.id || '',
    entry.eventType || 'QA_SIGNOFF',
    entry.projectKey || '',
    entry.issueKey || '',
    entry.decision || '',
    entry.actorAccountId || '',
    entry.actorName || '',
    entry.recordedAt || '',
    entry.rationale || '',
  ].join('|');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

/**
 * Prepend a newly hashed audit record onto a newest-first ledger array.
 */
export function appendChainedAuditEntry(existingLedger = [], recordInput) {
  const latestChained = existingLedger.find((e) => typeof e?.entryHash === 'string' && e.entryHash.length === 64);
  const previousHash = latestChained ? latestChained.entryHash : GENESIS_HASH;

  const baseRecord = {
    id: recordInput.id || `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    eventType: recordInput.eventType || 'QA_SIGNOFF',
    projectKey: recordInput.projectKey || '',
    issueKey: recordInput.issueKey || '',
    decision: recordInput.decision || 'Recorded',
    rationale: recordInput.rationale || '',
    actorAccountId: recordInput.actorAccountId || 'system',
    actorName: recordInput.actorName || 'MedTrace IQ',
    scoreAtSignOff: typeof recordInput.scoreAtSignOff === 'number' ? recordInput.scoreAtSignOff : null,
    fdaRecallNumber: recordInput.fdaRecallNumber || null,
    recordedAt: recordInput.recordedAt || new Date().toISOString(),
    previousHash,
  };

  const entryHash = computeAuditEntryHash(baseRecord, previousHash);
  const sealed = {
    ...baseRecord,
    entryHash,
    hashAlgorithm: 'SHA-256',
    standard: 'FDA 21 CFR Part 11',
  };

  return {
    entry: sealed,
    ledger: [sealed, ...existingLedger].slice(0, 150),
  };
}

/**
 * Cryptographically verify the entire hash chain from oldest chained record to newest head.
 * Gracefully identifies any pre-v3 legacy unchained entries without breaking verification of chained blocks.
 */
export function verifyAuditChain(ledger = []) {
  const chronological = [...ledger].reverse();
  let expectedPrev = GENESIS_HASH;
  let verifiedChainedEntries = 0;
  let legacyEntries = 0;
  let brokenEntryId = null;
  let brokenReason = null;
  let headHash = GENESIS_HASH;

  for (const entry of chronological) {
    if (!entry?.entryHash) {
      legacyEntries += 1;
      continue;
    }

    if (entry.previousHash !== expectedPrev) {
      brokenEntryId = entry.id || 'unknown';
      brokenReason = `Previous hash mismatch on ${entry.id}: expected ${expectedPrev.slice(0, 12)}..., found ${String(entry.previousHash || '').slice(0, 12)}...`;
      break;
    }

    const recomputed = computeAuditEntryHash(entry, expectedPrev);
    if (recomputed !== entry.entryHash) {
      brokenEntryId = entry.id || 'unknown';
      brokenReason = `SHA-256 digest mismatch on ${entry.id}: record appears modified after signing.`;
      break;
    }

    expectedPrev = entry.entryHash;
    headHash = entry.entryHash;
    verifiedChainedEntries += 1;
  }

  return {
    valid: brokenEntryId === null,
    standard: 'FDA 21 CFR Part 11 — SHA-256 Hash Chain',
    totalEntries: ledger.length,
    verifiedChainedEntries,
    legacyEntries,
    headHash,
    headHashShort: headHash === GENESIS_HASH ? 'GENESIS (empty)' : `${headHash.slice(0, 12)}…${headHash.slice(-8)}`,
    brokenEntryId,
    brokenReason,
    verifiedAt: new Date().toISOString(),
  };
}
