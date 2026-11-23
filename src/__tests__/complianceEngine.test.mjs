import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDeviceSubsystem,
  matchRecallsForIssue,
  matchSopsForIssue,
  evaluateIssueCompliance,
  computeExecutiveAnalytics,
  buildBlastRadiusGraph,
  generateAuditMarkdown,
} from '../services/complianceEngine.js';

test('detectDeviceSubsystem accurately classifies regulated medical subsystems', () => {
  const pump = detectDeviceSubsystem({
    summary: 'SmartFlow Infusion Pump Occlusion Sensor Firmware v4.2',
    description: 'Updates bolus and occlusion pressure threshold.',
    labels: ['firmware'],
  });
  assert.equal(pump.id, 'infusion-pump');
  assert.equal(pump.fdaKeyword, 'infusion pump');
  assert.equal(pump.matchedDirectly, true);

  const pacemaker = detectDeviceSubsystem({
    summary: 'Dual-chamber cardiac pacemaker BLE pairing rotation',
    description: '',
    labels: ['cardiac'],
  });
  assert.equal(pacemaker.id, 'pacemaker');
  assert.equal(pacemaker.deviceClass, 'Class III / Life-Sustaining');

  const generic = detectDeviceSubsystem({
    summary: 'Update login telemetry metrics',
    description: 'General dashboard cleanup',
    labels: [],
  });
  assert.equal(generic.id, 'samd-platform');
  assert.equal(generic.matchedDirectly, false);
});

test('evaluateIssueCompliance enforces Regulatory Hold on unmitigated Class I FDA recall', () => {
  const issue = {
    id: '10001',
    key: 'MED-1',
    summary: 'Infusion Pump Occlusion Sensor Threshold Update',
    description:
      'Design control specification for volumetric infusion pump downstream occlusion alarm threshold reduction from 18 seconds to 9 seconds with IEC 60601-2-24 compliance.',
    status: 'In Progress',
    statusCategory: 'indeterminate',
    priority: 'High',
    assigneeName: 'Dr. Leyla Kaya',
    assigneeAccountId: 'acc-1',
    labels: ['infusion-pump', 'iso-14971'],
    issueLinks: [],
  };

  const recalls = [
    {
      recallNumber: 'Z-0991-2026',
      classification: 'Class I',
      status: 'Ongoing',
      recallingFirm: 'MedEquip Corp',
      productDescription: 'Volumetric Infusion Pump Series 4',
      reasonForRecall: 'False occlusion alarm delay causing therapy interruption',
      matchedKeyword: 'infusion pump',
    },
  ];

  const matched = matchRecallsForIssue(issue, detectDeviceSubsystem(issue), recalls);
  assert.equal(matched.length, 1);

  const blockedEval = evaluateIssueCompliance({
    issue,
    checklist: {
      designVerification: true,
      iso14971RiskReview: true,
      sopOwnerVerified: true,
      fdaRecallReviewed: false,
    },
    signOff: null,
    matchedRecalls: matched,
    twgSignals: { teams: [{ id: 't1', displayName: 'MedTech QA' }], confluencePages: [], goals: [] },
    policy: { minConfidenceToShip: 80, blockOnUnmitigatedClassI: true, requireQaSignOff: true },
  });

  assert.equal(blockedEval.verdict, 'HOLD');
  assert.ok(blockedEval.score <= 49, `Expected score <= 49, got ${blockedEval.score}`);
  assert.ok(blockedEval.blockingGaps.some((g) => g.includes('Class I')));

  // After FDA recall review + QA Approval, issue transitions cleanly to SHIP_READY
  const readyEval = evaluateIssueCompliance({
    issue,
    checklist: {
      designVerification: true,
      iso14971RiskReview: true,
      sopOwnerVerified: true,
      fdaRecallReviewed: true,
    },
    signOff: {
      decision: 'Approved',
      actorName: 'QA Director',
      rationale: 'Bench verification passed and Z-0991-2026 failure mode mitigated.',
    },
    matchedRecalls: matched,
    twgSignals: {
      teams: [{ id: 't1', displayName: 'MedTech QA' }],
      confluencePages: [{ id: 'p1', title: 'SOP-QMS-104' }],
      goals: [{ id: 'g1', name: 'FDA 510(k) Submission' }],
      devArtifacts: [{ id: 'pr1', type: 'ExternalPullRequest' }],
    },
    policy: { minConfidenceToShip: 80, blockOnUnmitigatedClassI: true, requireQaSignOff: true },
  });

  assert.equal(readyEval.verdict, 'SHIP_READY');
  assert.equal(readyEval.score, 100);
});

test('buildBlastRadiusGraph and generateAuditMarkdown produce complete traceable artifacts', () => {
  const project = { key: 'MED', name: 'MedTrace Devices', leadName: 'Amin' };
  const ev = evaluateIssueCompliance({
    issue: {
      id: '10002',
      key: 'MED-2',
      summary: 'ICU Ventilator Valve Watchdog',
      description: 'Safety critical watchdog verification for mechanical ventilator actuator.',
      status: 'In Review',
      priority: 'Highest',
      assigneeName: 'Amin',
      assigneeAccountId: 'acc-2',
      labels: ['ventilator'],
      issueLinks: [],
    },
    matchedRecalls: [
      {
        recallNumber: 'Z-0444-2026',
        classification: 'Class I',
        recallingFirm: 'RespiraTech',
        reasonForRecall: 'Expiratory valve stall',
        matchedKeyword: 'ventilator',
      },
    ],
  });

  const graph = buildBlastRadiusGraph({
    project,
    evaluations: [ev],
    twg: {
      connected: true,
      teams: [{ id: 'team-1', displayName: 'Clinical QA', sourceQuery: 'atlassianTeamsBySpace' }],
      confluencePages: [{ id: 'pg-1', title: 'SOP-VENT-09', ownerName: 'QA Lead' }],
      goals: [{ id: 'goal-1', key: 'G-1', name: 'Zero Class I Escapes' }],
    },
  });

  assert.ok(graph.nodes.some((n) => n.type === 'project'));
  assert.ok(graph.nodes.some((n) => n.type === 'issue'));
  assert.ok(graph.nodes.some((n) => n.type === 'fda'));
  assert.ok(graph.nodes.some((n) => n.type === 'team'));
  assert.ok(graph.nodes.some((n) => n.type === 'sop'));
  assert.ok(graph.nodes.some((n) => n.type === 'goal'));
  assert.ok(graph.edges.length >= 5);

  const md = generateAuditMarkdown({
    project,
    summary: {
      averageScore: ev.score,
      overallVerdict: 'HOLD',
      totalIssues: 1,
      shipReadyCount: 0,
      conditionalCount: 0,
      holdCount: 1,
      capaCount: 0,
    },
    evaluations: [ev],
    twg: { connected: true, teams: [{}], confluencePages: [{}], goals: [{}] },
    ledger: [],
  });

  assert.ok(md.includes('MED-2'));
  assert.ok(md.includes('FDA 21 CFR 820'));
});

test('matchSopsForIssue directly connects Teamwork Graph SOPs to matching Jira design controls', () => {
  const issue = {
    id: '10010',
    key: 'MED-1',
    summary: 'Infusion Pump Occlusion Pressure Sensor Firmware v4.2 Threshold Update',
    description: 'References SOP-QMS-104 Volumetric Infusion Pump Verification Protocol.',
    labels: ['infusion-pump'],
  };
  const sops = [
    { id: 'pg-1', title: 'SOP-QMS-104: Volumetric Infusion Pump Occlusion Verification Protocol', ownerName: 'Amin' },
    { id: 'pg-2', title: 'SOP-QMS-209: Cardiac Pacemaker Cybersecurity Plan', ownerName: 'Amin' },
  ];
  const matched = matchSopsForIssue(issue, detectDeviceSubsystem(issue), sops);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, 'pg-1');

  const ev = evaluateIssueCompliance({
    issue,
    twgSignals: { confluencePages: sops, teams: [{ id: 't1', displayName: 'Team Vault' }] },
  });
  const graph = buildBlastRadiusGraph({
    project: { key: 'MED', name: 'MedTrace Devices', leadName: 'Amin' },
    evaluations: [ev],
    twg: { confluencePages: sops, teams: [{ id: 't1', displayName: 'Team Vault' }] },
  });
  assert.ok(graph.edges.some((e) => e.from === 'issue:MED-1' && e.to === 'sop:pg-1' && e.label === 'TWG_GOVERNS_SOP'));
});

test('computeExecutiveAnalytics aggregates 5-pillar averages and ISO 14971 Risk x Verdict matrix', () => {
  const holdEv = evaluateIssueCompliance({
    issue: {
      id: '20001',
      key: 'MED-1',
      summary: 'Cardiac Pacemaker Firmware Update',
      description: 'Class III cardiac telemetry update.',
      status: 'In Progress',
      priority: 'Highest',
      assigneeName: 'Amin',
      labels: ['pacemaker'],
    },
    matchedRecalls: [
      { recallNumber: 'Z-1001-2026', classification: 'Class I', matchedKeyword: 'pacemaker' },
    ],
  });

  const readyEv = evaluateIssueCompliance({
    issue: {
      id: '20002',
      key: 'MED-5',
      summary: 'CGM Sensor Drift Calibration',
      description: 'Detailed FDA 21 CFR 820 verification protocol and ISO 14971 hazard mitigation for continuous glucose calibration.',
      status: 'Done',
      priority: 'Medium',
      assigneeName: 'Amin',
      labels: ['glucose', 'iso-14971'],
      issueLinks: [{ id: 'l1' }],
    },
    checklist: {
      designVerification: true,
      iso14971RiskReview: true,
      sopOwnerVerified: true,
      fdaRecallReviewed: true,
    },
    signOff: { decision: 'Approved', actorName: 'QA Director', rationale: 'Verified.' },
    twgSignals: {
      teams: [{ id: 't1', displayName: 'QA' }],
      confluencePages: [{ id: 'p1', title: 'SOP-CGM-101' }],
      goals: [{ id: 'g1', name: 'Q4 Ship' }],
    },
  });

  const analytics = computeExecutiveAnalytics([holdEv, readyEv]);
  assert.equal(analytics.pillarAverages.length, 5);
  assert.equal(analytics.riskMatrix.Critical.HOLD, 1);
  assert.equal(analytics.riskMatrix.High.SHIP_READY, 1);

  const md = generateAuditMarkdown({
    project: { key: 'MED', name: 'MedTrace Devices' },
    summary: {
      averageScore: 70,
      overallVerdict: 'HOLD',
      totalIssues: 2,
      shipReadyCount: 1,
      conditionalCount: 0,
      holdCount: 1,
      capaCount: 0,
    },
    evaluations: [holdEv, readyEv],
    twg: { connected: true, teams: [{}], confluencePages: [{}], goals: [{}] },
    ledger: [],
    chainVerification: {
      valid: true,
      verifiedChainedEntries: 2,
      headHashShort: 'abcdef1234567890',
    },
  });

  assert.ok(md.includes('21 CFR Part 11 Cryptographic Integrity'));
  assert.ok(md.includes('VERIFIED VALID (SHA-256 Hash Chain)'));
  assert.ok(md.includes('abcdef1234567890'));
});
