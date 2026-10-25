import type {CompanyProfile} from '@/db/schema/audit';

// "(+222) 36 12 34 56": the country code in brackets, the number in pairs of digits.
export function formatPhone({code, number}: {code: string; number: string}) {
  const digits = number.replace(/\D/g, '');
  const grouped = digits.length >= 6 ? digits.replace(/(\d{2})(?=\d)/g, '$1 ') : number.trim();
  return `(+${code}) ${grouped}`;
}

export function companyLines(profile: CompanyProfile) {
  return {
    phones: (profile.phones ?? []).map(formatPhone),
    identifiers: [
      profile.taxId ? {key: 'taxId' as const, value: profile.taxId} : null,
      profile.registration ? {key: 'registration' as const, value: profile.registration} : null
    ].filter((row) => row !== null),
    address: profile.address ?? '',
    email: profile.email ?? ''
  };
}
