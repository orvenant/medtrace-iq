import api from '@forge/api';

/**
 * Execute a GraphQL query against Atlassian Teamwork Graph using api.asUser().requestTeamworkGraph.
 * Verified against live Teamwork Graph SDL curated queries & union node fragments.
 */
async function runTwgQuery(queryName, graphqlQuery, variables = {}) {
  const startedAt = Date.now();
  try {
    const response = await api.asUser().requestTeamworkGraph(graphqlQuery, variables);
    const status = response.status;
    const json = await response.json();
    const durationMs = Date.now() - startedAt;

    if (!response.ok || (json?.errors && json.errors.length > 0 && !json?.data)) {
      const errMsg = json?.errors?.[0]?.message || `HTTP ${status}`;
      console.warn(`[TWG:${queryName}] error:`, errMsg);
      return {
        queryName,
        ok: false,
        status,
        durationMs,
        data: null,
        error: errMsg,
      };
    }

    return {
      queryName,
      ok: true,
      status,
      durationMs,
      data: json?.data || null,
      warnings: json?.errors?.map((e) => e.message) || [],
    };
  } catch (err) {
    return {
      queryName,
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      data: null,
      error: err?.message || 'Teamwork Graph request failed',
    };
  }
}

export function buildJiraSpaceAri(cloudId, projectId) {
  return `ari:cloud:jira:${cloudId}:project/${projectId}`;
}

export function buildJiraIssueAri(cloudId, issueId) {
  return `ari:cloud:jira:${cloudId}:issue/${issueId}`;
}

export function buildUserAri(accountId) {
  return `ari:cloud:identity::user/${accountId}`;
}

export async function pingTeamworkGraph() {
  const res = await runTwgQuery(
    'echo',
    `query medtrace_echo { echo(myString: "MedTrace IQ Teamwork Graph Active") }`
  );
  return {
    connected: Boolean(res.ok && res.data?.echo),
    echo: res.data?.echo || null,
    durationMs: res.durationMs,
    error: res.error || null,
  };
}

/**
 * Fetch organizational context for a Jira project via Teamwork Graph Curated Queries:
 * - atlassianTeamsBySpace
 * - jiraSpaceWorkItems
 * - atlassianUserInTeams
 * - atlassianUserContent (Confluence SOP pages + Jira work items)
 * - atlassianUserGoalsAndProjects
 */
export async function fetchProjectTeamworkGraph({ cloudId, projectId, accountId }) {
  const spaceAri = cloudId && projectId ? buildJiraSpaceAri(cloudId, projectId) : null;
  const userAri = accountId ? buildUserAri(accountId) : null;

  const queries = [pingTeamworkGraph()];

  if (spaceAri) {
    queries.push(
      runTwgQuery(
        'atlassianTeamsBySpace',
        `query medtrace_teamsBySpace($spaceAri: ID!) {
          atlassianTeamsBySpace(spaceAri: $spaceAri, first: 15) {
            edges {
              node {
                __typename
                ... on AtlassianTeam {
                  id
                  displayName
                  description
                  profileUrl
                }
              }
            }
          }
        }`,
        { spaceAri }
      )
    );

    queries.push(
      runTwgQuery(
        'jiraSpaceWorkItems',
        `query medtrace_spaceWorkItems($spaceAri: ID!) {
          jiraSpaceWorkItems(spaceAri: $spaceAri, first: 25) {
            edges {
              node {
                __typename
                ... on JiraWorkItem {
                  id
                  issueId
                  key
                  summary
                  webUrl
                  status {
                    name
                    statusCategory { key name }
                  }
                  assignee { id name }
                  reporter { id name }
                }
              }
            }
          }
        }`,
        { spaceAri }
      )
    );
  }

  if (userAri) {
    queries.push(
      runTwgQuery(
        'atlassianUserInTeams',
        `query medtrace_userTeams($userId: ID!) {
          atlassianUserInTeams(userId: $userId, first: 15) {
            edges {
              node {
                __typename
                ... on AtlassianTeam {
                  id
                  displayName
                  description
                  profileUrl
                }
              }
            }
          }
        }`,
        { userId: userAri }
      )
    );

    queries.push(
      runTwgQuery(
        'atlassianUserContent',
        `query medtrace_userContent($userId: ID!) {
          atlassianUserContent(userId: $userId, since: "P180D", first: 25) {
            edges {
              node {
                __typename
                ... on ConfluencePage {
                  id
                  pageId
                  title
                  webUrl
                  lastUpdatedAt
                  status
                  owner { id name }
                  lastEditor { id name }
                  space { id key name }
                }
                ... on JiraWorkItem {
                  id
                  key
                  summary
                  webUrl
                }
              }
            }
          }
        }`,
        { userId: userAri }
      )
    );

    queries.push(
      runTwgQuery(
        'atlassianUserGoalsAndProjects',
        `query medtrace_userGoals($userId: ID!) {
          atlassianUserGoalsAndProjects(userId: $userId, first: 15) {
            edges {
              node {
                __typename
                ... on AtlassianGoal {
                  id
                  key
                  name
                  description
                  url
                  owner { id name }
                }
              }
            }
          }
        }`,
        { userId: userAri }
      )
    );
  }

  const [echoRes, ...queryResults] = await Promise.all(queries);

  const byName = Object.fromEntries(queryResults.map((r) => [r.queryName, r]));

  const teamsMap = new Map();
  for (const qName of ['atlassianTeamsBySpace', 'atlassianUserInTeams']) {
    const edges = byName[qName]?.data?.[qName]?.edges || [];
    for (const edge of edges) {
      const node = edge?.node;
      if (node?.id && node.__typename === 'AtlassianTeam') {
        teamsMap.set(node.id, {
          id: node.id,
          displayName: node.displayName || 'Atlassian Team',
          description: node.description || '',
          profileUrl: node.profileUrl || null,
          sourceQuery: qName,
        });
      }
    }
  }

  const graphWorkItems = (byName.jiraSpaceWorkItems?.data?.jiraSpaceWorkItems?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'JiraWorkItem')
    .map((n) => ({
      id: n.id,
      issueId: n.issueId,
      key: n.key,
      summary: n.summary,
      webUrl: n.webUrl,
      status: n.status?.name || 'Unknown',
      assigneeName: n.assignee?.name || 'Unassigned',
    }));

  const confluencePages = (byName.atlassianUserContent?.data?.atlassianUserContent?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'ConfluencePage')
    .map((n) => ({
      id: n.id,
      pageId: n.pageId,
      title: n.title || 'Untitled Confluence Page',
      webUrl: n.webUrl || null,
      lastUpdatedAt: n.lastUpdatedAt || null,
      ownerName: n.owner?.name || n.lastEditor?.name || 'Unknown Owner',
      spaceKey: n.space?.key || '',
      spaceName: n.space?.name || '',
    }));

  const goals = (byName.atlassianUserGoalsAndProjects?.data?.atlassianUserGoalsAndProjects?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'AtlassianGoal')
    .map((n) => ({
      id: n.id,
      key: n.key || '',
      name: n.name || 'Atlassian Goal',
      description: n.description || '',
      url: n.url || null,
      ownerName: n.owner?.name || '',
    }));

  // Traverse linked Confluence pages for up to 3 discovered SOP documents
  const linkedPageRelations = [];
  const topPages = confluencePages.slice(0, 3);
  if (topPages.length > 0) {
    const linkedResults = await Promise.all(
      topPages.map((pg) =>
        runTwgQuery(
          'confluencePageLinkedConfluencePages',
          `query medtrace_linkedPages($id: ID!) {
            confluencePageLinkedConfluencePages(id: $id, first: 10) {
              edges {
                node {
                  __typename
                  ... on ConfluencePage {
                    id
                    title
                    webUrl
                    owner { id name }
                  }
                }
              }
            }
          }`,
          { id: pg.id }
        )
      )
    );

    linkedResults.forEach((lr, idx) => {
      const sourcePage = topPages[idx];
      const edges = lr.data?.confluencePageLinkedConfluencePages?.edges || [];
      for (const edge of edges) {
        const target = edge?.node;
        if (target?.id && target.__typename === 'ConfluencePage') {
          linkedPageRelations.push({
            fromId: sourcePage.id,
            toId: target.id,
            toTitle: target.title || 'Linked SOP',
            toWebUrl: target.webUrl || null,
            toOwner: target.owner?.name || 'Unknown',
          });
        }
      }
    });
  }

  const telemetry = [
    { queryName: 'echo', ok: echoRes.connected, durationMs: echoRes.durationMs, error: echoRes.error },
    ...queryResults.map((r) => ({
      queryName: r.queryName,
      ok: r.ok,
      durationMs: r.durationMs,
      error: r.error || null,
      warnings: r.warnings || [],
    })),
  ];

  return {
    connected: echoRes.connected,
    echo: echoRes.echo,
    spaceAri,
    userAri,
    teams: Array.from(teamsMap.values()),
    graphWorkItems,
    confluencePages,
    linkedPageRelations,
    goals,
    telemetry,
  };
}

/**
 * Fetch deep Teamwork Graph context for a single Jira work item:
 * - jiraWorkItemGoals
 * - jiraWorkItemComments
 * - jiraWorkItemDevelopmentArtifacts (PRs, Deployments, Commits, Branches, Designs)
 * - jiraWorkItemHierarchy
 * - atlassianUserInTeams & atlassianUserContent
 */
export async function fetchIssueTeamworkGraph({ cloudId, issueId, accountId }) {
  const issueAri = cloudId && issueId ? buildJiraIssueAri(cloudId, issueId) : null;
  const userAri = accountId ? buildUserAri(accountId) : null;

  const [echoRes, goalsRes, commentsRes, devRes, hierarchyRes, teamsRes, contentRes] = await Promise.all([
    pingTeamworkGraph(),
    issueAri
      ? runTwgQuery(
          'jiraWorkItemGoals',
          `query medtrace_issueGoals($id: ID!) {
            jiraWorkItemGoals(id: $id, first: 10) {
              edges {
                node {
                  __typename
                  ... on AtlassianGoal {
                    id
                    key
                    name
                    url
                    owner { id name }
                  }
                }
              }
            }
          }`,
          { id: issueAri }
        )
      : Promise.resolve({ queryName: 'jiraWorkItemGoals', ok: false, data: null }),
    issueAri
      ? runTwgQuery(
          'jiraWorkItemComments',
          `query medtrace_issueComments($id: ID!) {
            jiraWorkItemComments(id: $id, since: "P180D", first: 15) {
              edges {
                node {
                  __typename
                  ... on JiraWorkItemComment {
                    id
                    content
                    createdAt
                    author { id name }
                    webUrl
                  }
                }
              }
            }
          }`,
          { id: issueAri }
        )
      : Promise.resolve({ queryName: 'jiraWorkItemComments', ok: false, data: null }),
    issueAri
      ? runTwgQuery(
          'jiraWorkItemDevelopmentArtifacts',
          `query medtrace_issueDevArtifacts($id: ID!) {
            jiraWorkItemDevelopmentArtifacts(id: $id, first: 15) {
              edges {
                node {
                  __typename
                  ... on ExternalPullRequest {
                    id
                    displayName
                    status
                    author { id name }
                  }
                  ... on ExternalDeployment {
                    id
                    displayName
                    createdAt
                    author { id name }
                  }
                }
              }
            }
          }`,
          { id: issueAri }
        )
      : Promise.resolve({ queryName: 'jiraWorkItemDevelopmentArtifacts', ok: false, data: null }),
    issueAri
      ? runTwgQuery(
          'jiraWorkItemHierarchy',
          `query medtrace_issueHierarchy($id: ID!) {
            jiraWorkItemHierarchy(id: $id, first: 15) {
              edges {
                node {
                  __typename
                  ... on JiraWorkItem {
                    id
                    key
                    summary
                    webUrl
                    status { name }
                  }
                }
              }
            }
          }`,
          { id: issueAri }
        )
      : Promise.resolve({ queryName: 'jiraWorkItemHierarchy', ok: false, data: null }),
    userAri
      ? runTwgQuery(
          'atlassianUserInTeams',
          `query medtrace_issueUserTeams($userId: ID!) {
            atlassianUserInTeams(userId: $userId, first: 10) {
              edges {
                node {
                  __typename
                  ... on AtlassianTeam {
                    id
                    displayName
                    profileUrl
                  }
                }
              }
            }
          }`,
          { userId: userAri }
        )
      : Promise.resolve({ queryName: 'atlassianUserInTeams', ok: false, data: null }),
    userAri
      ? runTwgQuery(
          'atlassianUserContent',
          `query medtrace_issueUserContent($userId: ID!) {
            atlassianUserContent(userId: $userId, since: "P180D", first: 15) {
              edges {
                node {
                  __typename
                  ... on ConfluencePage {
                    id
                    title
                    webUrl
                    lastUpdatedAt
                    owner { id name }
                    space { key name }
                  }
                }
              }
            }
          }`,
          { userId: userAri }
        )
      : Promise.resolve({ queryName: 'atlassianUserContent', ok: false, data: null }),
  ]);

  const goals = (goalsRes.data?.jiraWorkItemGoals?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'AtlassianGoal')
    .map((n) => ({ id: n.id, key: n.key, name: n.name, url: n.url, ownerName: n.owner?.name || '' }));

  const comments = (commentsRes.data?.jiraWorkItemComments?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'JiraWorkItemComment')
    .map((n) => ({
      id: n.id,
      content: (n.content || '').slice(0, 220),
      createdAt: n.createdAt,
      authorName: n.author?.name || 'Team Member',
      webUrl: n.webUrl,
    }));

  const devArtifacts = (devRes.data?.jiraWorkItemDevelopmentArtifacts?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n && (n.__typename === 'ExternalPullRequest' || n.__typename === 'ExternalDeployment'))
    .map((n) => ({
      id: n.id,
      type: n.__typename,
      displayName: n.displayName || n.__typename,
      status: n.status || 'Recorded',
      authorName: n.author?.name || '',
    }));

  const hierarchy = (hierarchyRes.data?.jiraWorkItemHierarchy?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'JiraWorkItem')
    .map((n) => ({ id: n.id, key: n.key, summary: n.summary, status: n.status?.name || '', webUrl: n.webUrl }));

  const teams = (teamsRes.data?.atlassianUserInTeams?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'AtlassianTeam')
    .map((n) => ({ id: n.id, displayName: n.displayName, profileUrl: n.profileUrl }));

  const confluencePages = (contentRes.data?.atlassianUserContent?.edges || [])
    .map((e) => e?.node)
    .filter((n) => n?.__typename === 'ConfluencePage')
    .map((n) => ({
      id: n.id,
      title: n.title,
      webUrl: n.webUrl,
      lastUpdatedAt: n.lastUpdatedAt,
      ownerName: n.owner?.name || 'Unknown Owner',
      spaceKey: n.space?.key || '',
    }));

  return {
    connected: echoRes.connected,
    echo: echoRes.echo,
    issueAri,
    goals,
    comments,
    devArtifacts,
    hierarchy,
    teams,
    confluencePages,
    telemetry: [goalsRes, commentsRes, devRes, hierarchyRes, teamsRes, contentRes].map((r) => ({
      queryName: r.queryName,
      ok: r.ok,
      durationMs: r.durationMs || 0,
      error: r.error || null,
    })),
  };
}
