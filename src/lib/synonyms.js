// Hand-curated NBEO abbreviation/synonym map — the documented seam for a
// future real semantic/vector search. Today this is a plain keyword expansion
// table: searching an abbreviation or common clinical phrase also matches the
// documents that contain its expansion (and vice versa). A future upgrade can
// replace `expandQuery()` with an embedding-similarity lookup without
// changing anything that calls it — `searchService.js` only depends on this
// function's signature (string in, string[] of extra terms out).
//
// Entries are drawn from real content already built into the platform, not
// invented — each key/value pair should genuinely appear (or nearly so) in
// STUDY_PAGES/CONTENT_TOPICS text somewhere in nbeo-app.jsx.

export const SYNONYMS = [
  // Neuro-ophthalmology
  ["rapd", "relative afferent pupillary defect", "marcus gunn pupil"],
  ["aion", "anterior ischemic optic neuropathy"],
  ["naion", "nonarteritic anterior ischemic optic neuropathy"],
  ["aaion", "arteritic anterior ischemic optic neuropathy", "giant cell arteritis", "temporal arteritis"],
  ["pion", "posterior ischemic optic neuropathy"],
  ["optic neuritis", "pain with eye movement", "demyelinating optic neuropathy"],
  ["papilledema", "bilateral optic disc swelling", "increased intracranial pressure"],
  ["internuclear ophthalmoplegia", "ino", "mlf lesion"],
  ["horner syndrome", "ptosis miosis anhidrosis"],
  ["cn iii palsy", "oculomotor nerve palsy", "third nerve palsy"],
  ["cn iv palsy", "trochlear nerve palsy", "fourth nerve palsy", "superior oblique palsy"],
  ["cn vi palsy", "abducens nerve palsy", "sixth nerve palsy"],

  // Retina/vitreous
  ["crao", "central retinal artery occlusion", "cherry red spot"],
  ["brao", "branch retinal artery occlusion"],
  ["crvo", "central retinal vein occlusion"],
  ["brvo", "branch retinal vein occlusion"],
  ["rd", "retinal detachment", "rhegmatogenous retinal detachment"],
  ["pvd", "posterior vitreous detachment", "flashes and floaters"],
  ["armd", "amd", "age-related macular degeneration"],
  ["cnv", "choroidal neovascularization"],
  ["dr", "diabetic retinopathy"],
  ["pdr", "proliferative diabetic retinopathy"],
  ["npdr", "nonproliferative diabetic retinopathy"],
  ["cme", "cystoid macular edema"],
  ["rp", "retinitis pigmentosa", "bone spicule pigmentation"],

  // Glaucoma
  ["poag", "primary open angle glaucoma"],
  ["pacg", "primary angle closure glaucoma", "angle closure glaucoma"],
  ["pds", "pigment dispersion syndrome"],
  ["pxf", "pxg", "pseudoexfoliation syndrome", "pseudoexfoliation glaucoma"],
  ["iop", "intraocular pressure"],

  // Cornea/anterior segment
  ["hsv keratitis", "herpes simplex keratitis", "dendritic ulcer"],
  ["hzo", "herpes zoster ophthalmicus", "shingles eye"],
  ["akc", "atopic keratoconjunctivitis"],
  ["vkc", "vernal keratoconjunctivitis"],
  ["sac", "seasonal allergic conjunctivitis"],
  ["pac", "perennial allergic conjunctivitis"],
  ["gpc", "giant papillary conjunctivitis"],
  ["fuchs", "fuchs endothelial corneal dystrophy", "fuchs dystrophy"],
  ["ectasia", "keratoconus"],
  ["acanthamoeba keratitis", "contact lens water exposure"],

  // Lens
  ["psc", "posterior subcapsular cataract"],
  ["nucleal sclerosis", "nuclear sclerotic cataract"],
  ["iol", "intraocular lens"],

  // Systemic/pharmacology
  ["cn palsy diabetes", "diabetic cranial neuropathy"],
  ["sjs", "ten", "stevens-johnson syndrome", "toxic epidermal necrolysis"],
  ["eps", "extrapyramidal symptoms", "oculogyric crisis"],
  ["ifis", "intraoperative floppy iris syndrome", "tamsulosin"],
  ["cypd450", "cyp450", "cytochrome p450 interactions"],
  ["nebulizer pupil", "ipratropium mydriasis"],

  // Optics/refraction
  ["mar", "minimum angle of resolution"],
  ["sam-fap", "same direction add plus contact lens power"],
  ["prentice's rule", "prism induced by decentration"],
];

// expandQuery: given a lowercase query string, returns extra search terms
// pulled in via synonym/abbreviation matches (both directions: typing the
// abbreviation surfaces the full term's content, and vice versa).
export function expandQuery(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const extra = new Set();
  for (const group of SYNONYMS) {
    const hit = group.some(term => q.includes(term) || term.includes(q));
    if (hit) {
      for (const term of group) extra.add(term);
    }
  }
  extra.delete(q);
  return Array.from(extra);
}
