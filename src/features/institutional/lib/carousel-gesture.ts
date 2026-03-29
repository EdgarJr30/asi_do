export type TouchPanIntent = 'horizontal' | 'vertical' | 'undetermined';

const GESTURE_LOCK_THRESHOLD = 14;
const GESTURE_AXIS_RATIO = 1.15;

export function getTouchPanIntent(offset: {
  x: number;
  y: number;
}): TouchPanIntent {
  const absX = Math.abs(offset.x);
  const absY = Math.abs(offset.y);

  if (absX < GESTURE_LOCK_THRESHOLD && absY < GESTURE_LOCK_THRESHOLD) {
    return 'undetermined';
  }

  if (absX > absY * GESTURE_AXIS_RATIO) {
    return 'horizontal';
  }

  if (absY > absX * GESTURE_AXIS_RATIO) {
    return 'vertical';
  }

  return 'undetermined';
}

export function normalizeCarouselLoopOffset(
  scrollLeft: number,
  setWidth: number
): number {
  if (setWidth <= 0) {
    return scrollLeft;
  }

  let normalized = scrollLeft;
  const min = setWidth * 0.5;
  const max = setWidth * 1.5;

  while (normalized < min) {
    normalized += setWidth;
  }

  while (normalized >= max) {
    normalized -= setWidth;
  }

  return normalized;
}

export function normalizeCarouselTrackOffset(
  trackOffset: number,
  setWidth: number
): number {
  return -normalizeCarouselLoopOffset(-trackOffset, setWidth);
}
