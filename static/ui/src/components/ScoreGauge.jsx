import React from 'react';

export function verdictBadge(verdict) {
  if (verdict === 'SHIP_READY') {
    return <span className="badge badge-ok">Ship Ready</span>;
  }
  if (verdict === 'HOLD') {
    return <span className="badge badge-danger">Regulatory Hold</span>;
  }
  return <span className="badge badge-warn">Conditional</span>;
}

export function fdaClassBadge(classification) {
  if (classification === 'Class I') {
    return <span className="badge badge-danger">FDA Class I</span>;
  }
  if (classification === 'Class II') {
    return <span className="badge badge-warn">FDA Class II</span>;
  }
  return <span className="badge badge-neutral">{classification || 'FDA Class III'}</span>;
}

export default function ScoreGauge({ score = 0, verdict = 'CONDITIONAL', size = 104 }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  const color =
    verdict === 'SHIP_READY'
      ? 'var(--ok)'
      : verdict === 'HOLD'
        ? 'var(--danger)'
        : 'var(--warn)';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', flex: 'none', maxWidth: '100%' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        aria-label={`Ship Confidence Score ${clamped} out of 100`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text)"
          fontSize={Math.round(size * 0.27)}
          fontWeight="800"
        >
          {clamped}
        </text>
        <text
          x="50%"
          y="69%"
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={Math.round(size * 0.11)}
          fontWeight="700"
        >
          / 100
        </text>
      </svg>
    </div>
  );
}
