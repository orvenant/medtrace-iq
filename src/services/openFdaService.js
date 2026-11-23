import { fetch } from '@forge/api';
import { getCachedFdaQuery, setCachedFdaQuery } from './storageService';

const OPENFDA_ENFORCEMENT_BASE = 'https://api.fda.gov/device/enforcement.json';

function sanitizeKeyword(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function formatFdaDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return yyyymmdd || 'N/A';
  const s = String(yyyymmdd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function normalizeRecall(item, matchedKeyword) {
  const recallNumber = item.recall_number || item.event_id || 'FDA-UNKNOWN';
  return {
    recallNumber,
    eventId: item.event_id || '',
    classification: item.classification || 'Class II',
    status: item.status || 'Ongoing',
    recallingFirm: item.recalling_firm || 'Unspecified Manufacturer',
    productDescription: (item.product_description || '').slice(0, 260),
    reasonForRecall: (item.reason_for_recall || '').slice(0, 340),
    initiationDate: formatFdaDate(item.recall_initiation_date),
    reportDate: formatFdaDate(item.report_date),
    distributionPattern: (item.distribution_pattern || '').slice(0, 140),
    voluntaryMandated: item.voluntary_mandated || 'Voluntary: Firm initiated',
    productQuantity: item.product_quantity || 'N/A',
    matchedKeyword: matchedKeyword || '',
    fdaUrl: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=${encodeURIComponent(item.event_id || '')}`,
  };
}

function buildSearchExpression(keyword, classification, ongoingOnly) {
  const parts = [];
  if (keyword) {
    const clean = sanitizeKeyword(keyword);
    if (clean) {
      parts.push(`(product_description:"${clean}"+OR+reason_for_recall:"${clean}")`);
    }
  }
  if (classification && ['Class I', 'Class II', 'Class III'].includes(classification)) {
    parts.push(`classification:"${classification}"`);
  }
  if (ongoingOnly) {
    parts.push('status:"Ongoing"');
  }
  return parts.join('+AND+');
}

async function queryOpenFdaRaw(searchExpr, limit) {
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));
  const queryParts = [];
  if (searchExpr) queryParts.push(`search=${searchExpr}`);
  queryParts.push(`sort=report_date:desc`);
  queryParts.push(`limit=${safeLimit}`);
  const url = `${OPENFDA_ENFORCEMENT_BASE}?${queryParts.join('&')}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    return { total: 0, results: [] };
  }
  if (!response.ok) {
    throw new Error(`openFDA HTTP ${response.status}`);
  }
  const json = await response.json();
  return {
    total: json?.meta?.results?.total || (json?.results?.length ?? 0),
    results: Array.isArray(json?.results) ? json.results : [],
  };
}

/**
 * Search live US openFDA Medical Device Enforcement & Recall API.
 * Strictly sends only generic medical device terms (zero PII or Jira text).
 */
export async function searchFdaDeviceRecalls({ keyword = '', classification = '', limit = 6, ongoingPreferred = true } = {}) {
  const cleanKw = sanitizeKeyword(keyword);
  const safeClass = ['Class I', 'Class II', 'Class III'].includes(classification) ? classification : '';
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));
  const cacheSlug = `${cleanKw || 'all'}_${safeClass || 'any'}_${safeLimit}_${ongoingPreferred ? 'ong' : 'all'}`;

  const cached = await getCachedFdaQuery(cacheSlug);
  if (cached) {
    return {
      source: 'openFDA (cached)',
      keyword: cleanKw,
      classification: safeClass || 'All',
      totalAvailable: cached.totalAvailable,
      recalls: cached.recalls,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
    };
  }

  try {
    let raw = await queryOpenFdaRaw(buildSearchExpression(cleanKw, safeClass, ongoingPreferred), safeLimit);

    // If ongoing-only returned empty for a niche keyword, broaden to all statuses
    if (raw.results.length === 0 && ongoingPreferred) {
      raw = await queryOpenFdaRaw(buildSearchExpression(cleanKw, safeClass, false), safeLimit);
    }

    // If multi-word phrase returned empty, retry with primary medical noun
    if (raw.results.length === 0 && cleanKw.includes(' ')) {
      const primaryToken = cleanKw.split(' ').find((t) => t.length >= 4) || cleanKw.split(' ')[0];
      raw = await queryOpenFdaRaw(buildSearchExpression(primaryToken, safeClass, false), safeLimit);
    }

    const recalls = raw.results.map((r) => normalizeRecall(r, cleanKw || 'medical device'));
    const payload = {
      source: 'openFDA live',
      keyword: cleanKw,
      classification: safeClass || 'All',
      totalAvailable: raw.total,
      recalls,
      fetchedAt: new Date().toISOString(),
    };

    await setCachedFdaQuery(cacheSlug, {
      totalAvailable: raw.total,
      recalls,
    });

    return payload;
  } catch (err) {
    console.error('[openFdaService] fetch error:', err?.message);
    return {
      source: 'openFDA unavailable',
      error: err?.message || 'Unable to reach api.fda.gov',
      keyword: cleanKw,
      classification: safeClass || 'All',
      totalAvailable: 0,
      recalls: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Fetch recalls for multiple distinct medical device subsystems detected across a project.
 */
export async function fetchRecallsForSubsystems(keywords = [], limitPerKeyword = 4) {
  const uniqueKeywords = [...new Set(keywords.map(sanitizeKeyword).filter(Boolean))].slice(0, 6);
  if (uniqueKeywords.length === 0) {
    uniqueKeywords.push('infusion pump', 'pacemaker', 'catheter');
  }

  const responses = await Promise.all(
    uniqueKeywords.map((kw) =>
      searchFdaDeviceRecalls({ keyword: kw, limit: limitPerKeyword, ongoingPreferred: true })
    )
  );

  const byKeyword = {};
  const mergedMap = new Map();
  let liveCount = 0;

  for (const res of responses) {
    byKeyword[res.keyword] = res.recalls;
    if (res.source.startsWith('openFDA live') || res.source.startsWith('openFDA (cached)')) {
      liveCount += 1;
    }
    for (const recall of res.recalls) {
      if (!mergedMap.has(recall.recallNumber)) {
        mergedMap.set(recall.recallNumber, recall);
      }
    }
  }

  const allRecalls = Array.from(mergedMap.values()).sort((a, b) => {
    const rank = { 'Class I': 0, 'Class II': 1, 'Class III': 2 };
    const diff = (rank[a.classification] ?? 3) - (rank[b.classification] ?? 3);
    if (diff !== 0) return diff;
    return String(b.reportDate).localeCompare(String(a.reportDate));
  });

  return {
    connected: liveCount > 0,
    queriedKeywords: uniqueKeywords,
    byKeyword,
    allRecalls,
    fetchedAt: new Date().toISOString(),
  };
}
