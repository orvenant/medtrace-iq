import React, { useCallback, useEffect, useState } from 'react';
import { callBackend, openExternalUrl, openMedTraceRovo } from '../utils/bridge';
import ScoreGauge, { fdaClassBadge, verdictBadge } from './ScoreGauge';
import { CapaModal, SignOffModal } from './CapaModal';
import {
  IconCheckCircle,
  IconExternalLink,
  IconFileText,
  IconGitBranch,
  IconLock,
  IconPlus,
  IconRefresh,
  IconSparkle,
  IconTarget,
  IconXCircle,
} from './Icons';

export default function IssueGuardrailPanel({ issueKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [capaOpen, setCapaOpen] = useState(false);
  const [capaDefaults, setCapaDefaults] = useState({});
  const [signOffOpen, setSignOffOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callBackend('getIssueGuardrail', { issueKey });
      setData(res);
    } catch (err) {
      setError(err?.message || 'Unable to load MedTrace regulatory guardrail.');
    } finally {
      setLoading(false);
    }
  }, [issueKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleChecklist = async (field, value) => {
    setSaving(true);
    try {
      await callBackend('updateIssueChecklist', {
        issueKey: data.issue.key,
        patch: { [field]: value },
      });
      await loadData();
      setToast('Regulatory checklist saved to Forge Storage.');
    } catch (err) {
      setError(err?.message || 'Failed to save checklist.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCapa = async (form) => {
    setSaving(true);
    try {
      const res = await callBackend('createCapaTicket', {
        projectKey: data.issue.projectKey,
        ...form,
      });
      setCapaOpen(false);
      setToast(`Created linked CAPA ${res.key} in Jira.`);
      await loadData();
    } catch (err) {
      setError(err?.message || 'CAPA creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOff = async (form) => {
    setSaving(true);
    try {
      const res = await callBackend('recordSignOff', form);
      setSignOffOpen(false);
      setToast(`Recorded ${res.entry.decision} (${res.entry.id}) to audit ledger & Jira comments.`);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Sign-off failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchRovo = async () => {
    const prompt = `Run a complete FDA 21 CFR 820 & ISO 13485 compliance audit on Jira issue ${data.issue.key} (${data.evaluation.subsystem.label}). Check Teamwork Graph context, live openFDA recall parallels, and recommend whether we can ship with confidence or need a CAPA.`;
    const res = await openMedTraceRovo(prompt);
    if (!res.opened) {
      setToast('Open Rovo Chat (top right) and select "MedTrace Compliance Copilot" to run this audit.');
    }
  };

  if (loading && !data) {
    return (
      <div className="panel-shell">
        <div className="banner banner-info">Loading MedTrace IQ regulatory context, Teamwork Graph &amp; live openFDA signals…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel-shell">
        <div className="banner banner-danger">
          <span>{error}</span>
          <button type="button" className="btn btn-sm" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const ev = data.evaluation;
  const twg = data.twg;

  return (
    <div className="panel-shell">
      {toast && (
        <div className="banner banner-ok">
          <span>{toast}</span>
          <button type="button" className="btn btn-sm" onClick={() => setToast('')}>Dismiss</button>
        </div>
      )}
      {error && <div className="banner banner-danger">{error}</div>}

      {/* Top Guardrail Summary */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ScoreGauge score={ev.score} verdict={ev.verdict} size={86} />
            <div>
              <div className="pill-row" style={{ marginBottom: 6 }}>
                {verdictBadge(ev.verdict)}
                <span className="badge badge-brand">{ev.subsystem.label}</span>
                <span className="badge badge-neutral">{ev.subsystem.deviceClass}</span>
                <span className="badge badge-purple">
                  TWG: {twg.connected ? 'Connected' : 'Pending Scope'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {ev.verdict === 'SHIP_READY'
                  ? 'Cleared under FDA 21 CFR 820 / ISO 13485 release controls'
                  : `${ev.blockingGaps.length} regulatory gate(s) require attention before shipping`}
              </div>
              <div className="kpi-sub">
                {ev.signOff
                  ? `Latest QA Decision: ${ev.signOff.decision} by ${ev.signOff.actorName} (${ev.signOff.id})`
                  : 'No formal QA regulatory sign-off recorded yet'}
              </div>
              {ev.signOff?.entryHash && (
                <div className="mono kpi-sub inline-flex-row" style={{ fontSize: 11, marginTop: 2 }}>
                  <IconLock size={12} />
                  <span>21 CFR Part 11 SHA-256: {ev.signOff.entryHash.slice(0, 24)}…</span>
                </div>
              )}
            </div>
          </div>

          <div className="pill-row">
            <button type="button" className="btn btn-rovo btn-sm" onClick={handleLaunchRovo}>
              <IconSparkle size={13} /> Ask MedTrace Rovo
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setSignOffOpen(true)}>
              <IconLock size={13} /> QA Sign-Off
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setCapaDefaults({
                  sourceIssueKey: data.issue.key,
                  title: `[CAPA] Resolve compliance gaps for ${data.issue.key}`,
                  severity: ev.riskTier === 'Critical' ? 'Critical' : 'High',
                  fdaRecallNumber: ev.matchedRecalls?.[0]?.recallNumber || '',
                  rationale: ev.blockingGaps.join('; ') || 'Preventive CAPA initiated from MedTrace IQ guardrail.',
                });
                setCapaOpen(true);
              }}
            >
              <IconPlus size={13} /> Create CAPA
            </button>
            <button type="button" className="btn btn-sm" onClick={loadData} disabled={loading}>
              <IconRefresh size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* 5 Pillar Breakdown */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {[
            ['Design Controls (820.30)', ev.pillars.designControl],
            ['V&V & ISO 14971 Evidence', ev.pillars.verificationValidation],
            ['SOP & Teamwork Graph', ev.pillars.sopOrgContext],
            ['openFDA Recall Clearance', ev.pillars.fdaRecallClearance],
            ['QA Regulatory Sign-Off', ev.pillars.qaSignOff],
          ].map(([label, p]) => (
            <div className="pillar-row" key={label}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
              <div className="pillar-track">
                <div className="pillar-fill" style={{ width: `${Math.round((p.score / p.max) * 100)}%` }} />
              </div>
              <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                {p.score}/{p.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive ISO 13485 Gate Checklist + Teamwork Graph Context */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">ISO 13485 / FDA Gate Checklist</h3>
            <span className="badge badge-neutral">Persisted in Forge KVS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['designVerification', 'Design Verification & Validation (V&V) Passed', 'Bench/software test protocols linked and verified'],
              ['iso14971RiskReview', 'ISO 14971 Hazard & FMEA Review Complete', 'Residual risk evaluated and within acceptable threshold'],
              ['sopOwnerVerified', 'Confluence SOP Impact & Owner Confirmed', 'SOP owners notified via Teamwork Graph context'],
              ['fdaRecallReviewed', 'Live openFDA Recall Parallels Assessed', 'Confirmed matched Class I/II failure modes are mitigated'],
            ].map(([field, label, desc]) => (
              <label key={field} className="checklist-item">
                <input
                  type="checkbox"
                  checked={Boolean(ev.checklist?.[field])}
                  disabled={saving}
                  onChange={(e) => toggleChecklist(field, e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                  <div className="kpi-sub">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Teamwork Graph Context</h3>
            <span className={`badge ${twg.connected ? 'badge-ok' : 'badge-warn'}`}>
              {twg.connected ? 'Live TWG API' : 'No TWG Data'}
            </span>
          </div>
          <div className="pill-row" style={{ marginBottom: 10 }}>
            <span className="badge badge-brand">Teams: {twg.teams?.length || 0}</span>
            <span className="badge badge-purple">Goals: {twg.goals?.length || 0}</span>
            <span className="badge badge-ok">Confluence SOPs: {twg.confluencePages?.length || 0}</span>
            <span className="badge badge-neutral">PRs/Deploys: {twg.devArtifacts?.length || 0}</span>
          </div>

          {ev.matchedSops?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Auto-Matched Confluence SOPs (Subsystem Match):</div>
              {ev.matchedSops.map((pg) => (
                <div key={pg.id} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <span className="inline-flex-row">
                    <IconFileText size={13} />
                    <span><strong>{pg.title}</strong> <span style={{ color: 'var(--text-muted)' }}>({pg.ownerName})</span></span>
                  </span>
                  {pg.webUrl && (
                    <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(pg.webUrl)}>
                      Open <IconExternalLink size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {twg.confluencePages?.length > 0 && !ev.matchedSops?.length && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Connected Confluence Documents (TWG):</div>
              {twg.confluencePages.slice(0, 3).map((pg) => (
                <div key={pg.id} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span className="inline-flex-row">
                    <IconFileText size={13} />
                    <span>{pg.title} <span style={{ color: 'var(--text-muted)' }}>({pg.ownerName})</span></span>
                  </span>
                  {pg.webUrl && (
                    <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(pg.webUrl)}>
                      Open <IconExternalLink size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {twg.goals?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Aligned Atlassian Goals:</div>
              {twg.goals.slice(0, 3).map((g) => (
                <div key={g.id} className="inline-flex-row" style={{ fontSize: 12, marginBottom: 3 }}>
                  <IconTarget size={13} />
                  <span>{g.name} ({g.key || 'Goal'})</span>
                </div>
              ))}
            </div>
          )}

          {twg.devArtifacts?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Linked Development Artifacts:</div>
              {twg.devArtifacts.slice(0, 3).map((a) => (
                <div key={a.id} className="inline-flex-row" style={{ fontSize: 12, marginBottom: 3 }}>
                  <IconGitBranch size={13} />
                  <span>{a.displayName} — {a.status}</span>
                </div>
              ))}
            </div>
          )}

          {twg.confluencePages?.length === 0 && twg.goals?.length === 0 && twg.devArtifacts?.length === 0 && (
            <div className="kpi-sub">
              Teamwork Graph connection verified ({twg.echo || 'live'}). Link Confluence SOPs, Atlassian Goals, or PRs to this issue to expand automated context coverage.
            </div>
          )}
        </div>
      </div>

      {/* Live openFDA Recall Parallels */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Live openFDA Device Recall Parallels ({ev.subsystem.fdaKeyword})</h3>
            <div className="kpi-sub">Source: {data.fda?.source || 'openFDA'} · Real US FDA Enforcement Database</div>
          </div>
          <span className="badge badge-neutral">{ev.matchedRecalls?.length || 0} Matched</span>
        </div>

        {!ev.matchedRecalls?.length ? (
          <div className="kpi-sub">No active openFDA recalls matched "{ev.subsystem.fdaKeyword}".</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ev.matchedRecalls.slice(0, 4).map((r) => (
              <div
                key={r.recallNumber}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div className="pill-row">
                    {fdaClassBadge(r.classification)}
                    <strong className="mono">{r.recallNumber}</strong>
                    <span className="badge badge-neutral">{r.status}</span>
                    {r.matchStrength === 'DIRECT_FAILURE_MODE' && (
                      <span className="badge badge-danger">
                        Failure Overlap: {(r.failureModeMatches || []).slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="pill-row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setCapaDefaults({
                          sourceIssueKey: data.issue.key,
                          title: `[CAPA] Assess FDA ${r.classification} Recall ${r.recallNumber} on ${data.issue.key}`,
                          severity: r.classification === 'Class I' ? 'Critical' : 'High',
                          fdaRecallNumber: r.recallNumber,
                          rationale: `${r.recallingFirm} recall parallel: ${r.reasonForRecall}`,
                        });
                        setCapaOpen(true);
                      }}
                    >
                      <IconPlus size={12} /> CAPA from Recall
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(r.fdaUrl)}>
                      FDA <IconExternalLink size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.recallingFirm} · {r.initiationDate}</div>
                <div className="kpi-sub" style={{ marginTop: 2 }}>{r.reasonForRecall}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CapaModal
        open={capaOpen}
        onClose={() => setCapaOpen(false)}
        onSubmit={handleCreateCapa}
        defaultValues={capaDefaults}
        busy={saving}
      />
      <SignOffModal
        open={signOffOpen}
        onClose={() => setSignOffOpen(false)}
        onSubmit={handleSignOff}
        issueKey={data.issue.key}
        busy={saving}
      />
    </div>
  );
}
