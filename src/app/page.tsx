'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, Heart, Lock, BookOpen, ChevronLeft, ChevronRight,
  Pen, Eraser, Loader2, Users, X, Sparkles,
  Image as ImageIcon, Download, Check,
  MessageSquare, Feather, Crown, Gem,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
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
  message: string
}

type FrameStyle = 'classic' | 'floral' | 'modern'
type ViewMode = 'book' | 'grid'

// ─── Constants ───────────────────────────────────────────
const WEDDING_PIN = '2025'
const COUPLE_NAMES = 'Patrícia & Samuel'
const WEDDING_DATE = '2026'
const FLIP_DURATION = 900

// ─── Utility: Parse guestName with frame & message ───────
function parseGuestName(raw: string): ParsedGuest {
  const nameAndRest = raw.split('|frame:')
  const name = nameAndRest[0] || 'Convidado'
  const rest = nameAndRest[1] || 'classic'
  const frameAndMsg = rest.split('|msg:')
  const frameStr = frameAndMsg[0]?.replace('|signature', '') || 'classic'
  const message = frameAndMsg[1] ? decodeURIComponent(frameAndMsg[1]) : ''
  const isSignature = raw.includes('|signature')
  const validFrames: FrameStyle[] = ['classic', 'floral', 'modern']
  const frame = validFrames.includes(frameStr as FrameStyle) ? (frameStr as FrameStyle) : 'classic'
  return { name, frame, message: isSignature ? '' : message }
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

// ─── Ornamental Divider Component ────────────────────────
function OrnamentalDivider({ color, className }: { color?: string; className?: string }) {
  return (
    <div className={`ornament-divider ${className || ''}`}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill={color || 'var(--wedding-gold)'} opacity="0.6" />
      </svg>
    </div>
  )
}

// ─── Monogram Component ─────────────────────────────────
function Monogram({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 64 : 40
  const fs = size === 'lg' ? 22 : 14
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" stroke="var(--wedding-gold)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="40" cy="40" r="34" stroke="var(--wedding-gold)" strokeWidth="0.5" opacity="0.3" />
      <text x="28" y="48" fontFamily="Cormorant Garamond, serif" fontSize={fs} fill="var(--wedding-gold)" fontWeight="300" fontStyle="italic">P</text>
      <text x="38" y="52" fontFamily="Cormorant Garamond, serif" fontSize="14" fill="var(--wedding-gold)" opacity="0.6">&</text>
      <text x="47" y="48" fontFamily="Cormorant Garamond, serif" fontSize={fs} fill="var(--wedding-gold)" fontWeight="300" fontStyle="italic">S</text>
    </svg>
  )
}

// ─── Photo Frame Component ──────────────────────────────
function PhotoFrame({
  src, alt, frameStyle, className, onClick,
}: {
  src: string; alt: string; frameStyle: FrameStyle; className?: string; onClick?: () => void
}) {
  const frameClasses: Record<FrameStyle, string> = {
    classic: 'frame-classic',
    floral: 'frame-floral',
    modern: 'frame-modern',
  }
  return (
    <div className={`relative cursor-pointer ${className || ''}`} onClick={onClick}>
      <div className={`${frameClasses[frameStyle]} bg-white`}>
        <img src={src} alt={alt} className="w-full h-full object-contain" loading="lazy" />
      </div>
    </div>
  )
}

// ─── Frame Selector ──────────────────────────────────────
function FrameSelector({ selected, onSelect }: { selected: FrameStyle; onSelect: (f: FrameStyle) => void }) {
  const frames: { id: FrameStyle; label: string; icon: string; desc: string }[] = [
    { id: 'classic', label: 'Dourado', icon: '🖼️', desc: 'Clássico real' },
    { id: 'floral', label: 'Lavanda', icon: '🌸', desc: 'Elegância suave' },
    { id: 'modern', label: 'Moderno', icon: '✦', desc: 'Minimalista' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {frames.map((f) => (
        <button key={f.id} type="button" onClick={() => onSelect(f.id)}
          className={`relative p-2 sm:p-3 rounded-xl border-2 transition-all text-center ${
            selected === f.id
              ? 'border-[var(--wedding-gold)] bg-[var(--wedding-lavender-soft)] shadow-lg'
              : 'border-[var(--wedding-lavender)] bg-white hover:border-[var(--wedding-gold)]'
          }`}>
          {selected === f.id && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-gold)' }}>
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          <span className="text-base block mb-0.5">{f.icon}</span>
          <span className="text-[10px] font-semibold block" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{f.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── PIN Modal Component ────────────────────────────────
function PINModal({ open, onVerified }: { open: boolean; onVerified: () => void }) {
  const { toast } = useToast()
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (open) setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }, [open])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    setError(false)
    if (value && index < 3) inputRefs.current[index + 1]?.focus()
    if (newPin.every((d) => d !== '')) {
      if (newPin.join('') === WEDDING_PIN) {
        sessionStorage.setItem('wedding_pin_verified', 'true')
        onVerified()
      } else {
        setError(true); setShaking(true)
        setTimeout(() => setShaking(false), 500)
        toast({ title: 'Código incorreto', variant: 'destructive' })
        setTimeout(() => { setPin(['', '', '', '']); inputRefs.current[0]?.focus() }, 600)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(45, 27, 61, 0.85)', backdropFilter: 'blur(12px)' }}>
          <motion.div
            initial={{ scale: 0.85, y: 30 }} animate={{ scale: shaking ? 1.02 : 1, y: 0 }} exit={{ scale: 0.85, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-xs sm:max-w-sm rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden bg-white">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), var(--wedding-purple), var(--wedding-gold))' }} />
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
              <Lock className="w-6 h-6" style={{ color: 'var(--wedding-purple)' }} />
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Código de Acesso
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Insira o código para enviar fotos
            </p>
            <div className="flex justify-center gap-2 sm:gap-3 mb-3">
              {pin.map((digit, i) => (
                <input key={i} ref={(el) => { inputRefs.current[i] = el }} type="tel" inputMode="numeric" maxLength={1}
                  value={digit} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`pin-digit ${error ? '!border-red-400' : ''}`}
                  aria-label={`Dígito ${i + 1}`} />
              ))}
            </div>
            {error && <p className="text-xs text-red-500 font-medium">Código incorreto</p>}
            <p className="text-[10px] mt-3 opacity-40" style={{ color: 'var(--muted-foreground)' }}>
              Peça o código aos noivos
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
  const [strokeColor, setStrokeColor] = useState('#4A1A6B')
  const [hasContent, setHasContent] = useState(false)
  const lastPointRef = useRef<{ x: number; y: number; pressure: number } | null>(null)

  const colors = [
    { value: '#4A1A6B', label: 'Royal' },
    { value: '#C9A96E', label: 'Ouro' },
    { value: '#2D1B3D', label: 'Ébano' },
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
        ctx.fillStyle = '#FFFAF3'
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.strokeStyle = 'rgba(201, 169, 110, 0.12)'
        ctx.lineWidth = 0.5
        for (let y = 24; y < rect.height; y += 22) {
          ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(rect.width - 12, y); ctx.stroke()
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
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 }
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
    const width = 2 * (0.5 + pressure * 1.5)
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

  const handlePointerUp = () => { setIsDrawing(false); lastPointRef.current = null }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#FFFAF3'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = 'rgba(201, 169, 110, 0.12)'
    ctx.lineWidth = 0.5
    for (let y = 24; y < rect.height; y += 22) {
      ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(rect.width - 12, y); ctx.stroke()
    }
    setHasContent(false)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `assinatura-${Date.now()}.png`, { type: 'image/png' })
      onSave(file)
      clearCanvas()
    }, 'image/png', 1.0)
  }

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-lg overflow-hidden shadow-inner" style={{ border: '2px solid rgba(201,169,110,0.3)' }}>
        <canvas ref={canvasRef} className="signature-canvas w-full" style={{ height: '160px', background: '#FFFAF3' }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex gap-1">
          {colors.map((c) => (
            <button key={c.value} type="button" onClick={() => setStrokeColor(c.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${strokeColor === c.value ? 'scale-110 shadow-md' : 'hover:scale-105'}`}
              style={{ backgroundColor: c.value, borderColor: strokeColor === c.value ? 'var(--wedding-gold)' : 'transparent' }}
              aria-label={`Cor ${c.label}`} />
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="rounded-lg text-[10px] h-7 px-2"
            style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple)' }}>
            <Eraser className="w-3 h-3 mr-0.5" /> Limpar
          </Button>
          <Button type="button" size="sm" onClick={saveSignature} disabled={!hasContent} className="rounded-lg text-[10px] h-7 px-2"
            style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}>
            <Upload className="w-3 h-3 mr-0.5" /> Assinar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function Home() {
  const { toast } = useToast()

  // ─── State ─────────────────────────────────────────
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('book')
  const [currentSpread, setCurrentSpread] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestMessage, setGuestMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState<FrameStyle>('classic')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flipPageRef = useRef<HTMLDivElement>(null)
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Check mobile ─────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ─── Check PIN on mount ────────────────────────────
  useEffect(() => {
    const verified = sessionStorage.getItem('wedding_pin_verified') === 'true'
    if (verified) setIsPinVerified(true)
  }, [])

  // ─── Compute album pages ───────────────────────────
  const sortedPhotos = [...photos].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const signaturePhotos = sortedPhotos.filter((p) => p.originalName.startsWith('assinatura-') || p.guestName.includes('|signature'))
  const regularPhotos = sortedPhotos.filter((p) => !p.originalName.startsWith('assinatura-') && !p.guestName.includes('|signature'))

  // Each spread shows 2 pages (left + right). On mobile single page mode.
  const photosPerPage = isMobile ? 1 : 2
  const pages: { photos: Photo[]; isSignature: boolean }[] = []

  // Build pages: each page holds 1 photo with message/signature space
  for (let i = 0; i < regularPhotos.length; i++) {
    pages.push({ photos: [regularPhotos[i]], isSignature: false })
  }
  // Always have at least one empty page
  if (pages.length === 0) pages.push({ photos: [], isSignature: false })
  // Signature page at end
  if (signaturePhotos.length > 0 || true) {
    pages.push({ photos: signaturePhotos, isSignature: true })
  }

  // Spreads for book view (2 pages per spread on desktop)
  const spreads: { left: typeof pages[0] | null; right: typeof pages[0] | null }[] = []
  // Cover spread
  spreads.push({ left: null, right: null }) // cover
  // Photo spreads
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push({ left: pages[i], right: pages[i + 1] || { photos: [], isSignature: false } })
  }
  // Back cover
  spreads.push({ left: null, right: null })

  const totalSpreads = spreads.length

  // ─── Fetch photos ──────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos')
      if (res.ok) { const data = await res.json(); setPhotos(data.photos) }
    } catch { /* */ } finally { setIsLoadingPhotos(false) }
  }, [])

  // ─── WebSocket ─────────────────────────────────────
  useEffect(() => {
    fetchPhotos()
    const socket = io('/?XTransformPort=3001', { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000 })
    socketRef.current = socket
    socket.on('photo_update', (data: { type: string; photo: Photo }) => {
      if (data.type === 'new_photo') {
        setPhotos((prev) => prev.some((p) => p.id === data.photo.id) ? prev : [...prev, data.photo])
        toast({ title: 'Nova foto!', description: `${parseGuestName(data.photo.guestName).name} enviou uma foto` })
      }
    })
    pollingRef.current = setInterval(fetchPhotos, 10000)
    return () => { socket.disconnect(); if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [fetchPhotos, toast])

  // ─── 3D Flip Navigation (CodePen-style) ───────────
  const performFlipNext = useCallback(() => {
    if (isFlipping || currentSpread >= totalSpreads - 1) return
    setIsFlipping(true)
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
    flipTimeoutRef.current = setTimeout(() => { setCurrentSpread(prev => prev + 1); setIsFlipping(false) }, FLIP_DURATION + 50)
  }, [isFlipping, currentSpread, totalSpreads])

  const performFlipPrev = useCallback(() => {
    if (isFlipping || currentSpread <= 0) return
    setIsFlipping(true)
    // On prev, we set currentSpread back and animate from -180 to 0
    requestAnimationFrame(() => {
      const el = flipPageRef.current
      if (el) {
        el.style.transition = 'none'
        el.style.transform = 'rotateY(-180deg)'
        void el.offsetHeight // force reflow
        el.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.645, 0.045, 0.355, 1)`
        el.style.transform = 'rotateY(0deg)'
      }
    })
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current)
    flipTimeoutRef.current = setTimeout(() => { setCurrentSpread(prev => prev - 1); setIsFlipping(false) }, FLIP_DURATION + 50)
  }, [isFlipping, currentSpread])

  const goToSpread = useCallback((index: number) => {
    if (isFlipping || index < 0 || index >= totalSpreads) return
    setCurrentSpread(index)
  }, [isFlipping, totalSpreads])

  // ─── Keyboard navigation ──────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') performFlipNext()
      if (e.key === 'ArrowLeft') performFlipPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [performFlipNext, performFlipPrev])

  // ─── Touch/swipe ──────────────────────────────────
  const touchStartRef = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const diff = touchStartRef.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) { diff > 0 ? performFlipNext() : performFlipPrev() }
    touchStartRef.current = null
  }

  // ─── Upload handlers ──────────────────────────────
  const requestUpload = () => {
    if (!isPinVerified) { setShowPinModal(true); return }
    setShowUploadDialog(true)
  }

  const handlePinVerified = () => { setIsPinVerified(true); setShowPinModal(false); setShowUploadDialog(true) }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      toast({ title: 'Tipo inválido', description: 'Use JPG, PNG ou WebP.', variant: 'destructive' }); return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo grande', description: 'Máximo 10MB.', variant: 'destructive' }); return
    }
    setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file))
  }

  // Compress image before upload to reduce memory usage
  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      if (file.size < 500 * 1024) { resolve(file); return } // Skip small files
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth }
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          resolve(compressed)
        }, 'image/jpeg', quality)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  const handleUpload = async () => {
    if (!selectedFile) { toast({ title: 'Selecione uma foto', variant: 'destructive' }); return }
    setIsUploading(true)
    try {
      // Compress image first
      const compressedFile = await compressImage(selectedFile)
      const msgEncoded = guestMessage.trim() ? encodeURIComponent(guestMessage.trim()) : ''
      const guestNameStr = `${guestName.trim() || 'Convidado'}|frame:${selectedFrame}${msgEncoded ? `|msg:${msgEncoded}` : ''}`

      // Try FormData upload first, fall back to base64
      let success = false

      // Method 1: FormData
      try {
        const formData = new FormData()
        formData.append('photo', compressedFile)
        formData.append('guestName', guestNameStr)
        const res = await fetch('/api/photos', { method: 'POST', body: formData })
        if (res.ok) { success = true }
      } catch {}

      // Method 2: Base64 JSON if FormData failed
      if (!success) {
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(compressedFile)
        })
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo: base64,
            filename: compressedFile.name,
            mimeType: compressedFile.type || 'image/jpeg',
            guestName: guestNameStr,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto')
      }

      toast({ title: 'Foto enviada!', description: 'Sua foto foi adicionada ao álbum!' })
      setSelectedFile(null); setPreviewUrl(null); setGuestName(''); setGuestMessage('')
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowUploadDialog(false); await fetchPhotos()
    } catch (err) {
      toast({ title: 'Erro ao enviar', description: err instanceof Error ? err.message : 'Tente novamente.', variant: 'destructive' })
    } finally { setIsUploading(false) }
  }

  const handleSignatureSave = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('guestName', `${guestName.trim() || 'Convidado'}|frame:classic|signature`)
      const res = await fetch('/api/photos', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro ao salvar assinatura')
      toast({ title: 'Assinatura salva!', description: 'Sua mensagem foi adicionada ao álbum!' })
      await fetchPhotos()
    } catch { toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' }) }
  }

  const clearPreview = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Render single photo page ──────────────────────
  const renderPhotoPage = (pagePhotos: Photo[], side: 'left' | 'right' | 'single') => (
    <div className="w-full h-full page-texture flex flex-col relative"
      style={{
        background: `linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)`,
        borderRadius: side === 'left' ? '2px 0 0 2px' : side === 'right' ? '0 2px 2px 0' : '2px',
      }}>
      {pagePhotos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center opacity-25 p-4">
          <Feather className="w-6 h-6 sm:w-8 sm:h-8 mb-2" style={{ color: 'var(--wedding-lavender)' }} />
          <p className="text-[10px] sm:text-xs italic text-center" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Aguardando fotos...
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2 sm:p-3 md:p-4 min-h-0">
          {pagePhotos.map((photo) => {
            const p = parseGuestName(photo.guestName)
            return (
              <div key={photo.id} className="flex-1 flex flex-col min-h-0 elegant-fade-in">
                {/* Photo with frame */}
                <div className="flex-1 flex items-center justify-center min-h-0" style={{ maxHeight: '55%' }}>
                  <PhotoFrame
                    src={`/uploads/${photo.filename}`} alt={`Foto de ${p.name}`} frameStyle={p.frame}
                    className="max-w-[95%] max-h-full" onClick={() => setSelectedPhoto(photo)}
                  />
                </div>
                {/* Guest name */}
                <p className="text-center text-[11px] sm:text-[13px] mt-1 italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  — {p.name}
                </p>
                {/* Divider */}
                <div className="my-1">
                  <OrnamentalDivider color="var(--wedding-gold)" />
                </div>
                {/* Message/signature area - this is the space for guests to write */}
                <div className="message-lines px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-1 min-h-[40px]" style={{ maxHeight: '30%' }}>
                  {p.message ? (
                    <p className="text-[10px] sm:text-[12px] italic leading-6 sm:leading-7" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      &ldquo;{p.message}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[9px] sm:text-[11px] italic leading-6 sm:leading-7 opacity-20" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      Espaço para mensagem e assinatura...
                    </p>
                  )}
                </div>
                {/* Date */}
                <p className="text-[8px] sm:text-[10px] text-right mt-0.5 opacity-25" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {new Date(photo.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Render signature page ────────────────────────
  const renderSignaturePage = () => (
    <div className="w-full h-full page-texture flex flex-col p-2 sm:p-3 md:p-4 relative"
      style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
      <div className="text-center mb-1.5 sm:mb-2">
        <Feather className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-0.5" style={{ color: 'var(--wedding-gold)' }} />
        <h3 className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          Deixe sua Mensagem
        </h3>
      </div>
      <div className="mb-1.5 sm:mb-2">
        <div className="relative">
          <Users className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--wedding-gold)' }} />
          <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Seu nome"
            className="pl-7 h-8 text-[11px] rounded-lg" style={{ borderColor: 'rgba(201,169,110,0.3)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={50} />
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <SignaturePad onSave={handleSignatureSave} />
      </div>
    </div>
  )

  // ─── Render LEFT half of a spread ─────────────────
  const renderLeftHalf = (spreadIndex: number) => {
    const spread = spreads[spreadIndex]
    // Cover
    if (spreadIndex === 0) {
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4A1A6B 0%, #3D1452 35%, #2D1B3D 70%, #1A0E2E 100%)' }}>
          <div className="absolute inset-3 sm:inset-4 border border-glow rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.25)' }} />
          <div className="absolute inset-5 sm:inset-6 border rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.12)' }} />
          <div className="relative z-10 text-center">
            <div className="mb-2 sm:mb-4"><Monogram size="lg" /></div>
            <h1 className="gold-shimmer text-2xl sm:text-4xl md:text-5xl font-light mb-1 sm:mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.05em' }}>
              Patrícia
            </h1>
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <div className="h-px w-8 sm:w-16" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
              <Crown className="w-3 h-3 sm:w-5 sm:h-5" style={{ color: 'var(--wedding-gold)', opacity: 0.6 }} />
              <div className="h-px w-8 sm:w-16" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
            </div>
            <h1 className="gold-shimmer text-2xl sm:text-4xl md:text-5xl font-light mb-2 sm:mb-4" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.05em' }}>
              Samuel
            </h1>
            <OrnamentalDivider color="var(--wedding-gold)" />
            <p className="text-[10px] sm:text-sm tracking-[0.3em] uppercase mt-2 sm:mt-3" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {WEDDING_DATE}
            </p>
          </div>
        </div>
      )
    }
    // Back cover
    if (spreadIndex === totalSpreads - 1) {
      return (
        <div className="w-full h-full page-texture flex flex-col items-center justify-center p-3 sm:p-6 relative"
          style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
          <div className="text-center">
            <div className="mb-3"><Monogram size="sm" /></div>
            <OrnamentalDivider color="var(--wedding-gold)" />
            <h2 className="text-lg sm:text-2xl font-light mt-3 sm:mt-4 mb-2 sm:mb-3" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Obrigado
            </h2>
            <p className="text-[11px] sm:text-sm leading-relaxed mb-2 sm:mb-3 italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Agradecemos a todos que fizeram parte deste momento mágico.
            </p>
            <OrnamentalDivider color="var(--wedding-gold)" />
            <p className="text-[10px] sm:text-xs mt-2 sm:mt-3 italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Com todo nosso amor,<br />
              <span style={{ color: 'var(--wedding-gold-dark)', fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '12px' }}>Patrícia & Samuel</span>
            </p>
          </div>
        </div>
      )
    }
    // Photo or signature page
    if (spread?.left?.isSignature) return renderSignaturePage()
    return renderPhotoPage(spread?.left?.photos || [], 'left')
  }

  // ─── Render RIGHT half of a spread ────────────────
  const renderRightHalf = (spreadIndex: number) => {
    const spread = spreads[spreadIndex]
    // Cover right - Welcome
    if (spreadIndex === 0) {
      return (
        <div className="w-full h-full page-texture flex flex-col items-center justify-center p-3 sm:p-6 relative"
          style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
          <div className="text-center max-w-[90%]">
            <Gem className="w-5 h-5 sm:w-7 sm:h-7 mx-auto mb-2 sm:mb-4" style={{ color: 'var(--wedding-gold)' }} />
            <h2 className="text-lg sm:text-2xl font-light mb-2 sm:mb-3" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Bem-vindos ao Nosso Álbum
            </h2>
            <OrnamentalDivider color="var(--wedding-gold)" className="mb-2 sm:mb-3" />
            <p className="text-[10px] sm:text-sm mb-3 sm:mb-4 leading-relaxed italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Este álbum foi criado com todo nosso amor para guardar os melhores momentos do dia mais especial das nossas vidas.
            </p>
            <OrnamentalDivider color="var(--wedding-gold)" className="mb-2 sm:mb-3" />
            <div className="mt-2 sm:mt-3">
              <Badge className="px-3 py-1 rounded-full text-[10px] sm:text-xs" style={{ backgroundColor: 'var(--wedding-lavender-soft)', color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <ImageIcon className="w-3 h-3 mr-1" />
                {regularPhotos.length} {regularPhotos.length === 1 ? 'foto' : 'fotos'} no álbum
              </Badge>
            </div>
          </div>
        </div>
      )
    }
    // Back cover right
    if (spreadIndex === totalSpreads - 1) {
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4A1A6B 0%, #3D1452 35%, #2D1B3D 70%, #1A0E2E 100%)' }}>
          <div className="absolute inset-3 sm:inset-4 border border-glow rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.15)' }} />
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="h-px w-8 sm:w-12" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.3 }} />
              <Crown className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: 'var(--wedding-gold)', opacity: 0.5 }} />
              <div className="h-px w-8 sm:w-12" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.3 }} />
            </div>
            <p className="gold-shimmer text-sm sm:text-lg tracking-[0.3em] uppercase" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Patrícia & Samuel
            </p>
            <OrnamentalDivider color="var(--wedding-gold)" className="my-2 sm:my-3" />
            <p className="text-[10px] sm:text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {WEDDING_DATE}
            </p>
          </div>
        </div>
      )
    }
    // Photo or signature page
    if (spread?.right?.isSignature) return renderSignaturePage()
    return renderPhotoPage(spread?.right?.photos || [], 'right')
  }

  // ─── Grid View ────────────────────────────────────
  const renderGridView = () => (
    <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
      {isLoadingPhotos ? (
        <div className="col-span-full flex flex-col items-center py-12 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--wedding-gold)' }} />
          <p className="text-xs" style={{ color: 'var(--wedding-purple)' }}>Carregando...</p>
        </div>
      ) : regularPhotos.length === 0 ? (
        <div className="col-span-full text-center py-12">
          <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
            <Feather className="w-8 h-8" style={{ color: 'var(--wedding-gold)' }} />
          </div>
          <p className="text-base font-light mb-1" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Seja o primeiro!
          </p>
        </div>
      ) : (
        regularPhotos.map((photo) => {
          const p = parseGuestName(photo.guestName)
          return (
            <motion.div key={photo.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="break-inside-avoid">
              <div className="overflow-hidden cursor-pointer group rounded-lg shadow-sm hover:shadow-lg transition-all bg-white"
                onClick={() => setSelectedPhoto(photo)}>
                <img src={`/uploads/${photo.filename}`} alt={`Foto de ${p.name}`} className="w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" style={{ minHeight: '100px' }} />
                <div className="p-2">
                  <p className="text-[11px] font-medium truncate" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>{p.name}</p>
                  {p.message && (
                    <p className="text-[10px] mt-0.5 italic line-clamp-2" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>&ldquo;{p.message}&rdquo;</p>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--wedding-cream)' }}>
      {/* ═══ HEADER - Compact & Mobile Friendly ═══ */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-lg" style={{ backgroundColor: 'rgba(255,249,240,0.92)', borderColor: 'rgba(201,169,110,0.15)' }}>
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: 'var(--wedding-gold)' }} />
            <h1 className="text-sm sm:text-lg font-light" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.02em' }}>
              {COUPLE_NAMES}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex rounded-lg sm:rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
              <button onClick={() => setViewMode('book')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-all ${viewMode === 'book' ? 'text-white' : ''}`}
                style={{ backgroundColor: viewMode === 'book' ? 'var(--wedding-royal)' : 'transparent', color: viewMode === 'book' ? 'white' : 'var(--wedding-purple)' }}>
                <BookOpen className="w-3 h-3" /><span className="hidden sm:inline">Álbum</span>
              </button>
              <button onClick={() => setViewMode('grid')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-all ${viewMode === 'grid' ? 'text-white' : ''}`}
                style={{ backgroundColor: viewMode === 'grid' ? 'var(--wedding-royal)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'var(--wedding-purple)' }}>
                <Sparkles className="w-3 h-3" /><span className="hidden sm:inline">Galeria</span>
              </button>
            </div>
            <Button onClick={requestUpload} size="sm" className="rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium shadow-md h-7 sm:h-8"
              style={{ backgroundColor: 'var(--wedding-royal)', color: 'white' }}>
              <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" /><span className="hidden sm:inline">Enviar Foto</span><span className="sm:hidden">Foto</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'book' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-3 md:p-6">
            {/* ═══ 3D BOOK - CodePen Style ═══ */}
            <div className="w-full max-w-4xl relative book-3d book-shadow rounded-md sm:rounded-lg overflow-hidden"
              style={{ height: isMobile ? 'calc(100vh - 100px)' : 'calc(100vh - 120px)', minHeight: isMobile ? '320px' : '400px', touchAction: 'manipulation' }}
              onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

              {/* Base Left Page */}
              <div className="absolute left-0 top-0 w-1/2 h-full" style={{ zIndex: 1 }}>
                {renderLeftHalf(isFlipping ? currentSpread : currentSpread)}
                <div className="page-spine-edge-left" />
              </div>
              {/* Base Right Page (shows NEXT spread content during flip) */}
              <div className="absolute right-0 top-0 w-1/2 h-full" style={{ zIndex: 1 }}>
                {renderRightHalf(isFlipping ? currentSpread + 1 : currentSpread)}
                <div className="page-spine-edge-right" />
              </div>

              {/* Shadow overlays during flip */}
              <div className={`flip-shadow ${isFlipping ? 'flip-shadow-active' : ''}`} />
              <div className={`flip-shadow-left ${isFlipping ? 'flip-shadow-left-active' : ''}`} />

              {/* ═══ Flippable Page - 3D Transform (CodePen style) ═══ */}
              {isFlipping && (
                <div ref={flipPageRef} className="flippable-page"
                  style={{ zIndex: 10, transform: 'rotateY(0deg)', transition: 'none' }}>
                  {/* Front face - current right page */}
                  <div className="page-face page-face-front">
                    {renderRightHalf(currentSpread)}
                    <div className="page-spine-edge-right" />
                    <div className="absolute left-0 top-0 bottom-0 w-[50px] pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 100%)', zIndex: 3 }} />
                  </div>
                  {/* Back face - next left page */}
                  <div className="page-face page-face-back">
                    {renderLeftHalf(currentSpread + 1)}
                    <div className="page-spine-edge-left" />
                    <div className="absolute right-0 top-0 bottom-0 w-[50px] pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.08) 0%, transparent 100%)', zIndex: 3 }} />
                  </div>
                </div>
              )}

              {/* Book Spine */}
              <div className="book-spine" />

              {/* Navigation arrows */}
              <button onClick={performFlipPrev} disabled={currentSpread === 0 || isFlipping}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 sm:-translate-x-3 z-30 w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 disabled:opacity-20 disabled:hover:scale-100"
                style={{ backgroundColor: 'var(--wedding-royal)', color: 'var(--wedding-gold)' }} aria-label="Anterior">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button onClick={performFlipNext} disabled={currentSpread >= totalSpreads - 1 || isFlipping}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 sm:translate-x-3 z-30 w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 disabled:opacity-20 disabled:hover:scale-100"
                style={{ backgroundColor: 'var(--wedding-royal)', color: 'var(--wedding-gold)' }} aria-label="Próxima">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Page indicator */}
            <div className="mt-2 sm:mt-4 flex items-center gap-1.5 sm:gap-2">
              <button onClick={performFlipPrev} disabled={currentSpread === 0 || isFlipping} className="p-0.5 rounded disabled:opacity-20" style={{ color: 'var(--wedding-gold)' }}>
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <div className="flex items-center gap-1 sm:gap-2">
                {Array.from({ length: Math.min(totalSpreads, 10) }, (_, i) => (
                  <button key={i} onClick={() => goToSpread(i)} disabled={isFlipping}
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-500 ${i === currentSpread ? 'w-5 sm:w-7' : ''}`}
                    style={{ backgroundColor: i === currentSpread ? 'var(--wedding-gold)' : 'var(--wedding-lavender)' }}
                    aria-label={`Página ${i + 1}`} />
                ))}
              </div>
              <button onClick={performFlipNext} disabled={currentSpread >= totalSpreads - 1 || isFlipping} className="p-0.5 rounded disabled:opacity-20" style={{ color: 'var(--wedding-gold)' }}>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
            <p className="text-[9px] sm:text-xs mt-1" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {currentSpread === 0 ? 'Capa' : currentSpread === totalSpreads - 1 ? 'Contracapa' : `Página ${currentSpread}`}
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-6">
            {renderGridView()}
          </div>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t py-1.5 sm:py-2 px-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderColor: 'rgba(201,169,110,0.1)' }}>
        <p className="text-[9px] sm:text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          <Heart className="w-2.5 h-2.5 inline mr-1 fill-current" style={{ color: 'var(--wedding-gold)' }} />
          Feito com amor para {COUPLE_NAMES}
        </p>
      </footer>

      {/* ═══ PIN MODAL ═══ */}
      <PINModal key={showPinModal ? 'open' : 'closed'} open={showPinModal} onVerified={handlePinVerified} />
      {showPinModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(45, 27, 61, 0.3)' }} onClick={() => setShowPinModal(false)} />
      )}

      {/* ═══ UPLOAD DIALOG ═══ */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-sm sm:max-w-md p-0 overflow-hidden rounded-xl sm:rounded-2xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'white' }}>
          <DialogTitle className="sr-only">Enviar Foto</DialogTitle>
          <DialogDescription className="sr-only">Envie sua foto para o álbum</DialogDescription>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), var(--wedding-royal), var(--wedding-gold))' }} />
          <div className="p-3 sm:p-5">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: 'var(--wedding-royal)' }} />
              </div>
              <h3 className="text-sm sm:text-lg font-light" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Enviar Foto
              </h3>
            </div>

            <div className="mb-2.5">
              <label className="text-[10px] sm:text-xs font-medium mb-1 block" style={{ color: 'var(--wedding-purple-deep)' }}>
                <Users className="w-3 h-3 inline mr-1" style={{ color: 'var(--wedding-gold)' }} />
                Seu nome
              </label>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Digite seu nome"
                className="h-8 sm:h-10 rounded-lg text-xs sm:text-sm" style={{ borderColor: 'rgba(201,169,110,0.25)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={50} />
            </div>

            <div className="mb-2.5">
              <label className="text-[10px] sm:text-xs font-medium mb-1 block" style={{ color: 'var(--wedding-purple-deep)' }}>
                <MessageSquare className="w-3 h-3 inline mr-1" style={{ color: 'var(--wedding-gold)' }} />
                Mensagem para os noivos
              </label>
              <Textarea value={guestMessage} onChange={(e) => setGuestMessage(e.target.value)} placeholder="Deixe uma mensagem especial..."
                className="rounded-lg resize-none text-xs sm:text-sm" rows={2}
                style={{ borderColor: 'rgba(201,169,110,0.25)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={200} />
              <p className="text-[9px] text-right mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{guestMessage.length}/200</p>
            </div>

            <div className="mb-2.5">
              <label className="text-[10px] sm:text-xs font-medium mb-1 block" style={{ color: 'var(--wedding-purple-deep)' }}>
                Moldura
              </label>
              <FrameSelector selected={selectedFrame} onSelect={setSelectedFrame} />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <Button onClick={() => cameraInputRef.current?.click()} className="h-9 sm:h-11 rounded-lg text-xs font-medium shadow-md"
                style={{ backgroundColor: 'var(--wedding-royal)', color: 'white' }} asChild>
                <span><Camera className="w-3.5 h-3.5 mr-1" /> Tirar Foto</span>
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 sm:h-11 rounded-lg text-xs font-medium shadow-sm border-2"
                style={{ borderColor: 'var(--wedding-royal)', color: 'var(--wedding-purple-deep)' }} asChild>
                <span><Upload className="w-3.5 h-3.5 mr-1" /> Enviar</span>
              </Button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
            <input ref={fileInputRef} type="file" accept="image/*" multiple={false} className="hidden" onChange={handleFileSelect} />

            <AnimatePresence>
              {previewUrl && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2.5">
                  <div className="relative rounded-lg overflow-hidden shadow-sm" style={{ border: '2px solid rgba(201,169,110,0.2)' }}>
                    <img src={previewUrl} alt="Preview" className="w-full max-h-36 sm:max-h-48 object-contain" style={{ backgroundColor: 'var(--wedding-ivory)' }} />
                    <button onClick={clearPreview} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                      style={{ backgroundColor: 'rgba(45,27,61,0.7)', color: 'white' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {selectedFile && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <Button onClick={handleUpload} disabled={isUploading}
                    className="w-full h-9 sm:h-11 rounded-lg text-xs sm:text-base font-medium shadow-lg"
                    style={{ background: 'linear-gradient(135deg, var(--wedding-royal) 0%, var(--wedding-purple-dark) 100%)', color: 'var(--wedding-gold)' }}>
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Enviar Foto</>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ PHOTO VIEWER ═══ */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-lg sm:max-w-3xl p-0 overflow-hidden rounded-xl sm:rounded-2xl border-0 shadow-2xl" style={{ backgroundColor: 'white' }}>
          {selectedPhoto && (
            <>
              <DialogTitle className="sr-only">Foto de {parseGuestName(selectedPhoto.guestName).name}</DialogTitle>
              <DialogDescription className="sr-only">Foto enviada por {parseGuestName(selectedPhoto.guestName).name}</DialogDescription>
              <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), var(--wedding-royal), var(--wedding-gold))' }} />
              <div className="relative">
                <img src={`/uploads/${selectedPhoto.filename}`} alt={`Foto de ${parseGuestName(selectedPhoto.guestName).name}`}
                  className="w-full max-h-[60vh] sm:max-h-[70vh] object-contain" style={{ backgroundColor: 'var(--wedding-ivory)' }} />
              </div>
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                      {parseGuestName(selectedPhoto.guestName).name}
                    </p>
                    <p className="text-[10px] sm:text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      {new Date(selectedPhoto.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <a href={`/uploads/${selectedPhoto.filename}`} download={selectedPhoto.originalName} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-lg shadow-sm text-[10px] sm:text-xs" style={{ borderColor: 'rgba(201,169,110,0.3)', color: 'var(--wedding-gold-dark)' }}>
                      <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Salvar
                    </Button>
                  </a>
                </div>
                {parseGuestName(selectedPhoto.guestName).message && (
                  <div className="mt-2 p-2 sm:p-3 rounded-lg" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
                    <p className="text-xs sm:text-sm italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      &ldquo;{parseGuestName(selectedPhoto.guestName).message}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
