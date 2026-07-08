import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { Check, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  cropRasterImageFile,
  getRasterImageCropPreviewLayout,
  type RasterImageCropOptions
} from '@/lib/uploads/media'
import { cn } from '@/lib/utils/cn'

type CropShape = 'circle' | 'rounded'

export interface ImageCropDialogProps {
  open: boolean
  file: File | null
  title: string
  description?: string
  shape?: CropShape
  outputWidth?: number
  outputHeight?: number
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (file: File) => void | Promise<void>
}

export function ImageCropDialog({
  open,
  file,
  title,
  description,
  shape = 'rounded',
  outputWidth = 768,
  outputHeight = 768,
  confirmLabel = 'Usar encuadre',
  onCancel,
  onConfirm
}: ImageCropDialogProps) {
  const zoomId = useId()
  const horizontalId = useId()
  const verticalId = useId()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !file) {
      setObjectUrl(null)
      setImageSize(null)
      setFrameSize(null)
      setZoom(1)
      setPanX(0)
      setPanY(0)
      setErrorMessage(null)
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setObjectUrl(nextUrl)
    setImageSize(null)
    setZoom(1)
    setPanX(0)
    setPanY(0)
    setErrorMessage(null)

    return () => URL.revokeObjectURL(nextUrl)
  }, [file, open])

  useEffect(() => {
    if (!open || !frameRef.current) {
      return
    }

    const frame = frameRef.current
    const updateFrameSize = () => {
      const rect = frame.getBoundingClientRect()
      setFrameSize({ width: rect.width, height: rect.height })
    }
    const observer = new ResizeObserver(updateFrameSize)

    updateFrameSize()
    observer.observe(frame)

    return () => observer.disconnect()
  }, [open])

  const previewLayout = useMemo(() => {
    if (!frameSize || !imageSize) {
      return null
    }

    return getRasterImageCropPreviewLayout({
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      zoom,
      panX,
      panY
    })
  }, [frameSize, imageSize, panX, panY, zoom])

  async function confirmCrop() {
    if (!file) {
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const cropOptions: RasterImageCropOptions = {
        outputWidth,
        outputHeight,
        panX,
        panY,
        zoom
      }
      const croppedFile = await cropRasterImageFile(file, cropOptions)
      await onConfirm(croppedFile)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos preparar la imagen.')
    } finally {
      setIsProcessing(false)
    }
  }

  function resetCrop() {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  return (
    <Dialog open={open} onClose={isProcessing ? () => undefined : onCancel} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
        <div className="flex min-h-full items-end justify-center sm:items-center">
          <DialogPanel
            transition
            className="w-full max-w-xl overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface) shadow-[0_24px_80px_rgba(15,23,42,0.28)] transition duration-200 ease-out data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
          >
            <header className="flex items-start justify-between gap-4 border-b border-(--app-border) px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-tight text-(--app-text)">
                  {title}
                </DialogTitle>
                {description ? (
                  <p className="mt-1 text-sm leading-5 text-(--app-text-muted)">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={isProcessing}
                onClick={onCancel}
                className="flex size-8 shrink-0 items-center justify-center rounded-control text-(--app-text-subtle) transition hover:bg-(--app-surface-muted) hover:text-(--app-text) disabled:opacity-60"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="grid gap-4 px-4 py-4 sm:px-5">
              <div
                ref={frameRef}
                className={cn(
                  'relative mx-auto w-full max-w-[320px] overflow-hidden border border-(--app-border) bg-slate-950 shadow-inner sm:max-w-[380px]',
                  shape === 'circle' ? 'rounded-full' : 'rounded-card'
                )}
                style={{ aspectRatio: `${outputWidth} / ${outputHeight}` }}
              >
                {objectUrl ? (
                  <img
                    alt=""
                    src={objectUrl}
                    draggable={false}
                    onLoad={(event) => {
                      setImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight
                      })
                    }}
                    className="absolute max-w-none select-none"
                    style={
                      previewLayout
                        ? {
                            left: previewLayout.x,
                            top: previewLayout.y,
                            width: previewLayout.width,
                            height: previewLayout.height
                          }
                        : { inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
                    }
                  />
                ) : null}
              </div>

              <div className="grid gap-3 rounded-control border border-(--app-border) bg-(--app-surface-muted) p-3">
                <label className="grid gap-1.5 text-xs font-semibold text-(--app-text-muted)" htmlFor={zoomId}>
                  Zoom
                  <input
                    id={zoomId}
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="w-full accent-primary-600"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-(--app-text-muted)" htmlFor={horizontalId}>
                  Horizontal
                  <input
                    id={horizontalId}
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={panX}
                    onChange={(event) => setPanX(Number(event.target.value))}
                    className="w-full accent-primary-600"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-(--app-text-muted)" htmlFor={verticalId}>
                  Vertical
                  <input
                    id={verticalId}
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={panY}
                    onChange={(event) => setPanY(Number(event.target.value))}
                    className="w-full accent-primary-600"
                  />
                </label>
              </div>

              {errorMessage ? <p className="text-sm text-rose-600 dark:text-rose-300">{errorMessage}</p> : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-(--app-border) px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
              <Button variant="outline" onClick={resetCrop} disabled={isProcessing}>
                <RotateCcw className="size-4" />
                Restablecer
              </Button>
              <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmCrop()} disabled={!file || !imageSize || isProcessing}>
                <Check className="size-4" />
                {isProcessing ? 'Preparando...' : confirmLabel}
              </Button>
            </footer>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
