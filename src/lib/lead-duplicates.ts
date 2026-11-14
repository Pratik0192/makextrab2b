import { Prisma } from "@/generated/prisma";

type Database = Prisma.TransactionClient;

export type DuplicateCandidate = {
  id: string;
  reasons: string[];
  confidence: "HIGH" | "POSSIBLE";
};

export type DuplicateInput = {
  mobile?: string | null;
  gstin?: string | null;
  email?: string | null;
  businessName?: string | null;
};

export function normalizeMobile(value: string | null | undefined): string {
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

export function normalizeBusinessName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function words(value: string) {
  return new Set(value.split(" ").filter((word) => word.length > 1));
}

function similarBusinessName(a: string, b: string): boolean {
  if (a.length >= 4 && a === b) return true;
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size || left.size < 2 || right.size < 2) return false;
  const overlap = [...left].filter((word) => right.has(word)).length;
  return overlap >= 2 && overlap / Math.max(left.size, right.size) >= 0.8;
}

export async function findPossibleLeadDuplicates(
  db: Database,
  input: DuplicateInput,
  excludeLeadId?: string,
): Promise<DuplicateCandidate[]> {
  const mobile = normalizeMobile(input.mobile);
  const gstin = (input.gstin ?? "").trim().toUpperCase();
  const email = (input.email ?? "").trim().toLocaleLowerCase("en-US");
  const businessName = normalizeBusinessName(input.businessName);
  const distinctiveWord = businessName.split(" ").find((word) => word.length >= 4);
  const predicates: Prisma.Sql[] = [];
  const highConfidencePredicates: Prisma.Sql[] = [];
  if (mobile) { const predicate=Prisma.sql`(regexp_replace(COALESCE(l."mobile", ''), '[^0-9]', '', 'g') IN (${mobile}, ${`91${mobile}`}, ${`0${mobile}`}) OR regexp_replace(COALESCE(l."whatsappNumber", ''), '[^0-9]', '', 'g') IN (${mobile}, ${`91${mobile}`}, ${`0${mobile}`}))`;predicates.push(predicate);highConfidencePredicates.push(predicate); }
  if (gstin) { const predicate=Prisma.sql`upper(trim(COALESCE(l.gstin, ''))) = ${gstin}`;predicates.push(predicate);highConfidencePredicates.push(predicate); }
  if (email) { const predicate=Prisma.sql`lower(trim(l.email)) = ${email}`;predicates.push(predicate);highConfidencePredicates.push(predicate); }
  if (distinctiveWord) predicates.push(Prisma.sql`l."businessName" ILIKE ${`%${distinctiveWord}%`}`);
  if (!predicates.length) return [];

  const rows = await db.$queryRaw<Array<{id:string; mobile:string; whatsappNumber:string|null; gstin:string|null; email:string; businessName:string}>>(Prisma.sql`
    SELECT l.id, l.mobile, l."whatsappNumber", l.gstin, l.email, l."businessName"
    FROM "Lead" l
    WHERE l."mergedIntoLeadId" IS NULL
      ${excludeLeadId ? Prisma.sql`AND l.id <> ${excludeLeadId}` : Prisma.empty}
      AND (${Prisma.join(predicates, " OR ")})
    ORDER BY CASE WHEN ${highConfidencePredicates.length ? Prisma.sql`(${Prisma.join(highConfidencePredicates, " OR ")})` : Prisma.sql`FALSE`} THEN 0 ELSE 1 END, l."createdAt" DESC
    LIMIT 300
  `);
  const matches = new Map<string, Set<string>>();
  for (const row of rows) {
    const reasons = new Set<string>();
    if (mobile && [row.mobile, row.whatsappNumber].some((value) => normalizeMobile(value) === mobile)) reasons.add("MOBILE");
    if (gstin && row.gstin?.trim().toUpperCase() === gstin) reasons.add("GSTIN");
    if (email && row.email.trim().toLocaleLowerCase("en-US") === email) reasons.add("EMAIL");
    if (businessName && similarBusinessName(businessName, normalizeBusinessName(row.businessName))) reasons.add("BUSINESS_NAME");
    if (reasons.size) matches.set(row.id, reasons);
  }
  return [...matches.entries()].map(([id, reasons]) => ({
    id,
    reasons: [...reasons],
    confidence: [...reasons].some((reason) => reason !== "BUSINESS_NAME") ? "HIGH" : "POSSIBLE",
  }));
}

export async function saveLeadDuplicateMatches(
  db: Database,
  leadId: string,
  matches: DuplicateCandidate[],
  actorId?: string,
) {
  for (const match of matches) {
    const [leadAId, leadBId] = [leadId, match.id].sort((a, b) => a.localeCompare(b));
    const prior = await db.leadDuplicateMatch.findUnique({ where: { leadAId_leadBId: { leadAId, leadBId } }, select: { id:true,status:true,reasons:true,confidence:true } });
    if(prior){
      const reasons=[...new Set([...prior.reasons,...match.reasons])];
      const confidence=prior.confidence==="HIGH"||match.confidence==="HIGH"?"HIGH":"POSSIBLE";
      const stronger=(prior.confidence==="POSSIBLE"&&confidence==="HIGH")||match.reasons.some((reason)=>!prior.reasons.includes(reason));
      if(reasons.length!==prior.reasons.length||prior.confidence!==confidence)await db.leadDuplicateMatch.update({where:{id:prior.id},data:{reasons,confidence,status:prior.status==="DISMISSED"&&stronger?"PENDING":prior.status,...(prior.status==="DISMISSED"&&stronger?{reviewedAt:null,reviewedById:null,reviewNote:null}:{})}});
      if(!stronger)continue;
      for (const affectedLeadId of [leadId, match.id]) await db.leadActivity.create({data:{leadId:affectedLeadId,activityType:"DUPLICATE_DETECTED",description:`Additional duplicate evidence found (${match.reasons.join(", ")}; ${match.confidence.toLowerCase()} confidence).`,createdById:actorId??undefined}});
      continue;
    }
    const inserted = await db.leadDuplicateMatch.createMany({
      data: [{ leadAId, leadBId, reasons: match.reasons, confidence: match.confidence }],
      skipDuplicates: true,
    });
    if (!inserted.count) continue;
    for (const affectedLeadId of [leadId, match.id]) await db.leadActivity.create({
      data: { leadId: affectedLeadId, activityType: "DUPLICATE_DETECTED", description: `Possible duplicate match detected (${match.reasons.join(", ")}; ${match.confidence.toLowerCase()} confidence).`, createdById: actorId ?? undefined },
    });
  }
}
