const USMCA = new Set(["US", "MX", "CA"]);
const CPTPP = new Set(["AU", "BN", "CA", "CL", "JP", "MY", "MX", "NZ", "PE", "SG", "VN"]);
const EU = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);

export interface FtaEvaluationInput {
  destination: string;
  supplierCountry: string | null;
  hsCode: string;
}

export interface FtaEvaluationResult {
  eligible: boolean | null;
  program: string | null;
}

/**
 * MVP heuristic: country-pair membership in well-known FTAs.
 * Phase 2+ will layer in HS-specific rules of origin and supplier declarations.
 */
export function evaluateFtaEligibility(input: FtaEvaluationInput): FtaEvaluationResult {
  if (!input.supplierCountry) return { eligible: null, program: null };

  if (USMCA.has(input.destination) && USMCA.has(input.supplierCountry) && input.destination !== input.supplierCountry) {
    return { eligible: true, program: "USMCA" };
  }
  if (CPTPP.has(input.destination) && CPTPP.has(input.supplierCountry) && input.destination !== input.supplierCountry) {
    return { eligible: true, program: "CPTPP" };
  }
  if (EU.has(input.destination) && EU.has(input.supplierCountry)) {
    return { eligible: true, program: "EU_INTRA" };
  }
  return { eligible: false, program: null };
}
