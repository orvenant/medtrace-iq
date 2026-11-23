import React, { useCallback, useEffect, useState } from 'react';
import { view, events } from '@forge/bridge';
import { callBackend } from '../utils/bridge';
import ScoreGauge, { verdictBadge } from './ScoreGauge';

export default function ExecutiveGadget({ context }) {
  const isEdit = context?.extension?.entryPoint === 'edit';
  const savedConfig = context?.extension?.gadgetConfiguration || {};

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(savedConfig.projectKey || 'MED');
  const [refreshMins, setRefreshMins] = useState(Number(savedConfig.refresh) || 15);
  const [saving, setSaving] = useState(false);

  const [cockpit, setCockpit] = useState(null);
  const [loading, setLoading] = useState(!isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      callBackend('getAccessibleProjects')
        .then((list) => {
          setProjects(list || []);
          if (!savedConfig.projectKey && list?.length) {
            const med = list.find((p) => p.key === 'MED');
            setSelectedProject(med ? med.key : list[0].key);
          }
        })
        .catch(() => {});
    }
  }, [isEdit, savedConfig.projectKey]);

  const loadSummary = useCallback(async () => {
    if (isEdit) return;
    setLoading(true);
    setError('');
    try {
      const targetKey = savedConfig.projectKey || 'MED';
      const data = await callBackend('getProjectCockpit', { projectKey: targetKey });
      setCockpit(data);
    } catch (err) {
      setError(err?.message || 'Unable to load MedTrace IQ gadget metrics.');
    } finally {
      setLoading(false);
    }
  }, [isEdit, savedConfig.projectKey]);

  useEffect(() => {
    loadSummary();
    if (!isEdit && events?.on) {
      const sub = events.on('JIRA_DASHBOARD_GADGET_REFRESH', () => {
        loadSummary();
      });
      return () => {
        sub?.then?.((s) => s?.unsubscribe?.());
      };
    }
    return undefined;
  }, [isEdit, loadSummary]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await view.submit({
        projectKey: selectedProject,
        refresh: Number(refreshMins) || 15,
      });
    } catch (err) {
      setError(err?.message || 'Failed to save gadget configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit) {
    return (
      <div className="panel-shell">
        <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="card-title">Configure MedTrace IQ Release Readiness Gadget</h2>
          {error && <div className="banner banner-danger">{error}</div>}
          <div className="field">
            <label htmlFor="gadget-project">Monitored Jira Project</label>
            <select
              id="gadget-project"
              className="select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              {projects.length === 0 ? (
                <option value={selectedProject}>{selectedProject}</option>
              ) : (
                projects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.key} — {p.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gadget-refresh">Auto-Refresh Interval (Minutes)</label>
            <select
              id="gadget-refresh"
              className="select"
              value={refreshMins}
              onChange={(e) => setRefreshMins(Number(e.target.value))}
            >
              <option value={5}>Every 5 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Gadget Configuration'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (loading && !cockpit) {
    return (
      <div className="panel-shell">
        <div className="banner banner-info">Loading live FDA 21 CFR 820 &amp; Teamwork Graph readiness metrics…</div>
      </div>
    );
  }

  if (error || !cockpit) {
    return (
      <div className="panel-shell">
        <div className="banner banner-danger">
          <span>{error || 'Configure a Jira project in gadget settings.'}</span>
          <button type="button" className="btn btn-sm" onClick={loadSummary}>Retry</button>
        </div>
      </div>
    );
  }

  const s = cockpit.summary;
  const chain = cockpit.chainVerification;

  return (
    <div className="panel-shell">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ScoreGauge score={s.averageScore} verdict={s.overallVerdict} size={82} />
          <div>
            <div className="pill-row" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>{cockpit.project.key}</strong>
              {verdictBadge(s.overallVerdict)}
              <span className={`badge ${chain?.valid ? 'badge-ok' : 'badge-danger'}`}>
                {chain?.valid ? '21 CFR Part 11 SHA-256 Valid' : 'Chain Warning'}
              </span>
            </div>
            <div className="kpi-sub">{cockpit.project.name}</div>
            <div className="kpi-sub">
              🟢 {s.shipReadyCount} Ready · 🟡 {s.conditionalCount} Conditional · 🔴 {s.holdCount} Hold · {s.capaCount} CAPAs
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-sm" onClick={loadSummary} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div className="kpi-card" style={{ padding: 10 }}>
          <div className="kpi-label">Live openFDA</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: s.classIExposure > 0 ? 'var(--danger)' : 'var(--ok)' }}>
            {s.fdaLiveCount} Recalls
          </div>
          <div className="kpi-sub">{s.classIExposure} Class I Exposed</div>
        </div>
        <div className="kpi-card" style={{ padding: 10 }}>
          <div className="kpi-label">Teamwork Graph</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>
            {s.twgConnected ? 'Connected' : 'Pending'}
          </div>
          <div className="kpi-sub">{s.twgSopCount} SOPs · {s.twgTeamsCount} Teams</div>
        </div>
        <div className="kpi-card" style={{ padding: 10 }}>
          <div className="kpi-label">Audit Ledger</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{chain?.verifiedChainedEntries || 0} Chained</div>
          <div className="kpi-sub mono" style={{ fontSize: 10.5 }}>{chain?.headHashShort || 'GENESIS'}</div>
        </div>
      </div>

      {cockpit.analytics?.pillarAverages && (
        <div>
          {cockpit.analytics.pillarAverages.map((p) => (
            <div className="pillar-row" key={p.key} style={{ marginBottom: 5 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{p.label}</span>
              <div className="pillar-track">
                <div className="pillar-fill" style={{ width: `${p.pct}%` }} />
              </div>
              <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{p.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
