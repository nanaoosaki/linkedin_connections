import { Connection } from '../domain/connection';

/** Escape a single CSV cell value */
function escapeCell(value: string): string {
  // Formula injection: prefix dangerous chars with a tab
  const sanitized = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  // Wrap in quotes if contains comma, quote, or newline
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

const HEADERS: (keyof Connection)[] = [
  'name',
  'profileUrl',
  'headline',
  'connectedOn',
  'messageUrl',
];

export function buildCsv(connections: Connection[]): string {
  const header = HEADERS.join(',');
  const rows = connections.map((c) =>
    HEADERS.map((h) => escapeCell(c[h])).join(',')
  );
  return [header, ...rows].join('\r\n');
}

export function downloadCsv(
  csv: string,
  filename = 'linkedin-connections.csv'
): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
