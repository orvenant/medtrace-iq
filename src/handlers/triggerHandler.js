import api, { route } from '@forge/api';
import { extractAdfText, buildAdfDocument } from '../services/jiraService';
import { detectDeviceSubsystem } from '../services/complianceEngine';
import { searchFdaDeviceRecalls } from '../services/openFdaService';
import {
  getProjectPolicy,
  hasTriggerAlerted,
  markTriggerAlerted,
  recordAutonomousAlertEntry,
} from '../services/storageService';

/**
 * Autonomous Background Forge Product Trigger (avi:jira:created:issue & avi:jira:updated:issue).
 * Screens newly created/updated regulated medical device tickets against live US openFDA Class I recalls,
 * applies the `medtrace-fda-hold` label, posts a structured safety alert comment, and seals a SHA-256 entry
 * into the FDA 21 CFR Part 11 audit ledger — zero human clicks required.
 */
export async function onJiraIssueEvent(event) {
  try {
    // Platform-native loop guard: never re-process events triggered by MedTrace IQ itself
    if (event?.selfGenerated) {
      return { skipped: true, reason: 'selfGenerated' };
    }

    // For issue update events, only re-scan when summary or description actually changed
    if (event?.eventType === 'avi:jira:updated:issue') {
      const changedFields = (event?.changelog?.items || []).map((i) => String(i?.field || '').toLowerCase());
      if (changedFields.length > 0 && !changedFields.some((f) => f === 'summary' || f === 'description')) {
        return { skipped: true, reason: 'non_content_update', changedFields };
      }
    }

    const issueKey = event?.issue?.key;
    if (!issueKey) {
      return { skipped: true, reason: 'missing_issue_key' };
    }

    const projectKey = event?.issue?.fields?.project?.key || issueKey.split('-')[0];
    const policy = await getProjectPolicy(projectKey);
    if (policy.autonomousFdaMonitor === false) {
      return { skipped: true, reason: 'autonomous_monitor_disabled' };
    }

    // Fetch canonical issue fields via asApp() (background triggers execute in app context)
    const issueRes = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary,description,labels,components,priority,status`
    );
    if (!issueRes.ok) {
      console.warn(`[trigger] Could not read ${issueKey} (${issueRes.status})`);
      return { skipped: true, reason: `jira_read_${issueRes.status}` };
    }

    const raw = await issueRes.json();
    const fields = raw.fields || {};
    const labels = Array.isArray(fields.labels) ? fields.labels : [];
    const summary = fields.summary || '';

    // Never recurse on CAPA tickets or issues already flagged with medtrace-fda-hold
    if (labels.includes('medtrace-capa') || labels.includes('medtrace-fda-hold') || /^\[CAPA\]/i.test(summary)) {
      return { skipped: true, reason: 'capa_or_already_flagged' };
    }

    const normalizedIssue = {
      key: issueKey,
      summary,
      description: extractAdfText(fields.description),
      labels,
      components: Array.isArray(fields.components) ? fields.components.map((c) => c.name) : [],
    };

    const subsystem = detectDeviceSubsystem(normalizedIssue);
    if (!subsystem.matchedDirectly) {
      return { skipped: true, reason: 'non_regulated_subsystem' };
    }

    // Scan live US openFDA for Class I ongoing enforcement recalls matching this device subsystem
    const fda = await searchFdaDeviceRecalls({
      keyword: subsystem.fdaKeyword,
      classification: 'Class I',
      limit: 3,
      ongoingPreferred: true,
    });

    const topClassI = (fda.recalls || []).find((r) => r.classification === 'Class I');
    if (!topClassI) {
      return { scanned: true, issueKey, subsystem: subsystem.label, classIFound: false };
    }

    // Strict per-(issue, recall) deduplication + optimistic lock BEFORE Jira writes
    if (await hasTriggerAlerted(issueKey, topClassI.recallNumber)) {
      return { skipped: true, reason: 'already_alerted', recallNumber: topClassI.recallNumber };
    }
    await markTriggerAlerted(issueKey, topClassI.recallNumber);

    // 1. Apply `medtrace-fda-hold` label if not present
    if (!labels.includes('medtrace-fda-hold')) {
      await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update: {
            labels: [{ add: 'medtrace-fda-hold' }],
          },
        }),
      });
    }

    // 2. Seal SHA-256 chained audit record into 21 CFR Part 11 Ledger
    const alertEntry = await recordAutonomousAlertEntry({
      projectKey,
      issueKey,
      fdaRecallNumber: topClassI.recallNumber,
      rationale: `Autonomous background monitor detected active US FDA Class I recall ${topClassI.recallNumber} (${topClassI.recallingFirm}) parallel to ${subsystem.label}: ${topClassI.reasonForRecall.slice(0, 180)}`,
    });

    // 3. Post structured ADF alert comment on Jira issue
    const commentBody = buildAdfDocument([
      {
        heading: `MedTrace IQ Autonomous FDA Monitor — Class I Recall Parallel (${topClassI.recallNumber})`,
        text: `Triggered automatically upon issue ${event.eventType === 'avi:jira:created:issue' ? 'creation' : 'update'} for detected subsystem: ${subsystem.label} (${subsystem.deviceClass}).`,
      },
      {
        heading: 'Live openFDA Class I Signal Detected',
        bullets: [
          `FDA Recall Number: ${topClassI.recallNumber} (${topClassI.classification} · ${topClassI.status})`,
          `Recalling Firm: ${topClassI.recallingFirm} (Initiated: ${topClassI.initiationDate})`,
          `Failure Mode: ${topClassI.reasonForRecall}`,
          `21 CFR Part 11 Audit Entry: ${alertEntry.id} (SHA-256: ${alertEntry.entryHash.slice(0, 16)}...)`,
          'Action Required: Open MedTrace IQ Regulatory Guardrail panel to review recall applicability, create a linked ISO 13485 CAPA if applicable, and record QA Sign-Off before release.',
        ],
      },
    ]);

    await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    });

    console.log(`[trigger] Alerted ${issueKey} for FDA Class I recall ${topClassI.recallNumber} (entry ${alertEntry.id})`);

    return {
      alerted: true,
      issueKey,
      subsystem: subsystem.label,
      recallNumber: topClassI.recallNumber,
      auditEntryId: alertEntry.id,
    };
  } catch (err) {
    console.error('[trigger] onJiraIssueEvent error:', err?.message);
    return { error: err?.message || 'Trigger failed' };
  }
}
