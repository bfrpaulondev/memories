'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Upload,
  Heart,
  Image as ImageIcon,
  Download,
  Loader2,
  Users,
  Clock,
  X,
  Sparkles,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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

// ─── Decorative Component ────────────────────────────────
function DecorativeHearts() {
  return (
    <div className="pointer-events-none select-none" aria-hidden="true">
      <span className="absolute top-4 left-4 text-2xl opacity-20 animate-pulse">💍</span>
      <span className="absolute top-8 right-8 text-xl opacity-15 animate-pulse" style={{ animationDelay: '0.5s' }}>✨</span>
      <span className="absolute bottom-4 left-8 text-lg opacity-20 animate-pulse" style={{ animationDelay: '1s' }}>💕</span>
      <span className="absolute bottom-6 right-4 text-2xl opacity-15 animate-pulse" style={{ animationDelay: '1.5s' }}>💍</span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────
export default function Home() {
  const { toast } = useToast()

  // State
  const [photos, setPhotos] = useState<Photo[]>([])
  const [guestName, setGuestName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [newPhotoIds, setNewPhotoIds] = useState<Set<string>>(new Set())

  // Refs
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Fetch photos ────────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos')
      if (res.ok) {
        const data = await res.json()
        setPhotos((prev) => {
          // Mark truly new photos
          const prevIds = new Set(prev.map((p) => p.id))
          const newIds = new Set<string>()
          data.photos.forEach((p: Photo) => {
            if (!prevIds.has(p.id)) newIds.add(p.id)
          })
          if (newIds.size > 0) {
            setNewPhotoIds((prevSet) => {
              const updated = new Set(prevSet)
              newIds.forEach((id) => updated.add(id))
              return updated
            })
            // Clear new badges after 4 seconds
            setTimeout(() => {
              setNewPhotoIds((prevSet) => {
                const updated = new Set(prevSet)
                newIds.forEach((id) => updated.delete(id))
                return updated
              })
            }, 4000)
          }
          return data.photos
        })
      }
    } catch {
      // Silently fail on polling
    } finally {
      setIsLoadingPhotos(false)
    }
  }, [])

  // ─── WebSocket connection ─────────────────────────────
  useEffect(() => {
    fetchPhotos()

    // WebSocket
    const socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[WS] Connected')
    })

    socket.on('photo_update', (data: { type: string; photo: Photo }) => {
      if (data.type === 'new_photo') {
        setPhotos((prev) => {
          // Avoid duplicates
          if (prev.some((p) => p.id === data.photo.id)) return prev
          return [data.photo, ...prev]
        })
        setNewPhotoIds((prevSet) => {
          const updated = new Set(prevSet)
          updated.add(data.photo.id)
          return updated
        })
        setTimeout(() => {
          setNewPhotoIds((prevSet) => {
            const updated = new Set(prevSet)
            updated.delete(data.photo.id)
            return updated
          })
        }, 4000)
        toast({
          title: '📸 Nova foto!',
          description: `${data.photo.guestName} enviou uma foto`,
        })
      }
    })

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected')
    })

    // Polling fallback every 10s
    pollingRef.current = setInterval(fetchPhotos, 10000)

    return () => {
      socket.disconnect()
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchPhotos, toast])

  // ─── Scroll to top button ────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // ─── Handle file selection ───────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      toast({
        title: 'Tipo inválido',
        description: 'Use JPG, PNG ou WebP.',
        variant: 'destructive',
      })
      return
    }

    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'Máximo 20MB.',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  // ─── Handle upload ───────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'Selecione uma foto',
        description: 'Escolha ou tire uma foto primeiro.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', selectedFile)
      formData.append('guestName', guestName.trim() || 'Convidado')

      const res = await fetch('/api/photos', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar foto')
      }

      toast({
        title: '🎉 Foto enviada!',
        description: 'Sua foto foi adicionada ao álbum!',
      })

      // Reset form
      setSelectedFile(null)
      setPreviewUrl(null)
      setGuestName('')
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Refresh photos
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

  // ─── Clear preview ───────────────────────────────────
  const clearPreview = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Download all photos ─────────────────────────────
  const downloadAllPhotos = async () => {
    if (photos.length === 0) {
      toast({
        title: 'Sem fotos',
        description: 'Ainda não há fotos para baixar.',
        variant: 'destructive',
      })
      return
    }

    toast({
      title: '⬇️ Baixando fotos...',
      description: `${photos.length} foto(s) serão baixadas.`,
    })

    // Download each photo sequentially with a small delay
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      const link = document.createElement('a')
      link.href = `/uploads/${photo.filename}`
      link.download = photo.originalName || photo.filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      // Small delay to avoid browser blocking
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--wedding-cream)' }}>
      {/* ═══════════ HERO SECTION ═══════════ */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #FFF9F0 0%, #F5EDE4 30%, #E8C4C4 70%, #D4A574 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, #E8C4C4 0%, transparent 50%), radial-gradient(circle at 80% 20%, #D4A574 0%, transparent 40%), radial-gradient(circle at 60% 80%, #E8C4C4 0%, transparent 45%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 px-4 pt-10 pb-8 text-center">
          {/* Decorative top */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-2"
          >
            <span className="text-3xl">💍</span>
          </motion.div>

          {/* Couple names */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-2"
            style={{
              color: 'var(--wedding-charcoal)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '0 2px 10px rgba(212,165,116,0.2)',
            }}
          >
            Ana & Pedro
          </motion.h1>

          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex items-center justify-center gap-3 my-3"
          >
            <div className="h-px w-16 sm:w-24" style={{ backgroundColor: 'var(--wedding-gold)' }} />
            <Heart className="w-5 h-5 fill-current" style={{ color: 'var(--wedding-blush)' }} />
            <div className="h-px w-16 sm:w-24" style={{ backgroundColor: 'var(--wedding-gold)' }} />
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg sm:text-xl font-medium mb-4"
            style={{ color: 'var(--wedding-gold-dark)' }}
          >
            <Sparkles className="w-4 h-4 inline-block mr-1" />
            Álbum de Fotos ao Vivo
            <Sparkles className="w-4 h-4 inline-block ml-1" />
          </motion.p>

          {/* Live counter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Badge
              variant="secondary"
              className="text-sm px-4 py-1.5 rounded-full shadow-sm"
              style={{
                backgroundColor: 'var(--wedding-gold)',
                color: 'white',
              }}
            >
              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
              {photos.length} {photos.length === 1 ? 'foto' : 'fotos'} no álbum
            </Badge>
          </motion.div>
        </div>

        {/* Bottom wave */}
        <div className="relative h-6 -mb-px">
          <svg viewBox="0 0 1440 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 w-full">
            <path
              d="M0 24L48 21.3C96 18.7 192 13.3 288 10.7C384 8 480 8 576 10.7C672 13.3 768 18.7 864 18.7C960 18.7 1056 13.3 1152 10.7C1248 8 1344 8 1392 8L1440 8V24H1392C1344 24 1248 24 1152 24C1056 24 960 24 864 24C768 24 672 24 576 24C480 24 384 24 288 24C192 24 96 24 48 24H0Z"
              fill="var(--wedding-cream)"
            />
          </svg>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* ─── UPLOAD SECTION ─── */}
        <section className="py-6">
          <Card className="overflow-hidden shadow-md border-0 rounded-2xl" style={{ backgroundColor: 'white' }}>
            <CardContent className="p-5 sm:p-6">
              <h2
                className="text-xl font-bold mb-4 text-center"
                style={{ color: 'var(--wedding-charcoal)', fontFamily: 'Georgia, serif' }}
              >
                Envie sua Foto 💫
              </h2>

              {/* Guest name input */}
              <div className="mb-4">
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--wedding-gold)' }} />
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Seu nome"
                    className="pl-10 h-11 rounded-xl border"
                    style={{ borderColor: 'var(--wedding-gold)', backgroundColor: 'var(--wedding-cream)' }}
                    maxLength={50}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-12 rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}
                  asChild
                >
                  <span>
                    <Camera className="w-4 h-4 mr-2" />
                    Tirar Foto
                  </span>
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="h-12 rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] border-2"
                  style={{ borderColor: 'var(--wedding-gold)', color: 'var(--wedding-gold-dark)' }}
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar Foto
                  </span>
                </Button>
              </div>

              {/* Hidden file inputs */}
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

              {/* Preview */}
              <AnimatePresence>
                {previewUrl && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-4"
                  >
                    <div className="relative rounded-xl overflow-hidden shadow-sm border" style={{ borderColor: 'var(--wedding-gold)' }}>
                      <img
                        src={previewUrl}
                        alt="Pré-visualização"
                        className="w-full max-h-64 object-contain"
                        style={{ backgroundColor: '#faf5f0' }}
                      />
                      <button
                        onClick={clearPreview}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: 'rgba(45,45,45,0.7)', color: 'white' }}
                        aria-label="Remover foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {selectedFile && (
                        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(45,45,45,0.6)', color: 'white' }}>
                          {selectedFile.name} · {formatSize(selectedFile.size)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload button */}
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
                      className="w-full h-12 rounded-xl text-base font-semibold shadow-md transition-all hover:shadow-lg active:scale-[0.99]"
                      style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}
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
            </CardContent>
          </Card>
        </section>

        {/* ─── GALLERY SECTION ─── */}
        <section className="py-4 pb-24">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
            <h2
              className="text-2xl font-bold text-center whitespace-nowrap"
              style={{ color: 'var(--wedding-charcoal)', fontFamily: 'Georgia, serif' }}
            >
              Galeria de Fotos
            </h2>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--wedding-gold)', opacity: 0.4 }} />
          </div>

          {/* Loading state */}
          {isLoadingPhotos && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--wedding-gold)' }} />
              <p className="text-sm" style={{ color: 'var(--wedding-gold-dark)' }}>
                Carregando fotos...
              </p>
            </div>
          )}

          {/* Empty state */}
          {!isLoadingPhotos && photos.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--wedding-ivory)' }}>
                <ImageIcon className="w-10 h-10" style={{ color: 'var(--wedding-gold)' }} />
              </div>
              <p className="text-lg font-semibold mb-1" style={{ color: 'var(--wedding-charcoal)' }}>
                Seja o primeiro a enviar uma foto!
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Compartilhe seus melhores momentos 💕
              </p>
            </motion.div>
          )}

          {/* Masonry gallery */}
          {!isLoadingPhotos && photos.length > 0 && (
            <div className="columns-2 sm:columns-3 gap-3 space-y-3">
              <AnimatePresence>
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
                    className="break-inside-avoid"
                  >
                    <Card
                      className="overflow-hidden cursor-pointer group shadow-sm hover:shadow-lg transition-all duration-300 border-0 rounded-xl"
                      style={{ backgroundColor: 'white' }}
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      {/* Image */}
                      <div className="relative overflow-hidden">
                        <img
                          src={`/uploads/${photo.filename}`}
                          alt={`Foto de ${photo.guestName}`}
                          className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          style={{ minHeight: '120px' }}
                        />
                        {/* New badge */}
                        {newPhotoIds.has(photo.id) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2"
                          >
                            <Badge
                              className="text-xs px-2 py-0.5 rounded-full shadow-sm"
                              style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}
                            >
                              Nova ✨
                            </Badge>
                          </motion.div>
                        )}
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      </div>

                      {/* Info */}
                      <div className="p-2.5">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--wedding-charcoal)' }}>
                          {photo.guestName}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {timeAgo(photo.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* ═══════════ ADMIN BAR ═══════════ */}
      <footer className="sticky bottom-0 z-30 border-t" style={{ backgroundColor: 'white', borderColor: 'var(--wedding-gold)', opacity: 0.95 }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <Heart className="w-3 h-3 inline mr-1" style={{ color: 'var(--wedding-blush)' }} />
            Feito com amor para Ana & Pedro
          </p>
          <Button
            onClick={downloadAllPhotos}
            variant="outline"
            size="sm"
            className="rounded-lg text-xs font-medium shadow-sm border"
            style={{ borderColor: 'var(--wedding-gold)', color: 'var(--wedding-gold-dark)' }}
            disabled={photos.length === 0}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Baixar Todas
          </Button>
        </div>
      </footer>

      {/* ═══════════ PHOTO DIALOG ═══════════ */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent
          className="max-w-3xl p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
          style={{ backgroundColor: 'white' }}
          showCloseButton={true}
        >
          {selectedPhoto && (
            <>
              <DialogTitle className="sr-only">Foto de {selectedPhoto.guestName}</DialogTitle>
              <DialogDescription className="sr-only">
                Foto enviada por {selectedPhoto.guestName} em {new Date(selectedPhoto.createdAt).toLocaleString('pt-BR')}
              </DialogDescription>
              <div className="relative">
                <img
                  src={`/uploads/${selectedPhoto.filename}`}
                  alt={`Foto de ${selectedPhoto.guestName}`}
                  className="w-full max-h-[75vh] object-contain"
                  style={{ backgroundColor: '#faf5f0' }}
                />
              </div>
              <div className="p-4 flex items-center justify-between" style={{ backgroundColor: 'white' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--wedding-charcoal)' }}>
                    {selectedPhoto.guestName}
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
                    style={{ borderColor: 'var(--wedding-gold)', color: 'var(--wedding-gold-dark)' }}
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

      {/* ═══════════ SCROLL TO TOP ═══════════ */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-20 right-4 z-40"
          >
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              size="icon"
              className="rounded-full w-11 h-11 shadow-lg"
              style={{ backgroundColor: 'var(--wedding-gold)', color: 'white' }}
              aria-label="Voltar ao topo"
            >
              <ChevronUp className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
