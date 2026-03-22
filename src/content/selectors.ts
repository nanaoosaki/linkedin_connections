/**
 * All LinkedIn DOM selectors in one place.
 *
 * Selector stability notes:
 *   HIGH stability   — structural attributes LinkedIn ships for accessibility/testing
 *   MEDIUM stability — href patterns tied to URL scheme, unlikely to change
 *   LOW stability    — obfuscated class names (change on each LinkedIn deploy)
 *
 * This module intentionally contains NO obfuscated class names.
 * Name, headline, and connected-date are extracted by structure and text pattern
 * in parser.ts rather than by class.
 */
export const SELECTORS = {
  /** HIGH — list container; LinkedIn uses data-testid for its own QA */
  LIST: '[data-testid="lazy-column"]',

  /** HIGH — each visible card is a direct child componentkey element inside the display-contents wrapper */
  CARD: '[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]',

  /**
   * MEDIUM — profile text link (wraps name + headline).
   * Distinguished from the photo link by the absence of an inline style attribute.
   * The photo thumbnail anchor always carries style="height:7.2rem;width:7.2rem";
   * the text link never has an inline style.
   */
  PROFILE_TEXT_LINK: 'a[href*="linkedin.com/in/"]:not([style])',

  /** MEDIUM — any profile link; used to extract the href */
  PROFILE_LINK: 'a[href*="linkedin.com/in/"]',

  /** MEDIUM — compose message deep-link */
  MESSAGE_LINK: 'a[href*="/messaging/compose/"]',

  /**
   * HIGH stability — exact visible text of LinkedIn's "Load more" button.
   * The button has no data-testid, id, or aria-label — only obfuscated class names.
   * Text content is the most stable hook available.
   * Used in index.ts: find button by textContent === LOAD_MORE_BUTTON_TEXT, then click.
   * Button absence signals all connections are loaded (natural loop stop condition).
   */
  LOAD_MORE_BUTTON_TEXT: 'Load more',
} as const;
