import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Quote,
} from 'lucide-react';
// import { Link } from 'react-router-dom';

import { surfacePaths } from '@/app/router/surface-paths';
import './institutional-home-page.css';
import {
  InstitutionalActionLink,
  InstitutionalCard,
  InstitutionalLead,
  InstitutionalSection,
} from '@/features/institutional/components/institutional-ui';
import {
  homeCarouselCards,
  homeEcosystemCards,
  homeHeroMetrics,
  homeHeroSlides,
  homeProgramShowcase,
  homeTestimonials,
} from '@/features/institutional/content/site-content';
import {
  getTouchPanIntent,
  normalizeCarouselLoopOffset,
} from '@/features/institutional/lib/carousel-gesture';
import { cn } from '@/lib/utils/cn';

function wrapIndex(index: number, length: number) {
  return (index + length) % length;
}

function getVisibleItems<T>(
  items: readonly T[],
  startIndex: number,
  count: number
) {
  return Array.from(
    { length: count },
    (_, offset) => items[wrapIndex(startIndex + offset, items.length)]
  );
}

function getSwipeDirection(info: {
  offset: { x: number };
  velocity: { x: number };
}) {
  if (info.offset.x <= -70 || info.velocity.x <= -320) {
    return 'next';
  }

  if (info.offset.x >= 70 || info.velocity.x >= 320) {
    return 'prev';
  }

  return 'stay';
}

function AnimatedMetricValue({ value }: { value: string }) {
  const numericValue = Number.parseInt(value.replace(/\D/g, ''), 10);
  const suffix = value.replace(/[0-9]/g, '');
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (Number.isNaN(numericValue)) {
      return;
    }

    let frame = 0;
    const start = window.performance.now();
    const duration = 1100;

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(numericValue * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [numericValue]);

  if (Number.isNaN(numericValue)) {
    return <>{value}</>;
  }

  return (
    <>
      {displayValue}
      {suffix}
    </>
  );
}

function FloatingEcosystemMedia({
  children,
  floatIndex,
}: {
  children: ReactNode;
  floatIndex: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [hoverOffset, setHoverOffset] = useState({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
  });

  const floatAmplitude = 7 + floatIndex * 1.5;
  const floatDuration = 7.6 + floatIndex * 0.55;

  return (
    <motion.div
      className="h-full"
      animate={
        shouldReduceMotion
          ? undefined
          : {
              y: [0, -floatAmplitude, 0, floatAmplitude * 0.68, 0]
            }
      }
      transition={{
        duration: floatDuration,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut',
        delay: floatIndex * 0.32,
      }}
    >
      <motion.div
        className="h-full"
        animate={shouldReduceMotion ? undefined : hoverOffset}
        transition={{
          type: 'spring',
          stiffness: 94,
          damping: 22,
          mass: 0.88,
        }}
        onMouseLeave={() => {
          setHoverOffset({
            x: 0,
            y: 0,
            rotate: 0,
            scale: 1,
          });
        }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
          const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
          const intensity = Math.min(
            1,
            Math.max(Math.abs(normalizedX), Math.abs(normalizedY)) * 2
          );

          setHoverOffset({
            x: normalizedX * 14,
            y: normalizedY * 11,
            rotate: normalizedX * 2.4,
            scale: 1 + intensity * 0.018,
          });
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function InstitutionalHomePage() {
  const shouldReduceMotion = useReducedMotion();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [heroInteractionTick, setHeroInteractionTick] = useState(0);
  const [testimonialInteractionTick, setTestimonialInteractionTick] =
    useState(0);
  const [platformVideoReady, setPlatformVideoReady] = useState(true);
  const carouselViewportRef = useRef<HTMLDivElement | null>(null);
  const carouselPrimarySetRef = useRef<HTMLDivElement | null>(null);
  const carouselSetWidthRef = useRef(0);
  const carouselAnimationFrameRef = useRef(0);
  const isCarouselHoveredRef = useRef(false);
  const isCarouselTouchingRef = useRef(false);
  const carouselTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const carouselTouchIntentRef = useRef<
    'horizontal' | 'vertical' | 'undetermined'
  >('undetermined');
  const carouselResumeTimeoutRef = useRef<number | null>(null);
  const carouselScrollSettleTimeoutRef = useRef<number | null>(null);
  const platformDemoVideoPath = '/media/demoApp.mp4';
  const christianEventVideoPath = '/media/christian-event.mp4';

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveHeroIndex((current) =>
        wrapIndex(current + 1, homeHeroSlides.length)
      );
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [activeHeroIndex, heroInteractionTick, shouldReduceMotion]);

  useEffect(() => {
    homeHeroSlides.forEach((slide) => {
      const image = new window.Image();
      image.src = slide.image;
    });

    homeCarouselCards.forEach((item) => {
      if (!item.image) {
        return;
      }

      const image = new window.Image();
      image.src = item.image;
    });
  }, []);

  useEffect(() => {
    const syncCarouselMeasurements = () => {
      const viewport = carouselViewportRef.current;
      const primarySet = carouselPrimarySetRef.current;

      if (!viewport || !primarySet) {
        return;
      }

      const trackStyles = window.getComputedStyle(primarySet);
      const gap = Number.parseFloat(trackStyles.gap || '0');

      const nextSetWidth = primarySet.getBoundingClientRect().width + gap;

      if (nextSetWidth <= 0) {
        return;
      }

      const previousSetWidth = carouselSetWidthRef.current;
      carouselSetWidthRef.current = nextSetWidth;

      if (previousSetWidth <= 0) {
        viewport.scrollLeft = nextSetWidth;
        return;
      }

      const relativeOffset = viewport.scrollLeft - previousSetWidth;
      viewport.scrollLeft = normalizeCarouselLoopOffset(
        nextSetWidth + relativeOffset,
        nextSetWidth
      );
    };

    syncCarouselMeasurements();
    const observer = new ResizeObserver(() => {
      syncCarouselMeasurements();
    });

    if (carouselPrimarySetRef.current) {
      observer.observe(carouselPrimarySetRef.current);
    }

    if (carouselViewportRef.current) {
      observer.observe(carouselViewportRef.current);
    }

    window.addEventListener('resize', syncCarouselMeasurements);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncCarouselMeasurements);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (carouselResumeTimeoutRef.current !== null) {
        window.clearTimeout(carouselResumeTimeoutRef.current);
      }

      if (carouselScrollSettleTimeoutRef.current !== null) {
        window.clearTimeout(carouselScrollSettleTimeoutRef.current);
      }

      window.cancelAnimationFrame(carouselAnimationFrameRef.current);
    };
  }, []);

  const resumeCarouselAfterSettle = () => {
    if (carouselResumeTimeoutRef.current !== null) {
      window.clearTimeout(carouselResumeTimeoutRef.current);
    }

    carouselResumeTimeoutRef.current = window.setTimeout(() => {
      if (!isCarouselHoveredRef.current && !isCarouselTouchingRef.current) {
        setIsCarouselPaused(false);
      }
    }, 480);
  };

  const scheduleCarouselLoopNormalization = (viewport: HTMLDivElement) => {
    if (carouselScrollSettleTimeoutRef.current !== null) {
      window.clearTimeout(carouselScrollSettleTimeoutRef.current);
    }

    carouselScrollSettleTimeoutRef.current = window.setTimeout(() => {
      recirculateCarouselViewport(viewport);
    }, 140);
  };

  const recirculateCarouselViewport = (viewport: HTMLDivElement) => {
    const setWidth = carouselSetWidthRef.current;

    if (setWidth <= 0) {
      return;
    }

    const normalizedLeft = normalizeCarouselLoopOffset(
      viewport.scrollLeft,
      setWidth
    );

    if (Math.abs(normalizedLeft - viewport.scrollLeft) > 0.5) {
      viewport.scrollLeft = normalizedLeft;
    }
  };

  useEffect(() => {
    if (shouldReduceMotion || isCarouselPaused) {
      return;
    }

    const viewport = carouselViewportRef.current;

    if (!viewport) {
      return;
    }

    let lastTimestamp = window.performance.now();

    const tick = (timestamp: number) => {
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const boundedDelta = Math.min(delta, 32);

      const nextLeft = normalizeCarouselLoopOffset(
        viewport.scrollLeft + boundedDelta * 0.045,
        carouselSetWidthRef.current
      );

      viewport.scrollLeft = nextLeft;

      carouselAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    carouselAnimationFrameRef.current = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(carouselAnimationFrameRef.current);
  }, [isCarouselPaused, shouldReduceMotion]);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveTestimonialIndex((current) =>
        wrapIndex(current + 1, homeTestimonials.length)
      );
    }, 6400);

    return () => window.clearTimeout(timer);
  }, [activeTestimonialIndex, testimonialInteractionTick, shouldReduceMotion]);

  const goToHeroSlide = (nextIndex: number) => {
    setHeroInteractionTick((current) => current + 1);
    setActiveHeroIndex(wrapIndex(nextIndex, homeHeroSlides.length));
  };

  const stepHeroSlide = (direction: 'next' | 'prev') => {
    goToHeroSlide(activeHeroIndex + (direction === 'next' ? 1 : -1));
  };

  const goToTestimonialSlide = (nextIndex: number) => {
    setTestimonialInteractionTick((current) => current + 1);
    setActiveTestimonialIndex(wrapIndex(nextIndex, homeTestimonials.length));
  };

  const stepTestimonialSlide = (direction: 'next' | 'prev') => {
    goToTestimonialSlide(
      activeTestimonialIndex + (direction === 'next' ? 1 : -1)
    );
  };

  const activeHero = homeHeroSlides[activeHeroIndex];
  const isImageOnlyHero = activeHero.contentMode === 'image-only';
  const visibleTestimonials = useMemo(
    () => getVisibleItems(homeTestimonials, activeTestimonialIndex, 3),
    [activeTestimonialIndex]
  );
  const heroControls = (
    <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-8 sm:pb-8 lg:px-12 lg:pb-10 xl:px-16">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {homeHeroSlides.map((slide, index) => (
            <button
              key={slide.title}
              aria-label={`Ir al slide ${index + 1}`}
              className={cn(
                'h-2.5 rounded-full transition-all',
                index === activeHeroIndex
                  ? 'w-9 bg-white'
                  : 'w-2.5 bg-white/28 hover:bg-white/48'
              )}
              type="button"
              onClick={() => goToHeroSlide(index)}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            aria-label="Ver slide anterior"
            className="institutional-home__hero-control flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/92 text-(--asi-primary) transition hover:bg-white"
            type="button"
            onClick={() => stepHeroSlide('prev')}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            aria-label="Ver slide siguiente"
            className="institutional-home__hero-control flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/92 text-(--asi-primary) transition hover:bg-white"
            type="button"
            onClick={() => stepHeroSlide('next')}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <InstitutionalSection spacing="none" tone="transparent">
        <div className="space-y-8 sm:space-y-10">
          <motion.div
            className="institutional-home__hero-shell relative overflow-hidden bg-(--asi-primary) shadow-(--asi-shadow-strong) sm:-mx-7 lg:-mx-10 xl:-mx-14"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            style={{
              cursor: 'default',
              touchAction: 'pan-y',
              userSelect: 'none',
            }}
            onPanEnd={(_, info) => {
              const direction = getSwipeDirection(info);

              if (direction === 'next') {
                stepHeroSlide('next');
              }

              if (direction === 'prev') {
                stepHeroSlide('prev');
              }
            }}
          >
            <div className="asi-hero-frame relative">
              {homeHeroSlides.map((slide, index) => (
                <motion.div
                  key={slide.image}
                  className="absolute inset-0"
                  initial={false}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: index === activeHeroIndex ? 1 : 0 }
                      : {
                          opacity: index === activeHeroIndex ? 1 : 0,
                          scale: index === activeHeroIndex ? 1 : 1.015,
                        }
                  }
                >
                  {slide.contentMode === 'image-only' ? (
                    <>
                      <div className="institutional-home__image-backdrop absolute inset-0 overflow-hidden">
                        <img
                          alt=""
                          aria-hidden="true"
                          className="institutional-home__image-glow h-full w-full object-cover opacity-55"
                          loading="lazy"
                          src={slide.image}
                        />
                        <div className="institutional-home__image-overlay absolute inset-0" />
                        <div className="institutional-home__image-fade absolute inset-x-0 bottom-0 h-28 sm:h-32" />
                      </div>

                      <div className="absolute inset-x-3 inset-y-3 flex items-center justify-center pb-22 sm:inset-x-8 sm:inset-y-8 sm:pb-28 lg:inset-x-12 lg:inset-y-10 lg:pb-32 xl:inset-x-16">
                        <img
                          alt={slide.imageAlt}
                          className="institutional-home__image-frame max-h-full w-auto max-w-full rounded-3xl object-contain"
                          loading="lazy"
                          src={slide.image}
                        />
                      </div>
                    </>
                  ) : (
                    <img
                      alt={slide.imageAlt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={slide.image}
                    />
                  )}
                </motion.div>
              ))}

              {!isImageOnlyHero ? (
                <>
                  <div className="institutional-home__hero-overlay absolute inset-0" />
                  <div className="institutional-home__hero-fade absolute inset-x-0 bottom-0 h-48 sm:h-44" />
                </>
              ) : null}

              <div
                className={cn(
                  'relative z-10 flex h-full flex-col px-5 py-6 pb-24 sm:px-8 sm:py-8 sm:pb-28 lg:px-12 lg:py-10 lg:pb-32 xl:px-16',
                  isImageOnlyHero ? 'justify-start' : 'justify-between'
                )}
              >
                {!isImageOnlyHero ? (
                  <>
                    <div className="max-w-2xl">
                      <AnimatePresence initial={false} mode="wait">
                        <motion.div
                          key={activeHero.title}
                          initial={
                            shouldReduceMotion ? false : { opacity: 0, y: 18 }
                          }
                          transition={{
                            duration: 0.52,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          animate={
                            shouldReduceMotion
                              ? undefined
                              : { opacity: 1, y: 0 }
                          }
                          exit={
                            shouldReduceMotion
                              ? undefined
                              : { opacity: 0, y: -10 }
                          }
                        >
                          <motion.h1
                            className="institutional-home__hero-title mt-4 font-semibold text-white"
                            initial="hidden"
                            animate="show"
                            exit="hidden"
                            variants={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    hidden: {},
                                    show: {
                                      transition: {
                                        staggerChildren: 0.05,
                                        delayChildren: 0.04,
                                      },
                                    },
                                  }
                            }
                          >
                            {activeHero.title.split(' ').map((word, index) => (
                              <motion.span
                                key={`${activeHero.title}-${word}-${index}`}
                                className="institutional-home__hero-word inline-block last:mr-0"
                                variants={
                                  shouldReduceMotion
                                    ? undefined
                                    : {
                                        hidden: {
                                          opacity: 0,
                                          y: 24,
                                          filter: 'blur(8px)',
                                        },
                                        show: {
                                          opacity: 1,
                                          y: 0,
                                          filter: 'blur(0px)',
                                        },
                                      }
                                }
                                transition={{
                                  duration: 0.34,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              >
                                {word}
                              </motion.span>
                            ))}
                          </motion.h1>
                          <p className="institutional-home__hero-description mt-4 text-white/84">
                            {activeHero.description}
                          </p>
                        </motion.div>
                      </AnimatePresence>

                      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <InstitutionalActionLink
                          action={activeHero.primaryAction}
                          className="min-h-14 w-full justify-center sm:min-w-46 sm:w-auto"
                        />
                        <InstitutionalActionLink
                          action={activeHero.secondaryAction}
                          className="min-h-14 w-full justify-center border border-white/30 bg-white/8 text-white hover:bg-white/14 sm:min-w-46 sm:w-auto"
                        />
                      </div>
                    </div>

                    <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
                      <div className="grid gap-3 sm:max-w-xl sm:grid-cols-3">
                        {homeHeroMetrics.map((metric) => (
                          <motion.div
                            key={metric.label}
                            className="rounded-3xl border border-white/10 bg-white/12 p-4 backdrop-blur-md"
                            transition={{ duration: 0.3 }}
                            whileHover={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    y: -3,
                                    backgroundColor: 'rgba(255,255,255,0.14)',
                                  }
                            }
                          >
                            <p className="institutional-home__metric-value text-2xl font-semibold tracking-tight text-white">
                              <AnimatedMetricValue value={metric.value} />
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {metric.label}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              {heroControls}
            </div>
          </motion.div>

          <motion.div
            className="institutional-home__carousel-shell py-4 sm:-mx-7 sm:py-5 lg:-mx-10 xl:-mx-14"
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: 10, scale: 0.988, filter: 'blur(10px)' }
            }
            transition={{ duration: 0.86, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, amount: 0.24 }}
            whileInView={
              shouldReduceMotion
                ? undefined
                : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
            }
          >
            <div
              ref={carouselViewportRef}
              aria-label="Historias destacadas de ASI"
              className="institutional-home__carousel-viewport overflow-x-auto overflow-y-hidden"
              onMouseEnter={() => {
                isCarouselHoveredRef.current = true;
                setIsCarouselPaused(true);
              }}
              onMouseLeave={() => {
                isCarouselHoveredRef.current = false;
                setIsCarouselPaused(false);
              }}
              onTouchStart={(event) => {
                const touch = event.touches[0];

                if (!touch) {
                  return;
                }

                carouselTouchStartRef.current = {
                  x: touch.clientX,
                  y: touch.clientY,
                };
                carouselTouchIntentRef.current = 'undetermined';
                isCarouselTouchingRef.current = false;
              }}
              onTouchMove={(event) => {
                const touch = event.touches[0];
                const touchStart = carouselTouchStartRef.current;

                if (
                  !touch ||
                  !touchStart ||
                  carouselTouchIntentRef.current !== 'undetermined'
                ) {
                  return;
                }

                const nextIntent = getTouchPanIntent({
                  x: touch.clientX - touchStart.x,
                  y: touch.clientY - touchStart.y,
                });

                if (nextIntent === 'horizontal') {
                  carouselTouchIntentRef.current = nextIntent;
                  isCarouselTouchingRef.current = true;
                  setIsCarouselPaused(true);
                  return;
                }

                if (nextIntent === 'vertical') {
                  carouselTouchIntentRef.current = nextIntent;
                  isCarouselTouchingRef.current = false;
                  setIsCarouselPaused(false);
                }
              }}
              onTouchEnd={(event) => {
                carouselTouchStartRef.current = null;
                carouselTouchIntentRef.current = 'undetermined';
                isCarouselTouchingRef.current = false;
                scheduleCarouselLoopNormalization(event.currentTarget);

                resumeCarouselAfterSettle();
              }}
              onTouchCancel={(event) => {
                carouselTouchStartRef.current = null;
                carouselTouchIntentRef.current = 'undetermined';
                isCarouselTouchingRef.current = false;
                scheduleCarouselLoopNormalization(event.currentTarget);

                resumeCarouselAfterSettle();
              }}
              onScroll={(event) => {
                const viewport = event.currentTarget;
                scheduleCarouselLoopNormalization(viewport);
              }}
            >
              <div className="institutional-home__carousel-track">
                <div
                  aria-hidden="true"
                  className="institutional-home__carousel-set"
                >
                  {homeCarouselCards.map((item) => (
                    <article
                      key={`${item.title}-prefix`}
                      className="institutional-home__carousel-card overflow-hidden rounded-3xl shadow-(--asi-shadow-soft)"
                    >
                      {item.image ? (
                        <div className="relative h-88 sm:h-96 xl:h-108 2xl:h-112">
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            fetchPriority="high"
                            loading="eager"
                            src={item.image}
                          />
                          <div className="institutional-home__carousel-image-overlay absolute inset-0" />
                          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
                            <span className="rounded-full border border-white/16 bg-black/18 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/86 backdrop-blur-sm">
                              {item.meta ?? 'ASI'}
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 xl:p-7">
                            <p className="text-xl font-semibold tracking-tight text-white xl:text-[1.5rem]">
                              {item.title}
                            </p>
                            <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/86 xl:text-[1rem]">
                              {item.description}
                            </p>
                            <button
                              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/12 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
                              type="button"
                            >
                              Leer mas
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="institutional-home__carousel-quote flex h-full min-h-62 flex-col justify-between p-6 text-white">
                          <Quote className="size-8 text-white/72" />
                          <div>
                            <p className="text-lg font-medium leading-8 text-white/92">
                              {item.description}
                            </p>
                            <p className="institutional-home__eyebrow-meta mt-5 text-sm font-semibold uppercase text-white/62">
                              {item.meta}
                            </p>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div
                  ref={carouselPrimarySetRef}
                  className="institutional-home__carousel-set"
                  data-carousel-set="primary"
                >
                  {homeCarouselCards.map((item) => (
                    <motion.article
                      key={item.title}
                      className={cn(
                        'institutional-home__carousel-card overflow-hidden rounded-3xl shadow-(--asi-shadow-soft)'
                      )}
                      transition={{
                        type: 'spring',
                        stiffness: 220,
                        damping: 24,
                        mass: 0.7,
                      }}
                      layout
                    >
                      {item.image ? (
                        <div className="relative h-88 sm:h-96 xl:h-108 2xl:h-112">
                          <img
                            alt={item.imageAlt ?? item.title}
                            className="h-full w-full object-cover"
                            fetchPriority="high"
                            loading="eager"
                            src={item.image}
                          />
                          <div className="institutional-home__carousel-image-overlay absolute inset-0" />
                          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
                            <span className="rounded-full border border-white/16 bg-black/18 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/86 backdrop-blur-sm">
                              {item.meta ?? 'ASI'}
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 xl:p-7">
                            <p className="text-xl font-semibold tracking-tight text-white xl:text-[1.5rem]">
                              {item.title}
                            </p>
                            <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/86 xl:text-[1rem]">
                              {item.description}
                            </p>
                            <button
                              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/12 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
                              type="button"
                            >
                              Leer mas
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="institutional-home__carousel-quote flex h-full min-h-62 flex-col justify-between p-6 text-white">
                          <Quote className="size-8 text-white/72" />
                          <div>
                            <p className="text-lg font-medium leading-8 text-white/92">
                              {item.description}
                            </p>
                            <p className="institutional-home__eyebrow-meta mt-5 text-sm font-semibold uppercase text-white/62">
                              {item.meta}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.article>
                  ))}
                </div>

                <div
                  aria-hidden="true"
                  className="institutional-home__carousel-set"
                >
                  {homeCarouselCards.map((item) => (
                    <article
                      key={`${item.title}-duplicate`}
                      className="institutional-home__carousel-card overflow-hidden rounded-3xl shadow-(--asi-shadow-soft)"
                    >
                      {item.image ? (
                        <div className="relative h-88 sm:h-96 xl:h-108 2xl:h-112">
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            fetchPriority="high"
                            loading="eager"
                            src={item.image}
                          />
                          <div className="institutional-home__carousel-image-overlay absolute inset-0" />
                          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
                            <span className="rounded-full border border-white/16 bg-black/18 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/86 backdrop-blur-sm">
                              {item.meta ?? 'ASI'}
                            </span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 xl:p-7">
                            <p className="text-xl font-semibold tracking-tight text-white xl:text-[1.5rem]">
                              {item.title}
                            </p>
                            <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/86 xl:text-[1rem]">
                              {item.description}
                            </p>
                            <button
                              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/12 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
                              type="button"
                            >
                              Leer mas
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="institutional-home__carousel-quote flex h-full min-h-62 flex-col justify-between p-6 text-white">
                          <Quote className="size-8 text-white/72" />
                          <div>
                            <p className="text-lg font-medium leading-8 text-white/92">
                              {item.description}
                            </p>
                            <p className="institutional-home__eyebrow-meta mt-5 text-sm font-semibold uppercase text-white/62">
                              {item.meta}
                            </p>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="transparent">
        <div className="institutional-home__ecosystem-layout grid gap-8 xl:items-start">
          <div className="space-y-5">
            <InstitutionalLead
              content={{
                eyebrow: 'Nuestro ecosistema',
                title:
                  'Transformando vidas a través del compromiso laico y la fe.',
                description:
                  'ASI articula espacios de adoración, formación, membresía y servicio para acompañar a profesionales y familias que desean vivir una fe cristocéntrica con impacto visible en su comunidad.',
              }}
            />

            <InstitutionalCard className="institutional-home__event-card overflow-hidden border-white/70 bg-white/78 p-0 backdrop-blur-sm">
              <div className="institutional-home__event-shell relative min-h-56">
                <video
                  autoPlay
                  aria-label="Video breve de un evento cristiano comunitario"
                  className="pointer-events-none h-full w-full select-none object-cover"
                  controls={false}
                  controlsList="nofullscreen nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  disableRemotePlayback
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  tabIndex={-1}
                >
                  <source src={christianEventVideoPath} type="video/mp4" />
                </video>
                <div className="institutional-home__event-overlay absolute inset-0" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                  <div className="institutional-home__event-caption max-w-104 border border-white/30 px-4 py-3 backdrop-blur-md">
                    <p className="institutional-home__event-kicker text-xs font-semibold uppercase text-white/74">
                      Evento destacado
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/88">
                      Encuentro congregacional que muestra cómo la adoración,
                      la enseñanza bíblica y la vida en comunidad siguen
                      siendo el corazón informativo de nuestra misión.
                    </p>
                  </div>
                </div>
              </div>
            </InstitutionalCard>
          </div>

          <div className="institutional-home__ecosystem-grid grid gap-4">
            <InstitutionalCard
              className="institutional-home__ecosystem-floating-card p-0 md:row-span-2"
              hoverMotion={false}
            >
              <FloatingEcosystemMedia floatIndex={0}>
                <div className="relative h-full min-h-84 overflow-hidden rounded-[1.5rem]">
                  <img
                    alt={homeEcosystemCards[0].imageAlt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={homeEcosystemCards[0].image}
                  />
                  <div className="institutional-home__ecosystem-hero-overlay absolute inset-0" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="institutional-home__ecosystem-hero-title font-semibold leading-tight tracking-tight text-white">
                      {homeEcosystemCards[0].title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/82">
                      {homeEcosystemCards[0].description}
                    </p>
                  </div>
                </div>
              </FloatingEcosystemMedia>
            </InstitutionalCard>

            {homeEcosystemCards.slice(1).map((item, index) => (
              <InstitutionalCard
                key={item.title}
                className="institutional-home__ecosystem-floating-card p-0"
                hoverMotion={false}
              >
                {item.image ? (
                  <FloatingEcosystemMedia floatIndex={index + 1}>
                    <div className="institutional-home__ecosystem-card-media relative overflow-hidden rounded-[1.5rem]">
                      <img
                        alt={item.imageAlt ?? item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={item.image}
                      />
                      <div className="institutional-home__ecosystem-card-overlay absolute inset-0" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="institutional-home__card-title font-semibold tracking-tight text-white">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/82">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </FloatingEcosystemMedia>
                ) : (
                  <div className="p-5">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-(--asi-surface-muted) text-(--asi-primary)">
                      <Quote className="size-5" />
                    </div>
                    <p className="institutional-home__card-title mt-4 font-semibold tracking-tight text-(--asi-text)">
                      {item.title}
                    </p>
                    <p className="asi-copy mt-2">{item.description}</p>
                  </div>
                )}
              </InstitutionalCard>
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted">
        <div className="institutional-home__device-layout grid gap-8 xl:items-center">
          <motion.div
            className="mx-auto w-full max-w-76"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          >
            <div className="institutional-home__device-shell overflow-hidden rounded-4xl p-3">
              <div className="institutional-home__device-frame overflow-hidden">
                {platformVideoReady ? (
                  <video
                    autoPlay
                    aria-hidden="true"
                    className="institutional-home__device-media pointer-events-none w-full select-none object-cover"
                    controlsList="nofullscreen nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    loop
                    muted
                    playsInline
                    poster="/brand/asi-logo-effect.png"
                    preload="metadata"
                    tabIndex={-1}
                    onCanPlay={() => setPlatformVideoReady(true)}
                    onError={() => setPlatformVideoReady(false)}
                  >
                    <source src={platformDemoVideoPath} type="video/mp4" />
                  </video>
                ) : (
                  <div className="institutional-home__device-fallback px-5 py-6 text-white">
                    <img
                      alt="ASI app mark"
                      className="w-16"
                      loading="lazy"
                      src="/brand/asi-logo-white-transparent.png"
                    />
                    <p className="mt-5 text-lg font-semibold">
                      Demo lista para enlazar
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/80">
                      Coloca el archivo en{' '}
                      <span className="font-semibold text-white">
                        public/media/demoApp.mp4
                      </span>{' '}
                      y este bloque lo reproducirá automáticamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <div>
            <InstitutionalLead
              content={{
                eyebrow: 'Experiencia móvil',
                title: 'ASI en la palma de tu mano.',
                description:
                  'Una sección limpia y profesional para comunicar que la experiencia institucional y la plataforma pueden seguirse también desde móvil, sin romper el ritmo visual.',
              }}
            />
            <div className="mt-6 max-w-xl">
              <p className="asi-copy">
                Usamos un mockup elegante en lugar de una tarjeta genérica para
                reforzar continuidad de marca, claridad y intención editorial.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <InstitutionalActionLink
                action={{
                  label: 'Explorar plataforma',
                  to: surfacePaths.public.home,
                  variant: 'primary',
                }}
              />
              <InstitutionalActionLink
                action={{
                  label: 'Conocer comunidad',
                  to: surfacePaths.institutional.membership,
                  variant: 'secondary',
                }}
              />
            </div>
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection>
        <div className="space-y-8">
          <InstitutionalLead
            content={{
              eyebrow: 'Nuestros programas',
              title:
                'Programas presentados con una lectura más sobria, menos ruidosa y mejor proporcionada.',
              description:
                'Los títulos ahora viven en una escala más contenida y los cards aprovechan mejor el ancho del layout.',
            }}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {homeProgramShowcase.map((item) => (
              <InstitutionalCard
                key={item.title}
                className="overflow-hidden p-0"
              >
                <img
                  alt={item.imageAlt}
                  className="h-60 w-full object-cover"
                  loading="lazy"
                  src={item.image}
                />
                <div className="p-5">
                  <p className="institutional-home__program-title font-semibold tracking-tight text-(--asi-text)">
                    {item.title}
                  </p>
                  <p className="asi-copy mt-2">{item.description}</p>
                </div>
              </InstitutionalCard>
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted">
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <InstitutionalLead
              className="max-w-2xl"
              content={{
                eyebrow: 'Testimonios',
                title:
                  'Testimonios de fe y servicio con transición suave y controles discretos.',
                description:
                  'Este último carrusel mantiene el mismo lenguaje visual: movimiento calmado, cards legibles y control intuitivo.',
              }}
            />
            <div className="flex items-center gap-2">
              <button
                aria-label="Testimonio anterior"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-(--asi-primary) shadow-(--asi-shadow-soft) transition hover:bg-(--asi-surface-raised)"
                type="button"
                onClick={() => stepTestimonialSlide('prev')}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                aria-label="Testimonio siguiente"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-(--asi-primary) shadow-(--asi-shadow-soft) transition hover:bg-(--asi-surface-raised)"
                type="button"
                onClick={() => stepTestimonialSlide('next')}
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={`testimonial-${activeTestimonialIndex}`}
              className="asi-gesture-surface grid gap-4 lg:grid-cols-3"
              initial={shouldReduceMotion ? false : { opacity: 0.72 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              animate={shouldReduceMotion ? undefined : { opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0.72 }}
              drag={shouldReduceMotion ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.08}
              onDragEnd={(_, info) => {
                const direction = getSwipeDirection(info);

                if (direction === 'next') {
                  stepTestimonialSlide('next');
                }

                if (direction === 'prev') {
                  stepTestimonialSlide('prev');
                }
              }}
            >
              {visibleTestimonials.map((item, index) => (
                <motion.article
                  key={item.title}
                  className={cn(
                    'institutional-home__testimonial-card rounded-3xl p-6 text-white',
                    index > 0 && 'hidden lg:block'
                  )}
                  layout
                >
                  <Quote className="size-7 text-white/68" />
                  <p className="mt-4 text-lg leading-8 text-white/92">
                    {item.title}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-white/74">
                    {item.description}
                  </p>
                  <p className="institutional-home__eyebrow-meta mt-6 text-xs font-semibold uppercase text-white/58">
                    {item.meta}
                  </p>
                </motion.article>
              ))}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-2">
            {homeTestimonials.map((item, index) => (
              <button
                key={item.title}
                aria-label={`Ir al testimonio ${index + 1}`}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  index === activeTestimonialIndex
                    ? 'w-8 bg-(--asi-primary)'
                    : 'w-2.5 bg-(--asi-outline) hover:bg-(--asi-secondary)/40'
                )}
                type="button"
                onClick={() => goToTestimonialSlide(index)}
              />
            ))}
          </div>
        </div>
      </InstitutionalSection>
    </div>
  );
}
