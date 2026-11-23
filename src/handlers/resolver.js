import Resolver from '@forge/resolver';
import {
  buildProjectCockpitData,
  buildIssueComplianceData,
  performCreateCapa,
  performRegulatorySignOff,
  performUpdateChecklist,
  performSavePolicy,
  performSeedDemo,
  performVerifyAuditChain,
  performGetAccessibleProjects,
} from './orchestrator';
import { searchFdaDeviceRecalls } from '../services/openFdaService';
import { pingTeamworkGraph } from '../services/teamworkGraphService';

const resolver = new Resolver();

function extractAppUuid(context) {
  const raw = context?.installContext || '';
  const localId = context?.localId || '';
  const fromLocal = localId.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const fromInstall = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return {
    cloudId: context?.cloudId || (fromInstall ? fromInstall[1] : '') || raw.split('/').pop() || '',
    accountId: context?.accountId || context?.principal?.accountId || '',
    projectKey: context?.extension?.project?.key || '',
    issueKey: context?.extension?.issue?.key || '',
    moduleKey: context?.moduleKey || '',
    appUuid: fromLocal ? fromLocal[1] : null,
    installContext: raw,
  };
}

resolver.define('getBootstrapContext', async ({ context }) => {
  const meta = extractAppUuid(context);
  const twgPing = await pingTeamworkGraph();
  return { ...meta, twgPing };
});

resolver.define('getProjectCockpit', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const projectKey = payload?.projectKey || meta.projectKey;
  if (!projectKey) {
    throw new Error('Missing Jira projectKey in context');
  }
  const data = await buildProjectCockpitData({
    projectKey,
    cloudId: meta.cloudId,
    accountId: meta.accountId,
  });
  return { ...data, meta };
});

resolver.define('getIssueGuardrail', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const issueKey = payload?.issueKey || meta.issueKey;
  if (!issueKey) {
    throw new Error('Missing Jira issueKey in context');
  }
  const data = await buildIssueComplianceData({
    issueKey,
    cloudId: meta.cloudId,
    accountId: meta.accountId,
  });
  return { ...data, meta };
});

resolver.define('searchFdaRecalls', async ({ payload }) => {
  return searchFdaDeviceRecalls({
    keyword: payload?.keyword || 'infusion pump',
    classification: payload?.classification || '',
    limit: payload?.limit || 8,
    ongoingPreferred: payload?.ongoingOnly !== false,
  });
});

resolver.define('updateIssueChecklist', async ({ payload }) => {
  if (!payload?.issueKey) throw new Error('issueKey is required');
  return performUpdateChecklist({
    issueKey: payload.issueKey,
    patch: payload.patch || {},
  });
});

resolver.define('createCapaTicket', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const projectKey = payload?.projectKey || meta.projectKey;
  if (!projectKey || !payload?.title || !payload?.rationale) {
    throw new Error('projectKey, title, and rationale are required');
  }
  return performCreateCapa({
    projectKey,
    sourceIssueKey: payload.sourceIssueKey || meta.issueKey || '',
    title: payload.title,
    severity: payload.severity || 'High',
    rationale: payload.rationale,
    fdaRecallNumber: payload.fdaRecallNumber || '',
  });
});

resolver.define('recordSignOff', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const issueKey = payload?.issueKey || meta.issueKey;
  if (!issueKey || !payload?.decision || !payload?.rationale) {
    throw new Error('issueKey, decision, and rationale are required');
  }
  return performRegulatorySignOff({
    issueKey,
    decision: payload.decision,
    rationale: payload.rationale,
    cloudId: meta.cloudId,
  });
});

resolver.define('savePolicy', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const projectKey = payload?.projectKey || meta.projectKey;
  if (!projectKey) throw new Error('projectKey is required');
  return performSavePolicy({ projectKey, patch: payload?.patch || {} });
});

resolver.define('seedDemoWorkspace', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const projectKey = payload?.projectKey || meta.projectKey;
  if (!projectKey) throw new Error('projectKey is required');
  return performSeedDemo({ projectKey });
});

resolver.define('verifyAuditChain', async ({ payload, context }) => {
  const meta = extractAppUuid(context);
  const projectKey = payload?.projectKey || meta.projectKey;
  if (!projectKey) throw new Error('projectKey is required');
  return performVerifyAuditChain({ projectKey });
});

resolver.define('getAccessibleProjects', async () => {
  return performGetAccessibleProjects();
});

export const resolverHandler = resolver.getDefinitions();
