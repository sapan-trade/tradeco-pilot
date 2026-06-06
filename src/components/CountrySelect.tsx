// Curated list of the most common trade origins/destinations. ISO-3166 alpha-2.
// Replaces the bare 2-letter text box so users pick a country instead of guessing codes.
const COUNTRIES: [string, string][] = [
  ["US", "United States"],
  ["CN", "China"],
  ["VN", "Vietnam"],
  ["IN", "India"],
  ["MX", "Mexico"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["GB", "United Kingdom"],
  ["FR", "France"],
  ["IT", "Italy"],
  ["ES", "Spain"],
  ["NL", "Netherlands"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["TW", "Taiwan"],
  ["TH", "Thailand"],
  ["ID", "Indonesia"],
  ["MY", "Malaysia"],
  ["BD", "Bangladesh"],
  ["TR", "Turkey"],
  ["BR", "Brazil"],
  ["AU", "Australia"],
  ["PL", "Poland"],
  ["CZ", "Czechia"],
  ["PT", "Portugal"],
  ["AE", "United Arab Emirates"],
];

export function CountrySelect({
  name,
  defaultValue,
  required,
  placeholder = "Select country…",
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required}>
      <option value="">{placeholder}</option>
      {COUNTRIES.map(([code, label]) => (
        <option key={code} value={code}>
          {label} ({code})
        </option>
      ))}
    </select>
  );
}
