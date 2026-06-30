/**
 * Minimal RFC 4180 CSV helpers. A field is quoted only when it contains a comma,
 * double-quote, CR or LF; embedded double-quotes are doubled. Records are joined
 * with CRLF. No trailing newline (the last record may omit the line break).
 */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows]
    .map((cols) => cols.map(escapeCsvField).join(','))
    .join('\r\n');
}
