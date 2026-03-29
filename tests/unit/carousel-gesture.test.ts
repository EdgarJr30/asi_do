import { describe, expect, it } from 'vitest';

import {
  getTouchPanIntent,
  normalizeCarouselLoopOffset,
  normalizeCarouselTrackOffset,
} from '@/features/institutional/lib/carousel-gesture';

describe('getTouchPanIntent', () => {
  it('keeps small movements unlocked', () => {
    expect(getTouchPanIntent({ x: 6, y: 8 })).toBe('undetermined');
  });

  it('detects clear horizontal swipes', () => {
    expect(getTouchPanIntent({ x: 42, y: 12 })).toBe('horizontal');
    expect(getTouchPanIntent({ x: -38, y: 10 })).toBe('horizontal');
  });

  it('detects clear vertical scroll gestures', () => {
    expect(getTouchPanIntent({ x: 10, y: 40 })).toBe('vertical');
    expect(getTouchPanIntent({ x: -8, y: -34 })).toBe('vertical');
  });
});

describe('normalizeCarouselLoopOffset', () => {
  it('keeps the viewport inside the middle loop when it drifts too far left', () => {
    expect(normalizeCarouselLoopOffset(120, 600)).toBe(720);
  });

  it('keeps the viewport inside the middle loop when it drifts too far right', () => {
    expect(normalizeCarouselLoopOffset(1310, 600)).toBe(710);
    expect(normalizeCarouselLoopOffset(1910, 600)).toBe(710);
  });

  it('leaves valid middle-loop positions untouched', () => {
    expect(normalizeCarouselLoopOffset(760, 600)).toBe(760);
  });
});

describe('normalizeCarouselTrackOffset', () => {
  it('keeps the motion track inside the middle loop when it drifts too far right', () => {
    expect(normalizeCarouselTrackOffset(-120, 600)).toBe(-720);
  });

  it('keeps the motion track inside the middle loop when it drifts too far left', () => {
    expect(normalizeCarouselTrackOffset(-1310, 600)).toBe(-710);
    expect(normalizeCarouselTrackOffset(-1910, 600)).toBe(-710);
  });

  it('leaves valid middle-loop offsets untouched', () => {
    expect(normalizeCarouselTrackOffset(-760, 600)).toBe(-760);
  });
});
