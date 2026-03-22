import { Connection } from '../domain/connection';
import { SELECTORS } from './selectors';

export function parseConnections(root: Document | Element): Connection[] {
  const cards = Array.from(root.querySelectorAll(SELECTORS.CARD));
  return cards.map(parseCard).filter((c): c is Connection => c !== null);
}

function parseCard(card: Element): Connection | null {
  // --- Name and headline ---
  // The text profile link (no inline style) wraps both the name <p> and headline <p>.
  // querySelectorAll('p') returns them in document order: name first, headline second.
  const textLink = card.querySelector(SELECTORS.PROFILE_TEXT_LINK);
  const paragraphs = textLink ? Array.from(textLink.querySelectorAll('p')) : [];
  const name = paragraphs[0]?.textContent?.trim() ?? '';
  if (!name) return null;
  const headline = paragraphs[1]?.textContent?.trim() ?? '';

  // --- Profile URL ---
  // Both the photo link and the text link share the same href; use the first match.
  const profileLinkEl = card.querySelector(SELECTORS.PROFILE_LINK) as HTMLAnchorElement | null;
  const profileUrl = profileLinkEl?.href ?? '';

  // --- Connected date ---
  // Identified by text content starting with "Connected on", not by class name.
  const connectedOn =
    Array.from(card.querySelectorAll('p'))
      .find((p) => p.textContent?.trim().startsWith('Connected on'))
      ?.textContent?.trim() ?? '';

  // --- Message URL ---
  const msgEl = card.querySelector(SELECTORS.MESSAGE_LINK) as HTMLAnchorElement | null;
  const messageUrl = msgEl?.href ?? '';

  return { name, profileUrl, headline, connectedOn, messageUrl };
}
