'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, Heart, Lock,
  Pen, Eraser, Loader2, Users, X, Sparkles,
  Image as ImageIcon, Check,
  Feather, Crown, Gem, PenLine,
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
  cloudinaryUrl: string
  cloudinaryId: string
  originalName: string
  guestName: string
  mimeType: string
  size: number
  frame: 'classic' | 'floral' | 'modern'
  message: string
  isSignature: boolean
  signatureForPhotoId: string | null
  createdAt: string
}

type FrameStyle = 'classic' | 'floral' | 'modern'

// ─── Constants ───────────────────────────────────────────
const WEDDING_PIN = process.env.NEXT_PUBLIC_WEDDING_PIN || '2025'
const WEDDING_DATE = '2026'
const FLIP_ANIM_DURATION = 600

// ─── Utility: Parse guestName with frame & message ───────
function parseGuestData(guestName: string, frame?: string, message?: string) {
  // New format: data is in separate fields
  if (frame) {
    return { name: guestName || 'Convidado', frame, message: message || '' }
  }
  // Legacy format: guestName contains encoded data
  const nameAndRest = guestName.split('|frame:')
  const name = nameAndRest[0] || 'Convidado'
  const rest = nameAndRest[1] || 'classic'
  const frameAndMsg = rest.split('|msg:')
  const frameStr = frameAndMsg[0]?.replace('|signature', '') || 'classic'
  const msg = frameAndMsg[1] ? decodeURIComponent(frameAndMsg[1]) : ''
  const isSig = guestName.includes('|signature')
  const validFrames: FrameStyle[] = ['classic', 'floral', 'modern']
  const f = validFrames.includes(frameStr as FrameStyle) ? (frameStr as FrameStyle) : 'classic'
  return { name, frame: f, message: isSig ? '' : msg }
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
      <text x="38" y="52" fontFamily="Cormorant Garamond, serif" fontSize="14" fill="var(--wedding-gold)" opacity="0.6">&amp;</text>
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
  const frames: { id: FrameStyle; label: string; icon: string }[] = [
    { id: 'classic', label: 'Dourado', icon: '🖼️' },
    { id: 'floral', label: 'Lavanda', icon: '🌸' },
    { id: 'modern', label: 'Moderno', icon: '✦' },
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

// ─── Inline Signature Area Component ─────────────────────
function InlineSignatureArea({
  photoId,
  existingSignatureUrl,
  onSignatureSaved,
}: {
  photoId: string
  existingSignatureUrl: string | null
  onSignatureSaved: () => void
}) {
  const { toast } = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(existingSignatureUrl)
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
    setSavedSignatureUrl(existingSignatureUrl)
  }, [existingSignatureUrl])

  useEffect(() => {
    if (!isExpanded) return
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
        for (let y = 20; y < rect.height; y += 18) {
          ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(rect.width - 8, y); ctx.stroke()
        }
      }
    }
    setTimeout(resize, 50)
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [isExpanded])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
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
    e.stopPropagation()
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
    for (let y = 20; y < rect.height; y += 18) {
      ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(rect.width - 8, y); ctx.stroke()
    }
    setHasContent(false)
  }

  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    setIsSaving(true)
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => { if (b) resolve(b) }, 'image/png', 1.0)
      })
      const file = new File([blob], `assinatura-${Date.now()}.png`, { type: 'image/png' })
      const formData = new FormData()
      formData.append('signature', file)
      formData.append('photoId', photoId)
      formData.append('guestName', 'Convidado')

      const res = await fetch('/api/photos/signature', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar assinatura')

      setSavedSignatureUrl(data.signature.cloudinaryUrl)
      setIsExpanded(false)
      setHasContent(false)
      toast({ title: 'Assinatura salva!', description: 'Sua assinatura foi adicionada!' })
      onSignatureSaved()
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' })
    } finally { setIsSaving(false) }
  }

  // If there's a saved signature, show it
  if (savedSignatureUrl) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2" style={{ borderTop: '1px solid rgba(201,169,110,0.15)' }}>
        <img src={savedSignatureUrl} alt="Assinatura" className="h-8 max-w-[60%] object-contain" />
        <span className="text-[8px] italic opacity-40" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>assinatura</span>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid rgba(201,169,110,0.15)' }}>
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="signature-tap-area w-full flex items-center justify-center gap-1.5 py-2 px-2 text-[10px] italic"
          style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
        >
          <PenLine className="w-3 h-3" style={{ color: 'var(--wedding-gold)' }} />
          Toque para assinar
        </button>
      ) : (
        <div className="p-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="relative rounded-lg overflow-hidden shadow-inner" style={{ border: '2px solid rgba(201,169,110,0.3)' }}>
            <canvas ref={canvasRef} className="signature-canvas w-full" style={{ height: '100px', background: '#FFFAF3' }}
              onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
          </div>
          <div className="flex items-center justify-between gap-1">
            <div className="flex gap-1">
              {colors.map((c) => (
                <button key={c.value} type="button" onClick={() => setStrokeColor(c.value)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${strokeColor === c.value ? 'scale-110 shadow-md' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c.value, borderColor: strokeColor === c.value ? 'var(--wedding-gold)' : 'transparent' }}
                  aria-label={`Cor ${c.label}`} />
              ))}
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="rounded-lg text-[9px] h-6 px-1.5"
                style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple)' }}>
                <Eraser className="w-2.5 h-2.5 mr-0.5" /> Limpar
              </Button>
              <Button type="button" size="sm" onClick={saveSignature} disabled={!hasContent || isSaving} className="rounded-lg text-[9px] h-6 px-1.5"
                style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}>
                {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Upload className="w-2.5 h-2.5 mr-0.5" />}
                {!isSaving && 'Assinar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIsExpanded(false); clearCanvas() }} className="rounded-lg h-6 w-6 p-0">
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
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
  const [currentPage, setCurrentPage] = useState(0)
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
  const [isMobile, setIsMobile] = useState(false)
  const [flipAngle, setFlipAngle] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flipPageRef = useRef<HTMLDivElement>(null)
  const bookContainerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; time: number } | null>(null)
  const isDraggingRef = useRef(false)

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
  const regularPhotos = sortedPhotos.filter((p) => !p.isSignature)
  const signaturePhotos = sortedPhotos.filter((p) => p.isSignature)

  // Build pages for the book
  // Page 0: Cover
  // Page 1: Welcome
  // Pages 2..N: Photo pages (1 photo per page)
  // Last-1: Signatures page
  // Last: Back cover
  const bookPages: { type: 'cover' | 'welcome' | 'photo' | 'signatures' | 'backcover'; photo?: Photo; allSignatures?: Photo[] }[] = []

  bookPages.push({ type: 'cover' })
  bookPages.push({ type: 'welcome' })

  for (const photo of regularPhotos) {
    bookPages.push({ type: 'photo', photo })
  }

  if (regularPhotos.length === 0) {
    bookPages.push({ type: 'photo' }) // empty placeholder
  }

  bookPages.push({ type: 'signatures', allSignatures: signaturePhotos })
  bookPages.push({ type: 'backcover' })

  const totalPages = bookPages.length

  // On desktop, we show 2 pages side-by-side (spread view)
  // On mobile, we show 1 page at a time
  // currentPage is the LEFT page index on desktop, or the single page on mobile

  const getSpreadPages = () => {
    if (isMobile) {
      return { left: bookPages[currentPage], right: null }
    }
    // Desktop: show 2 pages at a time
    // Cover is special: only left side
    const leftIdx = currentPage
    const rightIdx = currentPage + 1
    return {
      left: bookPages[leftIdx],
      right: rightIdx < totalPages ? bookPages[rightIdx] : null,
    }
  }

  const maxPage = isMobile ? totalPages - 1 : totalPages - 2

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
      if (data.type === 'new_photo' || data.type === 'new_signature') {
        setPhotos((prev) => prev.some((p) => p.id === data.photo.id) ? prev : [...prev, data.photo])
        toast({ title: data.type === 'new_signature' ? 'Nova assinatura!' : 'Nova foto!', description: 'O álbum foi atualizado' })
      }
    })
    pollingRef.current = setInterval(fetchPhotos, 15000)
    return () => { socket.disconnect(); if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [fetchPhotos, toast])

  // ─── Drag-to-Flip Logic ───────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isFlipping) return
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, time: Date.now() }
    isDraggingRef.current = false
    setIsDragging(false)
  }, [isFlipping])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || isFlipping) return
    const deltaX = dragStartRef.current.x - e.clientX
    const container = bookContainerRef.current
    if (!container) return

    const pageWidth = isMobile ? container.offsetWidth : container.offsetWidth / 2
    const absDelta = Math.abs(deltaX)

    if (absDelta > 5) {
      isDraggingRef.current = true
      setIsDragging(true)
    }

    // Calculate flip angle based on drag direction and distance
    let angle: number
    if (deltaX > 0) {
      // Dragging left = flipping forward (right page turns)
      angle = Math.min((deltaX / pageWidth) * 180, 180)
    } else {
      // Dragging right = flipping backward (left page turns)
      angle = Math.max((deltaX / pageWidth) * 180, -180)
    }
    setFlipAngle(angle)
  }, [isFlipping, isMobile])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || isFlipping) {
      dragStartRef.current = null
      setIsDragging(false)
      setFlipAngle(0)
      return
    }

    const deltaX = dragStartRef.current.x - e.clientX
    const container = bookContainerRef.current
    dragStartRef.current = null

    if (!isDraggingRef.current) {
      setIsDragging(false)
      setFlipAngle(0)
      return
    }

    const pageWidth = container ? (isMobile ? container.offsetWidth : container.offsetWidth / 2) : 300
    const absAngle = Math.abs(flipAngle)

    if (absAngle > 90) {
      // Past 50% threshold - complete the flip
      setIsFlipping(true)
      // Animate to completion
      const targetAngle = deltaX > 0 ? 180 : -180
      setFlipAngle(targetAngle)
      setTimeout(() => {
        if (deltaX > 0 && currentPage < maxPage) {
          setCurrentPage(prev => isMobile ? prev + 1 : prev + 2)
        } else if (deltaX < 0 && currentPage > 0) {
          setCurrentPage(prev => isMobile ? prev - 1 : prev - 2)
        }
        setFlipAngle(0)
        setIsFlipping(false)
        setIsDragging(false)
      }, FLIP_ANIM_DURATION)
    } else {
      // Spring back
      setFlipAngle(0)
      setTimeout(() => setIsDragging(false), 300)
    }
  }, [isFlipping, currentPage, maxPage, flipAngle, isMobile])

  // ─── Keyboard navigation ──────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isFlipping) return
      if (e.key === 'ArrowRight' && currentPage < maxPage) {
        setIsFlipping(true)
        setFlipAngle(180)
        setTimeout(() => {
          setCurrentPage(prev => isMobile ? prev + 1 : prev + 2)
          setFlipAngle(0)
          setIsFlipping(false)
        }, FLIP_ANIM_DURATION)
      }
      if (e.key === 'ArrowLeft' && currentPage > 0) {
        setIsFlipping(true)
        setFlipAngle(-180)
        setTimeout(() => {
          setCurrentPage(prev => isMobile ? prev - 1 : prev - 2)
          setFlipAngle(0)
          setIsFlipping(false)
        }, FLIP_ANIM_DURATION)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFlipping, currentPage, maxPage, isMobile])

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

  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      if (file.size < 500 * 1024) { resolve(file); return }
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
      const compressedFile = await compressImage(selectedFile)
      const formData = new FormData()
      formData.append('photo', compressedFile)
      formData.append('guestName', guestName.trim() || 'Convidado')
      formData.append('frame', selectedFrame)
      formData.append('message', guestMessage.trim())

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

  const clearPreview = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Find signature for a photo ────────────────────
  const getSignatureForPhoto = (photoId: string) => {
    return signaturePhotos.find((s) => s.signatureForPhotoId === photoId)
  }

  // ─── Render Cover Page ─────────────────────────────
  const renderCover = () => (
    <div className="w-full h-full relative flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #4A1A6B 0%, #3D1452 35%, #2D1B3D 70%, #1A0E2E 100%)' }}>
      <div className="absolute inset-3 sm:inset-4 border border-glow rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.25)' }} />
      <div className="absolute inset-5 sm:inset-6 border rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.12)' }} />
      <div className="relative z-10 text-center">
        <div className="mb-3 sm:mb-4"><Monogram size="lg" /></div>
        <h1 className="gold-shimmer text-2xl sm:text-4xl md:text-5xl font-light mb-1 sm:mb-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.05em' }}>
          Patrícia
        </h1>
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="h-px w-8 sm:w-16" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
          <Crown className="w-3 h-3 sm:w-5 sm:h-5" style={{ color: 'var(--wedding-gold)', opacity: 0.6 }} />
          <div className="h-px w-8 sm:w-16" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
        </div>
        <h1 className="gold-shimmer text-2xl sm:text-4xl md:text-5xl font-light mb-3 sm:mb-4" style={{ fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.05em' }}>
          Samuel
        </h1>
        <OrnamentalDivider color="var(--wedding-gold)" />
        <p className="text-[10px] sm:text-sm tracking-[0.3em] uppercase mt-2 sm:mt-3" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          {WEDDING_DATE}
        </p>
      </div>
    </div>
  )

  // ─── Render Welcome Page ───────────────────────────
  const renderWelcome = () => (
    <div className="w-full h-full page-texture flex flex-col items-center justify-center p-4 sm:p-6 relative"
      style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
      <div className="text-center max-w-[90%]">
        <Gem className="w-5 h-5 sm:w-7 sm:h-7 mx-auto mb-3 sm:mb-4" style={{ color: 'var(--wedding-gold)' }} />
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

  // ─── Render Photo Page ─────────────────────────────
  const renderPhotoPage = (photo?: Photo) => (
    <div className="w-full h-full page-texture flex flex-col relative"
      style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
      {!photo ? (
        <div className="flex-1 flex flex-col items-center justify-center opacity-25 p-4">
          <Feather className="w-6 h-6 sm:w-8 sm:h-8 mb-2" style={{ color: 'var(--wedding-lavender)' }} />
          <p className="text-[10px] sm:text-xs italic text-center" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Aguardando fotos...
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2 sm:p-3 md:p-4 min-h-0">
          <div key={photo.id} className="flex-1 flex flex-col min-h-0 elegant-fade-in">
            {/* Photo with frame */}
            <div className="flex-1 flex items-center justify-center min-h-0" style={{ maxHeight: '50%' }}>
              <PhotoFrame
                src={photo.cloudinaryUrl} alt={`Foto de ${parseGuestData(photo.guestName, photo.frame, photo.message).name}`}
                frameStyle={photo.frame || 'classic'}
                className="max-w-[92%] max-h-full"
              />
            </div>
            {/* Guest name */}
            <p className="text-center text-[11px] sm:text-[13px] mt-1 italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              — {parseGuestData(photo.guestName, photo.frame, photo.message).name}
            </p>
            {/* Message */}
            {photo.message && (
              <>
                <div className="my-0.5">
                  <OrnamentalDivider color="var(--wedding-gold)" />
                </div>
                <div className="message-lines px-1.5 sm:px-2 py-0.5 rounded" style={{ maxHeight: '20%' }}>
                  <p className="text-[10px] sm:text-[12px] italic leading-7" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                    &ldquo;{photo.message}&rdquo;
                  </p>
                </div>
              </>
            )}
            {/* Inline signature area */}
            <div className="mt-auto">
              <InlineSignatureArea
                photoId={photo.id}
                existingSignatureUrl={getSignatureForPhoto(photo.id)?.cloudinaryUrl || null}
                onSignatureSaved={fetchPhotos}
              />
            </div>
            {/* Date */}
            <p className="text-[8px] sm:text-[10px] text-right mt-0.5 opacity-25" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {new Date(photo.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  )

  // ─── Render Signatures Page ────────────────────────
  const renderSignaturesPage = (signatures?: Photo[]) => (
    <div className="w-full h-full page-texture flex flex-col items-center justify-center p-3 sm:p-4 relative"
      style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
      <div className="text-center mb-2">
        <Feather className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1" style={{ color: 'var(--wedding-gold)' }} />
        <h3 className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          Assinaturas &amp; Mensagens
        </h3>
      </div>
      <div className="flex-1 w-full overflow-y-auto album-scroll min-h-0">
        {signatures && signatures.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 p-1">
            {signatures.map((sig) => (
              <div key={sig.id} className="elegant-fade-in flex flex-col items-center p-1.5 rounded-lg" style={{ background: 'rgba(243,232,255,0.3)' }}>
                <img src={sig.cloudinaryUrl} alt="Assinatura" className="h-10 sm:h-14 object-contain mb-0.5" />
                <p className="text-[8px] italic opacity-60" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {parseGuestData(sig.guestName).name}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] italic text-center opacity-30 py-4" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Nenhuma assinatura ainda. Toque &ldquo;Toque para assinar&rdquo; abaixo de uma foto!
          </p>
        )}
      </div>
    </div>
  )

  // ─── Render Back Cover ─────────────────────────────
  const renderBackCover = () => (
    <div className="w-full h-full relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #4A1A6B 0%, #3D1452 35%, #2D1B3D 70%, #1A0E2E 100%)' }}>
      <div className="absolute inset-3 sm:inset-4 border border-glow rounded-sm" style={{ borderColor: 'rgba(201,169,110,0.15)' }} />
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="h-px w-8 sm:w-12" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.3 }} />
          <Crown className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: 'var(--wedding-gold)', opacity: 0.5 }} />
          <div className="h-px w-8 sm:w-12" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.3 }} />
        </div>
        <p className="gold-shimmer text-sm sm:text-lg tracking-[0.3em] uppercase" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          Patrícia &amp; Samuel
        </p>
        <OrnamentalDivider color="var(--wedding-gold)" className="my-2 sm:my-3" />
        <p className="text-[10px] sm:text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          {WEDDING_DATE}
        </p>
      </div>
    </div>
  )

  // ─── Render a page by type ─────────────────────────
  const renderPage = (page: typeof bookPages[0]) => {
    if (!page) return <div className="w-full h-full" style={{ background: 'var(--wedding-ivory)' }} />
    switch (page.type) {
      case 'cover': return renderCover()
      case 'welcome': return renderWelcome()
      case 'photo': return renderPhotoPage(page.photo)
      case 'signatures': return renderSignaturesPage(page.allSignatures)
      case 'backcover': return renderBackCover()
      default: return <div className="w-full h-full" style={{ background: 'var(--wedding-ivory)' }} />
    }
  }

  // ─── Build book spread view ────────────────────────
  const spread = getSpreadPages()

  // Flip angle for CSS transform
  const flipTransform = isDragging
    ? `rotateY(${-flipAngle}deg)`
    : isFlipping
    ? `rotateY(${-flipAngle}deg)`
    : 'rotateY(0deg)'

  const flipTransition = isDragging
    ? 'none'
    : isFlipping
    ? `transform ${FLIP_ANIM_DURATION}ms cubic-bezier(0.645, 0.045, 0.355, 1)`
    : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

  // Shadow intensity during flip
  const shadowOpacity = Math.min(Math.abs(flipAngle) / 180, 1)

  // Page indicator
  const pageIndicator = isMobile
    ? `${currentPage + 1} / ${totalPages}`
    : `${currentPage + 1}-${Math.min(currentPage + 2, totalPages)} / ${totalPages}`

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #FFF9F0 0%, #F8F0FF 50%, #FFF9F0 100%)' }}>
      {/* Header */}
      <header className="w-full py-2 sm:py-3 px-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(201,169,110,0.15)' }}>
        <div className="flex items-center gap-2">
          <Monogram size="sm" />
          <div>
            <h1 className="text-xs sm:text-sm font-light" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Patrícia &amp; Samuel
            </h1>
            <p className="text-[8px] sm:text-[10px] opacity-50" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Álbum de Casamento {WEDDING_DATE}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5" style={{ borderColor: 'var(--wedding-lavender)', color: 'var(--wedding-purple)' }}>
            <ImageIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
            {regularPhotos.length}
          </Badge>
          <Button onClick={requestUpload}
            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 rounded-full"
            style={{ backgroundColor: 'var(--wedding-gold)', color: 'white', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" />
            <span className="hidden sm:inline">Enviar Foto</span>
            <span className="sm:hidden">Enviar</span>
          </Button>
        </div>
      </header>

      {/* Book Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 min-h-0">
        {isLoadingPhotos ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--wedding-gold)' }} />
            <p className="text-xs italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Carregando álbum...
            </p>
          </div>
        ) : (
          <div
            ref={bookContainerRef}
            className={`book-3d relative book-shadow rounded-sm ${isMobile ? 'w-full max-w-[420px]' : 'w-full max-w-[900px] lg:max-w-[1000px]'}`}
            style={{ height: isMobile ? '70vh' : '65vh', maxHeight: '600px', touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* ─── Mobile: Single page view ─── */}
            {isMobile && (
              <>
                {/* Current page (static) */}
                <div className="absolute inset-0 rounded-sm overflow-hidden" style={{ zIndex: 1 }}>
                  {renderPage(spread.left)}
                </div>

                {/* Flipping page (on top) */}
                {(isDragging || isFlipping) && (
                  <div
                    ref={flipPageRef}
                    className="flippable-page-mobile rounded-sm"
                    style={{
                      transform: flipTransform,
                      transition: flipTransition,
                      zIndex: 10,
                    }}
                  >
                    {/* Front face */}
                    <div className="page-face page-face-front rounded-sm overflow-hidden">
                      {renderPage(spread.left)}
                    </div>
                    {/* Back face */}
                    <div className="page-face page-face-back rounded-sm overflow-hidden">
                      {flipAngle > 0 && (currentPage + 1 < totalPages)
                        ? renderPage(bookPages[currentPage + 1])
                        : flipAngle < 0 && (currentPage - 1 >= 0)
                        ? renderPage(bookPages[currentPage - 1])
                        : null
                      }
                    </div>
                  </div>
                )}

                {/* Shadow during flip */}
                {(isDragging || isFlipping) && (
                  <div className="absolute inset-0 pointer-events-none rounded-sm" style={{
                    zIndex: 5,
                    background: 'rgba(45, 27, 61, 0.15)',
                    opacity: shadowOpacity * 0.3,
                  }} />
                )}
              </>
            )}

            {/* ─── Desktop: Spread view (left + right pages) ─── */}
            {!isMobile && (
              <>
                {/* Left page (static) */}
                <div className="absolute left-0 top-0 w-1/2 h-full overflow-hidden rounded-l-sm" style={{ zIndex: 1 }}>
                  <div className="page-spine-edge-left" />
                  {renderPage(spread.left)}
                </div>

                {/* Right page (static) */}
                <div className="absolute right-0 top-0 w-1/2 h-full overflow-hidden rounded-r-sm" style={{ zIndex: 1 }}>
                  <div className="page-spine-edge-right" />
                  {renderPage(spread.right)}
                </div>

                {/* Spine */}
                <div className="book-spine" />

                {/* Flipping page overlay (right side flips forward, left side flips backward) */}
                {(isDragging || isFlipping) && flipAngle !== 0 && (
                  <>
                    <div
                      ref={flipPageRef}
                      className="flippable-page"
                      style={{
                        transform: flipTransform,
                        transition: flipTransition,
                        zIndex: 10,
                      }}
                    >
                      {/* Front face: current right page */}
                      <div className="page-face page-face-front overflow-hidden">
                        {renderPage(spread.right)}
                      </div>
                      {/* Back face: next left page */}
                      <div className="page-face page-face-back overflow-hidden">
                        {flipAngle > 0 && (currentPage + 2 < totalPages)
                          ? renderPage(bookPages[currentPage + 2])
                          : flipAngle < 0 && (currentPage - 2 >= 0)
                          ? renderPage(bookPages[currentPage - 1])
                          : null
                        }
                      </div>
                    </div>

                    {/* Shadow on left page during forward flip */}
                    {flipAngle > 0 && (
                      <div className="flip-shadow-left" style={{
                        opacity: shadowOpacity,
                        transition: isDragging ? 'none' : 'opacity 0.3s ease',
                      }} />
                    )}

                    {/* Shadow under flipping page */}
                    <div className="flip-shadow" style={{
                      opacity: shadowOpacity,
                      width: '50%',
                      transition: isDragging ? 'none' : 'opacity 0.3s ease',
                    }} />

                    {/* Depth shadow at spine */}
                    <div className="flip-depth-shadow" style={{
                      opacity: shadowOpacity * 0.8,
                      transition: isDragging ? 'none' : 'opacity 0.3s ease',
                    }} />
                  </>
                )}
              </>
            )}

            {/* Drag hint overlay */}
            {!isDragging && !isFlipping && currentPage === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 20 }}
              >
                <motion.div
                  animate={{ x: [0, 20, 0] }}
                  transition={{ repeat: 3, duration: 1.5, ease: 'easeInOut' }}
                  className="text-[10px] italic px-3 py-1.5 rounded-full"
                  style={{
                    color: 'var(--wedding-gold)',
                    background: 'rgba(45, 27, 61, 0.7)',
                    backdropFilter: 'blur(8px)',
                    fontFamily: 'var(--font-cormorant), Georgia, serif',
                  }}
                >
                  ← Arraste para virar →
                </motion.div>
              </motion.div>
            )}
          </div>
        )}

        {/* Page indicator */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[10px] italic" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif', opacity: 0.5 }}>
            {pageIndicator}
          </span>
          <div className="flex gap-1">
            {bookPages.map((_, i) => {
              // Only show dots for key pages
              if (i > 1 && i < totalPages - 1 && i % 2 !== 0 && isMobile) return null
              if (i > 1 && i < totalPages - 1 && !isMobile && i % 2 !== 0) return null
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (!isFlipping) {
                      const target = isMobile ? i : Math.max(0, i - (i % 2 === 0 ? 0 : 1))
                      setCurrentPage(Math.min(target, maxPage))
                    }
                  }}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: (isMobile ? i === currentPage : (i === currentPage || i === currentPage + 1)) ? 'var(--wedding-gold)' : 'var(--wedding-lavender)',
                    opacity: (isMobile ? i === currentPage : (i === currentPage || i === currentPage + 1)) ? 1 : 0.4,
                  }}
                  aria-label={`Página ${i + 1}`}
                />
              )
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-2 px-4 text-center" style={{ borderTop: '1px solid rgba(201,169,110,0.1)' }}>
        <p className="text-[9px] italic opacity-30" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Feito com ❤ para Patrícia &amp; Samuel — {WEDDING_DATE}
        </p>
      </footer>

      {/* PIN Modal */}
      <PINModal open={showPinModal} onVerified={handlePinVerified} />

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4" style={{ background: 'linear-gradient(135deg, #FFFAF3 0%, #F8F0FF 100%)' }}>
            <DialogTitle className="text-center text-base sm:text-lg" style={{ color: 'var(--wedding-purple-deep)', fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1.5" style={{ color: 'var(--wedding-gold)' }} />
              Enviar Foto
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulário para enviar uma foto ao álbum de casamento
            </DialogDescription>

            {/* File selection */}
            <div className="space-y-2">
              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden" style={{ border: '2px solid rgba(201,169,110,0.3)' }}>
                  <img src={previewUrl} alt="Preview" className="w-full max-h-40 object-contain" style={{ background: 'white' }} />
                  <button type="button" onClick={clearPreview}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl border-2 border-dashed transition-all hover:border-[var(--wedding-gold)]"
                    style={{ borderColor: 'var(--wedding-lavender)', background: 'white' }}>
                    <Camera className="w-5 h-5" style={{ color: 'var(--wedding-purple)' }} />
                    <span className="text-[10px] font-medium" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Câmera</span>
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl border-2 border-dashed transition-all hover:border-[var(--wedding-gold)]"
                    style={{ borderColor: 'var(--wedding-lavender)', background: 'white' }}>
                    <Upload className="w-5 h-5" style={{ color: 'var(--wedding-purple)' }} />
                    <span className="text-[10px] font-medium" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Arquivo</span>
                  </button>
                </div>
              )}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            {/* Guest name */}
            <div className="relative">
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--wedding-gold)' }} />
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Seu nome"
                className="pl-8 h-9 text-xs rounded-lg" style={{ borderColor: 'rgba(201,169,110,0.3)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={50} />
            </div>

            {/* Frame selector */}
            <div>
              <p className="text-[10px] mb-1.5 font-medium" style={{ color: 'var(--wedding-purple)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Moldura:</p>
              <FrameSelector selected={selectedFrame} onSelect={setSelectedFrame} />
            </div>

            {/* Message */}
            <Textarea value={guestMessage} onChange={(e) => setGuestMessage(e.target.value)} placeholder="Uma mensagem para os noivos..."
              className="text-xs rounded-lg min-h-[60px]" style={{ borderColor: 'rgba(201,169,110,0.3)', backgroundColor: 'var(--wedding-ivory)', fontFamily: 'var(--font-cormorant), Georgia, serif' }} maxLength={200} />

            {/* Upload button */}
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading}
              className="w-full h-10 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'var(--wedding-gold)', color: 'white', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="w-4 h-4 mr-1.5" /> Enviar Foto</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
