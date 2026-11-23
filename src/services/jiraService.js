import api, { route } from '@forge/api';

/**
 * Recursively extract readable plain text from Atlassian Document Format (ADF).
 */
export function extractAdfText(adf) {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  const parts = [];
  function walk(node) {
    if (!node) return;
    if (typeof node.text === 'string') parts.push(node.text);
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
      if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
        parts.push('\n');
      }
    }
  }
  walk(adf);
  return parts.join(' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildAdfDocument(sections = []) {
  const content = [];
  for (const sec of sections) {
    if (sec.heading) {
      content.push({
        type: 'heading',
        attrs: { level: sec.level || 3 },
        content: [{ type: 'text', text: String(sec.heading) }],
      });
    }
    if (sec.text) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: String(sec.text) }],
      });
    }
    if (Array.isArray(sec.bullets) && sec.bullets.length > 0) {
      content.push({
        type: 'bulletList',
        content: sec.bullets.map((b) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: String(b) }] }],
        })),
      });
    }
  }
  return { type: 'doc', version: 1, content };
}

function normalizeJiraIssue(raw) {
  const f = raw.fields || {};
  const descriptionText = extractAdfText(f.description);
  const links = Array.isArray(f.issuelinks)
    ? f.issuelinks.map((l) => {
        const target = l.outwardIssue || l.inwardIssue;
        return {
          type: l.type?.name || 'Relates',
          direction: l.outwardIssue ? l.type?.outward : l.type?.inward,
          targetKey: target?.key || '',
          targetSummary: target?.fields?.summary || '',
          targetStatus: target?.fields?.status?.name || '',
        };
      }).filter((l) => l.targetKey)
    : [];

  return {
    id: raw.id,
    key: raw.key,
    summary: f.summary || '(Untitled Issue)',
    description: descriptionText,
    status: f.status?.name || 'To Do',
    statusCategory: f.status?.statusCategory?.key || 'new',
    priority: f.priority?.name || 'Medium',
    issueType: f.issuetype?.name || 'Task',
    assigneeName: f.assignee?.displayName || 'Unassigned',
    assigneeAccountId: f.assignee?.accountId || null,
    reporterName: f.reporter?.displayName || 'Unknown',
    labels: Array.isArray(f.labels) ? f.labels : [],
    components: Array.isArray(f.components) ? f.components.map((c) => c.name) : [],
    issueLinks: links,
    commentCount: f.comment?.total ?? (Array.isArray(f.comment?.comments) ? f.comment.comments.length : 0),
    created: f.created || null,
    updated: f.updated || null,
  };
}

export async function getCurrentUser() {
  const res = await api.asUser().requestJira(route`/rest/api/3/myself`);
  if (!res.ok) throw new Error(`Jira myself failed (${res.status})`);
  const data = await res.json();
  return {
    accountId: data.accountId,
    displayName: data.displayName || 'Atlassian User',
    emailAddress: data.emailAddress || '',
  };
}

export async function getAccessibleProjects(maxResults = 30) {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/search?maxResults=${maxResults}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.values || []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    projectTypeKey: p.projectTypeKey || 'software',
  }));
}

export async function getProjectDetails(projectKey) {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}`);
  if (!res.ok) throw new Error(`Jira project ${projectKey} not accessible (${res.status})`);
  const p = await res.json();
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    projectTypeKey: p.projectTypeKey || 'software',
    leadName: p.lead?.displayName || 'Unassigned',
    issueTypes: Array.isArray(p.issueTypes)
      ? p.issueTypes.filter((it) => !it.subtask).map((it) => ({ id: it.id, name: it.name }))
      : [],
  };
}

export async function getProjectIssues(projectKey, maxResults = 30) {
  const jql = `project = "${String(projectKey).replace(/"/g, '')}" ORDER BY updated DESC`;
  const fields = [
    'summary',
    'description',
    'status',
    'priority',
    'issuetype',
    'assignee',
    'reporter',
    'labels',
    'components',
    'issuelinks',
    'comment',
    'created',
    'updated',
  ];

  // Jira Cloud v3 /search/jql endpoint (standard modern endpoint)
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      maxResults: Math.max(1, Math.min(50, maxResults)),
      fields,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Jira search failed (${res.status}): ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  return (data.issues || []).map(normalizeJiraIssue);
}

export async function getIssueDetails(issueKey) {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}`);
  if (!res.ok) throw new Error(`Jira issue ${issueKey} not found (${res.status})`);
  const raw = await res.json();
  return {
    ...normalizeJiraIssue(raw),
    projectKey: raw.fields?.project?.key || issueKey.split('-')[0],
    projectId: raw.fields?.project?.id || null,
    projectName: raw.fields?.project?.name || '',
  };
}

function pickBestIssueTypeId(issueTypes = [], preferred = ['Task', 'Story', 'Bug']) {
  for (const name of preferred) {
    const match = issueTypes.find((it) => it.name.toLowerCase() === name.toLowerCase());
    if (match) return match.id;
  }
  return issueTypes[0]?.id || null;
}

export async function createCapaIssue({
  projectKey,
  sourceIssueKey = '',
  title,
  severity = 'High',
  rationale,
  fdaRecallNumber = '',
}) {
  const project = await getProjectDetails(projectKey);
  const issueTypeId = pickBestIssueTypeId(project.issueTypes, ['Task', 'Bug', 'Story']);
  if (!issueTypeId) {
    throw new Error(`No creatable issue type found in project ${projectKey}`);
  }

  const summary = title.startsWith('[CAPA]') ? title.slice(0, 240) : `[CAPA] ${title}`.slice(0, 240);
  const adfDesc = buildAdfDocument([
    {
      heading: 'FDA 21 CFR 820.100 / ISO 13485 Corrective & Preventive Action (CAPA)',
      text: `Generated via MedTrace IQ Regulatory Context Engine. Severity: ${severity}.`,
    },
    {
      heading: 'Triggering Signal & Regulatory Rationale',
      bullets: [
        `Source Work Item: ${sourceIssueKey || 'Project-level regulatory audit'}`,
        `Live openFDA Recall Reference: ${fdaRecallNumber || 'N/A — Internal Design Control Finding'}`,
        `Risk Severity (ISO 14971): ${severity}`,
        `Analysis: ${rationale}`,
      ],
    },
    {
      heading: 'Mandatory Containment & Verification of Effectiveness (VoE)',
      bullets: [
        '1. Containment: Hold impacted firmware/device release until risk assessment is closed.',
        '2. Root Cause: Complete 5-Whys / Fault Tree Analysis and link Confluence SOP revision.',
        '3. Verification: Attach bench test / V&V protocol results confirming hazard mitigation.',
        '4. QA Release Sign-Off: Record final release decision in MedTrace IQ Audit Ledger.',
      ],
    },
  ]);

  const createRes = await api.asUser().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype: { id: issueTypeId },
        summary,
        description: adfDesc,
        labels: ['medtrace-capa', 'iso-13485', 'fda-21cfr820', `severity-${String(severity).toLowerCase().replace(/\s+/g, '-')}`],
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create CAPA issue (${createRes.status}): ${errText.slice(0, 220)}`);
  }

  const created = await createRes.json();
  let linked = false;

  if (sourceIssueKey && created.key) {
    try {
      const linkRes = await api.asUser().requestJira(route`/rest/api/3/issueLink`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: { name: 'Relates' },
          inwardIssue: { key: created.key },
          outwardIssue: { key: sourceIssueKey },
        }),
      });
      linked = linkRes.ok;
    } catch (linkErr) {
      console.warn('[jiraService] CAPA link warning:', linkErr?.message);
    }
  }

  return {
    id: created.id,
    key: created.key,
    summary,
    severity,
    linkedTo: linked ? sourceIssueKey : null,
  };
}

export async function addRegulatoryAuditComment(issueKey, { decision, rationale, score, actorName, recordedAt, entryId, entryHash, previousHash }) {
  const badge = decision === 'Approved' ? 'APPROVED' : decision === 'Hold' ? 'REGULATORY HOLD' : 'CONDITIONAL';
  const bullets = [
    `Ledger Entry ID: ${entryId}`,
    `Decision: ${decision}`,
    `Ship-Confidence Score at Review: ${score !== null && score !== undefined ? `${score}/100` : 'Evaluated'}`,
    `Reviewer: ${actorName}`,
    `Timestamp (UTC): ${recordedAt}`,
    `Regulatory Rationale: ${rationale}`,
  ];
  if (entryHash) {
    bullets.push(`FDA 21 CFR Part 11 SHA-256 Digest: ${entryHash}`);
    bullets.push(`Chained Previous Digest: ${String(previousHash || '').slice(0, 24)}...`);
  }
  const body = buildAdfDocument([
    {
      heading: `MedTrace IQ Regulatory Audit Sign-Off — ${badge}`,
      bullets,
    },
  ]);

  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  return { commented: res.ok, status: res.status };
}

const MEDTECH_DEMO_BLUEPRINTS = [
  {
    summary: 'Infusion Pump Occlusion Pressure Sensor Firmware v4.2 Threshold Update',
    description:
      'Design control change for SmartFlow volumetric infusion pump occlusion alarm threshold (reducing false occlusion detection delay from 18s to 9s). Impacts IEC 60601-2-24 safety margin, downstream bolus calculation, and SOP-QMS-104 Infusion Verification Protocol. Requires ISO 14971 FMEA update and FDA Class I occlusion recall screening prior to release.',
    labels: ['medtrace-demo', 'infusion-pump', 'iso-14971', 'firmware', 'class-ii-device'],
  },
  {
    summary: 'Implantable Cardiac Pacemaker BLE Telemetry Pairing Key Rotation',
    description:
      'Security and firmware hardening for dual-chamber cardiac pacemaker remote home-monitoring telemetry module. Updates cryptographic handshake and low-battery warning telemetry packets under FDA Premarket Cybersecurity Guidance and ISO 13485 Clause 7.3 Design Verification.',
    labels: ['medtrace-demo', 'pacemaker', 'cardiac', 'cybersecurity', 'class-iii-device'],
  },
  {
    summary: 'ICU Mechanical Ventilator Expiratory Valve Failsafe Watchdog Timer',
    description:
      'Safety-critical real-time watchdog timer modification for ICU mechanical ventilator expiratory valve actuator. Ensures automatic backup ventilation mode engages within 150ms upon microprocessor stall. Requires bench verification report and QA regulatory sign-off.',
    labels: ['medtrace-demo', 'ventilator', 'life-sustaining', 'verification-pending'],
  },
  {
    summary: 'Steerable Ablation Catheter Hydrophilic Tip Coating Lot Validation',
    description:
      'Manufacturing process transfer for steerable cardiac ablation catheter distal tip polymer coating. Evaluates particulate shedding and lumen occlusion tolerance under ISO 10993 biocompatibility and FDA 21 CFR 820.75 Process Validation.',
    labels: ['medtrace-demo', 'catheter', 'manufacturing-qms', 'dhf-traceability'],
  },
  {
    summary: 'Continuous Glucose Monitor (CGM) Sensor Drift Compensation Algorithm',
    description:
      'SaMD algorithm update calibrating enzymatic glucose sensor interstitial lag during rapid glycemic decline under FDA 21 CFR 820.30 and ISO 14971 hazard mitigation controls. Improves hypoglycemia alarm sensitivity by 14% across clinical validation dataset. Linked to Clinical Evaluation Report CER-2026-08 and verification protocol SOP-QMS-104.',
    labels: ['medtrace-demo', 'glucose-sensor', 'cgm', 'samd', 'clinical-eval'],
  },
  {
    summary: '[CAPA] Automated External Defibrillator (AED) Battery Thermal Cutoff Audit',
    description:
      'Preventive CAPA initiated under FDA 21 CFR 820.100 following field supplier review of lithium battery pack thermal fuse tolerances in portable defibrillator units. Track containment verification, updated SOP-MFG-219, and supplier corrective audit closure.',
    labels: ['medtrace-demo', 'medtrace-capa', 'defibrillator', 'iso-13485', 'fda-21cfr820'],
  },
];

/**
 * 1-Click Idempotent MedTech Demo Seeder so judges can populate realistic regulated device issues in 5 seconds.
 */
export async function seedMedTechDemoIssues(projectKey) {
  const existing = await getProjectIssues(projectKey, 50);
  const alreadySeeded = existing.filter((i) => i.labels.includes('medtrace-demo'));
  if (alreadySeeded.length >= 4) {
    return {
      seeded: false,
      message: `Project ${projectKey} already contains ${alreadySeeded.length} MedTrace demo issues.`,
      issueKeys: alreadySeeded.map((i) => i.key),
    };
  }

  const project = await getProjectDetails(projectKey);
  const issueTypeId = pickBestIssueTypeId(project.issueTypes, ['Task', 'Story', 'Bug']);
  if (!issueTypeId) {
    throw new Error(`No standard issue type available in project ${projectKey}`);
  }

  const createdKeys = [];
  for (const bp of MEDTECH_DEMO_BLUEPRINTS) {
    const res = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          issuetype: { id: issueTypeId },
          summary: bp.summary,
          description: buildAdfDocument([
            { heading: 'MedTech Design Control Specification', text: bp.description },
            {
              heading: 'Regulatory Traceability Scope',
              bullets: [
                'Standard: FDA 21 CFR 820 / ISO 13485 / ISO 14971',
                'Seeded by MedTrace IQ 1-Click Demo Workspace Generator',
              ],
            },
          ]),
          labels: bp.labels,
        },
      }),
    });
    if (res.ok) {
      const json = await res.json();
      createdKeys.push(json.key);
    }
  }

  // Link the CAPA issue to the first two device tickets to demonstrate real traceability
  if (createdKeys.length >= 6) {
    const capaKey = createdKeys[5];
    for (const targetKey of [createdKeys[0], createdKeys[1]]) {
      try {
        await api.asUser().requestJira(route`/rest/api/3/issueLink`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: { name: 'Relates' },
            inwardIssue: { key: capaKey },
            outwardIssue: { key: targetKey },
          }),
        });
      } catch {
        // non-blocking
      }
    }
  }

  return {
    seeded: true,
    message: `Created ${createdKeys.length} realistic MedTech regulated device work items in ${projectKey}.`,
    issueKeys: createdKeys,
  };
}
