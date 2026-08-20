// Stub external-source tool.
//
// This is a static, client-only site with no backend, so there is no real
// web-search API call happening here — a genuine implementation needs a
// server-side fetch (browser CORS and API-key security both rule out calling
// a search API directly from client JS). This stub returns a small set of
// realistic, clearly-labeled *suggested* authoritative sources for the
// query's topic, never presented as the result of an actual live fetch.
//
// searchWeb() is the seam: swap its body for a real backend call
// (`fetch("/api/web-search", ...)`) later without changing any caller, since
// the return shape stays the same.

const ORGS_BY_KEYWORD = [
  [/glaucoma|iop|intraocular pressure/i, ["American Academy of Ophthalmology (AAO) — EyeWiki: Glaucoma", "American Glaucoma Society"]],
  [/retina|macula|amd|diabetic retinopathy/i, ["American Academy of Ophthalmology (AAO) — EyeWiki: Retina", "American Society of Retina Specialists"]],
  [/cornea|keratoconus|contact lens/i, ["American Academy of Ophthalmology (AAO) — EyeWiki: Cornea", "American Optometric Association (AOA)"]],
  [/optic nerve|neuro|papilledema|visual field/i, ["North American Neuro-Ophthalmology Society (NANOS)", "American Academy of Ophthalmology (AAO) — EyeWiki: Neuro-Ophthalmology"]],
  [/uveitis|inflammation|autoimmune/i, ["American Uveitis Society", "American Academy of Ophthalmology (AAO) — EyeWiki: Uveitis"]],
  [/drug|pharmac|medication|dose|interaction/i, ["American Academy of Ophthalmology (AAO) — EyeWiki", "National Library of Medicine — DailyMed"]],
];

const DEFAULT_SOURCES = ["American Academy of Ophthalmology (AAO) — EyeWiki", "American Optometric Association (AOA)"];

export async function searchWeb(query) {
  const matched = ORGS_BY_KEYWORD.find(([re]) => re.test(query));
  const suggested = matched ? matched[1] : DEFAULT_SOURCES;
  return {
    live: false, // honest flag: no network call actually happened
    disclaimer:
      "This build has no live web-search connection yet — these are suggested authoritative sources to check yourself, not content actually fetched or read.",
    sources: suggested,
  };
}
