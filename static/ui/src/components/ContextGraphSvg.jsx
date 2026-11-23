import React, { useMemo, useState } from 'react';
import { openExternalUrl } from '../utils/bridge';
import { fdaClassBadge, verdictBadge } from './ScoreGauge';

const NODE_COLORS = {
  project: { fill: '#0c66e4', stroke: '#09326c', text: '#ffffff', tag: 'RELEASE' },
  issue: { fill: '#1d7afc', stroke: '#0c66e4', text: '#ffffff', tag: 'JIRA' },
  capa: { fill: '#6e5dc6', stroke: '#352c63', text: '#ffffff', tag: 'CAPA' },
  fda: { fill: '#c9372c', stroke: '#5d1f1a', text: '#ffffff', tag: 'openFDA' },
  team: { fill: '#1f845a', stroke: '#164b35', text: '#ffffff', tag: 'TWG TEAM' },
  sop: { fill: '#008da6', stroke: '#0b4f5c', text: '#ffffff', tag: 'TWG SOP' },
  goal: { fill: '#946f00', stroke: '#533f04', text: '#ffffff', tag: 'TWG GOAL' },
};

function computeLayout(nodes) {
  const width = 920;
  const height = 460;
  const cx = width / 2;
  const cy = height / 2;

  const byType = {
    project: [],
    issue: [],
    capa: [],
    fda: [],
    team: [],
    sop: [],
    goal: [],
  };

  for (const n of nodes) {
    (byType[n.type] || byType.issue).push(n);
  }

  const pos = {};
  byType.project.forEach((n) => {
    pos[n.id] = { x: cx, y: cy };
  });

  // Left arc: openFDA Recalls
  const fdaList = byType.fda;
  fdaList.forEach((n, i) => {
    const step = fdaList.length > 1 ? (height - 120) / (fdaList.length - 1) : 0;
    pos[n.id] = { x: 118, y: fdaList.length === 1 ? cy : 66 + i * step };
  });

  // Inner ring: Jira issues & CAPAs
  const workList = [...byType.issue, ...byType.capa];
  workList.forEach((n, i) => {
    const angle = (i / Math.max(1, workList.length)) * Math.PI * 1.4 - Math.PI * 0.7;
    const rx = 205;
    const ry = 148;
    pos[n.id] = {
      x: cx + Math.cos(angle) * rx - 15,
      y: cy + Math.sin(angle) * ry,
    };
  });

  // Right column: Teamwork Graph organizational context (Teams, Goals, Confluence SOPs)
  const orgList = [...byType.team, ...byType.goal, ...byType.sop];
  orgList.forEach((n, i) => {
    const step = orgList.length > 1 ? (height - 100) / (orgList.length - 1) : 0;
    pos[n.id] = { x: width - 125, y: orgList.length === 1 ? cy : 54 + i * step };
  });

  return { width, height, pos };
}

export default function ContextGraphSvg({ graph = { nodes: [], edges: [] }, onCreateCapa }) {
  const [filterType, setFilterType] = useState('all');
  const [selectedId, setSelectedId] = useState(graph.nodes?.[0]?.id || null);

  const visibleNodes = useMemo(() => {
    if (filterType === 'all') return graph.nodes || [];
    return (graph.nodes || []).filter((n) => n.type === 'project' || n.type === filterType);
  }, [graph.nodes, filterType]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () => (graph.edges || []).filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)),
    [graph.edges, visibleIds]
  );

  const layout = useMemo(() => computeLayout(visibleNodes), [visibleNodes]);

  const selectedNode = useMemo(
    () => (graph.nodes || []).find((n) => n.id === selectedId) || visibleNodes[0] || null,
    [graph.nodes, selectedId, visibleNodes]
  );

  return (
    <div className="split-2">
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Interactive Regulatory Context &amp; Blast-Radius Graph</h3>
            <div className="kpi-sub">
              Live topology merging Jira Design Controls, Atlassian Teamwork Graph (Teams · Goals · Confluence SOPs), and openFDA Recall Signals
            </div>
          </div>
          <div className="pill-row">
            {[
              ['all', 'All Nodes'],
              ['fda', 'openFDA Recalls'],
              ['issue', 'Jira Issues'],
              ['sop', 'TWG SOPs'],
              ['team', 'TWG Teams'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`btn btn-sm ${filterType === key ? 'btn-primary' : ''}`}
                onClick={() => setFilterType(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <svg
          className="graph-canvas"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="MedTrace IQ interactive blast radius and Teamwork Graph topology"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-muted)" opacity="0.55" />
            </marker>
          </defs>

          {visibleEdges.map((edge) => {
            const p1 = layout.pos[edge.from];
            const p2 = layout.pos[edge.to];
            if (!p1 || !p2) return null;
            const isHot = edge.label.includes('CLASS_I');
            const isSelected = edge.from === selectedNode?.id || edge.to === selectedNode?.id;
            return (
              <g key={edge.id}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isHot ? 'var(--danger)' : isSelected ? 'var(--brand)' : 'var(--border)'}
                  strokeWidth={isHot || isSelected ? 2.4 : 1.5}
                  strokeDasharray={edge.label.startsWith('TWG_') ? '5 4' : undefined}
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}

          {visibleNodes.map((node) => {
            const p = layout.pos[node.id];
            if (!p) return null;
            const palette = NODE_COLORS[node.type] || NODE_COLORS.issue;
            const isSelected = selectedNode?.id === node.id;
            const statusFill =
              node.type === 'issue' && node.status === 'HOLD'
                ? '#c9372c'
                : node.type === 'issue' && node.status === 'SHIP_READY'
                  ? '#1f845a'
                  : palette.fill;

            const boxW = node.type === 'project' ? 148 : 138;
            const boxH = node.type === 'project' ? 54 : 46;

            return (
              <g
                key={node.id}
                transform={`translate(${p.x - boxW / 2}, ${p.y - boxH / 2})`}
                onClick={() => setSelectedId(node.id)}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(node.id);
                  }
                }}
              >
                <rect
                  width={boxW}
                  height={boxH}
                  rx="10"
                  fill={statusFill}
                  stroke={isSelected ? '#ffffff' : palette.stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                />
                {isSelected && (
                  <rect
                    x="-4"
                    y="-4"
                    width={boxW + 8}
                    height={boxH + 8}
                    rx="13"
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth="2"
                  />
                )}
                <text x="10" y="16" fill="#ffffff" fontSize="9" fontWeight="800" opacity="0.88">
                  {palette.tag}
                  {typeof node.score === 'number' ? ` · ${node.score}/100` : ''}
                </text>
                <text x="10" y="32" fill="#ffffff" fontSize="11.5" fontWeight="700">
                  {String(node.label || '').slice(0, 18)}
                </text>
                {node.type === 'project' && (
                  <text x="10" y="45" fill="#ffffff" fontSize="9.5" opacity="0.88">
                    {String(node.sublabel || '').slice(0, 20)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="pill-row" style={{ marginTop: 10 }}>
          <span className="badge badge-danger">Red = Regulatory Hold / FDA Class I</span>
          <span className="badge badge-ok">Green = Ship Ready / TWG Team</span>
          <span className="badge badge-brand">Blue = Jira Design Control</span>
          <span className="badge badge-purple">Purple = CAPA Control</span>
          <span className="badge badge-neutral">Dashed Edge = Atlassian Teamwork Graph</span>
        </div>
      </div>

      {/* Node Inspector Side Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Context Provenance Inspector</h3>
          {selectedNode && <span className="badge badge-brand">{selectedNode.type}</span>}
        </div>
        {!selectedNode ? (
          <p className="kpi-sub">Select any node in the graph to inspect regulatory provenance.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedNode.label}</div>
            <div className="kpi-sub">{selectedNode.sublabel}</div>

            {(selectedNode.type === 'issue' || selectedNode.type === 'capa') && selectedNode.meta && (
              <>
                <div className="pill-row">
                  {verdictBadge(selectedNode.meta.verdict)}
                  <span className="badge badge-neutral">{selectedNode.meta.subsystem}</span>
                  <span className="badge badge-warn">{selectedNode.meta.riskTier} Risk</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong>Ship-Confidence:</strong> {selectedNode.meta.score}/100
                  <br />
                  <strong>Assignee:</strong> {selectedNode.meta.assignee}
                </div>
                {selectedNode.meta.blockingGaps?.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 12 }}>Blocking Compliance Gaps:</strong>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12 }}>
                      {selectedNode.meta.blockingGaps.map((g, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {onCreateCapa && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      onCreateCapa({
                        sourceIssueKey: selectedNode.meta.issueKey,
                        title: `[CAPA] Close compliance gaps on ${selectedNode.meta.issueKey}`,
                        severity: selectedNode.meta.riskTier === 'Critical' ? 'Critical' : 'High',
                        rationale: (selectedNode.meta.blockingGaps || []).join('; '),
                      })
                    }
                  >
                    + Create Linked CAPA
                  </button>
                )}
              </>
            )}

            {selectedNode.type === 'fda' && selectedNode.meta && (
              <>
                <div className="pill-row">
                  {fdaClassBadge(selectedNode.meta.classification)}
                  <span className="badge badge-neutral">{selectedNode.meta.status}</span>
                </div>
                <div style={{ fontSize: 12.5 }}>
                  <strong>Recalling Firm:</strong> {selectedNode.meta.recallingFirm}
                  <br />
                  <strong>Initiated:</strong> {selectedNode.meta.initiationDate}
                </div>
                <div style={{ fontSize: 12.5 }}>
                  <strong>Reason for Recall:</strong>
                  <p style={{ margin: '4px 0', color: 'var(--text-muted)' }}>{selectedNode.meta.reasonForRecall}</p>
                </div>
                <div className="pill-row">
                  {onCreateCapa && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        onCreateCapa({
                          title: `[CAPA] Assess FDA ${selectedNode.meta.classification} Recall ${selectedNode.meta.recallNumber}`,
                          severity: selectedNode.meta.classification === 'Class I' ? 'Critical' : 'High',
                          fdaRecallNumber: selectedNode.meta.recallNumber,
                          rationale: `Live openFDA recall parallel (${selectedNode.meta.recallingFirm}): ${selectedNode.meta.reasonForRecall}`,
                        })
                      }
                    >
                      Create Recall CAPA
                    </button>
                  )}
                  {selectedNode.meta.fdaUrl && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => openExternalUrl(selectedNode.meta.fdaUrl)}
                    >
                      Open FDA Record ↗
                    </button>
                  )}
                </div>
              </>
            )}

            {(selectedNode.type === 'sop' || selectedNode.type === 'team' || selectedNode.type === 'goal') && (
              <>
                <span className="badge badge-ok">Discovered via Live Atlassian Teamwork Graph</span>
                <div style={{ fontSize: 12.5 }}>
                  {selectedNode.meta?.ownerName && (
                    <div><strong>Owner:</strong> {selectedNode.meta.ownerName}</div>
                  )}
                  {selectedNode.meta?.spaceKey && (
                    <div><strong>Confluence Space:</strong> {selectedNode.meta.spaceKey}</div>
                  )}
                  {selectedNode.meta?.description && (
                    <p style={{ margin: '6px 0', color: 'var(--text-muted)' }}>{selectedNode.meta.description}</p>
                  )}
                </div>
                {(selectedNode.meta?.webUrl || selectedNode.meta?.profileUrl || selectedNode.meta?.url) && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      openExternalUrl(selectedNode.meta.webUrl || selectedNode.meta.profileUrl || selectedNode.meta.url)
                    }
                  >
                    Open in Atlassian ↗
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
