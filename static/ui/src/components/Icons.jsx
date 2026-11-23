import React from 'react';

const baseProps = (size = 14) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'mt-icon',
  'aria-hidden': 'true',
});

export function StatusDot({ tone = 'brand' }) {
  return <span className={`status-dot dot-${tone}`} aria-hidden="true" />;
}

export function IconSparkle({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 3v4M21 5h-4" />
    </svg>
  );
}

export function IconShieldCheck({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconShieldAlert({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

export function IconLock({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconFileText({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  );
}

export function IconRefresh({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function IconDownload({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

export function IconPlus({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconBolt({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconSliders({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="11" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

export function IconExternalLink({ size = 13 }) {
  return (
    <svg {...baseProps(size)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function IconCheckCircle({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconXCircle({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

export function IconTarget({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconGitBranch({ size = 14 }) {
  return (
    <svg {...baseProps(size)}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
