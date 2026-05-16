'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, Heart, Lock, BookOpen, ChevronLeft, ChevronRight,
  Pen, Eraser, Palette, Loader2, Users, Clock, X, Sparkles,
  Paintbrush, Grid3X3, Image as ImageIcon, Download, Check,
  MessageSquare, Feather, Crown, Gem, Star,
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
const PHOTOS_PER_PAGE = 1
const COUPLE_NAMES = 'Patrícia & Samuel'
const WEDDING_DATE = '2026'
const FLIP_DURATION = 1100

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

// ─── Utility: Format file size ───────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Decorative SVG Ornament ─────────────────────────────
function OrnamentalCorner({ className, color }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 48C2 24 24 2 48 2" stroke={color || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 36C2 18 18 2 36 2" stroke={color || 'currentColor'} strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      <circle cx="8" cy="8" r="2.5" fill={color || 'currentColor'} opacity="0.5" />
      <circle cx="16" cy="4" r="1" fill={color || 'currentColor'} opacity="0.3" />
    </svg>
  )
}

// ─── Ornamental Divider Component ────────────────────────
function OrnamentalDivider({ color, className }: { color?: string; className?: string }) {
  return (
    <div className={`ornament-divider ${className || ''}`}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill={color || 'var(--wedding-gold)'} opacity="0.6" />
      </svg>
    </div>
  )
}

// ─── Sparkle Effect ──────────────────────────────────────
function FloatingSparkles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${15 + Math.random() * 70}%`,
            top: `${20 + Math.random() * 60}%`,
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--wedding-gold)',
            opacity: 0,
            animation: `sparkleDrift ${3 + Math.random() * 4}s ease-in-out ${i * 0.8}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Monogram Component ─────────────────────────────────
function Monogram({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 80 : 50
  const fs = size === 'lg' ? 28 : 18
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" stroke="var(--wedding-gold)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="40" cy="40" r="34" stroke="var(--wedding-gold)" strokeWidth="0.5" opacity="0.3" />
      <text x="28" y="48" fontFamily="Cormorant Garamond, serif" fontSize={fs} fill="var(--wedding-gold)" fontWeight="300" fontStyle="italic">P</text>
      <text x="38" y="52" fontFamily="Cormorant Garamond, serif" fontSize="14" fill="var(--wedding-gold)" opacity="0.6">&</text>
      <text x="47" y="48" fontFamily="Cormorant Garamond, serif" fontSize={fs} fill="var(--wedding-gold)" fontWeight="300" fontStyle="italic">S</text>
    </svg>
  )
}

// ─── Photo Frame Component (Premium) ────────────────────
function PhotoFrame({
  src, alt, frameStyle, guestName, className, onClick,
}: {
  src: string; alt: string; frameStyle: FrameStyle; guestName?: string; className?: string; onClick?: () => void
}) {
  if (frameStyle === 'classic') {
    return (
      <div className={`relative group cursor-pointer ${className || ''}`} onClick={onClick}>
        <div className="frame-classic p-2.5 bg-white relative overflow-hidden">
          <div className="absolute top-1.5 left-1.5 text-[10px] text-[var(--wedding-gold)] opacity-50">&#10022;</div>
          <div className="absolute top-1.5 right-1.5 text-[10px] text-[var(--wedding-gold)] opacity-50">&#10022;</div>
          <div className="absolute bottom-1.5 left-1.5 text-[10px] text-[var(--wedding-gold)] opacity-50">&#10022;</div>
          <div className="absolute bottom-1.5 right-1.5 text-[10px] text-[var(--wedding-gold)] opacity-50">&#10022;</div>
          <img src={src} alt={alt} className="w-full h-full object-contain" loading="lazy" />
        </div>
        {guestName && (
          <p className="text-center text-xs mt-2 italic" style={{ color: 'var(--wedding-gold-dark)', fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: '13px' }}>
            — {guestName}
          </p>
        )}
      </div>
    )
  }

  if (frameStyle === 'floral') {
    return (
      <div className={`relative group cursor-pointer ${className || ''}`} onClick={onClick}>
        <div className="frame-floral p-2 bg-white">
          <img src={src} alt={alt} className="w-full h-full object-contain rounded-2xl" loading="lazy" />
        </div>
        {guestName && (
          <p className="text-center text-xs mt-2" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: '13px' }}>
            ✿ {guestName}
          </p>
        )}
      </div>
    )
  }

  // Modern
  return (
    <div className={`relative group cursor-pointer ${className || ''}`} onClick={onClick}>
      <div className="frame-modern p-1.5 bg-white">
        <img src={src} alt={alt} className="w-full h-full object-contain rounded" loading="lazy" />
      </div>
      {guestName && (
        <p className="text-center text-xs mt-2 tracking-wider" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '12px' }}>
          {guestName}
        </p>
      )}
    </div>
  )
}

// ─── Frame Selector Preview ──────────────────────────────
function FrameSelector({ selected, onSelect }: { selected: FrameStyle; onSelect: (f: FrameStyle) => void }) {
  const frames: { id: FrameStyle; label: string; icon: string; desc: string }[] = [
    { id: 'classic', label: 'Clássico Dourado', icon: '🖼️', desc: 'Ornamento real' },
    { id: 'floral', label: 'Floral Lavanda', icon: '🌸', desc: 'Elegância suave' },
    { id: 'modern', label: 'Moderno', icon: '✦', desc: 'Minimalista chic' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {frames.map((f) => (
        <button
          key={f.id} type="button" onClick={() => onSelect(f.id)}
          className={`relative p-3 rounded-xl border-2 transition-all text-center ${
            selected === f.id
              ? 'border-[var(--wedding-gold)] bg-[var(--wedding-lavender-soft)] shadow-lg shadow-[var(--wedding-gold)]/10'
              : 'border-[var(--wedding-lavender)] bg-white hover:border-[var(--wedding-gold)] hover:shadow-md'
          }`}
        >
          {selected === f.id && (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-gold)' }}>
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
          <span className="text-lg block mb-1">{f.icon}</span>
          <span className="text-[11px] font-semibold block" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{f.label}</span>
          <span className="text-[9px] block" style={{ color: 'var(--muted-foreground)' }}>{f.desc}</span>
        </button>
      ))}
    </div>
  )
}

// ─── PIN Modal Component (Premium) ───────────────────────
function PINModal({ open, onVerified }: { open: boolean; onVerified: () => void }) {
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
    if (value && index < 3) inputRefs.current[index + 1]?.focus()
    if (newPin.every((d) => d !== '')) {
      const entered = newPin.join('')
      if (entered === WEDDING_PIN) {
        sessionStorage.setItem('wedding_pin_verified', 'true')
        onVerified()
      } else {
        setError(true); setShaking(true)
        setTimeout(() => setShaking(false), 500)
        toast({ title: 'Código incorreto', description: 'Tente novamente', variant: 'destructive' })
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
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(45, 27, 61, 0.8)', backdropFilter: 'blur(12px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }} animate={{ scale: shaking ? 1.02 : 1, y: 0 }} exit={{ scale: 0.85, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden"
            style={{ backgroundColor: 'white' }}
          >
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), var(--wedding-purple), var(--wedding-gold))' }} />
            <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center pulse-glow" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
              <Lock className="w-7 h-7" style={{ color: 'var(--wedding-purple)' }} />
            </div>
            <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Código de Acesso
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Insira o código para enviar fotos
            </p>
            <div className="flex justify-center gap-3 mb-4">
              {pin.map((digit, i) => (
                <input key={i} ref={(el) => { inputRefs.current[i] = el }} type="tel" inputMode="numeric" maxLength={1}
                  value={digit} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`pin-digit ${error ? '!border-red-400 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                  aria-label={`Dígito ${i + 1}`}
                />
              ))}
            </div>
            {error && (
              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-500 font-medium">
                Código incorreto
              </motion.p>
            )}
            <p className="text-xs mt-4 opacity-40" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Peça o código aos noivos
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Signature Pad Component (Premium) ───────────────────
function SignaturePad({ onSave }: { onSave: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#4A1A6B')
  const [strokeWidth] = useState(2)
  const [hasContent, setHasContent] = useState(false)
  const lastPointRef = useRef<{ x: number; y: number; pressure: number } | null>(null)

  const colors = [
    { value: '#4A1A6B', label: 'Royal', emoji: '👑' },
    { value: '#C9A96E', label: 'Ouro', emoji: '✨' },
    { value: '#2D1B3D', label: 'Ébano', emoji: '🖤' },
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
        for (let y = 28; y < rect.height; y += 26) {
          ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(rect.width - 16, y); ctx.stroke()
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
    for (let y = 28; y < rect.height; y += 26) {
      ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(rect.width - 16, y); ctx.stroke()
    }
    setHasContent(false)
  }

  const saveSignature = async () => {
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
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden shadow-inner" style={{ border: '2px solid var(--wedding-gold)', borderColor: 'rgba(201,169,110,0.3)' }}>
        <canvas ref={canvasRef} className="signature-canvas w-full" style={{ height: '200px', background: '#FFFAF3' }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {colors.map((c) => (
            <button key={c.value} type="button" onClick={() => setStrokeColor(c.value)}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${strokeColor === c.value ? 'scale-110 shadow-md' : 'hover:scale-105'}`}
              style={{ backgroundColor: c.value, borderColor: strokeColor === c.value ? 'var(--wedding-gold)' : 'transparent' }}
              aria-label={`Cor ${c.label}`}
            >
              <span className="text-white text-[10px]">{c.emoji}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="rounded-lg text-xs h-8"
            style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple)' }}>
            <Eraser className="w-3 h-3 mr-1" /> Limpar
          </Button>
          <Button type="button" size="sm" onClick={saveSignature} disabled={!hasContent} className="rounded-lg text-xs h-8"
            style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}>
            <Upload className="w-3 h-3 mr-1" /> Assinar
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

  // Spreads: 0=cover, 1..N=photo pages (each spread has 2 photo pages), then signatures, then back cover
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

  const isSignatureSpreadFn = (spreadIndex: number) => spreadIndex === totalSpreads - 2 && signaturePhotos.length > 0
  const isBackCoverFn = (spreadIndex: number) => spreadIndex === totalSpreads - 1

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

  // ─── 3D Flip Navigation ───────────────────────────
  const performFlipNext = useCallback(() => {
    if (isFlipping || currentSpread >= totalSpreads - 1) return
    setFlipDirection('next'); setIsFlipping(true)
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
    flipTimeoutRef.current = setTimeout(() => { setCurrentSpread(prev => prev + 1); setIsFlipping(false) }, FLIP_DURATION + 80)
  }, [isFlipping, currentSpread, totalSpreads])

  const performFlipPrev = useCallback(() => {
    if (isFlipping || currentSpread <= 0) return
    setFlipDirection('prev'); setIsFlipping(true)
    requestAnimationFrame(() => {
      const el = flipPageRef.current
      if (el) {
        void el.offsetHeight
        el.style.transition = `transform ${FLIP_DURATION}ms cubic-bezier(0.645, 0.045, 0.355, 1)`
        el.style.transform = 'rotateY(0deg)'
      }
    })
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current)
    flipTimeoutRef.current = setTimeout(() => { setCurrentSpread(prev => prev - 1); setIsFlipping(false) }, FLIP_DURATION + 80)
  }, [isFlipping, currentSpread])

  const nextPage = performFlipNext
  const prevPage = performFlipPrev

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

  // ─── Touch/swipe ──────────────────────────────────
  const touchStartRef = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const diff = touchStartRef.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) { diff > 0 ? nextPage() : prevPage() }
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
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 20MB.', variant: 'destructive' }); return
    }
    setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!selectedFile) { toast({ title: 'Selecione uma foto', description: 'Escolha ou tire uma foto primeiro.', variant: 'destructive' }); return }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', selectedFile)
      const msgEncoded = guestMessage.trim() ? encodeURIComponent(guestMessage.trim()) : ''
      formData.append('guestName', `${guestName.trim() || 'Convidado'}|frame:${selectedFrame}${msgEncoded ? `|msg:${msgEncoded}` : ''}`)
      const res = await fetch('/api/photos', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto')
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
    } catch { toast({ title: 'Erro', description: 'Não foi possível salvar a assinatura.', variant: 'destructive' }) }
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
      link.href = `/uploads/${photo.filename}`; link.download = photo.originalName || photo.filename; link.target = '_blank'
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  // ─── Render single photo page with message area ──
  const renderPhotoPage = (pagePhotos: Photo[], side: 'left' | 'right') => (
    <div
      className={`w-full h-full page-texture flex flex-col relative ${side === 'left' ? 'page-edge-left' : 'page-edge-right'}`}
      style={{
        background: `linear-gradient(${side === 'left' ? 'to right' : 'to left'}, rgba(0,0,0,0.03) 0%, transparent 12%), linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)`,
        borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0',
      }}
    >
      <OrnamentalCorner className={`absolute ${side === 'left' ? 'top-2 left-2' : 'top-2 right-2'} opacity-20`} color="var(--wedding-gold)" />
      <OrnamentalCorner className={`absolute bottom-2 ${side === 'left' ? 'left-2' : 'right-2'} opacity-20 rotate-180`} color="var(--wedding-gold)" />

      {pagePhotos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center opacity-30">
          <Feather className="w-8 h-8 mb-2" style={{ color: 'var(--wedding-lavender)' }} />
          <p className="text-xs italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Aguardando fotos...
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-4 min-h-0">
          {pagePhotos.map((photo) => {
            const p = parseGuestName(photo.guestName)
            return (
              <div key={photo.id} className="flex-1 flex flex-col min-h-0 elegant-fade-in">
                {/* Photo with frame - takes most of the space */}
                <div className="flex-1 flex items-center justify-center min-h-0" style={{ maxHeight: '62%' }}>
                  <PhotoFrame
                    src={`/uploads/${photo.filename}`} alt={`Foto de ${p.name}`} frameStyle={p.frame}
                    guestName="" className="max-w-[92%] max-h-full" onClick={() => setSelectedPhoto(photo)}
                  />
                </div>
                {/* Guest name under photo */}
                <p className="text-center text-[13px] mt-1 italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  — {p.name}
                </p>
                {/* Decorative divider */}
                <div className="my-1.5">
                  <OrnamentalDivider color="var(--wedding-gold)" />
                </div>
                {/* Message area */}
                <div className="message-lines px-2 py-1 rounded" style={{ minHeight: '48px' }}>
                  {p.message ? (
                    <p className="text-[12px] italic leading-7" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      &ldquo;{p.message}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[11px] italic leading-7 opacity-25" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      Espaço para mensagem...
                    </p>
                  )}
                </div>
                {/* Date stamp */}
                <p className="text-[10px] text-right mt-0.5 opacity-30" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {new Date(photo.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Render LEFT half ─────────────────────────────
  const renderLeftHalf = (spreadIndex: number) => {
    // Cover left - Premium
    if (spreadIndex === 0) {
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center p-6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4A1A6B 0%, #3D1452 35%, #2D1B3D 70%, #1A0E2E 100%)', borderRadius: '8px 0 0 8px' }}>
          {/* Gold border frame */}
          <div className="absolute inset-4 border border-glow rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.25)' }} />
          <div className="absolute inset-6 border rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.12)' }} />
          {/* Corner ornaments */}
          <OrnamentalCorner className="absolute top-5 left-5 opacity-60" color="var(--wedding-gold)" />
          <div className="absolute top-5 right-5 opacity-60" style={{ transform: 'scaleX(-1)' }}><OrnamentalCorner color="var(--wedding-gold)" /></div>
          <div className="absolute bottom-5 left-5 opacity-60" style={{ transform: 'scaleY(-1)' }}><OrnamentalCorner color="var(--wedding-gold)" /></div>
          <div className="absolute bottom-5 right-5 opacity-60" style={{ transform: 'scale(-1)' }}><OrnamentalCorner color="var(--wedding-gold)" /></div>
          <FloatingSparkles />
          <div className="relative z-10 text-center">
            <div className="mb-4"><Monogram size="lg" /></div>
            <h1 className="gold-shimmer text-4xl sm:text-5xl font-light mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.05em' }}>
              Patrícia
            </h1>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-px w-16" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
              <Crown className="w-5 h-5" style={{ color: 'var(--wedding-gold)', opacity: 0.6 }} />
              <div className="h-px w-16" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
            </div>
            <h1 className="gold-shimmer text-4xl sm:text-5xl font-light mb-4" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.05em' }}>
              Samuel
            </h1>
            <OrnamentalDivider color="var(--wedding-gold)" />
            <p className="text-sm tracking-[0.3em] uppercase mt-3" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {WEDDING_DATE}
            </p>
          </div>
        </div>
      )
    }

    // Signature left
    if (isSignatureSpreadFn(spreadIndex)) {
      return (
        <div className="w-full h-full page-texture flex flex-col p-4 page-edge-left relative"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.03) 0%, transparent 12%), linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)', borderRadius: '4px 0 0 4px' }}>
          <OrnamentalCorner className="absolute top-2 left-2 opacity-20" color="var(--wedding-gold)" />
          <div className="text-center mb-2">
            <Feather className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--wedding-gold)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Deixe sua Mensagem
            </h3>
          </div>
          <div className="mb-2">
            <div className="relative">
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--wedding-gold)' }} />
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Seu nome"
                className="pl-8 h-9 text-xs rounded-xl" style={{ borderColor: 'rgba(201,169,110,0.3)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={50}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <SignaturePad onSave={handleSignatureSave} />
          </div>
        </div>
      )
    }

    // Back cover left - Premium
    if (isBackCoverFn(spreadIndex)) {
      return (
        <div className="w-full h-full page-texture flex flex-col items-center justify-center p-6 page-edge-left relative"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.03) 0%, transparent 12%), linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)', borderRadius: '4px 0 0 4px' }}>
          <OrnamentalCorner className="absolute top-3 left-3 opacity-20" color="var(--wedding-gold)" />
          <div className="text-center">
            <div className="mb-4"><Monogram size="sm" /></div>
            <OrnamentalDivider color="var(--wedding-gold)" />
            <h2 className="text-2xl font-light mt-4 mb-3" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Obrigado
            </h2>
            <p className="text-sm leading-relaxed mb-3 italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Agradecemos a todos que fizeram parte deste momento mágico.
            </p>
            <OrnamentalDivider color="var(--wedding-gold)" />
            <p className="text-xs mt-3 italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Com todo nosso amor,<br />
              <span style={{ color: 'var(--wedding-gold-dark)', fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '14px' }}>Patrícia & Samuel</span>
            </p>
          </div>
        </div>
      )
    }

    // Photo page left
    const { left } = getPhotosForSpread(spreadIndex)
    return renderPhotoPage(left, 'left')
  }

  // ─── Render RIGHT half ────────────────────────────
  const renderRightHalf = (spreadIndex: number) => {
    // Cover right - Premium welcome
    if (spreadIndex === 0) {
      return (
        <div className="w-full h-full page-texture flex flex-col items-center justify-center p-6 page-edge-right relative"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.03) 0%, transparent 12%), linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)', borderRadius: '0 8px 8px 0' }}>
          <OrnamentalCorner className="absolute top-3 right-3 opacity-20" color="var(--wedding-gold)" />
          <OrnamentalCorner className="absolute bottom-3 right-3 opacity-20 rotate-180" color="var(--wedding-gold)" />
          <div className="text-center max-w-[90%]">
            <Gem className="w-7 h-7 mx-auto mb-4" style={{ color: 'var(--wedding-gold)' }} />
            <h2 className="text-2xl font-light mb-3" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Bem-vindos ao Nosso Álbum
            </h2>
            <OrnamentalDivider color="var(--wedding-gold)" className="mb-3" />
            <p className="text-sm mb-4 leading-relaxed italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Este álbum foi criado com todo nosso amor para guardar os melhores momentos do dia mais especial das nossas vidas.
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Envie suas fotos e deixe suas mensagens nas páginas seguintes
            </p>
            <OrnamentalDivider color="var(--wedding-gold)" className="mb-3" />
            <div className="mt-3">
              <Badge className="px-4 py-1.5 rounded-full text-xs" style={{ backgroundColor: 'var(--wedding-lavender-soft)', color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                {regularPhotos.length} {regularPhotos.length === 1 ? 'foto' : 'fotos'} no álbum
              </Badge>
            </div>
          </div>
        </div>
      )
    }

    // Signature right - gallery
    if (isSignatureSpreadFn(spreadIndex)) {
      return (
        <div className="w-full h-full page-texture flex flex-col p-4 page-edge-right relative"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.03) 0%, transparent 12%), linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)', borderRadius: '0 4px 4px 0' }}>
          <OrnamentalCorner className="absolute top-2 right-2 opacity-20" color="var(--wedding-gold)" />
          <div className="text-center mb-2">
            <Pen className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--wedding-gold)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Assinaturas dos Convidados
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto album-scroll space-y-2">
            {signaturePhotos.length === 0 ? (
              <div className="text-center py-8 opacity-30">
                <Feather className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--wedding-lavender)' }} />
                <p className="text-xs italic" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Nenhuma assinatura ainda
                </p>
              </div>
            ) : (
              signaturePhotos.map((photo) => {
                const p = parseGuestName(photo.guestName)
                return (
                  <div key={photo.id} className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
                    <img src={`/uploads/${photo.filename}`} alt={`Assinatura de ${p.name}`} className="w-full object-contain"
                      style={{ maxHeight: '90px', background: '#FFFAF3' }} loading="lazy" />
                    {p.name !== 'Convidado' && (
                      <p className="text-[10px] text-center py-1 italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
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

    // Back cover right - Premium
    if (isBackCoverFn(spreadIndex)) {
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center p-6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4A1A6B 0%, #3D1452 35%, #2D1B3D 70%, #1A0E2E 100%)', borderRadius: '0 8px 8px 0' }}>
          <div className="absolute inset-4 border border-glow rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.15)' }} />
          <FloatingSparkles />
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-12" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.3 }} />
              <Crown className="w-4 h-4" style={{ color: 'var(--wedding-gold)', opacity: 0.5 }} />
              <div className="h-px w-12" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.3 }} />
            </div>
            <p className="gold-shimmer text-lg tracking-[0.3em] uppercase" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Patrícia & Samuel
            </p>
            <OrnamentalDivider color="var(--wedding-gold)" className="my-3" />
            <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {WEDDING_DATE}
            </p>
          </div>
        </div>
      )
    }

    // Photo page right
    const { right } = getPhotosForSpread(spreadIndex)
    return renderPhotoPage(right, 'right')
  }

  // ─── Compute flip data for 3D ─────────────────────
  const getFlipData = () => {
    if (!isFlipping) return { baseLeftSpread: currentSpread, baseRightSpread: currentSpread, flipFrontSpread: -1, flipBackSpread: -1, showFlipOverlay: false, initialFlipAngle: 0 }
    if (flipDirection === 'next') return { baseLeftSpread: currentSpread, baseRightSpread: currentSpread + 1, flipFrontSpread: currentSpread, flipBackSpread: currentSpread + 1, showFlipOverlay: true, initialFlipAngle: 0 }
    return { baseLeftSpread: currentSpread - 1, baseRightSpread: currentSpread, flipFrontSpread: currentSpread - 1, flipBackSpread: currentSpread, showFlipOverlay: true, initialFlipAngle: -180 }
  }
  const flipData = getFlipData()

  // ─── Grid View ────────────────────────────────────
  const renderGridView = () => (
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
      {isLoadingPhotos ? (
        <div className="col-span-full flex flex-col items-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--wedding-gold)' }} />
          <p className="text-sm" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Carregando fotos...</p>
        </div>
      ) : regularPhotos.length === 0 ? (
        <div className="col-span-full text-center py-16">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
            <Feather className="w-10 h-10" style={{ color: 'var(--wedding-gold)' }} />
          </div>
          <p className="text-lg font-light mb-1" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Seja o primeiro a enviar uma foto!
          </p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Compartilhe seus melhores momentos</p>
        </div>
      ) : (
        regularPhotos.map((photo) => {
          const p = parseGuestName(photo.guestName)
          return (
            <motion.div key={photo.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4 }} className="break-inside-avoid">
              <div className={`overflow-hidden cursor-pointer group rounded-xl shadow-sm hover:shadow-xl transition-all duration-500 ${p.frame === 'classic' ? 'frame-classic' : p.frame === 'floral' ? 'frame-floral' : 'frame-modern'} bg-white`}
                onClick={() => setSelectedPhoto(photo)}>
                <div className="p-1">
                  <img src={`/uploads/${photo.filename}`} alt={`Foto de ${p.name}`} className="w-full object-cover group-hover:scale-105 transition-transform duration-700 rounded-lg" loading="lazy" style={{ minHeight: '140px' }} />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>{p.name}</p>
                  {p.message && (
                    <p className="text-xs mt-1 italic line-clamp-2" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>&ldquo;{p.message}&rdquo;</p>
                  )}
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-3 h-3" style={{ color: 'var(--wedding-gold)' }} />
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(photo.createdAt)}</p>
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
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-lg" style={{ backgroundColor: 'rgba(255,249,240,0.92)', borderColor: 'rgba(201,169,110,0.15)' }}>
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Crown className="w-4 h-4" style={{ color: 'var(--wedding-gold)' }} />
            <h1 className="text-base sm:text-lg font-light" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.02em' }}>
              {COUPLE_NAMES}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,169,110,0.2)' }}>
              <button onClick={() => setViewMode('book')}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'book' ? 'text-white' : ''}`}
                style={{ backgroundColor: viewMode === 'book' ? 'var(--wedding-royal)' : 'transparent', color: viewMode === 'book' ? 'white' : 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <BookOpen className="w-3.5 h-3.5" /><span className="hidden sm:inline">Álbum</span>
              </button>
              <button onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'grid' ? 'text-white' : ''}`}
                style={{ backgroundColor: viewMode === 'grid' ? 'var(--wedding-royal)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <Grid3X3 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Galeria</span>
              </button>
            </div>
            <Button onClick={requestUpload} size="sm" className="rounded-xl text-xs font-medium shadow-md"
              style={{ backgroundColor: 'var(--wedding-royal)', color: 'white' }}>
              <Camera className="w-3.5 h-3.5 mr-1" /><span className="hidden sm:inline">Enviar Foto</span><span className="sm:hidden">Foto</span>
            </Button>
            <Button onClick={downloadAllPhotos} variant="outline" size="sm" className="rounded-xl text-xs font-medium shadow-sm hidden sm:flex"
              style={{ borderColor: 'rgba(201,169,110,0.3)', color: 'var(--wedding-gold-dark)' }} disabled={photos.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1" /> Baixar
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'book' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 md:p-6">
            {/* 3D Book Container */}
            <div className="w-full max-w-4xl relative book-3d book-shadow rounded-lg overflow-hidden"
              style={{ height: 'calc(100vh - 140px)', minHeight: '420px', touchAction: 'manipulation' }}
              onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              {/* Base Left Page */}
              <div className="absolute left-0 top-0 w-1/2 h-full" style={{ zIndex: 1 }}>
                {renderLeftHalf(flipData.baseLeftSpread)}
                <div className="page-spine-edge-left" />
              </div>
              {/* Base Right Page */}
              <div className="absolute right-0 top-0 w-1/2 h-full" style={{ zIndex: 1 }}>
                {renderRightHalf(flipData.baseRightSpread)}
                <div className="page-spine-edge-right" />
              </div>
              {/* Shadow overlays */}
              <div className={`flip-shadow ${isFlipping ? 'flip-shadow-active' : ''}`} />
              <div className={`flip-shadow-left ${isFlipping ? 'flip-shadow-left-active' : ''}`} />
              <div className={`flip-depth-shadow ${isFlipping ? 'flip-depth-shadow-active' : ''}`} />
              {/* Flippable Page (3D) */}
              {flipData.showFlipOverlay && (
                <div ref={flipPageRef} className="flippable-page"
                  style={{ zIndex: 10, transform: `rotateY(${flipData.initialFlipAngle}deg)`, transition: 'none' }}>
                  <div className="page-face page-face-front">
                    {renderRightHalf(flipData.flipFrontSpread)}
                    <div className="page-spine-edge-right" />
                    <div className="absolute left-0 top-0 bottom-0 w-[70px] pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.1) 0%, transparent 100%)', zIndex: 3 }} />
                  </div>
                  <div className="page-face page-face-back">
                    {renderLeftHalf(flipData.flipBackSpread)}
                    <div className="page-spine-edge-left" />
                    <div className="absolute right-0 top-0 bottom-0 w-[70px] pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.1) 0%, transparent 100%)', zIndex: 3 }} />
                  </div>
                </div>
              )}
              {/* Book Spine */}
              <div className="book-spine" />
              {/* Navigation arrows */}
              <button onClick={prevPage} disabled={currentSpread === 0 || isFlipping}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 disabled:opacity-20 disabled:hover:scale-100"
                style={{ backgroundColor: 'var(--wedding-royal)', color: 'var(--wedding-gold)' }} aria-label="Página anterior">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextPage} disabled={currentSpread >= totalSpreads - 1 || isFlipping}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 disabled:opacity-20 disabled:hover:scale-100"
                style={{ backgroundColor: 'var(--wedding-royal)', color: 'var(--wedding-gold)' }} aria-label="Próxima página">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            {/* Page indicator */}
            <div className="mt-4 flex items-center gap-2">
              <button onClick={prevPage} disabled={currentSpread === 0 || isFlipping} className="p-1 rounded disabled:opacity-20" style={{ color: 'var(--wedding-gold)' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSpreads }, (_, i) => (
                  <button key={i} onClick={() => goToSpread(i)} disabled={isFlipping}
                    className={`w-2 h-2 rounded-full transition-all duration-500 ${i === currentSpread ? 'w-7' : ''}`}
                    style={{ backgroundColor: i === currentSpread ? 'var(--wedding-gold)' : 'var(--wedding-lavender)' }}
                    aria-label={`Página ${i + 1}`}
                  />
                ))}
              </div>
              <button onClick={nextPage} disabled={currentSpread >= totalSpreads - 1 || isFlipping} className="p-1 rounded disabled:opacity-20" style={{ color: 'var(--wedding-gold)' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {currentSpread === 0 ? 'Capa' : isSignatureSpreadFn(currentSpread) ? 'Assinaturas' : isBackCoverFn(currentSpread) ? 'Contracapa' : `Página ${currentSpread} de ${totalSpreads - 2}`}
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full px-4 py-6">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--wedding-gold))' }} />
              <h2 className="text-xl font-light text-center whitespace-nowrap" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                Galeria de Fotos
              </h2>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), transparent)' }} />
            </div>
            {renderGridView()}
          </div>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t py-2 px-4 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderColor: 'rgba(201,169,110,0.1)' }}>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          <Heart className="w-3 h-3 inline mr-1 fill-current" style={{ color: 'var(--wedding-gold)' }} />
          Feito com amor para {COUPLE_NAMES}
        </p>
      </footer>

      {/* ═══ PIN MODAL ═══ */}
      <PINModal key={showPinModal ? 'open' : 'closed'} open={showPinModal} onVerified={handlePinVerified} />
      {showPinModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(45, 27, 61, 0.3)' }} onClick={() => setShowPinModal(false)} />
      )}

      {/* ═══ UPLOAD DIALOG ═══ */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl" style={{ backgroundColor: 'white' }}>
          <DialogTitle className="sr-only">Enviar Foto</DialogTitle>
          <DialogDescription className="sr-only">Envie sua foto para o álbum do casamento de Patrícia & Samuel</DialogDescription>
          {/* Premium header bar */}
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), var(--wedding-royal), var(--wedding-gold))' }} />
          <div className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
                  <Camera className="w-4 h-4" style={{ color: 'var(--wedding-royal)' }} />
                </div>
                <h3 className="text-lg font-light" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  Enviar Foto
                </h3>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <Users className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--wedding-gold)' }} />
                Seu nome
              </label>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Digite seu nome"
                className="h-10 rounded-xl" style={{ borderColor: 'rgba(201,169,110,0.25)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={50} />
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--wedding-gold)' }} />
                Mensagem para os noivos
              </label>
              <Textarea value={guestMessage} onChange={(e) => setGuestMessage(e.target.value)} placeholder="Deixe uma mensagem especial..."
                className="rounded-xl resize-none" rows={2}
                style={{ borderColor: 'rgba(201,169,110,0.25)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: '13px' }} maxLength={200} />
              <p className="text-[10px] text-right mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{guestMessage.length}/200</p>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                <Palette className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--wedding-gold)' }} />
                Moldura
              </label>
              <FrameSelector selected={selectedFrame} onSelect={setSelectedFrame} />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button onClick={() => cameraInputRef.current?.click()} className="h-11 rounded-xl text-sm font-medium shadow-md"
                style={{ backgroundColor: 'var(--wedding-royal)', color: 'white' }} asChild>
                <span><Camera className="w-4 h-4 mr-1.5" /> Tirar Foto</span>
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-11 rounded-xl text-sm font-medium shadow-sm border-2"
                style={{ borderColor: 'var(--wedding-royal)', color: 'var(--wedding-purple-deep)' }} asChild>
                <span><Upload className="w-4 h-4 mr-1.5" /> Enviar</span>
              </Button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
            <input ref={fileInputRef} type="file" accept="image/*" multiple={false} className="hidden" onChange={handleFileSelect} />

            <AnimatePresence>
              {previewUrl && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="mb-3">
                  <div className="relative rounded-xl overflow-hidden shadow-sm" style={{ border: '2px solid rgba(201,169,110,0.2)' }}>
                    <img src={previewUrl} alt="Pré-visualização" className="w-full max-h-48 object-contain" style={{ backgroundColor: 'var(--wedding-ivory)' }} />
                    <button onClick={clearPreview} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                      style={{ backgroundColor: 'rgba(45,27,61,0.7)', color: 'white' }} aria-label="Remover foto">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {selectedFile && (
                      <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs" style={{ backgroundColor: 'rgba(45,27,61,0.6)', color: 'white', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                        {selectedFile.name} · {formatSize(selectedFile.size)}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {selectedFile && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <Button onClick={handleUpload} disabled={isUploading}
                    className="w-full h-11 rounded-xl text-base font-medium shadow-lg"
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl border-0 shadow-2xl" style={{ backgroundColor: 'white' }}>
          {selectedPhoto && (
            <>
              <DialogTitle className="sr-only">Foto de {parseGuestName(selectedPhoto.guestName).name}</DialogTitle>
              <DialogDescription className="sr-only">Foto enviada por {parseGuestName(selectedPhoto.guestName).name}</DialogDescription>
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--wedding-gold), var(--wedding-royal), var(--wedding-gold))' }} />
              <div className="relative">
                <img src={`/uploads/${selectedPhoto.filename}`} alt={`Foto de ${parseGuestName(selectedPhoto.guestName).name}`}
                  className="w-full max-h-[70vh] object-contain" style={{ backgroundColor: 'var(--wedding-ivory)' }} />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                      {parseGuestName(selectedPhoto.guestName).name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3.5 h-3.5" style={{ color: 'var(--wedding-gold)' }} />
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                        {new Date(selectedPhoto.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <a href={`/uploads/${selectedPhoto.filename}`} download={selectedPhoto.originalName} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-xl shadow-sm" style={{ borderColor: 'rgba(201,169,110,0.3)', color: 'var(--wedding-gold-dark)' }}>
                      <Download className="w-4 h-4 mr-1.5" /> Salvar
                    </Button>
                  </a>
                </div>
                {parseGuestName(selectedPhoto.guestName).message && (
                  <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--wedding-lavender-soft)' }}>
                    <p className="text-sm italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
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
