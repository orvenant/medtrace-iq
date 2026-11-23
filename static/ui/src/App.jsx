import React, { useEffect, useState } from 'react';
import { getForgeContext } from './utils/bridge';
import ProjectCockpit from './components/ProjectCockpit';
import IssueGuardrailPanel from './components/IssueGuardrailPanel';

export default function App() {
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    getForgeContext()
      .then((context) => {
        if (!mounted) return;
        const colorMode = context?.theme?.colorMode;
        if (colorMode === 'dark' || colorMode === 'light') {
          document.documentElement.setAttribute('data-theme', colorMode);
        }
        setCtx(context);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e?.message || 'Unable to initialize Atlassian Forge bridge context.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (err) {
    return (
      <div className="app-shell">
        <div className="banner banner-danger">{err}</div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="panel-shell">
        <div className="banner banner-info">Connecting to Atlassian Forge context…</div>
      </div>
    );
  }

  const moduleKey = ctx.moduleKey || '';
  const issueKey = ctx.extension?.issue?.key || '';
  const projectKey = ctx.extension?.project?.key || '';

  if (moduleKey === 'medtrace-issue-panel' || (issueKey && moduleKey !== 'medtrace-cockpit')) {
    return <IssueGuardrailPanel issueKey={issueKey} />;
  }

  return <ProjectCockpit projectKey={projectKey} />;
}
