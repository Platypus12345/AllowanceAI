const DEFAULT_SIZE = { width: 280, height: 200 };
const GAP = 12;
const PADDING = 16;

/**
 * Compute fixed viewport coordinates for a tooltip anchored to a day cell.
 * Prefers above + centered; flips left/up when near edges.
 */
export function computeTooltipPosition(anchorRect, size = DEFAULT_SIZE) {
  if (!anchorRect) return null;

  const { width: tw, height: th } = size;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceAbove = anchorRect.top - PADDING;
  const spaceBelow = vh - anchorRect.bottom - PADDING;
  const openUp = spaceAbove >= th + GAP || spaceAbove >= spaceBelow;

  const centerX = anchorRect.left + anchorRect.width / 2;

  const fitsCentered =
    centerX - tw / 2 >= PADDING && centerX + tw / 2 <= vw - PADDING;

  const openLeft =
    !fitsCentered &&
    (anchorRect.right + tw + GAP > vw - PADDING ||
      centerX + tw / 2 > vw - PADDING);

  const openRight =
    !fitsCentered &&
    !openLeft &&
    anchorRect.left - tw - GAP < PADDING;

  let left;
  let transformOriginX = '50%';

  if (openLeft) {
    left = anchorRect.left - GAP;
    transformOriginX = '100%';
  } else if (openRight) {
    left = anchorRect.right + GAP;
    transformOriginX = '0%';
  } else {
    left = centerX;
    transformOriginX = '50%';
  }

  let top;
  let transformOriginY = openUp ? '100%' : '0%';

  if (openUp) {
    top = anchorRect.top - GAP;
  } else {
    top = anchorRect.bottom + GAP;
  }

  // Convert anchor-relative placement to top-left pixel coords
  let x = left;
  let y = top;

  if (openLeft) {
    x = left - tw;
  } else if (openRight) {
    x = left;
  } else {
    x = left - tw / 2;
  }

  if (openUp) {
    y = top - th;
  }

  // Clamp within viewport
  x = Math.max(PADDING, Math.min(x, vw - tw - PADDING));
  y = Math.max(PADDING, Math.min(y, vh - th - PADDING));

  return {
    x,
    y,
    openUp,
    openLeft,
    openRight,
    centered: !openLeft && !openRight,
    transformOrigin: `${transformOriginX} ${transformOriginY}`,
  };
}

export const TOOLTIP_ESTIMATED_SIZE = DEFAULT_SIZE;
