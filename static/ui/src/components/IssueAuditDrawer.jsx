import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { openExternalUrl } from '../utils/bridge';
import ScoreGauge, { fdaClassBadge, verdictBadge } from './ScoreGauge';

/**
 * Interactive Slide-Over Issue Audit & What-If Gate Simulator Drawer.
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
  const [simulateMode, setSimulateMode] = useState(false);

  useEffect(() => {
    if (evaluation) {
      setSimulateMode(false);
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [evaluation]);

  const handleClose = () => {
    if (dialogRef.current) dialogRef.current.returnValue = '';
    onClose?.();
  };

  // Compute live "What-If" projected score if remaining checklist + QA sign-off are completed
  const simulated = useMemo(() => {
    if (!evaluation) return null;
    const p = evaluation.pillars;
    const gainVv =
      (!evaluation.checklist?.designVerification ? 15 : 0) +
      (!evaluation.checklist?.iso14971RiskReview ? 6 : 0);
    const gainSop = !evaluation.checklist?.sopOwnerVerified ? Math.max(0, 10 - Math.min(10, p.sopOrgContext.score)) : 0;
    const gainFda = !evaluation.checklist?.fdaRecallReviewed ? Math.max(0, 20 - p.fdaRecallClearance.score) : 0;
    const gainQa = evaluation.signOff?.decision !== 'Approved' ? 10 - p.qaSignOff.score : 0;
    const rawProjected = Math.min(
      100,
      p.designControl.score +
        Math.min(25, p.verificationValidation.score + gainVv) +
        Math.min(20, p.sopOrgContext.score + gainSop) +
        20 +
        10
    );
    const minGate = policy?.minConfidenceToShip || 80;
    return {
      score: rawProjected,
      verdict: rawProjected >= minGate ? 'SHIP_READY' : 'CONDITIONAL',
      gainTotal: Math.max(0, rawProjected - evaluation.score),
    };
  }, [evaluation, policy]);

  if (!evaluation) {
    return <dialog ref={dialogRef} className="mt-drawer" aria-labelledby={titleId} onClose={handleClose} />;
  }

  const displayedScore = simulateMode && simulated ? simulated.score : evaluation.score;
  const displayedVerdict = simulateMode && simulated ? simulated.verdict : evaluation.verdict;

  return (
    <dialog ref={dialogRef} className="mt-drawer" aria-labelledby={titleId} onClose={handleClose}>
      <div className="dialog-head">
        <div>
          <div className="pill-row" style={{ marginBottom: 4 }}>
            <strong className="mono">{evaluation.issueKey}</strong>
            {verdictBadge(displayedVerdict)}
            {simulateMode && <span className="badge badge-purple">What-If Simulation</span>}
          </div>
          <h2 id={titleId} style={{ fontSize: 15 }}>{evaluation.summary}</h2>
        </div>
        <button type="button" className="btn btn-sm" onClick={handleClose} aria-label="Close audit drawer">
          ✕
        </button>
      </div>

      <div className="drawer-body">
        {/* Top Score + What-If Simulator Bar */}
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ScoreGauge score={displayedScore} verdict={displayedVerdict} size={84} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{evaluation.subsystem.label}</div>
              <div className="kpi-sub">{evaluation.subsystem.deviceClass} · {evaluation.riskTier} Risk</div>
              <div className="kpi-sub" style={{ marginTop: 4 }}>
                {simulateMode && simulated
                  ? `Projected +${simulated.gainTotal} pts upon completing open gates → ${simulated.verdict}`
                  : `${evaluation.blockingGaps.length} open gate(s) before release`}
              </div>
            </div>
          </div>
          <label className="checklist-item" style={{ padding: '6px 10px' }}>
            <input
              type="checkbox"
              checked={simulateMode}
              onChange={(e) => setSimulateMode(e.target.checked)}
            />
            <span style={{ fontSize: 12, fontWeight: 700 }}>What-If Simulator</span>
          </label>
        </div>

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
            <h3 className="card-title">Interactive ISO 13485 Gate Controls</h3>
            <span className="badge badge-neutral">Live Forge KVS</span>
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
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>📄 {sop.title}</div>
                  <div className="kpi-sub">Owner: {sop.ownerName} · Space: {sop.spaceKey}</div>
                </div>
                {sop.webUrl && (
                  <button type="button" className="btn btn-sm" onClick={() => openExternalUrl(sop.webUrl)}>Open ↗</button>
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
                    <span className="kpi-sub">{r.recallingFirm}</span>
                  </div>
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
              <h3 className="card-title">Latest 21 CFR Part 11 QA Sign-Off</h3>
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
          ✦ Ask Rovo Copilot
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onOpenCapa(evaluation)}>
          + Create CAPA
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenSignOff(evaluation.issueKey)}>
          Record 21 CFR Part 11 Sign-Off
        </button>
      </div>
    </dialog>
  );
}
