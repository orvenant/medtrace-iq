/**
 * Deterministic FDA 21 CFR 820 / ISO 13485 / ISO 14971 Ship-Confidence Engine.
 * Pure functions — zero external side effects, 100% unit-testable.
 */

const SUBSYSTEM_CATALOG = [
  {
    id: 'infusion-pump',
    label: 'Infusion Pump',
    fdaKeyword: 'infusion pump',
    deviceClass: 'Class II / High-Alert',
    patterns: [/infusion/i, /\bpump\b/i, /occlusion/i, /\bbolus\b/i, /syringe pump/i],
  },
  {
    id: 'pacemaker',
    label: 'Cardiac Pacemaker / ICD',
    fdaKeyword: 'pacemaker',
    deviceClass: 'Class III / Life-Sustaining',
    patterns: [/pacemaker/i, /cardiac/i, /\bicd\b/i, /arrhythmia/i, /leadless/i],
  },
  {
    id: 'ventilator',
    label: 'ICU Ventilator',
    fdaKeyword: 'ventilator',
    deviceClass: 'Class III / Life-Sustaining',
    patterns: [/ventilator/i, /respirat/i, /expiratory/i, /airway/i, /cpap|bipap/i],
  },
  {
    id: 'catheter',
    label: 'Vascular / Ablation Catheter',
    fdaKeyword: 'catheter',
    deviceClass: 'Class II-III / Invasive',
    patterns: [/catheter/i, /ablation/i, /lumen/i, /stent/i, /vascular/i, /guidewire/i],
  },
  {
    id: 'glucose-sensor',
    label: 'Glucose / CGM System',
    fdaKeyword: 'glucose',
    deviceClass: 'Class II / Monitoring',
    patterns: [/glucose/i, /\bcgm\b/i, /insulin/i, /glycem/i, /diabetes/i],
  },
  {
    id: 'defibrillator',
    label: 'Defibrillator / ECG',
    fdaKeyword: 'defibrillator',
    deviceClass: 'Class III / Life-Sustaining',
    patterns: [/defibrillator/i, /\baed\b/i, /\becg\b|\bekg\b/i, /shock energy/i],
  },
  {
    id: 'imaging-xray',
    label: 'Imaging / X-Ray / MRI',
    fdaKeyword: 'x-ray',
    deviceClass: 'Class II / Diagnostic',
    patterns: [/x-ray|xray/i, /\bmri\b/i, /ct scan/i, /ultrasound/i, /fluoroscop/i],
  },
  {
    id: 'surgical-robotics',
    label: 'Surgical / Robotics',
    fdaKeyword: 'surgical',
    deviceClass: 'Class II-III / Surgical',
    patterns: [/surgical/i, /endoscop/i, /robotic arm/i, /laparoscop/i, /scalpel/i],
  },
];

export function detectDeviceSubsystem(issue) {
  const haystack = [
    issue.summary || '',
    issue.description || '',
    ...(issue.labels || []),
    ...(issue.components || []),
  ].join(' ');

  for (const sub of SUBSYSTEM_CATALOG) {
    if (sub.patterns.some((re) => re.test(haystack))) {
      return {
        id: sub.id,
        label: sub.label,
        fdaKeyword: sub.fdaKeyword,
        deviceClass: sub.deviceClass,
        matchedDirectly: true,
      };
    }
  }

  return {
    id: 'samd-platform',
    label: 'SaMD / Connected Health',
    fdaKeyword: 'software',
    deviceClass: 'Class II / SaMD',
    matchedDirectly: false,
  };
}

export function matchRecallsForIssue(issue, subsystem, allRecalls = []) {
  const kw = (subsystem?.fdaKeyword || '').toLowerCase();
  const tokens = kw.split(/\s+/).filter((t) => t.length >= 3);

  const scored = [];
  for (const r of allRecalls) {
    const text = `${r.matchedKeyword || ''} ${r.productDescription || ''} ${r.reasonForRecall || ''}`.toLowerCase();
    let relevance = 0;
    if (r.matchedKeyword && r.matchedKeyword.toLowerCase() === kw) relevance += 5;
    for (const tok of tokens) {
      if (text.includes(tok)) relevance += 3;
    }
    if (relevance > 0) {
      scored.push({ ...r, relevance });
    }
  }

  return scored
    .sort((a, b) => {
      const clsRank = { 'Class I': 0, 'Class II': 1, 'Class III': 2 };
      const cDiff = (clsRank[a.classification] ?? 3) - (clsRank[b.classification] ?? 3);
      if (cDiff !== 0) return cDiff;
      return b.relevance - a.relevance;
    })
    .slice(0, 5);
}

export function matchSopsForIssue(issue, subsystem, confluencePages = []) {
  const issueTokens = new Set(
    `${issue.summary || ''} ${issue.description || ''} ${(issue.labels || []).join(' ')} ${subsystem?.label || ''} ${subsystem?.fdaKeyword || ''}`
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length >= 4 && !['with', 'that', 'this', 'from', 'into', 'under', 'update', 'review', 'protocol', 'device', 'system', 'design', 'control'].includes(t))
  );

  const matched = [];
  for (const pg of confluencePages) {
    const titleLower = String(pg.title || '').toLowerCase();
    let score = 0;
    // Direct SOP code mention in issue text (e.g. SOP-QMS-104)
    const sopCodeMatch = titleLower.match(/sop-[a-z0-9-]+/i);
    if (sopCodeMatch && `${issue.summary || ''} ${issue.description || ''}`.toLowerCase().includes(sopCodeMatch[0])) {
      score += 10;
    }
    for (const tok of issueTokens) {
      if (titleLower.includes(tok)) score += 3;
    }
    if (score > 0) {
      matched.push({ ...pg, relevanceScore: score });
    }
  }

  return matched.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
}

/**
 * Evaluate a single Jira issue under the 5-pillar FDA 21 CFR 820 / ISO 13485 Ship-Confidence Rubric.
 */
export function evaluateIssueCompliance({
  issue,
  checklist = {},
  signOff = null,
  matchedRecalls = [],
  twgSignals = {},
  policy = {},
}) {
  const minShipScore = Number(policy.minConfidenceToShip) || 80;
  const blockOnClassI = policy.blockOnUnmitigatedClassI !== false;
  const requireQa = policy.requireQaSignOff !== false;
  const subsystem = detectDeviceSubsystem(issue);
  const matchedSops = matchSopsForIssue(issue, subsystem, twgSignals.confluencePages || []);

  const blockingGaps = [];
  const positiveSignals = [];

  // Pillar 1: Design Control Completeness (25 pts)
  let p1 = 0;
  const descLen = (issue.description || '').trim().length;
  if (descLen >= 100) {
    p1 += 15;
    positiveSignals.push('Detailed design control specification documented');
  } else if (descLen >= 30) {
    p1 += 8;
    blockingGaps.push('Expand design specification to document acceptance criteria & hazard controls');
  } else {
    blockingGaps.push('Missing FDA 21 CFR 820.30 design specification description');
  }
  if (subsystem.matchedDirectly || (issue.labels && issue.labels.length > 0)) {
    p1 += 10;
  } else {
    p1 += 4;
    blockingGaps.push('Assign device subsystem label or component for DHF traceability');
  }

  // Pillar 2: Verification & Validation Evidence (25 pts)
  let p2 = 0;
  const devArtifactCount = (twgSignals.devArtifacts || []).length;
  if (checklist.designVerification) {
    p2 += 15;
    positiveSignals.push('Design Verification & Validation (V&V) confirmed');
  } else {
    blockingGaps.push('Design Verification & Validation (V&V) checklist item unconfirmed');
  }
  if (checklist.iso14971RiskReview) {
    p2 += 6;
    positiveSignals.push('ISO 14971 risk assessment completed');
  } else {
    blockingGaps.push('ISO 14971 FMEA / hazard analysis review pending');
  }
  if (devArtifactCount > 0 || issue.statusCategory === 'done') {
    p2 += 4;
    if (devArtifactCount > 0) {
      positiveSignals.push(`${devArtifactCount} linked PR/Deployment artifact(s) verified via Teamwork Graph`);
    }
  }

  // Pillar 3: SOP & Organizational Context via Teamwork Graph (20 pts)
  let p3 = 0;
  const teamCount = (twgSignals.teams || []).length;
  const sopCount = (twgSignals.confluencePages || []).length;
  const goalCount = (twgSignals.goals || []).length;
  const linkCount = (issue.issueLinks || []).length;

  if (checklist.sopOwnerVerified || checklist.linkedSopReference) {
    p3 += 10;
    positiveSignals.push(
      matchedSops[0]
        ? `SOP "${matchedSops[0].title}" owner (${matchedSops[0].ownerName}) verified`
        : 'Affected SOP document & owner verified'
    );
  } else if (matchedSops.length > 0) {
    p3 += 7;
    positiveSignals.push(`Auto-linked Confluence SOP via Teamwork Graph: ${matchedSops[0].title}`);
    blockingGaps.push(`Confirm SOP owner impact sign-off with ${matchedSops[0].ownerName} (${matchedSops[0].title.slice(0, 38)})`);
  } else if (sopCount > 0) {
    p3 += 5;
    blockingGaps.push('Confluence SOP pages found in Teamwork Graph — confirm SOP owner impact sign-off');
  } else {
    blockingGaps.push('No verified Confluence SOP owner linked to this change');
  }

  if (teamCount > 0 || goalCount > 0 || linkCount > 0 || issue.assigneeAccountId) {
    p3 += 10;
    if (teamCount > 0) positiveSignals.push(`${teamCount} Atlassian Team(s) mapped via Teamwork Graph`);
    if (goalCount > 0) positiveSignals.push(`${goalCount} Atlassian Goal(s) aligned via Teamwork Graph`);
  } else {
    p3 += 3;
    blockingGaps.push('Assign accountable owner or link to organizational Goal/Team');
  }

  // Pillar 4: Live openFDA Recall Clearance (20 pts)
  let p4 = 20;
  const classICount = matchedRecalls.filter((r) => r.classification === 'Class I').length;
  const classIICount = matchedRecalls.filter((r) => r.classification === 'Class II').length;
  const hasUnmitigatedClassI = classICount > 0 && !checklist.fdaRecallReviewed;

  if (hasUnmitigatedClassI) {
    p4 = 2;
    blockingGaps.push(
      `${classICount} live FDA Class I recall parallel(s) detected for ${subsystem.label} — mandatory review required`
    );
  } else if (classIICount > 0 && !checklist.fdaRecallReviewed) {
    p4 = 10;
    blockingGaps.push(
      `${classIICount} live FDA Class II recall parallel(s) detected — log applicability assessment`
    );
  } else if (matchedRecalls.length > 0 && checklist.fdaRecallReviewed) {
    p4 = 20;
    positiveSignals.push(`Live openFDA recall parallels (${matchedRecalls.length}) formally reviewed & mitigated`);
  } else {
    positiveSignals.push('Zero unmitigated live openFDA recall parallels');
  }

  // Pillar 5: Formal QA Regulatory Sign-Off (10 pts)
  let p5 = 0;
  const decision = signOff?.decision || null;
  if (decision === 'Approved') {
    p5 = 10;
    positiveSignals.push(`Formal QA Sign-Off Approved by ${signOff.actorName}`);
  } else if (decision === 'Conditional') {
    p5 = 5;
    blockingGaps.push(`QA Conditional Release by ${signOff.actorName} — complete open conditions`);
  } else if (decision === 'Hold') {
    p5 = 0;
    blockingGaps.unshift(`REGULATORY HOLD placed by ${signOff.actorName}: ${signOff.rationale}`);
  } else if (requireQa) {
    blockingGaps.push('Formal QA Regulatory Sign-Off pending');
  } else {
    p5 = 5;
  }

  let score = Math.max(0, Math.min(100, p1 + p2 + p3 + p4 + p5));

  // Hard regulatory safety caps
  if (decision === 'Hold') {
    score = Math.min(score, 39);
  } else if (blockOnClassI && hasUnmitigatedClassI) {
    score = Math.min(score, 49);
  }

  let verdict = 'CONDITIONAL';
  if (decision === 'Hold' || (blockOnClassI && hasUnmitigatedClassI) || score < 55) {
    verdict = 'HOLD';
  } else if (score >= minShipScore && (!requireQa || decision === 'Approved')) {
    verdict = 'SHIP_READY';
  }

  const isCapa =
    issue.labels?.includes('medtrace-capa') || /^\[CAPA\]/i.test(issue.summary || '');

  const riskTier =
    subsystem.deviceClass.includes('Class III') || classICount > 0 || issue.priority === 'Highest'
      ? 'Critical'
      : subsystem.deviceClass.includes('Class II') || classIICount > 0 || issue.priority === 'High'
        ? 'High'
        : 'Moderate';

  return {
    issueKey: issue.key,
    issueId: issue.id,
    summary: issue.summary,
    status: issue.status,
    priority: issue.priority,
    assigneeName: issue.assigneeName,
    isCapa,
    subsystem,
    riskTier,
    score,
    verdict,
    pillars: {
      designControl: { score: p1, max: 25 },
      verificationValidation: { score: p2, max: 25 },
      sopOrgContext: { score: p3, max: 20 },
      fdaRecallClearance: { score: p4, max: 20 },
      qaSignOff: { score: p5, max: 10 },
    },
    classICount,
    classIICount,
    matchedRecalls,
    matchedSops,
    checklist,
    signOff,
    blockingGaps,
    positiveSignals,
  };
}

/**
 * Build interactive Blast-Radius & Teamwork Graph visualization nodes & edges.
 * Directly links matched openFDA recalls -> Jira Design Controls -> matched Confluence SOPs (TWG) -> Teams & Goals (TWG).
 */
export function buildBlastRadiusGraph({ project, evaluations = [], twg = {}, fdaRecalls = [] }) {
  const nodes = [];
  const edges = [];

  const rootId = `project:${project.key}`;
  nodes.push({
    id: rootId,
    type: 'project',
    label: `${project.key} Release`,
    sublabel: project.name,
    status: 'ROOT',
    meta: { projectKey: project.key, lead: project.leadName, totalIssues: evaluations.length },
  });

  const sortedIssues = [...evaluations]
    .sort((a, b) => a.score - b.score)
    .slice(0, 7);

  const recallNodeIds = new Set();
  const sopNodeIds = new Set();
  const sopToIssueLinked = new Set();

  // Register Teamwork Graph Confluence SOP Pages first
  for (const pg of (twg.confluencePages || []).slice(0, 5)) {
    const pId = `sop:${pg.id}`;
    sopNodeIds.add(pId);
    nodes.push({
      id: pId,
      type: 'sop',
      label: pg.title.slice(0, 34),
      sublabel: `Owner: ${pg.ownerName}`,
      status: 'CONTEXT',
      meta: pg,
    });
  }

  for (const ev of sortedIssues) {
    const issueNodeId = `issue:${ev.issueKey}`;
    nodes.push({
      id: issueNodeId,
      type: ev.isCapa ? 'capa' : 'issue',
      label: ev.issueKey,
      sublabel: ev.summary.slice(0, 44),
      status: ev.verdict,
      score: ev.score,
      meta: {
        issueKey: ev.issueKey,
        summary: ev.summary,
        subsystem: ev.subsystem.label,
        riskTier: ev.riskTier,
        verdict: ev.verdict,
        score: ev.score,
        blockingGaps: ev.blockingGaps,
        matchedSops: ev.matchedSops || [],
        assignee: ev.assigneeName,
      },
    });

    // Connect top matched live FDA recall -> Jira Issue
    const topRecall = ev.matchedRecalls?.[0];
    if (topRecall) {
      const rId = `fda:${topRecall.recallNumber}`;
      if (!recallNodeIds.has(rId) && recallNodeIds.size < 5) {
        recallNodeIds.add(rId);
        nodes.push({
          id: rId,
          type: 'fda',
          label: topRecall.recallNumber,
          sublabel: `${topRecall.classification} · ${topRecall.recallingFirm.slice(0, 24)}`,
          status: topRecall.classification === 'Class I' ? 'HOLD' : 'CONDITIONAL',
          meta: topRecall,
        });
      }
      if (recallNodeIds.has(rId)) {
        edges.push({
          id: `${rId}->${issueNodeId}`,
          from: rId,
          to: issueNodeId,
          label: `FDA_${topRecall.classification.replace(/\s+/g, '_').toUpperCase()}`,
        });
      }
    }

    // Connect Jira Issue -> Semantically Matched Confluence SOP(s) from Teamwork Graph!
    let linkedAnySop = false;
    for (const sop of (ev.matchedSops || []).slice(0, 2)) {
      const sId = `sop:${sop.id}`;
      if (sopNodeIds.has(sId)) {
        linkedAnySop = true;
        sopToIssueLinked.add(sId);
        edges.push({
          id: `${issueNodeId}->${sId}`,
          from: issueNodeId,
          to: sId,
          label: 'TWG_GOVERNS_SOP',
        });
      }
    }
    if (!linkedAnySop) {
      edges.push({
        id: `${issueNodeId}->${rootId}`,
        from: issueNodeId,
        to: rootId,
        label: ev.isCapa ? 'CAPA_CONTROL' : 'DESIGN_CONTROL',
      });
    }
  }

  // Ensure every SOP connects to the Release Hub as well
  for (const sId of sopNodeIds) {
    edges.push({
      id: `${sId}->${rootId}`,
      from: sId,
      to: rootId,
      label: sopToIssueLinked.has(sId) ? 'TWG_SOP_GOVERNANCE' : 'TWG_CONFLUENCE_SOP',
    });
  }

  // Fallback live FDA recalls if none matched directly yet
  if (recallNodeIds.size === 0) {
    for (const r of (fdaRecalls || []).slice(0, 3)) {
      const rId = `fda:${r.recallNumber}`;
      recallNodeIds.add(rId);
      nodes.push({
        id: rId,
        type: 'fda',
        label: r.recallNumber,
        sublabel: `${r.classification} · ${r.recallingFirm.slice(0, 24)}`,
        status: r.classification === 'Class I' ? 'HOLD' : 'CONDITIONAL',
        meta: r,
      });
      edges.push({ id: `${rId}->${rootId}`, from: rId, to: rootId, label: 'FDA_SIGNAL' });
    }
  }

  // Prioritize Regulatory/Security/Legal/Engineering Teamwork Graph Teams (up to 4 cleanly)
  const prioritizedTeams = [...(twg.teams || [])].sort((a, b) => {
    const scoreTeam = (t) =>
      /vault|legal|security|regulatory|quality|platform|eng/i.test(`${t.displayName} ${t.description}`) ? 0 : 1;
    return scoreTeam(a) - scoreTeam(b);
  });

  for (const team of prioritizedTeams.slice(0, 4)) {
    const tId = `team:${team.id}`;
    nodes.push({
      id: tId,
      type: 'team',
      label: team.displayName,
      sublabel: team.description ? team.description.slice(0, 28) : 'Teamwork Graph Team',
      status: 'CONTEXT',
      meta: team,
    });
    edges.push({ id: `${rootId}->${tId}`, from: rootId, to: tId, label: 'TWG_TEAM' });
  }

  // Teamwork Graph Atlassian Goals (up to 2)
  for (const goal of (twg.goals || []).slice(0, 2)) {
    const gId = `goal:${goal.id}`;
    nodes.push({
      id: gId,
      type: 'goal',
      label: goal.name.slice(0, 30),
      sublabel: `Goal ${goal.key || ''}`,
      status: 'CONTEXT',
      meta: goal,
    });
    edges.push({ id: `${rootId}->${gId}`, from: rootId, to: gId, label: 'TWG_GOAL' });
  }

  return { nodes, edges };
}

/**
 * Generate an auditor-ready FDA 21 CFR 820.30 / ISO 13485 Design History File (DHF) Markdown report.
 */
export function generateAuditMarkdown({ project, summary, evaluations, twg, ledger }) {
  const lines = [
    `# MedTrace IQ — FDA 21 CFR 820 / ISO 13485 Release Readiness Audit Pack`,
    ``,
    `- **Project:** ${project.name} (\`${project.key}\`)`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    `- **Overall Ship-Confidence Score:** **${summary.averageScore}/100** (${summary.overallVerdict})`,
    `- **Teamwork Graph Status:** ${twg.connected ? 'Connected (Live Curated Queries)' : 'Disconnected'} — ${twg.teams?.length || 0} Teams, ${twg.confluencePages?.length || 0} Confluence SOPs, ${twg.goals?.length || 0} Goals`,
    `- **Work Items Audited:** ${summary.totalIssues} (Ship Ready: ${summary.shipReadyCount} | Conditional: ${summary.conditionalCount} | Hold: ${summary.holdCount} | CAPAs: ${summary.capaCount})`,
    ``,
    `## Design History File (DHF) Traceability Matrix`,
    ``,
    `| Issue | Subsystem | Risk Tier | Score | Verdict | Live FDA Parallels | QA Sign-Off | Top Blocking Gap |`,
    `| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |`,
  ];

  for (const ev of evaluations) {
    const fdaCol = ev.matchedRecalls.length
      ? `${ev.matchedRecalls.length} (${ev.classICount} Class I)`
      : 'None';
    const qaCol = ev.signOff ? `${ev.signOff.decision} (${ev.signOff.actorName})` : 'Pending';
    const gapCol = ev.blockingGaps[0] || 'All gates satisfied';
    lines.push(
      `| **${ev.issueKey}** | ${ev.subsystem.label} | ${ev.riskTier} | ${ev.score}/100 | ${ev.verdict} | ${fdaCol} | ${qaCol} | ${gapCol.replace(/\|/g, '/')} |`
    );
  }

  if (ledger && ledger.length > 0) {
    lines.push('', '## Immutable QA Regulatory Sign-Off Ledger', '');
    for (const entry of ledger.slice(0, 20)) {
      lines.push(
        `- **${entry.recordedAt}** | \`${entry.issueKey}\` → **${entry.decision}** by *${entry.actorName}* (${entry.id}): ${entry.rationale}`
      );
    }
  }

  return lines.join('\n');
}
