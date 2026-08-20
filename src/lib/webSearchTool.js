// Live external-source search.
//
// This is a static, client-only site with no backend — most search APIs
// (Google, Bing, SerpAPI, ...) need a secret key, and calling those directly
// from browser JS would expose the key to every visitor, so those are ruled
// out. Instead this calls two genuinely public, keyless, CORS-enabled APIs
// directly from the browser:
//   - NCBI PubMed E-utils (peer-reviewed literature — closest fit to the
//     spec's source-priority list)
//   - Wikipedia's REST/action APIs (general reference, good coverage as a
//     fallback when PubMed has nothing directly on point)
// Both are real, live network calls — not canned data. If a network/CORS
// error occurs (e.g. the host is unreachable from wherever this is deployed),
// this degrades gracefully to a small keyword-matched list of suggested
// professional-organization sources, clearly labeled as suggestions rather
// than fetched results, rather than failing the whole response.
//
// searchWeb() is the seam: swap/extend its body for a real backend-proxied
// search API later without changing any caller — the return shape stays the
// same either way.

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchPubMed(query) {
  const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=3&sort=relevance`;
  const esearch = await fetchJson(esearchUrl);
  const ids = esearch?.esearchresult?.idlist || [];
  if (ids.length === 0) return [];
  const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const esummary = await fetchJson(esummaryUrl);
  return ids
    .map(id => {
      const doc = esummary?.result?.[id];
      if (!doc || !doc.title) return null;
      return {
        title: doc.title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: [doc.source, doc.pubdate].filter(Boolean).join(" · "),
        origin: "PubMed",
      };
    })
    .filter(Boolean);
}

async function searchWikipedia(query) {
  // action=opensearch with origin=* is the documented way to get CORS
  // headers from Wikipedia's action API from an arbitrary browser origin.
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=2&namespace=0&format=json&origin=*`;
  const data = await fetchJson(url);
  const [, titles = [], descriptions = [], urls = []] = data || [];
  return titles.map((title, i) => ({
    title: `Wikipedia — ${title}`,
    url: urls[i],
    snippet: descriptions[i] || "",
    origin: "Wikipedia",
  })).filter(r => r.url);
}

const ORGS_BY_KEYWORD = [
  [/glaucoma|iop|intraocular pressure/i, ["American Academy of Ophthalmology (AAO) — EyeWiki: Glaucoma", "American Glaucoma Society"]],
  [/retina|macula|amd|diabetic retinopathy/i, ["American Academy of Ophthalmology (AAO) — EyeWiki: Retina", "American Society of Retina Specialists"]],
  [/cornea|keratoconus|contact lens/i, ["American Academy of Ophthalmology (AAO) — EyeWiki: Cornea", "American Optometric Association (AOA)"]],
  [/optic nerve|neuro|papilledema|visual field/i, ["North American Neuro-Ophthalmology Society (NANOS)", "American Academy of Ophthalmology (AAO) — EyeWiki: Neuro-Ophthalmology"]],
  [/uveitis|inflammation|autoimmune/i, ["American Uveitis Society", "American Academy of Ophthalmology (AAO) — EyeWiki: Uveitis"]],
  [/drug|pharmac|medication|dose|interaction/i, ["American Academy of Ophthalmology (AAO) — EyeWiki", "National Library of Medicine — DailyMed"]],
];
const DEFAULT_SOURCES = ["American Academy of Ophthalmology (AAO) — EyeWiki", "American Optometric Association (AOA)"];

function suggestedFallback(query) {
  const matched = ORGS_BY_KEYWORD.find(([re]) => re.test(query));
  const names = matched ? matched[1] : DEFAULT_SOURCES;
  return names.map(title => ({ title, url: null, snippet: null, origin: "Suggested" }));
}

export async function searchWeb(query) {
  const [pubmedRes, wikiRes] = await Promise.allSettled([searchPubMed(query), searchWikipedia(query)]);
  const results = [
    ...(pubmedRes.status === "fulfilled" ? pubmedRes.value : []),
    ...(wikiRes.status === "fulfilled" ? wikiRes.value : []),
  ];

  if (results.length > 0) {
    return {
      live: true,
      disclaimer: "Live results from PubMed and Wikipedia — for educational context only; this is not individualized medical advice, and primary/professional-society sources should be checked for clinical decisions.",
      sources: results,
    };
  }

  // Both real sources failed (network/CORS/no matches) — degrade honestly.
  return {
    live: false,
    disclaimer: "Live search didn't return results just now (network/CORS issue, or nothing matched) — these are suggested authoritative sources to check yourself, not content actually fetched.",
    sources: suggestedFallback(query),
  };
}
