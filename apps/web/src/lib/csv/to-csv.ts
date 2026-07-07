/**
 * Minimal RFC 4180 CSV builder for client-side exports. Mirrors the backend's
 * `toCsv` (apps/api/src/common/utils/csv.ts) so client- and server-generated
 * exports share one format.
 *
 * Every cell is treated as an OPAQUE STRING: the helper never calls
 * Number()/parseFloat/toFixed and never reformats a value. Callers pass final
 * strings — this is what keeps money exact (money-as-string). A non-string field
 * (e.g. a boolean) must be stringified by the CALLER, and the `cell` type below
 * enforces that at compile time (it must return a `string`).
 *
 * Escaping: a field containing a comma, double-quote, CR or LF is wrapped in
 * double quotes with embedded quotes doubled (""); records are joined with CRLF;
 * the header row comes first; no trailing newline.
 */
export interface CsvColumn<T> {
  header: string;
  cell: (row: T) => string;
}

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((c) => escapeField(c.header)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((c) => escapeField(c.cell(row))).join(','),
  );
  return [headerRow, ...dataRows].join('\r\n');
}
