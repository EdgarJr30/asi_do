import { BrandMark } from '@/components/ui/app-brand'
import { cn } from '@/lib/utils/cn'

type LoaderSize = 'sm' | 'md' | 'lg'

const spinnerFrameBySize: Record<LoaderSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-12'
}

const spinnerRingBySize: Record<LoaderSize, string> = {
  sm: 'border-[2px]',
  md: 'border-[2.5px]',
  lg: 'border-[3px]'
}

const spinnerInsetBySize: Record<LoaderSize, string> = {
  sm: 'inset-1',
  md: 'inset-1.5',
  lg: 'inset-2'
}

const spinnerBrandPanelBySize: Record<LoaderSize, string> = {
  sm: 'size-4 rounded-control p-0.5 shadow-[0_6px_14px_rgba(43,69,143,0.22)]',
  md: 'size-5 rounded-control p-1 shadow-[0_8px_18px_rgba(43,69,143,0.24)]',
  lg: 'size-7 rounded-control p-1.5 shadow-[0_10px_22px_rgba(43,69,143,0.26)]'
}

/**
 * Loader oficial compacto para usos inline (botones, filas, tablas y tarjetas).
 * Mantiene el logo ASI y los anillos del loader de página en escala pequeña.
 *
 * Animado con CSS puro (keyframes en `styles/index.css`) para no depender de
 * `motion`, ya que este loader vive en el camino crítico (fallback de Suspense).
 * `motion-reduce:animate-none` respeta `prefers-reduced-motion`.
 */
export function Spinner({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', spinnerFrameBySize[size], className)}
      role="status"
      aria-label="Cargando"
    >
      <span
        className={cn(
          'absolute inset-0 rounded-full border-primary-500/15 border-t-primary-500 animate-[loader-spin_0.85s_linear_infinite] motion-reduce:animate-none',
          spinnerRingBySize[size]
        )}
      />
      <span
        className={cn(
          'absolute rounded-full border-accent-400/15 border-b-accent-400 animate-[loader-spin-reverse_1.35s_linear_infinite] motion-reduce:animate-none',
          spinnerInsetBySize[size],
          spinnerRingBySize[size]
        )}
      />
      <span className="animate-[loader-breathe_1.8s_ease-in-out_infinite] motion-reduce:animate-none">
        <BrandMark panelClassName={spinnerBrandPanelBySize[size]} />
      </span>
    </span>
  )
}

/**
 * Loader de página: estado de carga centralizado y con sello de marca.
 * Halo pulsante + dos anillos contrarrotatorios alrededor del logo ASI que respira.
 * Animado con CSS puro; respeta `prefers-reduced-motion` vía `motion-reduce:*`.
 */
export function PageLoader({
  label = 'Preparando tu espacio',
  hint,
  className,
  fullScreen = false,
  inline = false
}: {
  label?: string
  hint?: string
  className?: string
  /** Ocupa todo el viewport (`min-h-dvh`). Para pantallas de bloqueo/guards. */
  fullScreen?: boolean
  /** Banda compacta para usos dentro de una sección/tarjeta con UI alrededor. */
  inline?: boolean
}) {
  // Altura del contenedor según el contexto:
  // - fullScreen → viewport completo
  // - inline → banda compacta dentro de una tarjeta/sección
  // - default (página) → llena el alto visible del contenido (viewport menos header + padding
  //   del shell ≈ 6.5rem arriba). Restar 12rem (≈ 2× ese offset) deja el loader centrado
  //   verticalmente en el área de contenido sin generar scroll.
  const minHeight = fullScreen ? 'min-h-dvh' : inline ? 'min-h-[clamp(16rem,42vh,28rem)]' : 'min-h-[calc(100dvh-12rem)]'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex w-full flex-col items-center justify-center gap-6 px-6 text-center', minHeight, className)}
    >
      <div className="relative flex size-24 items-center justify-center">
        {/* Halo pulsante */}
        <span className="absolute inset-0 rounded-full bg-primary-500/15 blur-[2px] animate-[loader-halo_2s_ease-in-out_infinite] motion-reduce:animate-none" />
        {/* Anillo exterior */}
        <span className="absolute inset-0 rounded-full border-[3px] border-primary-500/15 border-t-primary-500 animate-[loader-spin_1.1s_linear_infinite] motion-reduce:animate-none" />
        {/* Anillo interior contrarrotatorio */}
        <span className="absolute inset-[0.55rem] rounded-full border-[3px] border-accent-400/15 border-b-accent-400 animate-[loader-spin-reverse_1.6s_linear_infinite] motion-reduce:animate-none" />
        {/* Marca que respira */}
        <span className="animate-[loader-breathe_2s_ease-in-out_infinite] motion-reduce:animate-none">
          <BrandMark className="size-7" panelClassName="size-12 rounded-card shadow-[0_12px_28px_rgba(43,69,143,0.28)]" />
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center justify-center gap-1 text-sm font-semibold text-(--app-text)">
          {label}
          <span aria-hidden className="inline-flex motion-reduce:hidden">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="inline-block animate-[loader-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: `${index * 0.18}s` }}
              >
                .
              </span>
            ))}
          </span>
        </p>
        {hint ? <p className="text-xs text-(--app-text-muted)">{hint}</p> : null}
      </div>
    </div>
  )
}
