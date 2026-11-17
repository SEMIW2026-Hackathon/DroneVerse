/** Hectares with thousands separators; two decimals for small areas, none for big ones. */
export function formatHa(ha: number): string {
  return ha.toLocaleString('en-US', {
    minimumFractionDigits: ha < 100 ? 2 : 0,
    maximumFractionDigits: ha < 100 ? 2 : 0,
  });
}
