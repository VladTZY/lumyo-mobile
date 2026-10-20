// Works out how far to scroll so the cited passage sits near the top of the
// viewport. Pure module: no imports.

export type PassageScrollInput = {
  // Height of the text before the passage, laid out in the body's width.
  prefixHeight: number;
  lineHeight: number;
  // Y of the body inside the outer ScrollView.
  bodyY: number;
  viewportHeight: number;
  // Fraction of the viewport to leave above the passage.
  ratio: number;
  // Set when the body itself scrolls (the web textarea has a fixed height).
  innerViewportHeight?: number;
};

export type PassageScroll = { outerY: number; innerTop: number };

export function passageScroll(i: PassageScrollInput): PassageScroll {
  const lineTop = Math.max(0, i.prefixHeight - i.lineHeight);
  const innerTop = i.innerViewportHeight === undefined
    ? 0
    : Math.max(0, lineTop - i.innerViewportHeight * i.ratio);
  const outerY = i.bodyY + (lineTop - innerTop) - i.viewportHeight * i.ratio;
  if (!Number.isFinite(outerY) || !Number.isFinite(innerTop)) return { outerY: 0, innerTop: 0 };
  return { outerY: Math.max(0, outerY), innerTop };
}
