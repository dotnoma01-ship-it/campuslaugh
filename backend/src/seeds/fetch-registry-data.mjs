import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const out = resolve(dirname(fileURLToPath(import.meta.url)), 'verified-institutions.json');
const checkedAt = new Date().toISOString();
const states = new Set(['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara','FCT']);
const counts = { NUC: { parsed: 0, included: 0, excluded: 0 }, NBTE: { parsed: 0, included: 0, excluded: 0, published: {} }, NCCE: { parsed: 0, included: 0, excluded: 0 } };
const sources = {
  NUC: 'https://enuc.nuc.edu.ng/nus',
  NBTE: 'https://digitalnbte.nbte.gov.ng/Public/Institutions',
  NCCE: 'https://ncce.gov.ng/AccreditedColleges/Index',
};

function decode(value = '') {
  return value.replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}
const text = (html = '') => decode(html.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function normalizeState(value) {
  const cleaned = value.trim().replace(/\s+State$/i, '').replace(/\s+/g, ' ');
  const state = /^FCT(?: Abuja)?$/i.test(cleaned) ? 'FCT' : [...states].find((s) => s.toLowerCase() === cleaned.toLowerCase());
  return state ?? null;
}
function stateFromOfficialName(value = '') {
  const name = value.trim().replace(/[.,]+$/, '');
  const match = [...states].find((state) => new RegExp(`(?:^|[,\\s])${state}(?:\\s+State)?$`, 'i').test(name));
  if (match) return match;
  return /(?:^|[,\\s])Abuja$/i.test(name) ? 'FCT' : null;
}
function cityFromOfficialName(name, state) {
  const withoutState = name.replace(new RegExp(`[,\\s]+${state}(?:\\s+State)?$`, 'i'), '').trim();
  const segments = withoutState.split(',').map((part) => part.trim()).filter(Boolean);
  if (segments.length < 2) return undefined;
  const city = segments.at(-1).replace(/\b(?:main|permanent|satellite)?\s*campus\b/ig, '').trim();
  return city.length > 1 && city.length < 80 ? city : undefined;
}
function nbteCategory(type, name) {
  if (type === 'allied' && /\b(?:agricultural college|college of agriculture)\b/i.test(name)) return 'Agricultural College';
  if (type === 'allied' && /\btechnical college\b/i.test(name)) return 'Technical College';
  return nbteTypes.find(([key]) => key === type)?.[1] ?? 'Other NBTE-recognised tertiary institution';
}
function ownership(value) {
  const match = value.match(/\b(Federal|State|Private)\b/i)?.[1];
  return match ? match[0].toUpperCase() + match.slice(1).toLowerCase() : null;
}
function record({ name, category, ownership: owner, state, regulator, source, recognitionStatus, website }) {
  const cleanName = name.replace(/\s+/g, ' ').trim();
  const cleanState = normalizeState(state ?? '');
  const cleanOwnership = ownership(owner ?? '');
  if (!cleanName || !cleanState || !cleanOwnership) return null;
  return {
    name: cleanName,
    officialName: cleanName,
    ...(cleanState ? { city: cityFromOfficialName(cleanName, cleanState) } : {}),
    ...(website ? { website } : {}),
    category,
    ownership: cleanOwnership,
    state: cleanState,
    recognitionStatus,
    regulator,
    identifier: `${regulator.toLowerCase()}-${slug(cleanName)}-${slug(cleanState)}`,
    active: true,
    source,
    lastVerifiedAt: checkedAt,
  };
}

async function html(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'CampusLaugh Institution Directory importer (admin initiated)' } });
  if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}: ${new URL(url).hostname}`);
  return response.text();
}

async function universities() {
  const page = await html(sources.NUC);
  const tbody = page.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const entries = [];
  for (const row of tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => text(m[1]));
    if (cells.length < 5 || !/^\d+$/.test(cells[0])) continue;
    counts.NUC.parsed += 1;
    const item = record({ name: cells[1], category: 'University', ownership: cells[3], state: cells[4], regulator: 'NUC', source: sources.NUC, recognitionStatus: 'Listed in the NUC Nigerian University System' });
    if (item) { entries.push(item); counts.NUC.included += 1; } else counts.NUC.excluded += 1;
  }
  return entries;
}

const nbteTypes = [
  ['polytechnic', 'Polytechnic'],
  ['nursing', 'College of Nursing Sciences'],
  ['health', 'College of Health Technology'],
  ['allied', 'Other NBTE-recognised tertiary institution'],
  ['iei', 'Innovation Enterprise Institution'],
  ['vei', 'Vocational Enterprise Institution'],
];

async function nbte() {
  const entries = [];
  const jobs = [];
  for (const [type, category] of nbteTypes) {
    const firstUrl = `${sources.NBTE}?type=${encodeURIComponent(type)}`;
    const first = await html(firstUrl);
    const published = Number(first.match(/Show\s*<span class="num">(\d+)<\/span>\s*institutions/i)?.[1] ?? 0);
    counts.NBTE.published[type] = published || null;
    jobs.push({ type, category, page: 1, first });
    const pages = [...first.matchAll(/aria-label="Page (\d+)"/g)].map((m) => Number(m[1]));
    for (let page = 2; page <= Math.max(1, ...pages); page += 1) jobs.push({ type, category, page });
  }
  let index = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (index < jobs.length) {
      const job = jobs[index++];
      const page = job.first ?? await html(`${sources.NBTE}?type=${encodeURIComponent(job.type)}&page=${job.page}`);
      for (const match of page.matchAll(/<span class="irow__name">([^<]+)<\/span>\s*<span class="irow__meta">([^<]+)<\/span>/gi)) {
        counts.NBTE.parsed += 1;
        const [institutionType, owner, pageState] = text(match[2]).split(/\s*·\s*/);
        if (!institutionType || !owner) { counts.NBTE.excluded += 1; continue; }
        const name = text(match[1]);
        const item = record({ name, category: nbteCategory(job.type, name), ownership: owner, state: pageState ?? stateFromOfficialName(name), regulator: 'NBTE', source: `${sources.NBTE}?type=${job.type}`, recognitionStatus: 'Listed in the NBTE public register; verify programme-level approval dates with NBTE' });
        if (item) { entries.push(item); counts.NBTE.included += 1; } else counts.NBTE.excluded += 1;
      }
    }
  }));
  return entries;
}

async function collegesOfEducation() {
  const page = await html(sources.NCCE);
  const tbody = page.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const entries = [];
  for (const row of tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const parts = cells.map(text);
    counts.NCCE.parsed += 1;
    const ownerType = parts[3];
    const owner = ownership(ownerType);
    if (!owner) { counts.NCCE.excluded += 1; continue; }
    const category = /polytechnic/i.test(ownerType) ? 'Other NCE-awarding institution' : /college of education/i.test(ownerType) ? 'College of Education' : 'Other NCE-awarding institution';
    const href = cells[5]?.match(/href=["']([^"']+)["']/i)?.[1];
    let website;
    if (href && !/^(?:#|javascript:)/i.test(href) && !/none\.edu|nodomain|somethingedu|\/null/i.test(href)) {
      try { website = new URL(href.startsWith('//') ? `https:${href}` : href.startsWith('http') ? href : `https://${href}`).toString(); } catch { /* Ignore malformed directory links. */ }
    }
    const item = record({ name: parts[1].replace(/\bOPEN\b/gi, '').trim(), category, ownership: owner, state: parts[4], regulator: 'NCCE', source: sources.NCCE, recognitionStatus: 'Listed in the NCCE accredited-colleges directory', website });
    if (item) { entries.push(item); counts.NCCE.included += 1; } else counts.NCCE.excluded += 1;
  }
  return entries;
}

const [nuc, nbteData, ncce] = await Promise.all([universities(), nbte(), collegesOfEducation()]);
const all = [...nuc, ...nbteData, ...ncce];
const unique = new Map();
for (const item of all) {
  const key = `${item.state}|${item.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
  const existing = unique.get(key);
  // Retain one canonical listing when regulatory registers cross-list the same name.
  if (!existing || ['NUC', 'NBTE', 'NCCE'].indexOf(item.regulator) < ['NUC', 'NBTE', 'NCCE'].indexOf(existing.regulator)) unique.set(key, item);
}
const institutions = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
if (!institutions.length) throw new Error('No verified records were parsed; refusing to overwrite the directory snapshot.');
await writeFile(out, `${JSON.stringify({ fetchedAt: checkedAt, sources, counts, institutions }, null, 2)}\n`, 'utf8');
console.log(`Saved ${institutions.length} verified directory records (NUC ${nuc.length}; NBTE ${nbteData.length}; NCCE ${ncce.length}) to ${out}`);
console.log(`Source parsing counts: ${JSON.stringify(counts)}`);
console.log(`State/FCT coverage: ${new Set(institutions.map((item) => item.state)).size}/37; categories: ${new Set(institutions.map((item) => item.category)).size}`);
