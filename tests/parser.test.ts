import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import { parseConnections } from '../src/content/parser';

function loadFixture(name: string): Document {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
  return new JSDOM(html).window.document;
}

// ---------------------------------------------------------------------------
// Single-card fixture
// Fixture wraps one real card in the expected lazy-column / data-display-contents
// ancestry so the card selector matches and all fields are extractable.
// ---------------------------------------------------------------------------
describe('parseConnections - single card fixture', () => {
  let connections: ReturnType<typeof parseConnections>;

  beforeAll(() => {
    connections = parseConnections(loadFixture('connection-card-basic.html'));
  });

  test('finds exactly one card', () => {
    expect(connections).toHaveLength(1);
  });

  test('extracts name', () => {
    expect(connections[0].name).toBe('Siba Prasad');
  });

  test('extracts profileUrl', () => {
    expect(connections[0].profileUrl).toMatch(/linkedin\.com\/in\/sibaps\//);
  });

  test('extracts headline', () => {
    expect(connections[0].headline).toMatch(/Talent Acquisition Lead/);
  });

  test('extracts connectedOn', () => {
    expect(connections[0].connectedOn).toBe('Connected on March 19, 2026');
  });

  test('extracts messageUrl', () => {
    expect(connections[0].messageUrl).toMatch(/\/messaging\/compose\//);
  });
});

// ---------------------------------------------------------------------------
// List fixture
// Source of truth for repeated-card discovery and list-scanning behaviour.
// ---------------------------------------------------------------------------
describe('parseConnections - list fixture', () => {
  let connections: ReturnType<typeof parseConnections>;

  beforeAll(() => {
    connections = parseConnections(loadFixture('connections-list-basic.html'));
  });

  test('finds multiple cards', () => {
    expect(connections.length).toBeGreaterThan(1);
  });

  test('every card has a non-empty name', () => {
    expect(connections.every((c) => c.name.length > 0)).toBe(true);
  });

  test('every card has a profileUrl pointing to linkedin.com/in/', () => {
    expect(connections.every((c) => c.profileUrl.includes('linkedin.com/in/'))).toBe(true);
  });

  test('every card has a connectedOn value starting with "Connected on"', () => {
    expect(connections.every((c) => c.connectedOn.startsWith('Connected on'))).toBe(true);
  });

  test('no card has null or undefined in any field', () => {
    const fields: (keyof (typeof connections)[0])[] = [
      'name', 'profileUrl', 'headline', 'connectedOn', 'messageUrl',
    ];
    for (const c of connections) {
      for (const f of fields) {
        expect(c[f]).not.toBeNull();
        expect(c[f]).not.toBeUndefined();
      }
    }
  });

  test('first connection name matches known fixture value', () => {
    expect(connections[0].name).toBe('Siba Prasad');
  });
});
