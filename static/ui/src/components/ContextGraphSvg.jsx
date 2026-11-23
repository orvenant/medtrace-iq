import React, { useMemo, useState } from 'react';
import { openExternalUrl } from '../utils/bridge';
import { fdaClassBadge, verdictBadge } from './ScoreGauge';
import { IconExternalLink, IconFileText, IconPlus } from './Icons';

const NODE_COLORS = {
  fda: { fill: '#c9372c', stroke: '#87241c', tag: 'openFDA' },
  issue: { fill: '#0c66e4', stroke: '#09326c', tag: 'JIRA CONTROL' },
  capa: { fill: '#6e5dc6', stroke: '#352c63', tag: 'ISO CAPA' },
  sop: { fill: '#008da6', stroke: '#0b4f5c', tag: 'TWG SOP' },
  project: { fill: '#172b4d', stroke: '#091e42', tag: 'RELEASE GATE' },
  team: { fill: '#1f845a', stroke: '#164b35', tag: 'TWG TEAM' },
  goal: { fill: '#946f00', stroke: '#533f04', tag: 'TWG GOAL' },
};

const BOX_W = 166;
const BOX_H = 52;
const ROW_GAP = 16;
const TOP_PAD = 44;
const BOT_PAD = 24;

/**
 * Zero-overlap 4-column swimlane layout with dynamic height and smooth cubic Bezier curves:
 * Col 0: Live openFDA Recalls
 * Col 1: Jira Design Controls & CAPAs
 * Col 2: Teamwork Graph Confluence SOPs + Release Hub
 * Col 3: Teamwork Graph Accountable Teams & Goals
 */
function computeLayeredLayout(nodes) {
  const cols = [[], [], [], []];
  for (const n of nodes) {
    if (n.type === 'fda') cols[0].push(n);
    else if (n.type === 'issue' || n.type === 'capa') cols[1].push(n);
    else if (n.type === 'sop' || n.type === 'project') cols[2].push(n);
    else cols[3].push(n);
  }

  // Place Release Hub centered among SOPs in Col 2
  cols[2].sort((a, b) => (a.type === 'project' ? 1 : b.type === 'project' ? -1 : 0));

  const maxRows = Math.max(3, ...cols.map((c) => c.length));
  const contentHeight = maxRows * (BOX_H + ROW_GAP) - ROW_GAP;
  const height = TOP_PAD + contentHeight + BOT_PAD;
  const width = 940;
  const colCenters = [106, 336, 578, 824];

  const pos = {};
  cols.forEach((col, cIdx) => {
    const colH = col.length * (BOX_H + ROW_GAP) - ROW_GAP;
    const startY = TOP_PAD + (contentHeight - colH) / 2 + BOX_H / 2;
    col.forEach((node, rIdx) => {
      pos[node.id] = {
        x: colCenters[cIdx],
        y: startY + rIdx * (BOX_H + ROW_GAP),
        col: cIdx,
      };
    });
  });

  return { width, height, colCenters, pos };
}

function buildCurvePath(p1, p2) {
  const goingRight = p2.x >= p1.x;
  const x1 = goingRight ? p1.x + BOX_W / 2 : p1.x - BOX_W / 2;
  const x2 = goingRight ? p2.x - BOX_W / 2 : p2.x + BOX_W / 2;
  const dx = Math.abs(x2 - x1);
  const ctrl = Math.max(38, dx * 0.45);
  const c1x = goingRight ? x1 + ctrl : x1 - ctrl;
  const c2x = goingRight ? x2 - ctrl : x2 + ctrl;
  return `M ${x1} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${x2} ${p2.y}`;
}

export default function ContextGraphSvg({ graph = { nodes: [], edges: [] }, onCreateCapa }) {
  const [filterType, setFilterType] = useState('all');
  const [selectedId, setSelectedId] = useState(() => {
    const firstHold = (graph.nodes || []).find((n) => n.type === 'issue' && n.status === 'HOLD');
    return firstHold?.id || graph.nodes?.[0]?.id || null;
  });

  const visibleNodes = useMemo(() => {
    if (filterType === 'all') return graph.nodes || [];
    return (graph.nodes || []).filter((n) => n.type === 'project' || n.type === filterType);
  }, [graph.nodes, filterType]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () => (graph.edges || []).filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)),
    [graph.edges, visibleIds]
  );

  const layout = useMemo(() => computeLayeredLayout(visibleNodes), [visibleNodes]);

  const selectedNode = useMemo(
    () => (graph.nodes || []).find((n) => n.id === selectedId) || visibleNodes[0] || null,
    [graph.nodes, selectedId, visibleNodes]
  );

  const connectedToSelected = useMemo(() => {
    const set = new Set();
    if (!selectedNode) return set;
    set.add(selectedNode.id);
    for (const e of visibleEdges) {
      if (e.from === selectedNode.id) set.add(e.to);
      if (e.to === selectedNode.id) set.add(e.from);
    }
    return set;
  }, [selectedNode, visibleEdges]);

  const headers = [
    '1. LIVE openFDA SIGNALS',
    '2. JIRA DESIGN CONTROLS',
    '3. CONFLUENCE SOPs (TWG)',
    '4. TEAMS & GOALS (TWG)',
  ];

  return (
    <div className="split-2">
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Interactive Regulatory Blast-Radius &amp; Teamwork Graph</h3>
            <div className="kpi-sub">
              End-to-end traceability linking live US openFDA Recalls → Jira Design Controls → Teamwork Graph Confluence SOPs &amp; Accountable Teams
            </div>
          </div>
          <div className="pill-row">
            {[
              ['all', 'Full Topology'],
              ['fda', 'openFDA'],
              ['issue', 'Jira Controls'],
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
          style={{ height: Math.max(430, layout.height) }}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="MedTrace IQ four-layer regulatory blast radius and Teamwork Graph topology"
        >
          <defs>
            <marker id="mt-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-muted)" opacity="0.65" />
            </marker>
            <marker id="mt-arrow-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#c9372c" />
            </marker>
            <marker id="mt-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#0c66e4" />
            </marker>
          </defs>

          {/* Subtle swimlane columns & titles */}
          {layout.colCenters.map((cx, i) => (
            <g key={headers[i]}>
              <rect
                x={cx - BOX_W / 2 - 12}
                y={10}
                width={BOX_W + 24}
                height={layout.height - 20}
                rx={12}
                fill="var(--surface)"
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.72"
              />
              <text
                x={cx}
                y={28}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="0.06em"
              >
                {headers[i]}
              </text>
            </g>
          ))}

          {/* Bezier Edges */}
          {visibleEdges.map((edge) => {
            const p1 = layout.pos[edge.from];
            const p2 = layout.pos[edge.to];
            if (!p1 || !p2) return null;
            const isHot = edge.label.includes('CLASS_I');
            const isActive = edge.from === selectedNode?.id || edge.to === selectedNode?.id;
            const isTwg = edge.label.startsWith('TWG_');
            const d = buildCurvePath(p1, p2);
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke={isActive ? '#0c66e4' : isHot ? '#c9372c' : 'var(--border)'}
                strokeWidth={isActive ? 2.8 : isHot ? 2.1 : 1.5}
                strokeDasharray={isTwg ? '5 4' : undefined}
                opacity={selectedNode && !isActive ? 0.35 : 0.92}
                markerEnd={isActive ? 'url(#mt-arrow-active)' : isHot ? 'url(#mt-arrow-hot)' : 'url(#mt-arrow)'}
              />
            );
          })}

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const p = layout.pos[node.id];
            if (!p) return null;
            const palette = NODE_COLORS[node.type] || NODE_COLORS.issue;
            const isSelected = selectedNode?.id === node.id;
            const isDimmed = selectedNode && !connectedToSelected.has(node.id);
            const statusFill =
              node.type === 'issue' && node.status === 'HOLD'
                ? '#c9372c'
                : node.type === 'issue' && node.status === 'SHIP_READY'
                  ? '#1f845a'
                  : palette.fill;

            return (
              <g
                key={node.id}
                transform={`translate(${p.x - BOX_W / 2}, ${p.y - BOX_H / 2})`}
                onClick={() => setSelectedId(node.id)}
                style={{ cursor: 'pointer' }}
                opacity={isDimmed ? 0.45 : 1}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(node.id);
                  }
                }}
              >
                {node.type === 'fda' && node.meta?.classification === 'Class I' && (
                  <rect
                    x="-3"
                    y="-3"
                    width={BOX_W + 6}
                    height={BOX_H + 6}
                    rx="11"
                    fill="none"
                    stroke="#c9372c"
                    className="svg-pulse-ring"
                  />
                )}
                <rect
                  width={BOX_W}
                  height={BOX_H}
                  rx="9"
                  fill={statusFill}
                  stroke={isSelected ? '#ffffff' : palette.stroke}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                />
                {isSelected && (
                  <rect
                    x="-4"
                    y="-4"
                    width={BOX_W + 8}
                    height={BOX_H + 8}
                    rx="12"
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth="2.2"
                  />
                )}
                <text x="10" y="15" fill="#ffffff" fontSize="8.5" fontWeight="800" opacity="0.88">
                  {palette.tag}
                  {typeof node.score === 'number' ? ` · ${node.score}/100` : ''}
                </text>
                <text x="10" y="31" fill="#ffffff" fontSize="11.5" fontWeight="700">
                  {String(node.label || '').slice(0, 21)}
                </text>
                <text x="10" y="44" fill="#ffffff" fontSize="9.2" opacity="0.86">
                  {String(node.sublabel || '').slice(0, 25)}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="pill-row" style={{ marginTop: 10 }}>
          <span className="badge badge-danger">Red = Regulatory Hold / FDA Class I</span>
          <span className="badge badge-ok">Green = Ship Ready / TWG Team</span>
          <span className="badge badge-brand">Teal = TWG Confluence SOP</span>
          <span className="badge badge-purple">Purple = ISO 13485 CAPA</span>
          <span className="badge badge-neutral">Dashed Curve = Live Teamwork Graph Link</span>
        </div>
      </div>

      {/* Node Inspector Side Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Context Provenance Inspector</h3>
          {selectedNode && <span className="badge badge-brand">{selectedNode.type}</span>}
        </div>
        {!selectedNode ? (
          <p className="kpi-sub">Click any node in the topology to inspect regulatory provenance.</p>
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
                {selectedNode.meta.matchedSops?.length > 0 && (
                  <div style={{ padding: 9, borderRadius: 8, background: 'var(--brand-soft)', fontSize: 12 }}>
                    <strong>Linked Confluence SOPs (via Teamwork Graph):</strong>
                    {selectedNode.meta.matchedSops.map((sop) => (
                      <div key={sop.id} className="inline-flex-row" style={{ marginTop: 4 }}>
                        <IconFileText size={13} />
                        <span><strong>{sop.title}</strong> · Owner: {sop.ownerName}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                      Open FDA Record <IconExternalLink size={12} />
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
                    Open in Atlassian <IconExternalLink size={12} />
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
