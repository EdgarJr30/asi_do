import { useEffect, useMemo, useState } from 'react'

import { type PanInfo, AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { Link } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { InstitutionalActionLink, InstitutionalCard, InstitutionalCtaBand, InstitutionalLead, InstitutionalSection } from '@/features/institutional/components/institutional-ui'
import {
  homeCarouselCards,
  homeEcosystemCards,
  homeHeroMetrics,
  homeHeroSlides,
  homeProgramShowcase,
  homeTestimonials
} from '@/features/institutional/content/site-content'
import { cn } from '@/lib/utils/cn'

function wrapIndex(index: number, length: number) {
  return (index + length) % length
}

function getVisibleItems<T>(items: readonly T[], startIndex: number, count: number) {
  return Array.from({ length: count }, (_, offset) => items[wrapIndex(startIndex + offset, items.length)])
}

function getSwipeDirection(info: PanInfo) {
  if (info.offset.x <= -70 || info.velocity.x <= -320) {
    return 'next'
  }

  if (info.offset.x >= 70 || info.velocity.x >= 320) {
    return 'prev'
  }

  return 'stay'
}

function AnimatedMetricValue({ value }: { value: string }) {
  const numericValue = Number.parseInt(value.replace(/\D/g, ''), 10)
  const suffix = value.replace(/[0-9]/g, '')
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (Number.isNaN(numericValue)) {
      return
    }

    let frame = 0
    const start = window.performance.now()
    const duration = 1100

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplayValue(Math.round(numericValue * eased))

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick)
      }
    }

    frame = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(frame)
  }, [numericValue])

  if (Number.isNaN(numericValue)) {
    return <>{value}</>
  }

  return (
    <>
      {displayValue}
      {suffix}
    </>
  )
}

export function InstitutionalHomePage() {
  const shouldReduceMotion = useReducedMotion()
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0)
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0)
  const [heroInteractionTick, setHeroInteractionTick] = useState(0)
  const [carouselInteractionTick, setCarouselInteractionTick] = useState(0)
  const [testimonialInteractionTick, setTestimonialInteractionTick] = useState(0)
  const [platformVideoReady, setPlatformVideoReady] = useState(true)
  const platformDemoVideoPath = '/media/demoApp.mp4'
  const christianEventVideoPath = '/media/christian-event.mp4'

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }

    const timer = window.setTimeout(() => {
      setActiveHeroIndex((current) => wrapIndex(current + 1, homeHeroSlides.length))
    }, 7000)

    return () => window.clearTimeout(timer)
  }, [activeHeroIndex, heroInteractionTick, shouldReduceMotion])

  useEffect(() => {
    homeHeroSlides.forEach((slide) => {
      const image = new window.Image()
      image.src = slide.image
    })
  }, [])

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }

    const timer = window.setTimeout(() => {
      setActiveCarouselIndex((current) => wrapIndex(current + 1, homeCarouselCards.length))
    }, 5200)

    return () => window.clearTimeout(timer)
  }, [activeCarouselIndex, carouselInteractionTick, shouldReduceMotion])

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }

    const timer = window.setTimeout(() => {
      setActiveTestimonialIndex((current) => wrapIndex(current + 1, homeTestimonials.length))
    }, 6400)

    return () => window.clearTimeout(timer)
  }, [activeTestimonialIndex, testimonialInteractionTick, shouldReduceMotion])

  const goToHeroSlide = (nextIndex: number) => {
    setHeroInteractionTick((current) => current + 1)
    setActiveHeroIndex(wrapIndex(nextIndex, homeHeroSlides.length))
  }

  const stepHeroSlide = (direction: 'next' | 'prev') => {
    goToHeroSlide(activeHeroIndex + (direction === 'next' ? 1 : -1))
  }

  const goToCarouselSlide = (nextIndex: number) => {
    setCarouselInteractionTick((current) => current + 1)
    setActiveCarouselIndex(wrapIndex(nextIndex, homeCarouselCards.length))
  }

  const stepCarouselSlide = (direction: 'next' | 'prev') => {
    goToCarouselSlide(activeCarouselIndex + (direction === 'next' ? 1 : -1))
  }

  const goToTestimonialSlide = (nextIndex: number) => {
    setTestimonialInteractionTick((current) => current + 1)
    setActiveTestimonialIndex(wrapIndex(nextIndex, homeTestimonials.length))
  }

  const stepTestimonialSlide = (direction: 'next' | 'prev') => {
    goToTestimonialSlide(activeTestimonialIndex + (direction === 'next' ? 1 : -1))
  }

  const activeHero = homeHeroSlides[activeHeroIndex]
  const visibleCarouselCards = useMemo(
    () => getVisibleItems(homeCarouselCards, activeCarouselIndex, 3),
    [activeCarouselIndex]
  )
  const visibleTestimonials = useMemo(
    () => getVisibleItems(homeTestimonials, activeTestimonialIndex, 3),
    [activeTestimonialIndex]
  )

  return (
    <div>
      <InstitutionalSection className="!pt-0 !pb-0">
        <div className="space-y-8 sm:space-y-10">
          <motion.div
            className="relative overflow-hidden rounded-[2rem] bg-[var(--asi-primary)] shadow-[var(--asi-shadow-strong)] sm:-mx-7 sm:rounded-[2.4rem] lg:-mx-10 xl:-mx-14"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            style={{ cursor: 'default', touchAction: 'pan-y', userSelect: 'none' }}
            onPanEnd={(_, info) => {
              const direction = getSwipeDirection(info)

              if (direction === 'next') {
                stepHeroSlide('next')
              }

              if (direction === 'prev') {
                stepHeroSlide('prev')
              }
            }}
          >
            <div className="asi-hero-frame relative">
              {homeHeroSlides.map((slide, index) => (
                <motion.img
                  key={slide.image}
                  alt={slide.imageAlt}
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={false}
                  loading="lazy"
                  src={slide.image}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: index === activeHeroIndex ? 1 : 0 }
                      : {
                          opacity: index === activeHeroIndex ? 1 : 0,
                          scale: index === activeHeroIndex ? 1 : 1.015
                        }
                  }
                />
              ))}

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,22,44,0.36)_0%,rgba(14,26,47,0.52)_30%,rgba(10,20,39,0.72)_64%,rgba(8,16,33,0.9)_100%)] sm:bg-[linear-gradient(90deg,rgba(24,35,61,0.68)_0%,rgba(22,34,60,0.38)_42%,rgba(0,69,153,0.38)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,rgba(248,249,250,0)_0%,rgba(248,249,250,0.95)_100%)] sm:h-44" />

              <div className="relative flex h-full flex-col justify-between px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 xl:px-16">
                <div className="max-w-[42rem]">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      key={activeHero.title}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                    >
                      <motion.h1
                        className="mt-4 max-w-[9.5ch] text-[2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:max-w-[11ch] sm:text-[2.6rem] lg:text-[3.35rem] xl:text-[3.8rem]"
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
                                    delayChildren: 0.04
                                  }
                                }
                              }
                        }
                      >
                        {activeHero.title.split(' ').map((word, index) => (
                          <motion.span
                            key={`${activeHero.title}-${word}-${index}`}
                            className="mr-[0.22em] inline-block last:mr-0"
                            variants={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
                                    show: { opacity: 1, y: 0, filter: 'blur(0px)' }
                                  }
                            }
                            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {word}
                          </motion.span>
                        ))}
                      </motion.h1>
                      <p className="mt-4 max-w-[31rem] text-[1rem] leading-7 text-white/84 sm:max-w-[34rem] sm:text-base sm:leading-7">
                        {activeHero.description}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <InstitutionalActionLink action={activeHero.primaryAction} className="min-h-14 w-full justify-center sm:min-w-[11.5rem] sm:w-auto" />
                    <InstitutionalActionLink
                      action={activeHero.secondaryAction}
                      className="min-h-14 w-full justify-center border border-white/30 bg-white/8 text-white hover:bg-white/14 sm:min-w-[11.5rem] sm:w-auto"
                    />
                  </div>
                </div>

                <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
                  <div className="grid gap-3 sm:max-w-[36rem] sm:grid-cols-3">
                    {homeHeroMetrics.map((metric) => (
                      <motion.div
                        key={metric.label}
                        className="rounded-[1.5rem] border border-white/10 bg-white/12 p-4 backdrop-blur-md"
                        transition={{ duration: 0.3 }}
                        whileHover={shouldReduceMotion ? undefined : { y: -3, backgroundColor: 'rgba(255,255,255,0.14)' }}
                      >
                        <p className="text-2xl font-semibold tracking-tight text-white sm:text-[1.85rem]">
                          <AnimatedMetricValue value={metric.value} />
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">{metric.label}</p>
                      </motion.div>
                    ))}
                  </div>
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
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/92 text-[var(--asi-primary)] shadow-[0_10px_30px_rgba(0,47,110,0.18)] transition hover:bg-white"
                        type="button"
                        onClick={() => stepHeroSlide('prev')}
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <button
                        aria-label="Ver slide siguiente"
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/92 text-[var(--asi-primary)] shadow-[0_10px_30px_rgba(0,47,110,0.18)] transition hover:bg-white"
                        type="button"
                        onClick={() => stepHeroSlide('next')}
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="rounded-[2rem] bg-white/92 px-3 py-4 shadow-[var(--asi-shadow-soft)] backdrop-blur-md sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-4 px-2 sm:px-1">
              <div>
                <p className="asi-kicker !px-0 !py-0 bg-transparent">Historias en movimiento</p>
                <h2 className="mt-2 text-[1.4rem] font-semibold tracking-tight text-[var(--asi-text)] sm:text-[1.7rem]">
                  Una sección de carrusel inmediata debajo del hero, con una lectura más editorial.
                </h2>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  aria-label="Tarjeta anterior"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--asi-surface-muted)] text-[var(--asi-primary)] transition hover:bg-white hover:shadow-[var(--asi-shadow-soft)]"
                  type="button"
                  onClick={() => stepCarouselSlide('prev')}
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  aria-label="Tarjeta siguiente"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--asi-surface-muted)] text-[var(--asi-primary)] transition hover:bg-white hover:shadow-[var(--asi-shadow-soft)]"
                  type="button"
                  onClick={() => stepCarouselSlide('next')}
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>

            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={`carousel-${activeCarouselIndex}`}
                className="asi-gesture-surface mt-5 grid gap-4 lg:grid-cols-3"
                initial={shouldReduceMotion ? false : { opacity: 0.72 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                animate={shouldReduceMotion ? undefined : { opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0.72 }}
                drag={shouldReduceMotion ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  const direction = getSwipeDirection(info)

                  if (direction === 'next') {
                    stepCarouselSlide('next')
                  }

                  if (direction === 'prev') {
                    stepCarouselSlide('prev')
                  }
                }}
              >
                {visibleCarouselCards.map((item, index) => (
                  <motion.article
                    key={item.title}
                    className={cn(
                      'overflow-hidden rounded-[1.5rem] bg-[var(--asi-surface-muted)] shadow-[var(--asi-shadow-soft)]',
                      index > 0 && 'hidden lg:block'
                    )}
                    layout
                  >
                    {item.image ? (
                      <div className="relative h-[15.5rem]">
                        <img alt={item.imageAlt ?? item.title} className="h-full w-full object-cover" loading="lazy" src={item.image} />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(18,28,48,0.72)_100%)]" />
                        <div className="absolute inset-x-0 bottom-0 p-5">
                          <p className="text-xl font-semibold tracking-tight text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-white/84">{item.description}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[15.5rem] flex-col justify-between bg-[linear-gradient(135deg,rgba(24,35,61,0.9)_0%,rgba(0,69,153,0.7)_100%)] p-6 text-white">
                        <Quote className="size-8 text-white/72" />
                        <div>
                          <p className="text-lg font-medium leading-8 text-white/92">{item.description}</p>
                          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-white/62">{item.meta}</p>
                        </div>
                      </div>
                    )}
                  </motion.article>
                ))}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center justify-center gap-2">
              {homeCarouselCards.map((item, index) => (
                <button
                  key={item.title}
                  aria-label={`Ir a la tarjeta ${index + 1}`}
                  className={cn(
                    'h-2.5 rounded-full transition-all',
                    index === activeCarouselIndex ? 'w-8 bg-[var(--asi-primary)]' : 'w-2.5 bg-[var(--asi-outline)] hover:bg-[var(--asi-secondary)]/40'
                  )}
                  type="button"
                  onClick={() => goToCarouselSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start">
          <div className="space-y-5">
            <InstitutionalLead
              content={{
                eyebrow: 'Nuestro ecosistema',
                title: 'Transformando vidas a través del compromiso laico y la fe.',
                description:
                  'La siguiente sección replica una lectura más cercana a tu referencia: mosaico editorial, jerarquía clara y tarjetas con mejor uso del espacio.'
              }}
            />

            <InstitutionalCard className="overflow-hidden border-white/70 bg-white/78 p-0 shadow-[0_24px_60px_rgba(9,22,47,0.12)] backdrop-blur-sm">
              <div className="relative aspect-[16/10] min-h-[14rem] bg-[linear-gradient(180deg,#dfe8f7_0%,#edf2fb_100%)]">
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
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,21,40,0.08)_0%,rgba(11,21,40,0.22)_100%)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                  <div className="max-w-[26rem] rounded-[1.15rem] border border-white/30 bg-[rgba(8,17,31,0.42)] px-4 py-3 backdrop-blur-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/74">Evento destacado</p>
                    <p className="mt-2 text-sm leading-6 text-white/88">
                      Encuentro breve de adoración y comunidad que acompaña esta lectura editorial sin competir con las imágenes del mosaico.
                    </p>
                  </div>
                </div>
              </div>
            </InstitutionalCard>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <InstitutionalCard className="overflow-hidden p-0 md:row-span-2">
              <div className="relative h-full min-h-[21rem]">
                <img
                  alt={homeEcosystemCards[0].imageAlt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={homeEcosystemCards[0].image}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(17,27,46,0.82)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-[1.55rem] font-semibold leading-tight tracking-tight text-white">
                    {homeEcosystemCards[0].title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/82">{homeEcosystemCards[0].description}</p>
                </div>
              </div>
            </InstitutionalCard>

            {homeEcosystemCards.slice(1).map((item) => (
              <InstitutionalCard key={item.title} className="overflow-hidden p-0">
                {item.image ? (
                  <div className="relative min-h-[10.35rem]">
                    <img alt={item.imageAlt ?? item.title} className="h-full w-full object-cover" loading="lazy" src={item.image} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(17,27,46,0.74)_100%)]" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="text-[1.18rem] font-semibold tracking-tight text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/82">{item.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex size-12 items-center justify-center rounded-[1rem] bg-[var(--asi-surface-muted)] text-[var(--asi-primary)]">
                      <Quote className="size-5" />
                    </div>
                    <p className="mt-4 text-[1.18rem] font-semibold tracking-tight text-[var(--asi-text)]">{item.title}</p>
                    <p className="asi-copy mt-2">{item.description}</p>
                  </div>
                )}
              </InstitutionalCard>
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted">
        <div className="grid gap-8 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)] xl:items-center">
          <motion.div
            className="mx-auto w-full max-w-[19rem]"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          >
            <div className="overflow-hidden rounded-[2rem] bg-[#0f1831] p-3 shadow-[0_26px_80px_rgba(0,47,110,0.18)]">
              <div className="overflow-hidden rounded-[1.45rem] bg-[#08111f]">
                {platformVideoReady ? (
                  <video
                    autoPlay
                    aria-hidden="true"
                    className="pointer-events-none aspect-[9/16] w-full select-none object-cover"
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
                  <div className="aspect-[9/16] bg-[linear-gradient(180deg,#17468f_0%,#0f2f67_100%)] px-5 py-6 text-white">
                    <img alt="ASI app mark" className="w-16" loading="lazy" src="/brand/asi-logo-white-transparent.png" />
                    <p className="mt-5 text-lg font-semibold">Demo lista para enlazar</p>
                    <p className="mt-3 text-sm leading-6 text-white/80">
                      Coloca el archivo en <span className="font-semibold text-white">public/media/demoApp.mp4</span> y este bloque lo reproducirá automáticamente.
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
                  'Una sección limpia y profesional para comunicar que la experiencia institucional y la plataforma pueden seguirse también desde móvil, sin romper el ritmo visual.'
              }}
            />
            <div className="mt-6 max-w-xl">
              <p className="asi-copy">
                Usamos un mockup elegante en lugar de una tarjeta genérica para reforzar continuidad de marca, claridad y
                intención editorial.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <InstitutionalActionLink
                action={{
                  label: 'Explorar plataforma',
                  to: surfacePaths.public.home,
                  variant: 'primary'
                }}
              />
              <InstitutionalActionLink
                action={{
                  label: 'Conocer comunidad',
                  to: surfacePaths.institutional.membership,
                  variant: 'secondary'
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
              title: 'Programas presentados con una lectura más sobria, menos ruidosa y mejor proporcionada.',
              description:
                'Los títulos ahora viven en una escala más contenida y los cards aprovechan mejor el ancho del layout.'
            }}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {homeProgramShowcase.map((item) => (
              <InstitutionalCard key={item.title} className="overflow-hidden p-0">
                <img alt={item.imageAlt} className="h-60 w-full object-cover" loading="lazy" src={item.image} />
                <div className="p-5">
                  <p className="text-[1.12rem] font-semibold tracking-tight text-[var(--asi-text)]">{item.title}</p>
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
                title: 'Testimonios de fe y servicio con transición suave y controles discretos.',
                description:
                  'Este último carrusel mantiene el mismo lenguaje visual: movimiento calmado, cards legibles y control intuitivo.'
              }}
            />
            <div className="flex items-center gap-2">
              <button
                aria-label="Testimonio anterior"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-[var(--asi-primary)] shadow-[var(--asi-shadow-soft)] transition hover:bg-[var(--asi-surface-raised)]"
                type="button"
                onClick={() => stepTestimonialSlide('prev')}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                aria-label="Testimonio siguiente"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-[var(--asi-primary)] shadow-[var(--asi-shadow-soft)] transition hover:bg-[var(--asi-surface-raised)]"
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
                const direction = getSwipeDirection(info)

                if (direction === 'next') {
                  stepTestimonialSlide('next')
                }

                if (direction === 'prev') {
                  stepTestimonialSlide('prev')
                }
              }}
            >
              {visibleTestimonials.map((item, index) => (
                <motion.article
                  key={item.title}
                  className={cn(
                    'rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(22,35,60,0.94)_0%,rgba(0,47,110,0.92)_100%)] p-6 text-white shadow-[0_18px_44px_rgba(0,47,110,0.14)]',
                    index > 0 && 'hidden lg:block'
                  )}
                  layout
                >
                  <Quote className="size-7 text-white/68" />
                  <p className="mt-4 text-lg leading-8 text-white/92">{item.title}</p>
                  <p className="mt-4 text-sm leading-6 text-white/74">{item.description}</p>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/58">{item.meta}</p>
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
                  index === activeTestimonialIndex ? 'w-8 bg-[var(--asi-primary)]' : 'w-2.5 bg-[var(--asi-outline)] hover:bg-[var(--asi-secondary)]/40'
                )}
                type="button"
                onClick={() => goToTestimonialSlide(index)}
              />
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalCtaBand
        title="Desde el portal institucional puedes pasar a membresía, proyectos o a la plataforma sin perder coherencia visual."
        description="El rediseño prioriza amplitud, elegancia y movimiento suave con Motion, manteniendo botones compactos, imágenes lazy y una composición más cercana a tus referencias."
        primaryAction={{
          label: 'Ir a donaciones',
          to: surfacePaths.institutional.donate,
          variant: 'primary'
        }}
        secondaryAction={{
          label: 'Abrir /platform',
          to: surfacePaths.public.home,
          variant: 'secondary'
        }}
      />

      <InstitutionalSection>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
          <div>
            <p className="asi-kicker">Puente digital</p>
            <h2 className="asi-heading-lg mt-4">La institución presenta contexto. La plataforma habilita workflows.</h2>
          </div>
          <InstitutionalCard>
            <div className="flex items-start gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--asi-surface-raised)] text-[var(--asi-primary)]">
                <ArrowRight className="size-5" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-[var(--asi-text)]">Abrir plataforma ASI</p>
                <p className="asi-copy mt-2">
                  Lleva a la persona visitante desde el portal institucional hacia el producto, jobs públicos o autenticación
                  con una transición clara y profesional.
                </p>
                <Link
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--asi-primary)] transition hover:gap-3"
                  to={surfacePaths.public.home}
                >
                  Ir a /platform
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </InstitutionalCard>
        </div>
      </InstitutionalSection>
    </div>
  )
}
