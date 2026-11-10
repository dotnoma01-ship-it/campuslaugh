import { readFile } from 'node:fs/promises'; import { connectDatabase } from '../config/database.js'; import { Institution } from '../models/index.js';
// Curated initial records. University ownership is sourced from the NUC's Nigerian University System directory.
// NBTE/NCCE entries should be imported from their live regulator registers before being marked independently verified.
const src='National Universities Commission (NUC), Nigerian University System; https://enuc.nuc.edu.ng/nus';
const universities=[
['University of Lagos','Federal','Lagos','Akoka','UNILAG'],['University of Nigeria, Nsukka','Federal','Enugu','Nsukka','UNN'],['University of Ibadan','Federal','Oyo','Ibadan','UI'],['Obafemi Awolowo University','Federal','Osun','Ile-Ife','OAU'],['Ahmadu Bello University','Federal','Kaduna','Zaria','ABU'],['University of Benin','Federal','Edo','Benin City','UNIBEN'],['University of Ilorin','Federal','Kwara','Ilorin','UNILORIN'],['University of Port Harcourt','Federal','Rivers','Port Harcourt','UNIPORT'],['Bayero University, Kano','Federal','Kano','Kano','BUK'],['Federal University of Technology, Akure','Federal','Ondo','Akure','FUTA'],['Federal University of Technology, Minna','Federal','Niger','Minna','FUTMINNA'],['Nnamdi Azikiwe University','Federal','Anambra','Awka','UNIZIK'],['University of Jos','Federal','Plateau','Jos','UNIJOS'],['University of Calabar','Federal','Cross River','Calabar','UNICAL'],['University of Maiduguri','Federal','Borno','Maiduguri','UNIMAID'],['Usmanu Danfodiyo University','Federal','Sokoto','Sokoto','UDUS'],['National Open University of Nigeria','Federal','FCT','Abuja','NOUN'],['Federal University of Technology, Owerri','Federal','Imo','Owerri','FUTO'],['Lagos State University','State','Lagos','Ojo','LASU'],['Ambrose Alli University','State','Edo','Ekpoma','AAU'],['Abia State University','State','Abia','Uturu','ABSU'],['Adamawa State University','State','Adamawa','Mubi','ADSU'],['Akwa Ibom State University','State','Akwa Ibom','Ikot Akpaden','AKSU'],['Niger Delta University','State','Bayelsa','Wilberforce Island','NDU'],['Olabisi Onabanjo University','State','Ogun','Ago-Iwoye','OOU'],['Ekiti State University','State','Ekiti','Ado-Ekiti','EKSU'],['Kogi State University','State','Kogi','Anyigba','PAAU'],['Rivers State University','State','Rivers','Port Harcourt','RSU'],['Covenant University','Private','Ogun','Ota','CU'],['Babcock University','Private','Ogun','Ilishan-Remo','BU'],['American University of Nigeria','Private','Adamawa','Yola','AUN'],['Afe Babalola University','Private','Ekiti','Ado-Ekiti','ABUAD'],['Bowen University','Private','Osun','Iwo','BU'],['Pan-Atlantic University','Private','Lagos','Lagos','PAU'],['Nile University of Nigeria','Private','FCT','Abuja','NILE'],['Landmark University','Private','Kwara','Omu-Aran','LMU'],['Redeemer’s University','Private','Osun','Ede','RUN'],['Bingham University','Private','Nasarawa','Karu','BH'],['Madonna University','Private','Anambra','Okija','MU'],['Al-Hikmah University','Private','Kwara','Ilorin','AHU'],
];
const snapshot = await readFile(new URL('./verified-institutions.json', import.meta.url), 'utf8').then((value) => JSON.parse(value) as { institutions: Record<string, unknown>[]; fetchedAt: string }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
const fallback = universities.map(([name, ownership, state, city, abbreviation]) => ({ name, officialName: name, ownership, state, city, abbreviation, category: 'University', recognitionStatus: 'Listed in NUC Nigerian University System', regulator: 'NUC', source: src, lastVerifiedAt: new Date().toISOString(), active: true, identifier: `nuc-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}` }));
const records = snapshot?.institutions ?? fallback;
await connectDatabase();
const existingRecords = await Institution.find().select('identifier name officialName category ownership state regulator').lean();
const normalizeName = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value: unknown) => new Set(normalizeName(value).split(' ').filter(Boolean));
let insertedOrUpdated = 0;
for (const record of records) {
  const fields = { ...record, lastVerifiedAt: new Date(String(record.lastVerifiedAt ?? snapshot?.fetchedAt ?? new Date().toISOString())) };
  const identifier = String(record.identifier);
  let existing = existingRecords.find((item) => item.identifier === identifier);
  if (!existing && snapshot) {
    const sourceTokens = tokens(record.officialName);
    existing = existingRecords.find((item) => {
      if (item.regulator !== record.regulator || item.category !== record.category || item.ownership !== record.ownership || item.state !== record.state) return false;
      const currentTokens = tokens(item.officialName ?? item.name);
      const smaller = sourceTokens.size < currentTokens.size ? sourceTokens : currentTokens;
      const larger = sourceTokens.size < currentTokens.size ? currentTokens : sourceTokens;
      return smaller.size > 2 && [...smaller].every((token) => larger.has(token));
    });
  }
  const filter = existing ? { _id: existing._id } : { identifier };
  const update = process.env.UPDATE_EXISTING === 'true' ? { $set: fields } : { $setOnInsert: fields };
  if (existing && process.env.UPDATE_EXISTING !== 'true') continue;
  await Institution.updateOne(filter, update, { upsert: true, runValidators: true });
  insertedOrUpdated += 1;
}
console.log(`Upserted ${insertedOrUpdated} institution records${snapshot ? ` from official register snapshot fetched ${snapshot.fetchedAt}` : ' from the curated NUC starter set (not exhaustive)'}.`);
await (await import('mongoose')).default.disconnect();
