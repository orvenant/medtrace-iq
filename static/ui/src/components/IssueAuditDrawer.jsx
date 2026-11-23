import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { openExternalUrl } from '../utils/bridge';
import ScoreGauge, { fdaClassBadge, verdictBadge } from './ScoreGauge';
import {
  IconCheckCircle,
  IconExternalLink,
  IconFileText,
  IconLock,
  IconPlus,
  IconSliders,
  IconSparkle,
  IconXCircle,
} from './Icons';

/**
 * Interactive Slide-Over Issue Audit & Per-Gate What-If Release Simulator Drawer.
 * Uses native <dialog> opened via showModal() following modern-web-guidance.
 */
export default function IssueAuditDrawer({
  evaluation,
  policy,
  onClose,
  onToggleChecklist,
  onOpenSignOff,
  onOpenCapa,
  onAskRovo,
  busy = false,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [simFlags, setSimFlags] = useState({
    designVerification: false,
    iso14971RiskReview: false,
    sopOwnerVerified: false,
    fdaRecallReviewed: false,
    qaApproved: false,
  });

  useEffect(() => {
    if (evaluation) {
      setSimFlags({
        designVerification: false,
        iso14971RiskReview: false,
        sopOwnerVerified: false,
        fdaRecallReviewed: false,
        qaApproved: false,
      });
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [evaluation?.issueKey]);

  const handleClose = () => {
    if (dialogRef.current) dialogRef.current.returnValue = '';
    onClose?.();
  };

  const anySimActive = Object.values(simFlags).some(Boolean);

  // Recompute deterministic 5-pillar score & verdict dynamically for toggled What-If gates
  const simulated = useMemo(() => {
    if (!evaluation) return null;
    const p = evaluation.pillars;
    const minGate = Number(policy?.minConfidenceToShip) || 80;
    const blockOnClassI = policy?.blockOnUnmitigatedClassI !== false;
    const requireQa = policy?.requireQaSignOff !== false;

    const effVv = Boolean(evaluation.checklist?.designVerification || simFlags.designVerification);
    const effIso = Boolean(evaluation.checklist?.iso14971RiskReview || simFlags.iso14971RiskReview);
    const effSop = Boolean(evaluation.checklist?.sopOwnerVerified || simFlags.sopOwnerVerified);
    const effFda = Boolean(evaluation.checklist?.fdaRecallReviewed || simFlags.fdaRecallReviewed);
    const effQa = evaluation.signOff?.decision === 'Approved' || simFlags.qaApproved;

    const p1 = p.designControl.score;
    const p2 = Math.min(
      25,
      p.verificationValidation.score +
        (!evaluation.checklist?.designVerification && effVv ? 15 : 0) +
        (!evaluation.checklist?.iso14971RiskReview && effIso ? 6 : 0)
    );
    const sopBaseGap = Math.max(0, 10 - Math.min(10, p.sopOrgContext.score));
    const p3 = Math.min(
      20,
      p.sopOrgContext.score + (!evaluation.checklist?.sopOwnerVerified && effSop ? Math.max(3, sopBaseGap) : 0)
    );
    const p4 = effFda ? 20 : p.fdaRecallClearance.score;
    const p5 = effQa ? 10 : p.qaSignOff.score;

    let score = Math.max(0, Math.min(100, p1 + p2 + p3 + p4 + p5));
    const hasUnmitigatedClassI = evaluation.classICount > 0 && !effFda;

    if (evaluation.signOff?.decision === 'Hold' && !simFlags.qaApproved) {
      score = Math.min(score, 39);
    } else if (blockOnClassI && hasUnmitigatedClassI) {
      score = Math.min(score, 49);
    }

    let verdict = 'CONDITIONAL';
    if ((evaluation.signOff?.decision === 'Hold' && !simFlags.qaApproved) || (blockOnClassI && hasUnmitigatedClassI) || score < 55) {
      verdict = 'HOLD';
    } else if (score >= minGate && (!requireQa || effQa)) {
      verdict = 'SHIP_READY';
    }

    return {
      score,
      verdict,
      delta: score - evaluation.score,
    };
  }, [evaluation, policy, simFlags]);

  if (!evaluation) {
    return <dialog ref={dialogRef} className="mt-drawer" aria-labelledby={titleId} onClose={handleClose} />;
  }

  const displayedScore = anySimActive && simulated ? simulated.score : evaluation.score;
  const displayedVerdict = anySimActive && simulated ? simulated.verdict : evaluation.verdict;

  const simOptions = [
    { key: 'designVerification', label: 'V&V Passed', pts: '+15', alreadyDone: Boolean(evaluation.checklist?.designVerification) },
    { key: 'iso14971RiskReview', label: 'ISO 14971 Risk', pts: '+6', alreadyDone: Boolean(evaluation.checklist?.iso14971RiskReview) },
    { key: 'sopOwnerVerified', label: 'SOP Owner', pts: '+10', alreadyDone: Boolean(evaluation.checklist?.sopOwnerVerified) },
    { key: 'fdaRecallReviewed', label: 'openFDA Reviewed', pts: evaluation.classICount > 0 ? '+18 & Lift Hold' : '+10', alreadyDone: Boolean(evaluation.checklist?.fdaRecallReviewed) },
    { key: 'qaApproved', label: 'QA Approved', pts: '+10', alreadyDone: evaluation.signOff?.decision === 'Approved' },
  ].filter((o) => !o.alreadyDone);

  const toggleSim = (k) => setSimFlags((prev) => ({ ...prev, [k]: !prev[k] }));
  const simulateAll = () => {
    const next = {};
    simOptions.forEach((o) => {
      next[o.key] = true;
    });
    setSimFlags((prev) => ({ ...prev, ...next }));
  };

  return (
    <dialog ref={dialogRef} className="mt-drawer" aria-labelledby={titleId} onClose={handleClose}>
      <div className="dialog-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 4 }}>
            <strong className="mono">{evaluation.issueKey}</strong>
            {verdictBadge(displayedVerdict)}
            {anySimActive && <span className="badge badge-purple">What-If Active</span>}
          </div>
          <h2 id={titleId} style={{ fontSize: 15 }}>{evaluation.summary}</h2>
        </div>
        <button type="button" className="btn btn-sm" onClick={handleClose} aria-label="Close audit drawer">
          Close
        </button>
      </div>

      <div className="drawer-body">
        {/* Top Score + Interactive Per-Gate What-If Simulator */}
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ScoreGauge score={displayedScore} verdict={displayedVerdict} size={84} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{evaluation.subsystem.label}</div>
                <div className="kpi-sub">{evaluation.subsystem.deviceClass} · {evaluation.riskTier} Risk</div>
                <div className="kpi-sub" style={{ marginTop: 4 }}>
                  {anySimActive && simulated
                    ? `Simulated delta: ${simulated.delta >= 0 ? '+' : ''}${simulated.delta} pts (${evaluation.score} → ${simulated.score})`
                    : `${evaluation.blockingGaps.length} open gate(s) before release`}
                </div>
              </div>
            </div>
            {simOptions.length > 0 && (
              <div className="pill-row">
                <button type="button" className="btn btn-sm" onClick={simulateAll}>
                  <IconSliders size={13} /> Simulate All
                </button>
                {anySimActive && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      setSimFlags({
                        designVerification: false,
                        iso14971RiskReview: false,
                        sopOwnerVerified: false,
                        fdaRecallReviewed: false,
                        qaApproved: false,
                      })
                    }
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {simOptions.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Interactive What-If Gate Simulator (toggle open gates to project score)
              </div>
              <div className="sim-grid">
                {simOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className="sim-toggle"
                    aria-pressed={Boolean(simFlags[opt.key])}
                    onClick={() => toggleSim(opt.key)}
                  >
                    <span>{opt.label}</span>
                    <span className="mono" style={{ opacity: 0.85 }}>{opt.pts}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FDA 21 CFR 820.30 Semantic Design Control Rubric */}
        {evaluation.designControlRubric && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">FDA 21 CFR 820.30 Specification Rubric</h3>
              <span className="badge badge-brand">
                {evaluation.designControlRubric.passedCount}/{evaluation.designControlRubric.totalCount} Verified
              </span>
            </div>
            <div className="rubric-list">
              {evaluation.designControlRubric.checks.map((c) => (
                <div key={c.id} className="rubric-item">
                  <span className="inline-flex-row" style={{ color: c.passed ? 'var(--ok)' : 'var(--danger)', fontWeight: 600 }}>
                    {c.passed ? <IconCheckCircle size={14} /> : <IconXCircle size={14} />}
                    <span style={{ color: 'var(--text)' }}>{c.label}</span>
                  </span>
                  <span className="mono kpi-sub">{c.passed ? `+${c.weight}` : `0/${c.weight}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5-Pillar Breakdown */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 10 }}>5-Pillar FDA 21 CFR 820 / ISO 13485 Breakdown</h3>
          {[
            ['Design Controls (820.30)', evaluation.pillars.designControl],
            ['V&V & ISO 14971 Evidence', evaluation.pillars.verificationValidation],
            ['SOP & Teamwork Graph', evaluation.pillars.sopOrgContext],
            ['openFDA Recall Clearance', evaluation.pillars.fdaRecallClearance],
            ['QA Regulatory Sign-Off', evaluation.pillars.qaSignOff],
          ].map(([label, p]) => (
            <div className="pillar-row" key={label}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
              <div className="pillar-track">
                <div className="pillar-fill" style={{ width: `${Math.round((p.score / p.max) * 100)}%` }} />
              </div>
              <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{p.score}/{p.max}</span>
            </div>
          ))}
        </div>

        {/* Interactive ISO 13485 Checklist (Persists directly to Forge KVS!) */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Live ISO 13485 Gate Controls</h3>
            <span className="badge badge-neutral">Persisted in Forge KVS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['designVerification', 'Design Verification & Validation (V&V) Passed'],
              ['iso14971RiskReview', 'ISO 14971 Hazard & FMEA Review Complete'],
              ['sopOwnerVerified', 'Confluence SOP Impact & Owner Confirmed'],
              ['fdaRecallReviewed', 'Live openFDA Recall Parallels Assessed'],
            ].map(([field, label]) => (
              <label key={field} className="checklist-item">
                <input
                  type="checkbox"
                  checked={Boolean(evaluation.checklist?.[field])}
                  disabled={busy}
                  onChange={(e) => onToggleChecklist(evaluation.issueKey, field, e.target.checked)}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Auto-Matched Teamwork Graph SOPs */}
        {evaluation.matchedSops?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Auto-Matched Confluence SOPs (Teamwork Graph)</h3>
              <span className="badge badge-ok">Live TWG</span>
            </div>
            {evaluation.matchedSops.map((sop) => (
              <div key={sop.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="inline-flex-row" style={{ fontWeight: 600, fontSize: 12.5 }}>
                    <IconFileText size={13} />
                    <span>{sop.title}</span>
                  </div>
                  <div className="kpi-sub">Owner: {sop.ownerName} · Space: {sop.spaceKey}</div>
                </div>
                {sop.webUrl && (
                  <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(sop.webUrl)}>
                    Open <IconExternalLink size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Live Matched openFDA Recalls */}
        {evaluation.matchedRecalls?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Matched Live openFDA Recalls ({evaluation.matchedRecalls.length})</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evaluation.matchedRecalls.slice(0, 3).map((r) => (
                <div key={r.recallNumber} style={{ padding: 9, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="pill-row" style={{ marginBottom: 4 }}>
                    {fdaClassBadge(r.classification)}
                    <strong className="mono">{r.recallNumber}</strong>
                    {r.matchStrength === 'DIRECT_FAILURE_MODE' && (
                      <span className="badge badge-danger">
                        Direct Failure Match: {(r.failureModeMatches || []).slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.recallingFirm}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.reasonForRecall.slice(0, 170)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 21 CFR Part 11 Latest Sign-Off */}
        {evaluation.signOff && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title inline-flex-row">
                <IconLock size={14} /> Latest 21 CFR Part 11 QA Sign-Off
              </h3>
              <span className="badge badge-brand">{evaluation.signOff.decision}</span>
            </div>
            <div style={{ fontSize: 12.5 }}>
              <strong>Reviewer:</strong> {evaluation.signOff.actorName} ({evaluation.signOff.id})
              <br />
              <strong>Rationale:</strong> {evaluation.signOff.rationale}
              {evaluation.signOff.entryHash && (
                <div className="mono kpi-sub" style={{ marginTop: 4, fontSize: 11 }}>
                  SHA-256: {evaluation.signOff.entryHash}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="dialog-foot">
        <button type="button" className="btn btn-rovo btn-sm" onClick={() => onAskRovo(evaluation)}>
          <IconSparkle size={13} /> Ask Rovo Copilot
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onOpenCapa(evaluation)}>
          <IconPlus size={13} /> Create CAPA
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenSignOff(evaluation.issueKey)}>
          <IconLock size={13} /> Record 21 CFR Part 11 Sign-Off
        </button>
      </div>
    </dialog>
  );
}
