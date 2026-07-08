import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'

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
type CropPoint = { x: number; y: number }

const MIN_ZOOM_FLOOR = 0.5
const MAX_ZOOM = 4

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function distanceBetween(first: CropPoint, second: CropPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function centerBetween(first: CropPoint, second: CropPoint) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  }
}

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
  const frameRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, CropPoint>())
  const gestureRef = useRef<{
    distance: number | null
    origin: CropPoint
    panX: number
    panY: number
    zoom: number
  } | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    panRef.current = { x: panX, y: panY }
  }, [panX, panY])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    if (!open || !file) {
      setObjectUrl(null)
      setImageSize(null)
      setFrameSize(null)
      setZoom(1)
      setPanX(0)
      setPanY(0)
      setIsDragging(false)
      setErrorMessage(null)
      pointersRef.current.clear()
      gestureRef.current = null
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setObjectUrl(nextUrl)
    setImageSize(null)
    setZoom(1)
    setPanX(0)
    setPanY(0)
    setIsDragging(false)
    setErrorMessage(null)
    pointersRef.current.clear()
    gestureRef.current = null

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

  const minZoom = useMemo(() => {
    if (!frameSize || !imageSize) {
      return MIN_ZOOM_FLOOR
    }

    const coverScale = Math.max(frameSize.width / imageSize.width, frameSize.height / imageSize.height)
    const containScale = Math.min(frameSize.width / imageSize.width, frameSize.height / imageSize.height)

    return clamp(containScale / coverScale, MIN_ZOOM_FLOOR, 1)
  }, [frameSize, imageSize])

  useEffect(() => {
    if (zoom < minZoom) {
      setZoom(minZoom)
      zoomRef.current = minZoom
    }
  }, [minZoom, zoom])

  function updatePanFromPixels(deltaX: number, deltaY: number, startPanX: number, startPanY: number, activeZoom: number) {
    if (!frameSize || !imageSize) {
      return
    }

    const layout = getRasterImageCropPreviewLayout({
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      zoom: clamp(activeZoom, minZoom, MAX_ZOOM),
      panX: 0,
      panY: 0
    })
    const panRangeX = Math.abs(layout.width - frameSize.width) / 2
    const panRangeY = Math.abs(layout.height - frameSize.height) / 2
    const nextPanX = panRangeX > 0 ? clamp(startPanX + deltaX / panRangeX, -1, 1) : 0
    const nextPanY = panRangeY > 0 ? clamp(startPanY + deltaY / panRangeY, -1, 1) : 0

    setPanX(nextPanX)
    setPanY(nextPanY)
    panRef.current = { x: nextPanX, y: nextPanY }
  }

  function beginGesture(origin: CropPoint, distance: number | null) {
    gestureRef.current = {
      distance,
      origin,
      panX: panRef.current.x,
      panY: panRef.current.y,
      zoom: zoomRef.current
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!imageSize || !frameSize || isProcessing) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    setIsDragging(true)

    const points = [...pointersRef.current.values()]
    if (points.length >= 2) {
      beginGesture(centerBetween(points[0], points[1]), distanceBetween(points[0], points[1]))
      return
    }

    beginGesture({ x: event.clientX, y: event.clientY }, null)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!gestureRef.current || !pointersRef.current.has(event.pointerId)) {
      return
    }

    event.preventDefault()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointersRef.current.values()]

    if (points.length >= 2 && gestureRef.current.distance) {
      const nextDistance = distanceBetween(points[0], points[1])
      const nextCenter = centerBetween(points[0], points[1])
      const nextZoom = clamp(gestureRef.current.zoom * (nextDistance / gestureRef.current.distance), minZoom, MAX_ZOOM)
      setZoom(nextZoom)
      zoomRef.current = nextZoom
      updatePanFromPixels(
        nextCenter.x - gestureRef.current.origin.x,
        nextCenter.y - gestureRef.current.origin.y,
        gestureRef.current.panX,
        gestureRef.current.panY,
        nextZoom
      )
      return
    }

    const point = points[0]
    if (!point) {
      return
    }

    updatePanFromPixels(
      point.x - gestureRef.current.origin.x,
      point.y - gestureRef.current.origin.y,
      gestureRef.current.panX,
      gestureRef.current.panY,
      zoomRef.current
    )
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const points = [...pointersRef.current.values()]
    if (points.length >= 2) {
      beginGesture(centerBetween(points[0], points[1]), distanceBetween(points[0], points[1]))
      return
    }

    if (points.length === 1) {
      beginGesture(points[0], null)
      return
    }

    gestureRef.current = null
    setIsDragging(false)
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!imageSize || !frameSize || isProcessing) {
      return
    }

    event.preventDefault()
    const nextZoom = clamp(zoomRef.current - event.deltaY * 0.002, minZoom, MAX_ZOOM)
    setZoom(nextZoom)
    zoomRef.current = nextZoom
    setPanX((current) => clamp(current, -1, 1))
    setPanY((current) => clamp(current, -1, 1))
  }

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
        zoom: clamp(zoom, minZoom, MAX_ZOOM)
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
    panRef.current = { x: 0, y: 0 }
    zoomRef.current = 1
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
                aria-label="Área de encuadre de imagen"
                role="img"
                onPointerDownCapture={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerCancel={handlePointerEnd}
                onPointerUp={handlePointerEnd}
                onWheel={handleWheel}
                className={cn(
                  'relative mx-auto w-full max-w-[320px] touch-none overflow-hidden border border-(--app-border) bg-slate-950 shadow-inner outline-none sm:max-w-[380px]',
                  imageSize && !isProcessing ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                  isDragging && 'cursor-grabbing',
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
                    className="pointer-events-none absolute max-w-none select-none"
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
                <div
                  className="pointer-events-none absolute inset-0 opacity-45"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,255,255,0.26) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.26) 1px, transparent 1px)',
                    backgroundSize: '33.333% 33.333%'
                  }}
                />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/35" />
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
