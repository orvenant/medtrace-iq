import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callBackend, openExternalUrl, openMedTraceRovo } from '../utils/bridge';
import ScoreGauge, { fdaClassBadge, verdictBadge } from './ScoreGauge';
import ContextGraphSvg from './ContextGraphSvg';
import { CapaModal, SignOffModal } from './CapaModal';
import IssueAuditDrawer from './IssueAuditDrawer';
import {
  IconBolt,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconLock,
  IconPlus,
  IconRefresh,
  IconShieldAlert,
  IconShieldCheck,
  IconSliders,
  IconSparkle,
  StatusDot,
} from './Icons';

const TABS = [
  { id: 'overview', label: 'Release Readiness Cockpit' },
  { id: 'graph', label: 'Blast-Radius & TWG Graph' },
  { id: 'fda', label: 'Live openFDA Recall Radar' },
  { id: 'dhf', label: 'DHF · 21 CFR Part 11 · Policy' },
  { id: 'hub', label: 'Rovo · MCP · Automation' },
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
  const [riskFilter, setRiskFilter] = useState('ALL');
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
    autonomousFdaMonitor: true,
    regulatoryStandard: 'FDA 21 CFR 820 + ISO 13485 + ISO 14971',
  });

  // 21 CFR Part 11 Cryptographic verification
  const [chainResult, setChainResult] = useState(null);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // Modals & Slide-Over Audit Drawer
  const [selectedIssueKey, setSelectedIssueKey] = useState('');
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
      setChainResult(res.chainVerification || null);
      if (res.policy) {
        setPolicyForm({
          minConfidenceToShip: res.policy.minConfidenceToShip ?? 80,
          blockOnUnmitigatedClassI: res.policy.blockOnUnmitigatedClassI !== false,
          requireQaSignOff: res.policy.requireQaSignOff !== false,
          autonomousFdaMonitor: res.policy.autonomousFdaMonitor !== false,
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
      if (riskFilter !== 'ALL' && ev.riskTier !== riskFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const hay = `${ev.issueKey} ${ev.summary} ${ev.subsystem.label} ${ev.assigneeName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data?.evaluations, verdictFilter, riskFilter, searchText]);

  const selectedEvaluation = useMemo(
    () => (data?.evaluations || []).find((ev) => ev.issueKey === selectedIssueKey) || null,
    [data?.evaluations, selectedIssueKey]
  );

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

  const handleDownloadJsonAuditPack = () => {
    if (!data) return;
    const payload = {
      schema: 'medtrace-iq.21cfr11-evidence-pack.v3',
      generatedAt: data.generatedAt,
      project: data.project,
      policy: data.policy,
      summary: data.summary,
      analytics: data.analytics,
      chainVerification: chainResult || data.chainVerification,
      evaluations: data.evaluations,
      ledger: data.ledger,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MedTrace-IQ-21CFR11-Evidence-${data.project.key}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Downloaded machine-readable 21 CFR Part 11 JSON Evidence Pack (.json).');
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    try {
      const res = await callBackend('verifyAuditChain', { projectKey: data.project.key });
      setChainResult(res);
      setToast(
        res.valid
          ? `SHA-256 Chain VERIFIED: ${res.verifiedChainedEntries} chained record(s) intact · Head ${res.headHashShort}`
          : `TAMPER ALERT on ${res.brokenEntryId}: ${res.brokenReason || 'Hash mismatch detected'}`
      );
    } catch (err) {
      setError(err?.message || 'Audit chain verification failed.');
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleToggleChecklist = async (issueKey, field, value) => {
    setBusy(true);
    try {
      await callBackend('updateIssueChecklist', { issueKey, patch: { [field]: value } });
      await loadCockpit();
      setToast(`Updated ISO 13485 gate control for ${issueKey} in Forge KVS.`);
    } catch (err) {
      setError(err?.message || 'Checklist update failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleMatrixCellClick = (tier, verdict) => {
    if (riskFilter === tier && verdictFilter === verdict) {
      setRiskFilter('ALL');
      setVerdictFilter('ALL');
    } else {
      setRiskFilter(tier);
      setVerdictFilter(verdict);
    }
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
            <IconSparkle size={14} /> Launch MedTrace Rovo
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
            <IconPlus size={14} /> New CAPA
          </button>
          <button type="button" className="btn" onClick={handleSeedDemo} disabled={busy}>
            <IconBolt size={14} /> Seed MedTech Demo
          </button>
          <button type="button" className="btn" onClick={loadCockpit} disabled={loading}>
            <IconRefresh size={14} /> Refresh
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
          <div className="kpi-sub inline-flex-row" style={{ flexWrap: 'wrap' }}>
            <span className="inline-flex-row"><StatusDot tone="ok" /> {s.shipReadyCount} Ready</span>
            <span>·</span>
            <span className="inline-flex-row"><StatusDot tone="warn" /> {s.conditionalCount} Cond</span>
            <span>·</span>
            <span className="inline-flex-row"><StatusDot tone="danger" /> {s.holdCount} Hold</span>
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
          <div className="kpi-sub inline-flex-row" style={{ flexWrap: 'wrap' }}>
            <StatusDot tone={s.twgConnected ? 'ok' : 'warn'} />
            <span>{s.twgConnected ? 'Live TWG' : 'Pending Scope'} · {s.twgTeamsCount} Teams · {s.twgSopCount} SOPs · {s.twgGoalsCount} Goals</span>
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
          {/* Executive Analytics Row: 3x3 Risk x Verdict Heatmap + 5-Pillar Coverage */}
          {data.analytics && (
            <section className="analytics-grid" aria-label="Executive risk and compliance analytics">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">ISO 14971 Risk × Release Verdict Matrix</h2>
                    <div className="kpi-sub">Click any cell to cross-filter the release gate table below</div>
                  </div>
                  {(riskFilter !== 'ALL' || verdictFilter !== 'ALL') && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setRiskFilter('ALL');
                        setVerdictFilter('ALL');
                      }}
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <table className="heatmap-table" aria-label="ISO 14971 risk tier versus release verdict counts">
                  <thead>
                    <tr>
                      <th>Risk Tier</th>
                      <th>HOLD</th>
                      <th>CONDITIONAL</th>
                      <th>SHIP READY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Critical', 'High', 'Moderate'].map((tier) => {
                      const row = data.analytics.riskMatrix?.[tier] || { HOLD: 0, CONDITIONAL: 0, SHIP_READY: 0 };
                      return (
                        <tr key={tier}>
                          <th scope="row">{tier}</th>
                          {[
                            ['HOLD', 'cell-hold'],
                            ['CONDITIONAL', 'cell-cond'],
                            ['SHIP_READY', 'cell-ok'],
                          ].map(([verdictKey, toneClass]) => {
                            const count = row[verdictKey] || 0;
                            const isSelected = riskFilter === tier && verdictFilter === verdictKey;
                            return (
                              <td key={verdictKey}>
                                <button
                                  type="button"
                                  className={`heatmap-cell ${count > 0 ? toneClass : 'cell-zero'}`}
                                  style={isSelected ? { outline: '2px solid var(--brand)', outlineOffset: 2 } : undefined}
                                  aria-pressed={isSelected}
                                  onClick={() => handleMatrixCellClick(tier, verdictKey)}
                                  title={`Filter ${tier} risk items with ${verdictKey} verdict`}
                                >
                                  {count}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Project 5-Pillar FDA 21 CFR 820 Coverage</h2>
                    <div className="kpi-sub">Average maturity across all {s.totalIssues} audited work item(s)</div>
                  </div>
                  <span className="badge badge-brand">v3.1 Engine</span>
                </div>
                {(data.analytics.pillarAverages || []).map((p) => (
                  <div className="pillar-row" key={p.key}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{p.label}</span>
                    <div className="pillar-track">
                      <div
                        className="pillar-fill"
                        style={{
                          width: `${p.pct}%`,
                          background: p.pct >= 80 ? 'var(--ok)' : p.pct >= 50 ? 'var(--brand)' : 'var(--warn)',
                        }}
                      />
                    </div>
                    <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {p.avg}/{p.max}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Release Gate &amp; Regulatory Risk Table</h2>
                <div className="kpi-sub">
                  Every Jira work item scored deterministically across 5 FDA 21 CFR 820 / ISO 13485 pillars · Click <strong>Inspect</strong> for What-If Simulator
                </div>
              </div>
              <div className="pill-row">
                {riskFilter !== 'ALL' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setRiskFilter('ALL')}
                    title="Clear risk tier filter"
                  >
                    Risk: {riskFilter} ✕
                  </button>
                )}
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
                <span>No work items match this filter. Clear filters above or click "Seed MedTech Demo" to populate regulated medical device tickets.</span>
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
                          <div className="mono">
                            <button
                              type="button"
                              onClick={() => setSelectedIssueKey(ev.issueKey)}
                              style={{
                                background: 'none',
                                border: 0,
                                padding: 0,
                                color: 'var(--brand)',
                                font: 'inherit',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {ev.issueKey}
                            </button>{' '}
                            {ev.isCapa && <span className="badge badge-purple">CAPA</span>}
                          </div>
                          <div style={{ fontWeight: 500, fontSize: 12.5, maxWidth: 270 }}>{ev.summary}</div>
                          <div className="kpi-sub">{ev.status} · {ev.assigneeName} · {ev.riskTier} Risk</div>
                        </th>
                        <td data-label="Subsystem">
                          <div style={{ fontWeight: 600 }}>{ev.subsystem.label}</div>
                          <div className="kpi-sub">{ev.subsystem.deviceClass}</div>
                          {ev.matchedSops?.[0] && (
                            <div style={{ marginTop: 4 }}>
                              <span className="badge badge-brand inline-flex-row" title={ev.matchedSops[0].title}>
                                <IconFileText size={11} />
                                <span>{ev.matchedSops[0].title.slice(0, 18)}…</span>
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
                              {ev.directFailureModeCount > 0 && (
                                <span className="badge badge-purple" title="Direct technical failure-mode overlap with live FDA recall">
                                  Failure Match
                                </span>
                              )}
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
                              className="btn btn-sm"
                              onClick={() => setSelectedIssueKey(ev.issueKey)}
                            >
                              <IconSliders size={12} /> Inspect
                            </button>
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
                              <IconPlus size={12} /> CAPA
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
                              <IconSparkle size={12} /> Rovo
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
                      <IconPlus size={12} /> Create Impact CAPA
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(r.fdaUrl)}>
                      FDA Portal <IconExternalLink size={12} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 4: DHF Audit Matrix, 21 CFR Part 11 SHA-256 Ledger & Governance Policy */}
      <div role="tabpanel" aria-labelledby="tab-dhf" hidden={activeTab !== 'dhf'}>
        <div className="tabpanel-inner">
          {/* FDA 21 CFR Part 11 Cryptographic Integrity Banner */}
          {(() => {
            const chain = chainResult || data.chainVerification;
            if (!chain) return null;
            return (
              <div className={`banner ${chain.valid ? 'banner-ok' : 'banner-danger'}`}>
                <div>
                  <div className="inline-flex-row" style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {chain.valid ? <IconShieldCheck size={16} /> : <IconShieldAlert size={16} />}
                    <span>
                      {chain.valid
                        ? 'FDA 21 CFR Part 11 Cryptographic Audit Chain: VERIFIED INTACT (SHA-256)'
                        : `TAMPER ALERT DETECTED at ${chain.brokenEntryId}: ${chain.brokenReason || 'Hash mismatch'}`}
                    </span>
                  </div>
                  <div className="kpi-sub" style={{ color: 'inherit', opacity: 0.9, marginTop: 2 }}>
                    {chain.verifiedChainedEntries} SHA-256 chained record(s) · {chain.legacyEntries || 0} legacy record(s) · Head Digest:{' '}
                    <span className="mono">{chain.headHashShort}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleVerifyChain}
                  disabled={verifyingChain}
                >
                  <IconLock size={13} /> {verifyingChain ? 'Verifying SHA-256…' : 'Verify Chain Now'}
                </button>
              </div>
            );
          })()}

          <div className="split-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Design History File (DHF) Audit Pack &amp; SHA-256 Ledger</h2>
                  <div className="kpi-sub">FDA 21 CFR 820.30 / 21 CFR Part 11 / ISO 13485 evidence export for external inspectors</div>
                </div>
                <div className="pill-row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadAuditPack}>
                    <IconDownload size={13} /> Export (.md)
                  </button>
                  <button type="button" className="btn btn-sm" onClick={handleDownloadJsonAuditPack}>
                    <IconDownload size={13} /> Evidence (.json)
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 13.5, margin: '8px 0' }}>Cryptographic QA &amp; Autonomous Event Ledger ({data.ledger?.length || 0})</h3>
              {!data.ledger?.length ? (
                <div className="kpi-sub" style={{ marginBottom: 14 }}>
                  No QA sign-offs or autonomous FDA alerts recorded yet. Click "Sign-Off" on any issue in the Cockpit or Issue Panel to append a SHA-256 chained record.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {data.ledger.slice(0, 12).map((entry) => (
                    <div key={entry.id} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <div className="pill-row">
                          <strong className="mono">{entry.issueKey}</strong>
                          <span className={`badge ${entry.decision === 'Approved' ? 'badge-ok' : entry.decision === 'Hold' ? 'badge-danger' : 'badge-warn'}`}>
                            {entry.decision}
                          </span>
                          {entry.eventType === 'AUTONOMOUS_FDA_ALERT' && (
                            <span className="badge badge-purple">Auto Trigger</span>
                          )}
                          <span className="mono kpi-sub">{entry.id}</span>
                        </div>
                        <span className="kpi-sub">{entry.actorName} · {entry.recordedAt.slice(0, 19).replace('T', ' ')} UTC</span>
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 4 }}>{entry.rationale}</div>
                      {entry.entryHash && (
                        <div className="mono kpi-sub" style={{ fontSize: 11, marginTop: 4 }}>
                          SHA-256: {entry.entryHash.slice(0, 24)}… ← prev: {(entry.previousHash || 'GENESIS').slice(0, 12)}
                        </div>
                      )}
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
                    <div className="kpi-sub">Caps confidence at 49/100 and blocks Jira release transitions until QA logs recall review.</div>
                  </div>
                </label>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={policyForm.requireQaSignOff}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, requireQaSignOff: e.target.checked }))}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Require Formal 21 CFR Part 11 QA Sign-Off</div>
                    <div className="kpi-sub">Enforces SHA-256 chained ledger approval before Ship Ready verdict.</div>
                  </div>
                </label>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={policyForm.autonomousFdaMonitor}
                    onChange={(e) => setPolicyForm((p) => ({ ...p, autonomousFdaMonitor: e.target.checked }))}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Autonomous Background openFDA Trigger Monitor</div>
                    <div className="kpi-sub">Automatically scans every created/updated Jira issue against live openFDA Class I recalls, applies <span className="mono">medtrace-fda-hold</span>, and posts an audit comment.</div>
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

      {/* TAB 5: Rovo Agent, Skills, MCP & Enterprise Automation Hub */}
      <div role="tabpanel" aria-labelledby="tab-hub" hidden={activeTab !== 'hub'}>
        <div className="tabpanel-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Rovo Agent &amp; Reusable Skills</h2>
                <span className="badge badge-purple">rovo:agent + 3 rovo:skill</span>
              </div>
              <p className="kpi-sub" style={{ marginTop: 0 }}>
                <strong>MedTrace QMS Copilot</strong> ships with 3 modular <span className="mono">rovo:skill</span> playbooks and <strong>7 executable Forge actions</strong> accessible in Rovo Chat and Jira Automation:
              </p>
              <ul style={{ margin: '8px 0 14px 18px', padding: 0, fontSize: 13 }}>
                <li><strong>fda-recall-impact</strong> — Correlates live openFDA Class I/II/III recalls with Jira issues &amp; Teamwork Graph</li>
                <li><strong>capa-triage</strong> — Triages nonconformances under FDA 21 CFR 820.100 &amp; creates linked CAPA tickets</li>
                <li><strong>dhf-audit-check</strong> — Runs 5-pillar ISO 13485 DHF audits &amp; verifies SHA-256 21 CFR Part 11 audit chains</li>
              </ul>
              <button type="button" className="btn btn-rovo" onClick={() => handleOpenRovo()}>
                <IconSparkle size={14} /> Open MedTrace QMS Copilot
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Atlassian Rovo MCP Server</h2>
                <span className="badge badge-brand">rovo:mcp · 7 Tools</span>
              </div>
              <p className="kpi-sub" style={{ marginTop: 0 }}>
                Connect Claude Code, Cursor, Antigravity, or Rovo Studio directly to MedTrace IQ's <strong>7 regulatory tools</strong> (including <span className="mono">verify-audit-chain</span>) via OAuth 2.1:
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
                <h2 className="card-title">Autonomous Platform Modules (v3.0)</h2>
                <span className="badge badge-ok">Enterprise</span>
              </div>
              <ul style={{ margin: '4px 0 10px 18px', padding: 0, fontSize: 12.5, lineHeight: 1.55 }}>
                <li>
                  <strong>Autonomous openFDA Trigger</strong> (<span className="mono">trigger</span>) — Listens to <span className="mono">avi:jira:created:issue</span> &amp; <span className="mono">updated:issue</span>, auto-applies <span className="mono">medtrace-fda-hold</span> label, posts ADF alert comment, and appends SHA-256 ledger entry.
                </li>
                <li>
                  <strong>Physical Release Gate</strong> (<span className="mono">jira:workflowValidator</span>) — Blocks Jira transitions unless Ship-Confidence = <span className="mono">SHIP_READY</span>. Enable in <em>Project Settings → Workflows → Transition Rules → Validators → MedTrace IQ FDA/ISO Release Gate</em>.
                </li>
                <li>
                  <strong>Executive Dashboard Gadget</strong> (<span className="mono">jira:dashboardGadget</span>) — Add <em>MedTrace IQ Executive Release Readiness</em> to any Jira Dashboard for VP QA leadership visibility.
                </li>
              </ul>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Live Teamwork Graph Telemetry</h2>
                <div className="pill-row">
                  {data.twg?.snapshotUsed && (
                    <span className="badge badge-brand">KVS Snapshot Hydrated</span>
                  )}
                  <span className={`badge ${data.twg?.connected ? 'badge-ok' : 'badge-warn'}`}>
                    {data.twg?.connected ? 'Connected' : 'Check Scopes'}
                  </span>
                </div>
              </div>
              <div className="kpi-sub" style={{ marginBottom: 10 }}>
                Echo: <span className="mono">{data.twg?.echo || 'Pending'}</span> · Resolved: <strong>{s.twgTeamsCount} Teams · {s.twgSopCount} SOPs · {s.twgGoalsCount} Goals</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(data.twg?.telemetry || []).map((t) => {
                  const hydrated = !t.ok && data.twg?.snapshotUsed;
                  return (
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
                        <span className={`badge ${t.ok ? 'badge-ok' : hydrated ? 'badge-brand' : 'badge-warn'}`}>
                          {t.ok ? 'LIVE OK' : hydrated ? 'CACHED OK' : 'WARN'}
                        </span>{' '}
                        <span className="kpi-sub">{t.durationMs}ms</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">1-Click MedTech Judge Demo Seeder</h2>
                <span className="badge badge-ok">Balanced Portfolio</span>
              </div>
              <p className="kpi-sub" style={{ marginTop: 0 }}>
                Evaluating MedTrace IQ on a fresh Jira site? Seed 6 realistic cardiac pacemaker, infusion pump, ICU ventilator, ablation catheter, CGM, and AED CAPA work items into <strong>{data.project.key}</strong> with realistic Ship Ready, Conditional, and Regulatory Hold states in one click.
              </p>
              <button type="button" className="btn btn-primary" onClick={handleSeedDemo} disabled={busy}>
                <IconBolt size={14} /> {busy ? 'Seeding MedTech Issues…' : `Seed / Calibrate Demo in ${data.project.key}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <IssueAuditDrawer
        evaluation={selectedEvaluation}
        policy={data.policy}
        onClose={() => setSelectedIssueKey('')}
        onToggleChecklist={handleToggleChecklist}
        onOpenSignOff={(key) => {
          setSelectedIssueKey('');
          setSignOffKey(key);
        }}
        onOpenCapa={(ev) => {
          setSelectedIssueKey('');
          setCapaDefaults({
            sourceIssueKey: ev.issueKey,
            title: `[CAPA] Remediate ${ev.issueKey} (${ev.subsystem.label})`,
            severity: ev.riskTier === 'Critical' ? 'Critical' : 'High',
            fdaRecallNumber: ev.matchedRecalls?.[0]?.recallNumber || '',
            rationale: ev.blockingGaps.join('; ') || 'Regulatory remediation required.',
          });
          setCapaOpen(true);
        }}
        onAskRovo={(ev) => {
          setSelectedIssueKey('');
          handleOpenRovo(
            `Audit Jira issue ${ev.issueKey} (${ev.summary}) for FDA 21 CFR 820 & ISO 13485 compliance, Teamwork Graph context, and live openFDA recalls.`
          );
        }}
        busy={busy}
      />

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
