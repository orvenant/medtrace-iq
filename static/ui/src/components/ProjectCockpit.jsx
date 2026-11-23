import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callBackend, openExternalUrl, openMedTraceRovo } from '../utils/bridge';
import ScoreGauge, { fdaClassBadge, verdictBadge } from './ScoreGauge';
import ContextGraphSvg from './ContextGraphSvg';
import { CapaModal, SignOffModal } from './CapaModal';

const TABS = [
  { id: 'overview', label: 'Release Readiness Cockpit' },
  { id: 'graph', label: 'Blast-Radius & TWG Graph' },
  { id: 'fda', label: 'Live openFDA Recall Radar' },
  { id: 'dhf', label: 'DHF Matrix & Governance' },
  { id: 'hub', label: 'Rovo Agent · MCP · Demo Setup' },
];

export default function ProjectCockpit({ projectKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Filtering & Sorting
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  // Live FDA Radar search
  const [fdaKeyword, setFdaKeyword] = useState('infusion pump');
  const [fdaClass, setFdaClass] = useState('');
  const [fdaSearchResult, setFdaSearchResult] = useState(null);
  const [fdaSearching, setFdaSearching] = useState(false);

  // Governance Policy state
  const [policyForm, setPolicyForm] = useState({
    minConfidenceToShip: 80,
    blockOnUnmitigatedClassI: true,
    requireQaSignOff: true,
    regulatoryStandard: 'FDA 21 CFR 820 + ISO 13485 + ISO 14971',
  });

  // Modals
  const [capaOpen, setCapaOpen] = useState(false);
  const [capaDefaults, setCapaDefaults] = useState({});
  const [signOffKey, setSignOffKey] = useState('');
  const tabRefs = useRef({});

  const loadCockpit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callBackend('getProjectCockpit', { projectKey });
      setData(res);
      if (res.policy) {
        setPolicyForm({
          minConfidenceToShip: res.policy.minConfidenceToShip ?? 80,
          blockOnUnmitigatedClassI: res.policy.blockOnUnmitigatedClassI !== false,
          requireQaSignOff: res.policy.requireQaSignOff !== false,
          regulatoryStandard: res.policy.regulatoryStandard || 'FDA 21 CFR 820 + ISO 13485 + ISO 14971',
        });
      }
    } catch (err) {
      setError(err?.message || 'Failed to load MedTrace IQ cockpit.');
    } finally {
      setLoading(false);
    }
  }, [projectKey]);

  useEffect(() => {
    loadCockpit();
  }, [loadCockpit]);

  const filteredEvaluations = useMemo(() => {
    const list = data?.evaluations || [];
    return list.filter((ev) => {
      if (verdictFilter !== 'ALL' && ev.verdict !== verdictFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const hay = `${ev.issueKey} ${ev.summary} ${ev.subsystem.label} ${ev.assigneeName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data?.evaluations, verdictFilter, searchText]);

  const handleTabKeyDown = (e, idx) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;
    else return;

    e.preventDefault();
    const nextTab = TABS[nextIdx];
    setActiveTab(nextTab.id);
    const el = tabRefs.current[nextTab.id];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const handleFdaSearch = async (e) => {
    e?.preventDefault();
    setFdaSearching(true);
    try {
      const res = await callBackend('searchFdaRecalls', {
        keyword: fdaKeyword,
        classification: fdaClass,
        limit: 10,
      });
      setFdaSearchResult(res);
    } catch (err) {
      setError(err?.message || 'openFDA query failed.');
    } finally {
      setFdaSearching(false);
    }
  };

  const handleCreateCapa = async (form) => {
    setBusy(true);
    try {
      const res = await callBackend('createCapaTicket', {
        projectKey: data.project.key,
        ...form,
      });
      setCapaOpen(false);
      setToast(`Created structured ISO 13485 CAPA ${res.key}${res.linkedTo ? ` linked to ${res.linkedTo}` : ''}.`);
      await loadCockpit();
    } catch (err) {
      setError(err?.message || 'CAPA creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOff = async (form) => {
    setBusy(true);
    try {
      const res = await callBackend('recordSignOff', form);
      setSignOffKey('');
      setToast(`Recorded ${res.entry.decision} (${res.entry.id}) for ${form.issueKey} and posted Jira audit comment.`);
      await loadCockpit();
    } catch (err) {
      setError(err?.message || 'Sign-off failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await callBackend('savePolicy', {
        projectKey: data.project.key,
        patch: policyForm,
      });
      setToast('Project governance policy saved to Forge Storage and applied across all release gates.');
      await loadCockpit();
    } catch (err) {
      setError(err?.message || 'Policy save failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSeedDemo = async () => {
    setBusy(true);
    try {
      const res = await callBackend('seedDemoWorkspace', { projectKey: data.project.key });
      setToast(res.message || 'Seeded realistic MedTech demo issues.');
      await loadCockpit();
      setActiveTab('overview');
    } catch (err) {
      setError(err?.message || 'Demo seeding failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadAuditPack = () => {
    if (!data?.auditMarkdown) return;
    const blob = new Blob([data.auditMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MedTrace-IQ-DHF-Audit-${data.project.key}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Downloaded FDA 21 CFR 820 / ISO 13485 DHF Audit Pack (.md).');
  };

  const handleOpenRovo = async (prompt) => {
    const res = await openMedTraceRovo(
      prompt ||
        `Run a Ship-Confidence release readiness audit for Jira project ${data?.project?.key || projectKey}. Summarize Teamwork Graph context, top FDA recall risks, and which issues need a CAPA.`
    );
    if (!res.opened) {
      setToast('Click Rovo Chat in the top navigation bar and pick "MedTrace Compliance Copilot".');
    }
  };

  if (loading && !data) {
    return (
      <div className="app-shell">
        <div className="banner banner-info">
          Evaluating Jira design controls, querying Atlassian Teamwork Graph, and scanning live US openFDA device recalls…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="app-shell">
        <div className="banner banner-danger">
          <span>{error}</span>
          <button type="button" className="btn btn-sm" onClick={loadCockpit}>Retry</button>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const appUuid = data.meta?.appUuid || '<YOUR_APP_UUID>';
  const mcpEndpoint = `https://mcp.atlassian.com/forge/${appUuid}`;
  const radarRecalls = fdaSearchResult ? fdaSearchResult.recalls : data.fda?.allRecalls || [];

  return (
    <div className="app-shell">
      {/* Hero Header */}
      <header className="hero-bar">
        <div className="hero-brand">
          <div className="hero-logo" aria-hidden="true">MT</div>
          <div>
            <h1 className="hero-title">
              MedTrace IQ <span className="badge badge-brand" style={{ verticalAlign: 'middle', marginLeft: 6 }}>{data.project.key}</span>
            </h1>
            <p className="hero-subtitle">
              FDA 21 CFR 820 &amp; ISO 13485 Regulatory Context, Blast-Radius &amp; Ship-Confidence Engine · {data.project.name}
            </p>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="btn btn-rovo" onClick={() => handleOpenRovo()}>
            ✦ Launch MedTrace Rovo
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setCapaDefaults({
                title: `[CAPA] ${data.project.key} Release Gate Remediation`,
                severity: 'High',
                rationale: '',
              });
              setCapaOpen(true);
            }}
          >
            + New CAPA
          </button>
          <button type="button" className="btn" onClick={handleSeedDemo} disabled={busy}>
            ⚡ Seed MedTech Demo
          </button>
          <button type="button" className="btn" onClick={loadCockpit} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {toast && (
        <div className="banner banner-ok" role="status">
          <span>{toast}</span>
          <button type="button" className="btn btn-sm" onClick={() => setToast('')}>Dismiss</button>
        </div>
      )}
      {error && (
        <div className="banner banner-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-sm" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Executive KPI Strip */}
      <section className="kpi-grid" aria-label="Release readiness summary metrics">
        <div className="kpi-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="kpi-label">Ship Confidence</div>
            <div style={{ marginTop: 6 }}>{verdictBadge(s.overallVerdict)}</div>
            <div className="kpi-sub" style={{ marginTop: 4 }}>Gate ≥ {data.policy.minConfidenceToShip}/100</div>
          </div>
          <ScoreGauge score={s.averageScore} verdict={s.overallVerdict} size={78} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Design Controls Audited</div>
          <div className="kpi-value">{s.totalIssues}</div>
          <div className="kpi-sub">
            🟢 {s.shipReadyCount} Ready · 🟡 {s.conditionalCount} Cond · 🔴 {s.holdCount} Hold
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Live openFDA Signals</div>
          <div className="kpi-value" style={{ color: s.classIExposure > 0 ? 'var(--danger)' : 'var(--ok)' }}>
            {s.fdaLiveCount}
          </div>
          <div className="kpi-sub">
            {s.classIExposure > 0
              ? `${s.classIExposure} issue(s) with unreviewed Class I parallel`
              : 'No unmitigated Class I recall exposure'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Teamwork Graph Context</div>
          <div className="kpi-value" style={{ color: 'var(--brand)' }}>
            {s.twgTeamsCount + s.twgSopCount + s.twgGoalsCount}
          </div>
          <div className="kpi-sub">
            {s.twgConnected ? '🟢 Live TWG' : '⚠️ Check TWG Scopes'} · {s.twgTeamsCount} Teams · {s.twgSopCount} SOPs · {s.twgGoalsCount} Goals
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">CAPA &amp; Audit Ledger</div>
          <div className="kpi-value">{s.capaCount} / {data.ledger?.length || 0}</div>
          <div className="kpi-sub">{s.capaCount} CAPA tickets · {data.ledger?.length || 0} QA sign-offs</div>
        </div>
      </section>

      {/* Accessible Single-Row Tablist */}
      <div className="tablist" role="tablist" aria-label="MedTrace IQ views">
        {TABS.map((t, idx) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={activeTab === t.id}
            tabIndex={activeTab === t.id ? 0 : -1}
            onClick={() => setActiveTab(t.id)}
            onKeyDown={(e) => handleTabKeyDown(e, idx)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Overview & Release Gate Table */}
      <div role="tabpanel" aria-labelledby="tab-overview" hidden={activeTab !== 'overview'}>
        <div className="tabpanel-inner">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Release Gate &amp; Regulatory Risk Matrix</h2>
                <div className="kpi-sub">Every Jira work item scored deterministically across 5 FDA 21 CFR 820 / ISO 13485 pillars</div>
              </div>
              <div className="pill-row">
                <input
                  type="search"
                  className="input"
                  style={{ width: 220 }}
                  aria-label="Filter issues"
                  placeholder="Filter by key, subsystem, owner…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {['ALL', 'HOLD', 'CONDITIONAL', 'SHIP_READY'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`btn btn-sm ${verdictFilter === v ? 'btn-primary' : ''}`}
                    onClick={() => setVerdictFilter(v)}
                  >
                    {v === 'ALL' ? 'All' : v === 'SHIP_READY' ? 'Ready' : v === 'HOLD' ? 'Hold' : 'Conditional'}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvaluations.length === 0 ? (
              <div className="banner banner-info">
                <span>No work items match this filter. Click "⚡ Seed MedTech Demo" above to populate 6 realistic cardiac/infusion medical device tickets!</span>
              </div>
            ) : (
              <div className="table-wrapper" tabIndex={0} role="region" aria-labelledby="release-table-caption">
                <table className="data-table">
                  <caption id="release-table-caption">
                    MedTech Release Gate Status — {filteredEvaluations.length} work item(s)
                  </caption>
                  <thead>
                    <tr>
                      <th>Work Item</th>
                      <th>Device Subsystem</th>
                      <th>Score</th>
                      <th>Verdict</th>
                      <th>Live openFDA</th>
                      <th>Top Blocking Gap</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvaluations.map((ev) => (
                      <tr key={ev.issueKey}>
                        <th>
                          <div className="mono">{ev.issueKey} {ev.isCapa && <span className="badge badge-purple">CAPA</span>}</div>
                          <div style={{ fontWeight: 500, fontSize: 12.5, maxWidth: 270 }}>{ev.summary}</div>
                          <div className="kpi-sub">{ev.status} · {ev.assigneeName}</div>
                        </th>
                        <td data-label="Subsystem">
                          <div style={{ fontWeight: 600 }}>{ev.subsystem.label}</div>
                          <div className="kpi-sub">{ev.subsystem.deviceClass}</div>
                          {ev.matchedSops?.[0] && (
                            <div style={{ marginTop: 4 }}>
                              <span className="badge badge-brand" title={ev.matchedSops[0].title}>
                                📄 {ev.matchedSops[0].title.slice(0, 18)}…
                              </span>
                            </div>
                          )}
                        </td>
                        <td data-label="Score">
                          <strong className="mono" style={{ fontSize: 15 }}>{ev.score}</strong>
                          <span className="kpi-sub">/100</span>
                        </td>
                        <td data-label="Verdict">{verdictBadge(ev.verdict)}</td>
                        <td data-label="Live openFDA">
                          {ev.matchedRecalls.length > 0 ? (
                            <div className="pill-row">
                              {ev.classICount > 0 && <span className="badge badge-danger">{ev.classICount} Class I</span>}
                              {ev.classIICount > 0 && <span className="badge badge-warn">{ev.classIICount} Class II</span>}
                            </div>
                          ) : (
                            <span className="badge badge-ok">Clear</span>
                          )}
                        </td>
                        <td data-label="Top Gap" style={{ maxWidth: 260, fontSize: 12 }}>
                          {ev.blockingGaps[0] || <span style={{ color: 'var(--ok)', fontWeight: 600 }}>All gates satisfied</span>}
                        </td>
                        <td data-label="Actions">
                          <div className="pill-row">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => setSignOffKey(ev.issueKey)}
                            >
                              Sign-Off
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                setCapaDefaults({
                                  sourceIssueKey: ev.issueKey,
                                  title: `[CAPA] Remediate ${ev.issueKey} (${ev.subsystem.label})`,
                                  severity: ev.riskTier === 'Critical' ? 'Critical' : 'High',
                                  fdaRecallNumber: ev.matchedRecalls?.[0]?.recallNumber || '',
                                  rationale: ev.blockingGaps.join('; ') || 'Regulatory remediation required.',
                                });
                                setCapaOpen(true);
                              }}
                            >
                              + CAPA
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-rovo"
                              onClick={() =>
                                handleOpenRovo(
                                  `Audit Jira issue ${ev.issueKey} (${ev.summary}) for FDA 21 CFR 820 & ISO 13485 compliance, Teamwork Graph context, and live openFDA recalls.`
                                )
                              }
                            >
                              ✦ Rovo
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TAB 2: Interactive Blast-Radius & Teamwork Graph */}
      <div role="tabpanel" aria-labelledby="tab-graph" hidden={activeTab !== 'graph'}>
        <div className="tabpanel-inner">
          <ContextGraphSvg
            graph={data.graph}
            onCreateCapa={(defaults) => {
              setCapaDefaults(defaults);
              setCapaOpen(true);
            }}
          />
        </div>
      </div>

      {/* TAB 3: Live openFDA Recall Radar */}
      <div role="tabpanel" aria-labelledby="tab-fda" hidden={activeTab !== 'fda'}>
        <div className="tabpanel-inner">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Live US openFDA Medical Device Recall Radar</h2>
                <div className="kpi-sub">
                  Real-time queries against <span className="mono">api.fda.gov/device/enforcement.json</span> — zero PII sent externally
                </div>
              </div>
              <span className="badge badge-ok">{data.fda?.connected ? 'openFDA Live' : 'Offline'}</span>
            </div>

            <form onSubmit={handleFdaSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <input
                type="search"
                className="input"
                style={{ flex: '1 1 240px' }}
                aria-label="Medical device keyword"
                value={fdaKeyword}
                onChange={(e) => setFdaKeyword(e.target.value)}
                placeholder="Search device subsystem (e.g. infusion pump, pacemaker, catheter, ventilator, glucose)…"
              />
              <select
                className="select"
                style={{ width: 170 }}
                aria-label="FDA recall classification"
                value={fdaClass}
                onChange={(e) => setFdaClass(e.target.value)}
              >
                <option value="">All Classes (I / II / III)</option>
                <option value="Class I">Class I (Critical)</option>
                <option value="Class II">Class II (Moderate)</option>
                <option value="Class III">Class III (Minor)</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={fdaSearching}>
                {fdaSearching ? 'Scanning openFDA…' : 'Scan Live openFDA'}
              </button>
            </form>

            <div className="pill-row" style={{ marginBottom: 14 }}>
              {['infusion pump', 'pacemaker', 'catheter', 'ventilator', 'glucose', 'defibrillator'].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setFdaKeyword(kw);
                    callBackend('searchFdaRecalls', { keyword: kw, classification: fdaClass, limit: 10 }).then(
                      setFdaSearchResult
                    );
                  }}
                >
                  {kw}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
              {radarRecalls.map((r) => (
                <article
                  key={r.recallNumber}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div className="pill-row">
                      {fdaClassBadge(r.classification)}
                      <strong className="mono">{r.recallNumber}</strong>
                    </div>
                    <span className="badge badge-neutral">{r.status}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.recallingFirm}</div>
                  <div style={{ fontSize: 12.5 }}>{r.reasonForRecall}</div>
                  <div className="kpi-sub">
                    <strong>Product:</strong> {r.productDescription.slice(0, 140)}
                    <br />
                    <strong>Initiated:</strong> {r.initiationDate} · <strong>Matched:</strong> {r.matchedKeyword}
                  </div>
                  <div className="pill-row" style={{ marginTop: 'auto', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setCapaDefaults({
                          title: `[CAPA] FDA ${r.classification} Recall Impact — ${r.recallNumber}`,
                          severity: r.classification === 'Class I' ? 'Critical' : 'High',
                          fdaRecallNumber: r.recallNumber,
                          rationale: `Evaluate device applicability against live FDA ${r.classification} recall (${r.recallingFirm}): ${r.reasonForRecall}`,
                        });
                        setCapaOpen(true);
                      }}
                    >
                      + Create Impact CAPA
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(r.fdaUrl)}>
                      FDA Portal ↗
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 4: DHF Audit Matrix, Immutable Ledger & Governance Policy */}
      <div role="tabpanel" aria-labelledby="tab-dhf" hidden={activeTab !== 'dhf'}>
        <div className="tabpanel-inner">
          <div className="split-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Design History File (DHF) Audit Pack &amp; Sign-Off Ledger</h2>
                  <div className="kpi-sub">FDA 21 CFR 820.30 / ISO 13485 evidence export ready for external inspectors</div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadAuditPack}>
                  ⬇ Export Audit Pack (.md)
                </button>
              </div>

              <h3 style={{ fontSize: 13.5, margin: '8px 0' }}>Immutable QA Regulatory Sign-Off Ledger ({data.ledger?.length || 0})</h3>
              {!data.ledger?.length ? (
                <div className="kpi-sub" style={{ marginBottom: 14 }}>
                  No QA sign-offs recorded yet. Click "Sign-Off" on any issue in the Cockpit or Issue Panel to record a timestamped entry.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {data.ledger.slice(0, 10).map((entry) => (
                    <div key={entry.id} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <div className="pill-row">
                          <strong className="mono">{entry.issueKey}</strong>
                          <span className={`badge ${entry.decision === 'Approved' ? 'badge-ok' : entry.decision === 'Hold' ? 'badge-danger' : 'badge-warn'}`}>
                            {entry.decision}
                          </span>
                          <span className="mono kpi-sub">{entry.id}</span>
                        </div>
                        <span className="kpi-sub">{entry.actorName} · {entry.recordedAt.slice(0, 19).replace('T', ' ')} UTC</span>
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 4 }}>{entry.rationale}</div>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ fontSize: 13.5, margin: '8px 0' }}>Audit Report Preview</h3>
              <pre className="code-block" style={{ maxHeight: 280 }}>{data.auditMarkdown}</pre>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Regulatory Governance Policy</h2>
                <span className="badge badge-neutral">Forge KVS</span>
              </div>
              <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label htmlFor="pol-std">Target Regulatory Framework</label>
                  <input
                    id="pol-std"
                    className="input"
                    value={policyForm.regulatoryStandard}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, regulatoryStandard: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pol-score">Minimum Ship-Confidence Score (50–98)</label>
                  <input
                    id="pol-score"
                    type="number"
                    min={50}
                    max={98}
                    className="input"
                    value={policyForm.minConfidenceToShip}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, minConfidenceToShip: Number(e.target.value) }))}
                  />
                </div>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={policyForm.blockOnUnmitigatedClassI}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, blockOnUnmitigatedClassI: e.target.checked }))}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Hard Regulatory Hold on Class I FDA Recalls</div>
                    <div className="kpi-sub">Caps confidence at 49/100 until QA logs FDA recall review.</div>
                  </div>
                </label>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={policyForm.requireQaSignOff}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, requireQaSignOff: e.target.checked }))}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Require Formal QA Sign-Off to Ship</div>
                    <div className="kpi-sub">Enforces immutable ledger entry before Ship Ready verdict.</div>
                  </div>
                </label>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving Policy…' : 'Save Governance Policy'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 5: Rovo Agent, Skills, MCP & Teamwork Graph Hub */}
      <div role="tabpanel" aria-labelledby="tab-hub" hidden={activeTab !== 'hub'}>
        <div className="tabpanel-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Rovo Agent &amp; Reusable Skills</h2>
                <span className="badge badge-purple">rovo:agent + 3 rovo:skill</span>
              </div>
              <p className="kpi-sub" style={{ marginTop: 0 }}>
                <strong>MedTrace Compliance Copilot</strong> ships with 3 modular <span className="mono">rovo:skill</span> playbooks and 6 executable Forge actions accessible in Rovo Chat and Jira Automation:
              </p>
              <ul style={{ margin: '8px 0 14px 18px', padding: 0, fontSize: 13 }}>
                <li><strong>fda-recall-impact</strong> — Correlates live openFDA Class I/II/III recalls with Jira issues &amp; Teamwork Graph</li>
                <li><strong>capa-triage</strong> — Triages nonconformances under FDA 21 CFR 820.100 &amp; creates linked CAPA tickets</li>
                <li><strong>dhf-audit-check</strong> — Runs 5-pillar ISO 13485 Design History File release readiness audits</li>
              </ul>
              <button type="button" className="btn btn-rovo" onClick={() => handleOpenRovo()}>
                ✦ Open MedTrace Compliance Copilot
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Atlassian Rovo MCP Server</h2>
                <span className="badge badge-brand">rovo:mcp</span>
              </div>
              <p className="kpi-sub" style={{ marginTop: 0 }}>
                Connect Claude Code, Cursor, Antigravity, or Rovo Studio directly to MedTrace IQ's 6 regulatory tools via OAuth 2.1:
              </p>
              <pre className="code-block">{JSON.stringify({ mcpServers: { 'medtrace-iq': { url: mcpEndpoint } } }, null, 2)}</pre>
              <div className="pill-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      JSON.stringify({ mcpServers: { 'medtrace-iq': { url: mcpEndpoint } } }, null, 2)
                    );
                    setToast('Copied MedTrace MCP server JSON config to clipboard.');
                  }}
                >
                  Copy MCP Config
                </button>
              </div>
              <div className="kpi-sub" style={{ marginTop: 8 }}>
                Enable external exposure in <strong>Atlassian Administration → Apps → Connected apps → MedTrace IQ</strong>. Pair with our open-source <span className="mono">SKILL.md</span> for pre-merge FDA release gating.
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Live Teamwork Graph Telemetry</h2>
                <span className={`badge ${data.twg?.connected ? 'badge-ok' : 'badge-warn'}`}>
                  {data.twg?.connected ? 'Connected' : 'Check Scopes'}
                </span>
              </div>
              <div className="kpi-sub" style={{ marginBottom: 10 }}>
                Echo: <span className="mono">{data.twg?.echo || 'Pending'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(data.twg?.telemetry || []).map((t) => (
                  <div
                    key={t.queryName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                    }}
                  >
                    <span className="mono">{t.queryName}</span>
                    <span>
                      <span className={`badge ${t.ok ? 'badge-ok' : 'badge-warn'}`}>{t.ok ? 'OK' : 'WARN'}</span>{' '}
                      <span className="kpi-sub">{t.durationMs}ms</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">1-Click MedTech Judge Demo Seeder</h2>
                <span className="badge badge-ok">Idempotent</span>
              </div>
              <p className="kpi-sub" style={{ marginTop: 0 }}>
                Evaluating MedTrace IQ on a fresh Jira site? Seed 6 realistic cardiac pacemaker, infusion pump, ICU ventilator, ablation catheter, CGM, and AED CAPA work items into <strong>{data.project.key}</strong> in one click.
              </p>
              <button type="button" className="btn btn-primary" onClick={handleSeedDemo} disabled={busy}>
                {busy ? 'Seeding MedTech Issues…' : `⚡ Seed 6 MedTech Issues into ${data.project.key}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <CapaModal
        open={capaOpen}
        onClose={() => setCapaOpen(false)}
        onSubmit={handleCreateCapa}
        defaultValues={capaDefaults}
        busy={busy}
      />
      <SignOffModal
        open={Boolean(signOffKey)}
        onClose={() => setSignOffKey('')}
        onSubmit={handleSignOff}
        issueKey={signOffKey}
        busy={busy}
      />
    </div>
  );
}
