import { buildCsv } from '../src/export/csv';
import { Connection } from '../src/domain/connection';

const sample: Connection = {
  name: 'Alice Smith',
  profileUrl: 'https://www.linkedin.com/in/alice',
  headline: 'Engineer',
  connectedOn: 'Connected on Jan 1, 2025',
  messageUrl: 'https://www.linkedin.com/messaging/compose/?foo=bar',
};

test('builds CSV with header', () => {
  const csv = buildCsv([sample]);
  expect(csv).toContain('name,profileUrl,headline,connectedOn,messageUrl');
  expect(csv).toContain('Alice Smith');
});

test('escapes double quotes', () => {
  const conn: Connection = { ...sample, name: 'Say "Hello"' };
  const csv = buildCsv([conn]);
  expect(csv).toContain('"Say ""Hello"""');
});

test('formula injection: prefixes = with tab', () => {
  const conn: Connection = { ...sample, name: '=SUM(A1)' };
  const csv = buildCsv([conn]);
  expect(csv).toContain('\t=SUM(A1)');
});

test('formula injection: prefixes + with tab', () => {
  const conn: Connection = { ...sample, headline: '+malicious' };
  const csv = buildCsv([conn]);
  expect(csv).toContain('\t+malicious');
});

test('empty connections returns only header', () => {
  const csv = buildCsv([]);
  const lines = csv.split('\r\n').filter(Boolean);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toBe('name,profileUrl,headline,connectedOn,messageUrl');
});
