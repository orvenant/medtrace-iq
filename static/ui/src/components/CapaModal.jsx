import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Native <dialog> modal following modern-web-guidance:
 * - Opened via showModal() on ref (native top layer, Esc, focus containment, inert backdrop)
 * - No redundant role="dialog" or aria-modal
 * - Explicit aria-labelledby pointing to heading
 */
export function CapaModal({ open, onClose, onSubmit, defaultValues = {}, busy = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('High');
  const [sourceIssueKey, setSourceIssueKey] = useState('');
  const [fdaRecallNumber, setFdaRecallNumber] = useState('');
  const [rationale, setRationale] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(defaultValues.title || '');
      setSeverity(defaultValues.severity || 'High');
      setSourceIssueKey(defaultValues.sourceIssueKey || '');
      setFdaRecallNumber(defaultValues.fdaRecallNumber || '');
      setRationale(defaultValues.rationale || '');
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [open, defaultValues]);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !rationale.trim()) return;
    await onSubmit({
      title: title.trim(),
      severity,
      sourceIssueKey: sourceIssueKey.trim(),
      fdaRecallNumber: fdaRecallNumber.trim(),
      rationale: rationale.trim(),
    });
  };

  return (
    <dialog ref={dialogRef} className="mt-dialog" aria-labelledby={titleId} onClose={handleClose}>
      <div className="dialog-head">
        <h2 id={titleId}>Create FDA 21 CFR 820 / ISO 13485 CAPA Ticket</h2>
        <button type="button" className="btn btn-sm" onClick={handleClose} aria-label="Close modal">
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div className="field">
            <label htmlFor="capa-title">CAPA Summary</label>
            <input
              id="capa-title"
              className="input"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="[CAPA] Mitigate infusion pump occlusion alarm latency"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label htmlFor="capa-sev">ISO 14971 Severity</label>
              <select id="capa-sev" className="select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="Critical">Critical (Class I / Life-Sustaining)</option>
                <option value="High">High (Class II / Safety Control)</option>
                <option value="Medium">Medium (SOP / Traceability Gap)</option>
                <option value="Low">Low (Preventive Improvement)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="capa-source">Linked Jira Issue (Optional)</label>
              <input
                id="capa-source"
                className="input"
                value={sourceIssueKey}
                onChange={(e) => setSourceIssueKey(e.target.value)}
                placeholder="e.g. PLAT-12"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="capa-fda">Live openFDA Recall Number (Optional)</label>
            <input
              id="capa-fda"
              className="input"
              value={fdaRecallNumber}
              onChange={(e) => setFdaRecallNumber(e.target.value)}
              placeholder="e.g. Z-0991-2026"
            />
          </div>
          <div className="field">
            <label htmlFor="capa-rationale">Regulatory Rationale & Containment Plan</label>
            <textarea
              id="capa-rationale"
              className="textarea"
              required
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Describe the compliance gap, FDA recall parallel, root cause scope, and V&V evidence required before release..."
            />
          </div>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating CAPA in Jira…' : 'Create Linked CAPA'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function SignOffModal({ open, onClose, onSubmit, issueKey = '', busy = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [decision, setDecision] = useState('Approved');
  const [rationale, setRationale] = useState('');

  useEffect(() => {
    if (open) {
      setDecision('Approved');
      setRationale('');
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [open, issueKey]);

  const handleClose = () => {
    if (dialogRef.current) dialogRef.current.returnValue = '';
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rationale.trim()) return;
    await onSubmit({ issueKey, decision, rationale: rationale.trim() });
  };

  return (
    <dialog ref={dialogRef} className="mt-dialog" aria-labelledby={titleId} onClose={handleClose}>
      <div className="dialog-head">
        <h2 id={titleId}>Record QA Regulatory Sign-Off ({issueKey})</h2>
        <button type="button" className="btn btn-sm" onClick={handleClose} aria-label="Close modal">
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div className="field">
            <label htmlFor="so-decision">Release Gate Decision</label>
            <select
              id="so-decision"
              className="select"
              autoFocus
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
            >
              <option value="Approved">Approved — Cleared to Ship (FDA 21 CFR 820 / ISO 13485)</option>
              <option value="Conditional">Conditional — Pending Minor Evidence Closure</option>
              <option value="Hold">Regulatory Hold — Block Release Immediately</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="so-rationale">Audit Trail Rationale (Logged to Jira + Immutable Ledger)</label>
            <textarea
              id="so-rationale"
              className="textarea"
              required
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Summarize V&V test report IDs, ISO 14971 risk acceptance, SOP owner confirmation, and FDA recall mitigation..."
            />
          </div>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn" onClick={handleClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className={decision === 'Hold' ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={busy}
          >
            {busy ? 'Recording Audit Entry…' : `Record ${decision}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
