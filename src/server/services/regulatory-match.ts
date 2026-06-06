/**
 * Matches regulatory updates against an org's catalog so we can alert merchants when
 * a rule change touches a product they actually classified — the difference between a
 * generic news feed and a compliance product.
 */

export interface MatchableUpdate {
  id: string;
  affectedHs: string[];
  affectedDest: string[];
}

export interface MatchableClassification {
  id: string;
  skuId: string;
  hsCode: string;
  destination: string;
  skuTitle: string;
}

/** Digits only, so "8517.62.0090" and "851762" compare cleanly. */
export function normalizeHs(hs: string): string {
  return (hs ?? "").replace(/\D/g, "");
}

/**
 * An update affects a classification when one of its affected HS codes is a prefix of
 * the product's full HS code (heading/subheading level), and the destination matches
 * (or the update lists no destinations). Updates with no affected HS codes are general
 * feed items, not catalog alerts, so they never match here.
 */
export function updateAffectsClassification(
  update: MatchableUpdate,
  c: MatchableClassification
): boolean {
  const destOk = update.affectedDest.length === 0 || update.affectedDest.includes(c.destination);
  if (!destOk) return false;
  const hsDigits = normalizeHs(c.hsCode);
  if (!hsDigits) return false;
  return update.affectedHs.some((a) => {
    const ad = normalizeHs(a);
    return ad.length >= 4 && hsDigits.startsWith(ad);
  });
}

export interface CatalogAlert<U extends MatchableUpdate> {
  update: U;
  affected: MatchableClassification[];
}

export function matchUpdatesToClassifications<U extends MatchableUpdate>(
  updates: U[],
  classifications: MatchableClassification[]
): CatalogAlert<U>[] {
  const alerts: CatalogAlert<U>[] = [];
  for (const update of updates) {
    const affected: MatchableClassification[] = [];
    const seenSku = new Set<string>();
    for (const c of classifications) {
      if (updateAffectsClassification(update, c) && !seenSku.has(c.skuId)) {
        seenSku.add(c.skuId);
        affected.push(c);
      }
    }
    if (affected.length > 0) alerts.push({ update, affected });
  }
  return alerts;
}
