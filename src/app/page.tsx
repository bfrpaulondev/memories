'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Upload,
  Heart,
  Lock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Pen,
  Eraser,
  Palette,
  Loader2,
  Users,
  Clock,
  X,
  Sparkles,
  Paintbrush,
  Grid3X3,
  Image as ImageIcon,
  Download,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────
interface Photo {
  id: string
  filename: string
  originalName: string
  guestName: string
  mimeType: string
  size: number
  createdAt: string
}

interface ParsedGuest {
  name: string
  frame: 'classic' | 'floral' | 'modern'
}

type FrameStyle = 'classic' | 'floral' | 'modern'
type ViewMode = 'book' | 'grid'

// ─── Constants ───────────────────────────────────────────
const WEDDING_PIN = '2025'
const PHOTOS_PER_PAGE = 2
const COUPLE_NAMES = 'Patrícia & Samuel'
const WEDDING_DATE = '2025'
const FLIP_DURATION = 900 // ms

// ─── Utility: Parse guestName with frame info ────────────
function parseGuestName(raw: string): ParsedGuest {
  const parts = raw.split('|frame:')
  const name = parts[0] || 'Convidado'
  const frameStr = parts[1] || 'classic'
  const validFrames: FrameStyle[] = ['classic', 'floral', 'modern']
  const frame = validFrames.includes(frameStr as FrameStyle) ? (frameStr as FrameStyle) : 'classic'
  return { name, frame }
}

// ─── Utility: Time Ago in Portuguese ─────────────────────
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (seconds < 10) return 'agora mesmo'
  if (seconds < 60) return `${seconds}s atrás`
  if (minutes < 60) return `${minutes}min atrás`
  if (hours < 24) return `${hours}h atrás`
  return `${days}d atrás`
}

// ─── Utility: Format file size ───────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Decorative SVG Corner ───────────────────────────────
function OrnamentalCorner({ className }: { className?: string }) {
  return (
    <svg className={className} width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 38C2 18 18 2 38 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 28C2 14 14 2 28 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <circle cx="6" cy="6" r="2" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

// ─── Photo Frame Component ───────────────────────────────
function PhotoFrame({
  src,
  alt,
  frameStyle,
  guestName,
  className,
  onClick,
}: {
  src: string
  alt: string
  frameStyle: FrameStyle
  guestName?: string
  className?: string
  onClick?: () => void
}) {
  if (frameStyle === 'classic') {
    return (
      <div className={`relative group cursor-pointer ${className || ''}`} onClick={onClick}>
        <div className="frame-classic p-2 bg-white relative overflow-hidden">
          <div className="absolute top-1 left-1 text-[10px] text-[var(--wedding-gold-accent)] opacity-60">✦</div>
          <div className="absolute top-1 right-1 text-[10px] text-[var(--wedding-gold-accent)] opacity-60">✦</div>
          <div className="absolute bottom-1 left-1 text-[10px] text-[var(--wedding-gold-accent)] opacity-60">✦</div>
          <div className="absolute bottom-1 right-1 text-[10px] text-[var(--wedding-gold-accent)] opacity-60">✦</div>
          <img src={src} alt={alt} className="w-full h-full object-contain" loading="lazy" />
        </div>
        {guestName && (
          <p className="text-center text-xs mt-1.5 italic" style={{ color: 'var(--wedding-gold-dark)', fontFamily: 'Georgia, serif' }}>
            {guestName}
          </p>
        )}
      </div>
    )
  }

  if (frameStyle === 'floral') {
    return (
      <div className={`relative group cursor-pointer ${className || ''}`} onClick={onClick}>
        <div className="frame-floral p-1.5 bg-white">
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 rounded-tl-2xl" style={{ borderColor: 'var(--wedding-lavender)' }} />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 rounded-tr-2xl" style={{ borderColor: 'var(--wedding-lavender)' }} />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 rounded-bl-2xl" style={{ borderColor: 'var(--wedding-lavender)' }} />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 rounded-br-2xl" style={{ borderColor: 'var(--wedding-lavender)' }} />
          <img src={src} alt={alt} className="w-full h-full object-contain rounded-xl" loading="lazy" />
        </div>
        {guestName && (
          <p className="text-center text-xs mt-1.5" style={{ color: 'var(--wedding-purple-dark)', fontFamily: 'Georgia, serif' }}>
            🌸 {guestName}
          </p>
        )}
      </div>
    )
  }

  // Modern
  return (
    <div className={`relative group cursor-pointer ${className || ''}`} onClick={onClick}>
      <div className="frame-modern p-1 bg-white">
        <img src={src} alt={alt} className="w-full h-full object-contain" loading="lazy" />
      </div>
      {guestName && (
        <p className="text-center text-xs mt-1.5 font-light tracking-wide" style={{ color: 'var(--wedding-deep)' }}>
          {guestName}
        </p>
      )}
    </div>
  )
}

// ─── Frame Selector Preview ──────────────────────────────
function FrameSelector({
  selected,
  onSelect,
}: {
  selected: FrameStyle
  onSelect: (f: FrameStyle) => void
}) {
  const frames: { id: FrameStyle; label: string; icon: string; desc: string }[] = [
    { id: 'classic', label: 'Clássico', icon: '🖼️', desc: 'Ornamento dourado' },
    { id: 'floral', label: 'Floral', icon: '🌸', desc: 'Bordas suaves' },
    { id: 'modern', label: 'Moderno', icon: '✦', desc: 'Minimalista' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {frames.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onSelect(f.id)}
          className={`relative p-2.5 rounded-xl border-2 transition-all text-center ${
            selected === f.id
              ? 'border-[var(--wedding-purple)] bg-[var(--wedding-soft-lavender)] shadow-md'
              : 'border-[var(--wedding-lavender)] bg-white hover:border-[var(--wedding-purple)] hover:shadow-sm'
          }`}
        >
          {selected === f.id && (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-purple)' }}>
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
          <span className="text-lg block mb-0.5">{f.icon}</span>
          <span className="text-xs font-semibold block" style={{ color: 'var(--wedding-deep)' }}>{f.label}</span>
          <span className="text-[10px] block" style={{ color: 'var(--muted-foreground)' }}>{f.desc}</span>
        </button>
      ))}
    </div>
  )
}

// ─── PIN Modal Component ─────────────────────────────────
function PINModal({
  open,
  onVerified,
}: {
  open: boolean
  onVerified: () => void
}) {
  const { toast } = useToast()
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    setError(false)

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newPin.every((d) => d !== '')) {
      const entered = newPin.join('')
      if (entered === WEDDING_PIN) {
        sessionStorage.setItem('wedding_pin_verified', 'true')
        onVerified()
      } else {
        setError(true)
        setShaking(true)
        setTimeout(() => setShaking(false), 500)
        toast({
          title: 'Código incorreto',
          description: 'Tente novamente',
          variant: 'destructive',
        })
        setTimeout(() => {
          setPin(['', '', '', ''])
          inputRefs.current[0]?.focus()
        }, 600)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(45, 32, 64, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: shaking ? 1.02 : 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
            style={{ backgroundColor: 'white' }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--wedding-soft-lavender)' }}
            >
              <Lock className="w-8 h-8" style={{ color: 'var(--wedding-purple)' }} />
            </div>

            <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}>
              Digite o código de acesso
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Para enviar fotos, insira o código
            </p>

            <div className="flex justify-center gap-3 mb-4">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`pin-digit ${error ? '!border-red-400 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                  aria-label={`Dígito ${i + 1} do código`}
                />
              ))}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-500 font-medium"
              >
                Código incorreto ✕
              </motion.p>
            )}

            <p className="text-xs mt-4 opacity-40" style={{ color: 'var(--muted-foreground)' }}>
              💜 Peça o código aos noivos
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Signature Pad Component ─────────────────────────────
function SignaturePad({ onSave }: { onSave: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#7B2D8E')
  const [strokeWidth] = useState(2)
  const [hasContent, setHasContent] = useState(false)
  const lastPointRef = useRef<{ x: number; y: number; pressure: number } | null>(null)

  const colors = [
    { value: '#7B2D8E', label: 'Roxo', emoji: '💜' },
    { value: '#D4A574', label: 'Dourado', emoji: '✨' },
    { value: '#2D2040', label: 'Escuro', emoji: '🖤' },
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.fillStyle = '#FDFBF7'
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)'
        ctx.lineWidth = 0.5
        for (let y = 30; y < rect.height; y += 25) {
          ctx.beginPath()
          ctx.moveTo(20, y)
          ctx.lineTo(rect.width - 20, y)
          ctx.stroke()
        }
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    setIsDrawing(true)
    const point = getPoint(e)
    if (point) lastPointRef.current = point
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const point = getPoint(e)
    if (!point || !lastPointRef.current) return

    const pressure = point.pressure > 0 ? point.pressure : 0.5
    const width = strokeWidth * (0.5 + pressure * 1.5)

    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPointRef.current = point
    setHasContent(true)
  }

  const handlePointerUp = () => {
    setIsDrawing(false)
    lastPointRef.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#FDFBF7'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)'
    ctx.lineWidth = 0.5
    for (let y = 30; y < rect.height; y += 25) {
      ctx.beginPath()
      ctx.moveTo(20, y)
      ctx.lineTo(rect.width - 20, y)
      ctx.stroke()
    }
    setHasContent(false)
  }

  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `assinatura-${Date.now()}.png`, { type: 'image/png' })
        onSave(file)
        clearCanvas()
      },
      'image/png',
      1.0
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-xl overflow-hidden shadow-inner"
        style={{ border: '2px solid var(--wedding-lavender)' }}
      >
        <canvas
          ref={canvasRef}
          className="signature-canvas w-full"
          style={{ height: '280px', background: '#FDFBF7' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setStrokeColor(c.value)}
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                strokeColor === c.value ? 'scale-110 shadow-md' : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: c.value,
                borderColor: strokeColor === c.value ? 'var(--wedding-deep)' : 'transparent',
              }}
              aria-label={`Cor ${c.label}`}
            >
              <span className="text-white text-xs">{c.emoji}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            className="rounded-lg text-xs"
            style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple-dark)' }}
          >
            <Eraser className="w-3.5 h-3.5 mr-1" />
            Limpar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveSignature}
            disabled={!hasContent}
            className="rounded-lg text-xs"
            style={{ backgroundColor: 'var(--wedding-purple)', color: 'white' }}
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────
export default function Home() {
  const { toast } = useToast()

  // ─── State ─────────────────────────────────────────
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('book')
  const [currentSpread, setCurrentSpread] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next')

  // PIN state
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)

  // Upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState<FrameStyle>('classic')

  // Photo viewer
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  // Refs
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flipPageRef = useRef<HTMLDivElement>(null)
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Check PIN on mount ────────────────────────────
  useEffect(() => {
    const verified = sessionStorage.getItem('wedding_pin_verified') === 'true'
    if (verified) setIsPinVerified(true)
  }, [])

  // ─── Compute album pages ───────────────────────────
  const sortedPhotos = [...photos].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const photoPages: Photo[][] = []
  for (let i = 0; i < sortedPhotos.length; i += PHOTOS_PER_PAGE) {
    photoPages.push(sortedPhotos.slice(i, i + PHOTOS_PER_PAGE))
  }

  const signaturePhotos = sortedPhotos.filter(
    (p) => p.originalName.startsWith('assinatura-') || p.guestName.includes('|signature')
  )
  const regularPhotos = sortedPhotos.filter(
    (p) => !p.originalName.startsWith('assinatura-') && !p.guestName.includes('|signature')
  )

  const regularPhotoPages: Photo[][] = []
  for (let i = 0; i < regularPhotos.length; i += PHOTOS_PER_PAGE) {
    regularPhotoPages.push(regularPhotos.slice(i, i + PHOTOS_PER_PAGE))
  }

  const totalSpreads = 2 + Math.max(1, Math.ceil(regularPhotoPages.length / 2)) + (signaturePhotos.length > 0 ? 1 : 0)

  const getPhotosForSpread = (spreadIndex: number): { left: Photo[]; right: Photo[] } => {
    if (spreadIndex === 0) return { left: [], right: [] }
    const photoSpreadIndex = spreadIndex - 1
    const leftPageIndex = photoSpreadIndex * 2
    const rightPageIndex = photoSpreadIndex * 2 + 1
    return {
      left: regularPhotoPages[leftPageIndex] || [],
      right: regularPhotoPages[rightPageIndex] || [],
    }
  }

  const isSignatureSpreadFn = (spreadIndex: number) => {
    return spreadIndex === totalSpreads - 2 && signaturePhotos.length > 0
  }

  const isBackCoverFn = (spreadIndex: number) => {
    return spreadIndex === totalSpreads - 1
  }

  // ─── Fetch photos ──────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos')
      if (res.ok) {
        const data = await res.json()
        setPhotos(data.photos)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingPhotos(false)
    }
  }, [])

  // ─── WebSocket connection ──────────────────────────
  useEffect(() => {
    fetchPhotos()

    const socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('photo_update', (data: { type: string; photo: Photo }) => {
      if (data.type === 'new_photo') {
        setPhotos((prev) => {
          if (prev.some((p) => p.id === data.photo.id)) return prev
          return [...prev, data.photo]
        })
        toast({
          title: '📸 Nova foto!',
          description: `${parseGuestName(data.photo.guestName).name} enviou uma foto`,
        })
      }
    })

    pollingRef.current = setInterval(fetchPhotos, 10000)

    return () => {
      socket.disconnect()
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchPhotos, toast])

  // ─── 3D Flip Navigation ───────────────────────────
  const performFlipNext = useCallback(() => {
    if (isFlipping || currentSpread >= totalSpreads - 1) return
    setFlipDirection('next')
    setIsFlipping(true)

    // Flip overlay renders at rotateY(0deg), then we animate to -180deg
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = flipPageRef.current
        if (el) {
          el.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.645, 0.045, 0.355, 1)`
          el.style.transform = 'rotateY(-180deg)'
        }
      })
    })

    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current)
    flipTimeoutRef.current = setTimeout(() => {
      setCurrentSpread(prev => prev + 1)
      setIsFlipping(false)
    }, FLIP_DURATION + 60)
  }, [isFlipping, currentSpread, totalSpreads])

  const performFlipPrev = useCallback(() => {
    if (isFlipping || currentSpread <= 0) return
    setFlipDirection('prev')
    setIsFlipping(true)

    // Flip overlay renders at rotateY(-180deg), then we animate to 0deg
    requestAnimationFrame(() => {
      const el = flipPageRef.current
      if (el) {
        // Force reflow to ensure the -180deg position is painted first
        void el.offsetHeight
        el.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.645, 0.045, 0.355, 1)`
        el.style.transform = 'rotateY(0deg)'
      }
    })

    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current)
    flipTimeoutRef.current = setTimeout(() => {
      setCurrentSpread(prev => prev - 1)
      setIsFlipping(false)
    }, FLIP_DURATION + 60)
  }, [isFlipping, currentSpread])

  const nextPage = performFlipNext
  const prevPage = performFlipPrev

  // For dot navigation - instant jump (no 3D flip for non-adjacent pages)
  const goToSpread = useCallback((index: number) => {
    if (isFlipping || index < 0 || index >= totalSpreads) return
    setCurrentSpread(index)
  }, [isFlipping, totalSpreads])

  // ─── Keyboard navigation ──────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [nextPage, prevPage])

  // ─── Touch/swipe navigation ───────────────────────
  const touchStartRef = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const diff = touchStartRef.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) {
      if (diff > 0) nextPage()
      else prevPage()
    }
    touchStartRef.current = null
  }

  // ─── Upload handlers ──────────────────────────────
  const requestUpload = () => {
    if (!isPinVerified) {
      setShowPinModal(true)
      return
    }
    setShowUploadDialog(true)
  }

  const handlePinVerified = () => {
    setIsPinVerified(true)
    setShowPinModal(false)
    setShowUploadDialog(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      toast({ title: 'Tipo inválido', description: 'Use JPG, PNG ou WebP.', variant: 'destructive' })
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 20MB.', variant: 'destructive' })
      return
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: 'Selecione uma foto', description: 'Escolha ou tire uma foto primeiro.', variant: 'destructive' })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', selectedFile)
      formData.append('guestName', `${guestName.trim() || 'Convidado'}|frame:${selectedFrame}`)

      const res = await fetch('/api/photos', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto')

      toast({ title: '🎉 Foto enviada!', description: 'Sua foto foi adicionada ao álbum!' })
      setSelectedFile(null)
      setPreviewUrl(null)
      setGuestName('')
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowUploadDialog(false)
      await fetchPhotos()
    } catch (err) {
      toast({
        title: 'Erro ao enviar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSignatureSave = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('guestName', `${guestName.trim() || 'Convidado'}|frame:classic|signature`)

      const res = await fetch('/api/photos', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro ao salvar assinatura')

      toast({ title: '✍️ Assinatura salva!', description: 'Sua mensagem foi adicionada ao álbum!' })
      await fetchPhotos()
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar a assinatura.', variant: 'destructive' })
    }
  }

  const clearPreview = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadAllPhotos = async () => {
    if (photos.length === 0) return
    for (const photo of photos) {
      const link = document.createElement('a')
      link.href = `/uploads/${photo.filename}`
      link.download = photo.originalName || photo.filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  // ─── Render single page content (photo pages) ────
  const renderPageContent = (pagePhotos: Photo[], side: 'left' | 'right') => (
    <div
      className={`w-full h-full page-texture flex flex-col items-center justify-center p-4 relative ${
        side === 'left' ? 'page-edge-left' : 'page-edge-right'
      }`}
      style={{
        background: `linear-gradient(${side === 'left' ? 'to right' : 'to left'}, rgba(0,0,0,0.03) 0%, transparent 10%), linear-gradient(135deg, #FDFBF7 0%, #F8F0FF 100%)`,
        borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0',
      }}
    >
      <OrnamentalCorner
        className={`absolute ${side === 'left' ? 'top-2 left-2' : 'top-2 right-2'} opacity-30`}
      />
      <OrnamentalCorner
        className={`absolute bottom-2 ${side === 'left' ? 'left-2' : 'right-2'} opacity-30 rotate-180`}
      />

      {pagePhotos.length === 0 ? (
        <div className="text-center opacity-40">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--wedding-lavender)' }} />
          <p className="text-xs italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'Georgia, serif' }}>
            Aguardando fotos...
          </p>
        </div>
      ) : pagePhotos.length === 1 ? (
        <div className="w-full h-full flex items-center justify-center">
          {(() => {
            const p = parseGuestName(pagePhotos[0].guestName)
            return (
              <PhotoFrame
                src={`/uploads/${pagePhotos[0].filename}`}
                alt={`Foto de ${p.name}`}
                frameStyle={p.frame}
                guestName={p.name}
                className="max-w-[90%] max-h-[85%]"
                onClick={() => setSelectedPhoto(pagePhotos[0])}
              />
            )
          })()}
        </div>
      ) : (
        <div className="w-full h-full grid grid-rows-2 gap-2 p-1">
          {pagePhotos.map((photo) => {
            const p = parseGuestName(photo.guestName)
            return (
              <PhotoFrame
                key={photo.id}
                src={`/uploads/${photo.filename}`}
                alt={`Foto de ${p.name}`}
                frameStyle={p.frame}
                guestName={p.name}
                className="max-h-[48%]"
                onClick={() => setSelectedPhoto(photo)}
              />
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Render LEFT half of any spread ───────────────
  const renderLeftHalf = (spreadIndex: number) => {
    // Cover left
    if (spreadIndex === 0) {
      return (
        <div
          className="w-full h-full relative flex flex-col items-center justify-center p-6 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #7B2D8E 0%, #5B1F6E 40%, #3D1452 100%)',
            borderRadius: '8px 0 0 8px',
          }}
        >
          <div className="absolute inset-3 border border-[var(--wedding-gold-accent)] opacity-30 rounded-sm" />
          <div className="absolute inset-5 border border-[var(--wedding-gold-accent)] opacity-15 rounded-sm" />
          <div className="absolute top-5 left-5 text-[var(--wedding-gold-accent)] opacity-50 text-lg">❧</div>
          <div className="absolute top-5 right-5 text-[var(--wedding-gold-accent)] opacity-50 text-lg" style={{ transform: 'scaleX(-1)' }}>❧</div>
          <div className="absolute bottom-5 left-5 text-[var(--wedding-gold-accent)] opacity-50 text-lg" style={{ transform: 'scaleY(-1)' }}>❧</div>
          <div className="absolute bottom-5 right-5 text-[var(--wedding-gold-accent)] opacity-50 text-lg" style={{ transform: 'scale(-1)' }}>❧</div>

          <div className="relative z-10 text-center">
            <div className="mb-3"><span className="text-4xl">💍</span></div>
            <h1
              className="text-3xl sm:text-4xl font-bold mb-2"
              style={{
                color: 'var(--wedding-gold-accent)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              Patrícia
            </h1>
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-px w-12" style={{ backgroundColor: 'var(--wedding-gold-accent)', opacity: 0.5 }} />
              <Heart className="w-4 h-4 fill-current" style={{ color: 'var(--wedding-gold-accent)' }} />
              <div className="h-px w-12" style={{ backgroundColor: 'var(--wedding-gold-accent)', opacity: 0.5 }} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold mb-3"
              style={{
                color: 'var(--wedding-gold-accent)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              Samuel
            </h1>
            <p className="text-sm tracking-widest" style={{ color: 'rgba(212,165,116,0.7)', fontFamily: 'Georgia, serif' }}>
              {WEDDING_DATE}
            </p>
          </div>
        </div>
      )
    }

    // Signature left
    if (isSignatureSpreadFn(spreadIndex)) {
      return (
        <div
          className="w-full h-full page-texture flex flex-col p-4 page-edge-left relative"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.03) 0%, transparent 10%), linear-gradient(135deg, #FDFBF7 0%, #F8F0FF 100%)',
            borderRadius: '4px 0 0 4px',
          }}
        >
          <OrnamentalCorner className="absolute top-2 left-2 opacity-30" />
          <div className="text-center mb-2">
            <Paintbrush className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--wedding-purple)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}>
              Deixe sua mensagem
            </h3>
          </div>
          <div className="mb-2">
            <div className="relative">
              <Users className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--wedding-purple)' }} />
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Seu nome"
                className="pl-7 h-8 text-xs rounded-lg"
                style={{ borderColor: 'var(--wedding-lavender)', backgroundColor: 'white' }}
                maxLength={50}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <SignaturePad onSave={handleSignatureSave} />
          </div>
        </div>
      )
    }

    // Back cover left
    if (isBackCoverFn(spreadIndex)) {
      return (
        <div
          className="w-full h-full page-texture flex flex-col items-center justify-center p-6 page-edge-left relative"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.03) 0%, transparent 10%), linear-gradient(135deg, #FDFBF7 0%, #F8F0FF 100%)',
            borderRadius: '4px 0 0 4px',
          }}
        >
          <OrnamentalCorner className="absolute top-3 left-3 opacity-30" />
          <div className="text-center">
            <div className="mb-3"><span className="text-3xl">💜</span></div>
            <h2
              className="text-2xl font-bold mb-3"
              style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}
            >
              Obrigado!
            </h2>
            <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Agradecemos a todos que fizeram parte deste momento especial.
            </p>
            <div className="flex items-center justify-center gap-2 my-3">
              <div className="h-px w-10" style={{ backgroundColor: 'var(--wedding-lavender)' }} />
              <Heart className="w-3 h-3 fill-current" style={{ color: 'var(--wedding-purple)' }} />
              <div className="h-px w-10" style={{ backgroundColor: 'var(--wedding-lavender)' }} />
            </div>
            <p className="text-xs italic" style={{ color: 'var(--wedding-purple-dark)', fontFamily: 'Georgia, serif' }}>
              Com amor,<br />Patrícia & Samuel
            </p>
          </div>
        </div>
      )
    }

    // Photo spread left
    const { left } = getPhotosForSpread(spreadIndex)
    return renderPageContent(left, 'left')
  }

  // ─── Render RIGHT half of any spread ──────────────
  const renderRightHalf = (spreadIndex: number) => {
    // Cover right
    if (spreadIndex === 0) {
      return (
        <div
          className="w-full h-full page-texture flex flex-col items-center justify-center p-6 page-edge-right relative"
          style={{
            background: 'linear-gradient(to left, rgba(0,0,0,0.03) 0%, transparent 10%), linear-gradient(135deg, #FDFBF7 0%, #F8F0FF 100%)',
            borderRadius: '0 8px 8px 0',
          }}
        >
          <OrnamentalCorner className="absolute top-3 right-3 opacity-30" />
          <OrnamentalCorner className="absolute bottom-3 right-3 opacity-30 rotate-180" />
          <div className="text-center max-w-[90%]">
            <Sparkles className="w-6 h-6 mx-auto mb-3" style={{ color: 'var(--wedding-purple)' }} />
            <h2
              className="text-xl font-bold mb-3"
              style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}
            >
              Bem-vindos ao nosso álbum!
            </h2>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Este álbum foi criado com amor para guardar os melhores momentos do nosso dia especial.
            </p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px w-8" style={{ backgroundColor: 'var(--wedding-lavender)' }} />
              <span className="text-xs" style={{ color: 'var(--wedding-purple)' }}>💜</span>
              <div className="h-px w-8" style={{ backgroundColor: 'var(--wedding-lavender)' }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Envie suas fotos e deixe sua mensagem nas páginas seguintes
            </p>
            <div className="mt-4">
              <Badge
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: 'var(--wedding-soft-lavender)', color: 'var(--wedding-purple-dark)' }}
              >
                <ImageIcon className="w-3 h-3 mr-1" />
                {regularPhotos.length} {regularPhotos.length === 1 ? 'foto' : 'fotos'} no álbum
              </Badge>
            </div>
          </div>
        </div>
      )
    }

    // Signature right
    if (isSignatureSpreadFn(spreadIndex)) {
      return (
        <div
          className="w-full h-full page-texture flex flex-col p-4 page-edge-right relative"
          style={{
            background: 'linear-gradient(to left, rgba(0,0,0,0.03) 0%, transparent 10%), linear-gradient(135deg, #FDFBF7 0%, #F8F0FF 100%)',
            borderRadius: '0 4px 4px 0',
          }}
        >
          <OrnamentalCorner className="absolute top-2 right-2 opacity-30" />
          <div className="text-center mb-2">
            <Pen className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--wedding-purple)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}>
              Assinaturas dos Convidados
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto album-scroll space-y-2">
            {signaturePhotos.length === 0 ? (
              <div className="text-center py-8 opacity-40">
                <Pen className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--wedding-lavender)' }} />
                <p className="text-xs italic" style={{ color: 'var(--muted-foreground)' }}>
                  Nenhuma assinatura ainda
                </p>
              </div>
            ) : (
              signaturePhotos.map((photo) => {
                const p = parseGuestName(photo.guestName)
                return (
                  <div key={photo.id} className="rounded-lg overflow-hidden shadow-sm" style={{ border: '1px solid var(--wedding-lavender)' }}>
                    <img
                      src={`/uploads/${photo.filename}`}
                      alt={`Assinatura de ${p.name}`}
                      className="w-full object-contain"
                      style={{ maxHeight: '100px', background: '#FDFBF7' }}
                      loading="lazy"
                    />
                    {p.name !== 'Convidado' && (
                      <p className="text-[10px] text-center py-1 italic" style={{ color: 'var(--wedding-purple-dark)' }}>
                        — {p.name}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )
    }

    // Back cover right
    if (isBackCoverFn(spreadIndex)) {
      return (
        <div
          className="w-full h-full relative flex flex-col items-center justify-center p-6 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #7B2D8E 0%, #5B1F6E 40%, #3D1452 100%)',
            borderRadius: '0 8px 8px 0',
          }}
        >
          <div className="absolute inset-3 border border-[var(--wedding-gold-accent)] opacity-20 rounded-sm" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px w-8" style={{ backgroundColor: 'var(--wedding-gold-accent)', opacity: 0.4 }} />
              <span className="text-xl">💍</span>
              <div className="h-px w-8" style={{ backgroundColor: 'var(--wedding-gold-accent)', opacity: 0.4 }} />
            </div>
            <p className="text-xs tracking-[0.3em] uppercase" style={{ color: 'rgba(212,165,116,0.6)', fontFamily: 'Georgia, serif' }}>
              Patrícia & Samuel
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgba(212,165,116,0.4)' }}>
              {WEDDING_DATE}
            </p>
          </div>
        </div>
      )
    }

    // Photo spread right
    const { right } = getPhotosForSpread(spreadIndex)
    return renderPageContent(right, 'right')
  }

  // ─── Compute spread data for 3D flip rendering ────
  // During flip, we need content from adjacent spreads
  const getFlipData = () => {
    if (!isFlipping) {
      return {
        baseLeftSpread: currentSpread,
        baseRightSpread: currentSpread,
        flipFrontSpread: -1, // not used
        flipBackSpread: -1,  // not used
        showFlipOverlay: false,
        initialFlipAngle: 0,
      }
    }

    if (flipDirection === 'next') {
      return {
        baseLeftSpread: currentSpread,
        baseRightSpread: currentSpread + 1,
        flipFrontSpread: currentSpread,       // front face = current right page
        flipBackSpread: currentSpread + 1,     // back face = next left page
        showFlipOverlay: true,
        initialFlipAngle: 0, // starts at 0, animates to -180
      }
    }

    // prev
    return {
      baseLeftSpread: currentSpread - 1,
      baseRightSpread: currentSpread,
      flipFrontSpread: currentSpread - 1,      // front face = prev right page
      flipBackSpread: currentSpread,            // back face = current left page
      showFlipOverlay: true,
      initialFlipAngle: -180, // starts at -180, animates to 0
    }
  }

  const flipData = getFlipData()

  // ─── Grid View ────────────────────────────────────
  const renderGridView = () => (
    <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
      {isLoadingPhotos ? (
        <div className="col-span-full flex flex-col items-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--wedding-purple)' }} />
          <p className="text-sm" style={{ color: 'var(--wedding-purple-dark)' }}>Carregando fotos...</p>
        </div>
      ) : regularPhotos.length === 0 ? (
        <div className="col-span-full text-center py-16">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-soft-lavender)' }}>
            <ImageIcon className="w-10 h-10" style={{ color: 'var(--wedding-purple)' }} />
          </div>
          <p className="text-lg font-semibold mb-1" style={{ color: 'var(--wedding-deep)' }}>
            Seja o primeiro a enviar uma foto!
          </p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Compartilhe seus melhores momentos 💜</p>
        </div>
      ) : (
        regularPhotos.map((photo) => {
          const p = parseGuestName(photo.guestName)
          return (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="break-inside-avoid"
            >
              <div
                className={`overflow-hidden cursor-pointer group rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 ${
                  p.frame === 'classic' ? 'frame-classic' : p.frame === 'floral' ? 'frame-floral' : 'frame-modern'
                } bg-white`}
                onClick={() => setSelectedPhoto(photo)}
              >
                <div className="p-1">
                  <img
                    src={`/uploads/${photo.filename}`}
                    alt={`Foto de ${p.name}`}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-lg"
                    loading="lazy"
                    style={{ minHeight: '120px' }}
                  />
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--wedding-deep)' }}>
                    {p.name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {timeAgo(photo.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })
      )}
    </div>
  )

  // ─── Main Render ───────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--wedding-cream)' }}>
      {/* ═══════════ HEADER BAR ═══════════ */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{ backgroundColor: 'rgba(251,247,255,0.9)', borderColor: 'var(--wedding-lavender)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 fill-current" style={{ color: 'var(--wedding-purple)' }} />
            <h1
              className="text-base sm:text-lg font-bold"
              style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}
            >
              {COUPLE_NAMES}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--wedding-lavender)' }}>
              <button
                onClick={() => setViewMode('book')}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-all ${
                  viewMode === 'book' ? 'text-white shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: viewMode === 'book' ? 'var(--wedding-purple)' : 'transparent',
                  color: viewMode === 'book' ? 'white' : 'var(--wedding-purple-dark)',
                }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Álbum</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-all ${
                  viewMode === 'grid' ? 'text-white shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: viewMode === 'grid' ? 'var(--wedding-purple)' : 'transparent',
                  color: viewMode === 'grid' ? 'white' : 'var(--wedding-purple-dark)',
                }}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Galeria</span>
              </button>
            </div>

            <Button
              onClick={requestUpload}
              size="sm"
              className="rounded-lg text-xs font-medium shadow-sm"
              style={{ backgroundColor: 'var(--wedding-purple)', color: 'white' }}
            >
              <Camera className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Enviar Foto</span>
              <span className="sm:hidden">Foto</span>
            </Button>

            <Button
              onClick={downloadAllPhotos}
              variant="outline"
              size="sm"
              className="rounded-lg text-xs font-medium shadow-sm hidden sm:flex"
              style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple-dark)' }}
              disabled={photos.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Baixar
            </Button>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'book' ? (
          /* ═══════════ 3D BOOK VIEW ═══════════ */
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 md:p-6">
            {/* 3D Book Container */}
            <div
              className="w-full max-w-4xl relative book-3d book-shadow rounded-lg overflow-hidden"
              style={{
                height: 'calc(100vh - 140px)',
                minHeight: '400px',
                touchAction: 'manipulation',
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* ─── Base Left Page ─── */}
              <div
                className="absolute left-0 top-0 w-1/2 h-full"
                style={{ zIndex: 1 }}
              >
                {renderLeftHalf(flipData.baseLeftSpread)}
                {/* Spine edge gradient */}
                <div className="page-spine-edge-left" />
              </div>

              {/* ─── Base Right Page ─── */}
              <div
                className="absolute right-0 top-0 w-1/2 h-full"
                style={{ zIndex: 1 }}
              >
                {renderRightHalf(flipData.baseRightSpread)}
                {/* Spine edge gradient */}
                <div className="page-spine-edge-right" />
              </div>

              {/* ─── Shadow overlays during flip ─── */}
              <div
                className={`flip-shadow ${isFlipping ? 'flip-shadow-active' : ''}`}
              />
              <div
                className={`flip-shadow-left ${isFlipping ? 'flip-shadow-left-active' : ''}`}
              />
              <div
                className={`flip-depth-shadow ${isFlipping ? 'flip-depth-shadow-active' : ''}`}
              />

              {/* ─── Flippable Page (3D) ─── */}
              {flipData.showFlipOverlay && (
                <div
                  ref={flipPageRef}
                  className="flippable-page"
                  style={{
                    zIndex: 10,
                    transform: `rotateY(${flipData.initialFlipAngle}deg)`,
                    transition: 'none', // Will be set by JS during animation
                  }}
                >
                  {/* Front Face */}
                  <div className="page-face page-face-front">
                    {renderRightHalf(flipData.flipFrontSpread)}
                    {/* Spine edge gradient on front face */}
                    <div className="page-spine-edge-right" />
                    {/* Page turn shadow gradient near spine */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[60px] pointer-events-none"
                      style={{
                        background: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 100%)',
                        zIndex: 3,
                      }}
                    />
                  </div>

                  {/* Back Face */}
                  <div className="page-face page-face-back">
                    {renderLeftHalf(flipData.flipBackSpread)}
                    {/* Spine edge gradient on back face */}
                    <div className="page-spine-edge-left" />
                    {/* Page turn shadow gradient near spine (mirrored) */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-[60px] pointer-events-none"
                      style={{
                        background: 'linear-gradient(to left, rgba(0,0,0,0.08) 0%, transparent 100%)',
                        zIndex: 3,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ─── Book Spine ─── */}
              <div className="book-spine" />

              {/* ─── Navigation arrows ─── */}
              <button
                onClick={prevPage}
                disabled={currentSpread === 0 || isFlipping}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-30 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
                style={{
                  backgroundColor: 'var(--wedding-purple)',
                  color: 'white',
                }}
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextPage}
                disabled={currentSpread >= totalSpreads - 1 || isFlipping}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-30 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
                style={{
                  backgroundColor: 'var(--wedding-purple)',
                  color: 'white',
                }}
                aria-label="Próxima página"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Page indicator */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={currentSpread === 0 || isFlipping}
                className="p-1 rounded disabled:opacity-30"
                style={{ color: 'var(--wedding-purple)' }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSpreads }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSpread(i)}
                    disabled={isFlipping}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentSpread ? 'w-6' : ''
                    }`}
                    style={{
                      backgroundColor: i === currentSpread ? 'var(--wedding-purple)' : 'var(--wedding-lavender)',
                    }}
                    aria-label={`Ir para página ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={nextPage}
                disabled={currentSpread >= totalSpreads - 1 || isFlipping}
                className="p-1 rounded disabled:opacity-30"
                style={{ color: 'var(--wedding-purple)' }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Page label */}
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {currentSpread === 0
                ? 'Capa'
                : isSignatureSpreadFn(currentSpread)
                ? 'Assinaturas'
                : isBackCoverFn(currentSpread)
                ? 'Contracapa'
                : `Página ${currentSpread} de ${totalSpreads - 2}`}
            </p>
          </div>
        ) : (
          /* ═══════════ GRID VIEW ═══════════ */
          <div className="max-w-5xl mx-auto w-full px-4 py-6">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ backgroundColor: 'var(--wedding-lavender)' }} />
              <h2
                className="text-xl font-bold text-center whitespace-nowrap"
                style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}
              >
                Galeria de Fotos
              </h2>
              <div className="h-px flex-1" style={{ backgroundColor: 'var(--wedding-lavender)' }} />
            </div>

            {renderGridView()}
          </div>
        )}
      </main>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer
        className="border-t py-2 px-4 text-center"
        style={{ backgroundColor: 'white', borderColor: 'var(--wedding-lavender)' }}
      >
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <Heart className="w-3 h-3 inline mr-1 fill-current" style={{ color: 'var(--wedding-purple)' }} />
          Feito com amor para {COUPLE_NAMES} 💜
        </p>
      </footer>

      {/* ═══════════ PIN MODAL ═══════════ */}
      <PINModal key={showPinModal ? 'open' : 'closed'} open={showPinModal} onVerified={handlePinVerified} />
      {showPinModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(45, 32, 64, 0.3)' }}
          onClick={() => setShowPinModal(false)}
        />
      )}

      {/* ═══════════ UPLOAD DIALOG ═══════════ */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent
          className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
          style={{ backgroundColor: 'white' }}
        >
          <DialogTitle className="sr-only">Enviar Foto</DialogTitle>
          <DialogDescription className="sr-only">Envie sua foto para o álbum do casamento</DialogDescription>

          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--wedding-soft-lavender)' }}
                >
                  <Camera className="w-4 h-4" style={{ color: 'var(--wedding-purple)' }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--wedding-deep)', fontFamily: 'Georgia, serif' }}>
                  Enviar Foto
                </h3>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--wedding-deep)' }}>
                Seu nome
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wedding-purple)' }} />
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Digite seu nome"
                  className="pl-10 h-10 rounded-xl"
                  style={{ borderColor: 'var(--wedding-lavender)', backgroundColor: 'var(--wedding-cream)' }}
                  maxLength={50}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--wedding-deep)' }}>
                <Palette className="w-3.5 h-3.5 inline mr-1" />
                Escolha a moldura
              </label>
              <FrameSelector selected={selectedFrame} onSelect={setSelectedFrame} />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="h-11 rounded-xl text-sm font-semibold shadow-sm"
                style={{ backgroundColor: 'var(--wedding-purple)', color: 'white' }}
                asChild
              >
                <span>
                  <Camera className="w-4 h-4 mr-1.5" />
                  Tirar Foto
                </span>
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="h-11 rounded-xl text-sm font-semibold shadow-sm border-2"
                style={{ borderColor: 'var(--wedding-purple)', color: 'var(--wedding-purple-dark)' }}
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Enviar
                </span>
              </Button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={false}
              className="hidden"
              onChange={handleFileSelect}
            />

            <AnimatePresence>
              {previewUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-3"
                >
                  <div
                    className="relative rounded-xl overflow-hidden shadow-sm"
                    style={{ border: '2px solid var(--wedding-lavender)' }}
                  >
                    <img
                      src={previewUrl}
                      alt="Pré-visualização"
                      className="w-full max-h-48 object-contain"
                      style={{ backgroundColor: 'var(--wedding-cream)' }}
                    />
                    <button
                      onClick={clearPreview}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                      style={{ backgroundColor: 'rgba(45,32,64,0.7)', color: 'white' }}
                      aria-label="Remover foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {selectedFile && (
                      <div
                        className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs"
                        style={{ backgroundColor: 'rgba(45,32,64,0.6)', color: 'white' }}
                      >
                        {selectedFile.name} · {formatSize(selectedFile.size)}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full h-11 rounded-xl text-base font-semibold shadow-md"
                    style={{ backgroundColor: 'var(--wedding-purple)', color: 'white' }}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar Foto
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════ PHOTO VIEWER DIALOG ═══════════ */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent
          className="max-w-3xl p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
          style={{ backgroundColor: 'white' }}
        >
          {selectedPhoto && (
            <>
              <DialogTitle className="sr-only">Foto de {parseGuestName(selectedPhoto.guestName).name}</DialogTitle>
              <DialogDescription className="sr-only">
                Foto enviada por {parseGuestName(selectedPhoto.guestName).name} em{' '}
                {new Date(selectedPhoto.createdAt).toLocaleString('pt-BR')}
              </DialogDescription>
              <div className="relative">
                <img
                  src={`/uploads/${selectedPhoto.filename}`}
                  alt={`Foto de ${parseGuestName(selectedPhoto.guestName).name}`}
                  className="w-full max-h-[75vh] object-contain"
                  style={{ backgroundColor: 'var(--wedding-cream)' }}
                />
              </div>
              <div
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: 'white' }}
              >
                <div>
                  <p className="font-semibold" style={{ color: 'var(--wedding-deep)' }}>
                    {parseGuestName(selectedPhoto.guestName).name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(selectedPhoto.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <a
                  href={`/uploads/${selectedPhoto.filename}`}
                  download={selectedPhoto.originalName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg shadow-sm"
                    style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple-dark)' }}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Salvar
                  </Button>
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
