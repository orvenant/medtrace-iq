import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENESIS_HASH,
  appendChainedAuditEntry,
  verifyAuditChain,
} from '../services/auditCryptoService.js';

test('appendChainedAuditEntry builds valid SHA-256 21 CFR Part 11 hash chain (newest-first ledger)', () => {
  let ledger = [];

  const r1 = appendChainedAuditEntry(ledger, {
    id: 'SO-1',
    eventType: 'QA_SIGNOFF',
    projectKey: 'MED',
    issueKey: 'MED-1',
    decision: 'Conditional',
    rationale: 'Initial design review completed.',
    actorAccountId: 'acc-1',
    actorName: 'Amin',
    scoreAtSignOff: 72,
    recordedAt: '2026-11-23T12:00:00.000Z',
  });
  ledger = r1.ledger;
  assert.equal(r1.entry.previousHash, GENESIS_HASH);
  assert.equal(r1.entry.entryHash.length, 64);

  const r2 = appendChainedAuditEntry(ledger, {
    id: 'AUTO-2',
    eventType: 'AUTONOMOUS_FDA_ALERT',
    projectKey: 'MED',
    issueKey: 'MED-2',
    decision: 'Hold',
    rationale: 'Autonomous openFDA monitor detected Class I recall Z-0316-2027.',
    actorAccountId: 'system:medtrace-trigger',
    actorName: 'MedTrace Autonomous FDA Monitor',
    scoreAtSignOff: 42,
    recordedAt: '2026-11-23T12:05:00.000Z',
  });
  ledger = r2.ledger;
  assert.equal(r2.entry.previousHash, r1.entry.entryHash);

  const check = verifyAuditChain(ledger);
  assert.equal(check.valid, true);
  assert.equal(check.totalEntries, 2);
  assert.equal(check.verifiedChainedEntries, 2);
  assert.equal(check.legacyEntries, 0);
  assert.equal(check.headHash, r2.entry.entryHash);
});

test('verifyAuditChain immediately detects tampering with rationale or chain linkage', () => {
  let ledger = [];
  const r1 = appendChainedAuditEntry(ledger, {
    id: 'SO-10',
    eventType: 'QA_SIGNOFF',
    projectKey: 'MED',
    issueKey: 'MED-4',
    decision: 'Approved',
    rationale: 'Original QA approval rationale.',
    actorAccountId: 'acc-1',
    actorName: 'QA Director',
    scoreAtSignOff: 92,
    recordedAt: '2026-11-23T13:00:00.000Z',
  });
  ledger = r1.ledger;

  const r2 = appendChainedAuditEntry(ledger, {
    id: 'SO-11',
    eventType: 'QA_SIGNOFF',
    projectKey: 'MED',
    issueKey: 'MED-5',
    decision: 'Approved',
    rationale: 'Second sign-off.',
    actorAccountId: 'acc-1',
    actorName: 'QA Director',
    scoreAtSignOff: 95,
    recordedAt: '2026-11-23T13:10:00.000Z',
  });
  ledger = r2.ledger;

  // Tamper with the older entry's rationale post-hoc
  const tampered = ledger.map((e) =>
    e.id === 'SO-10' ? { ...e, rationale: 'TAMPERED RATIONALE!' } : e
  );

  const result = verifyAuditChain(tampered);
  assert.equal(result.valid, false);
  assert.equal(result.brokenEntryId, 'SO-10');
  assert.match(result.brokenReason, /SHA-256 digest mismatch/i);
});

test('verifyAuditChain gracefully coexists with legacy pre-v3 unchained records', () => {
  const legacyRecord = {
    id: 'SO-LEGACY-1',
    projectKey: 'MED',
    issueKey: 'MED-5',
    decision: 'Approved',
    rationale: 'Recorded in v2.2.0 before hash chaining.',
    actorAccountId: 'acc-1',
    actorName: 'Amin',
    scoreAtSignOff: 95,
    recordedAt: '2026-11-23T10:00:00.000Z',
  };

  const { ledger } = appendChainedAuditEntry([legacyRecord], {
    id: 'SO-V3-1',
    eventType: 'QA_SIGNOFF',
    projectKey: 'MED',
    issueKey: 'MED-4',
    decision: 'Approved',
    rationale: 'Recorded in v3.0.0 with SHA-256 chain.',
    actorAccountId: 'acc-1',
    actorName: 'Amin',
    scoreAtSignOff: 90,
    recordedAt: '2026-11-23T14:00:00.000Z',
  });

  const check = verifyAuditChain(ledger);
  assert.equal(check.valid, true);
  assert.equal(check.totalEntries, 2);
  assert.equal(check.verifiedChainedEntries, 1);
  assert.equal(check.legacyEntries, 1);
});
