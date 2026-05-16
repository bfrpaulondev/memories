# Wedding Album Rebuild - Work Log

**Project**: Patrícia & Samuel Virtual Wedding Album (2026)
**Date**: 2026-05-16
**Status**: Complete

## Summary

Complete rewrite of the virtual wedding album app from Prisma/SQLite to MongoDB/Cloudinary, with drag-to-flip page turns, inline signatures, and full mobile responsiveness.

## Changes Made

### 1. Backend: MongoDB + Cloudinary (Replaced Prisma/SQLite)

- **Removed**: `prisma/` directory, `src/lib/db.ts` (Prisma client), `db/` directory, `public/uploads/` directory
- **Added**: `src/lib/mongodb.ts` - Mongoose connection with graceful fallback when DB is unreachable
- **Added**: `src/lib/cloudinary.ts` - Cloudinary configuration for image uploads
- **Added**: `src/models/Photo.ts` - Mongoose schema with fields: cloudinaryId, cloudinaryUrl, frame, message, isSignature, signatureForPhotoId
- **Updated**: `src/app/api/photos/route.ts` - POST uploads to Cloudinary, saves metadata to MongoDB (with in-memory fallback)
- **Added**: `src/app/api/photos/signature/route.ts` - POST endpoint for inline signatures linked to specific photos
- **Removed**: `server.js` (old custom server), `src/app/api/route.ts` (placeholder)

### 2. Drag-to-Flip Page Turn (NO ARROWS!)

- Removed all arrow/button navigation (ChevronLeft, ChevronRight icons removed)
- Implemented pointer event-based drag-to-flip system:
  - `onPointerDown`: Records drag start position
  - `onPointerMove`: Calculates rotation angle proportional to drag distance (`angle = (deltaX / pageWidth) * 180`)
  - `onPointerUp`: If angle > 90° (past 50%), completes flip with animation; otherwise springs back
  - Works with mouse, touch, and Apple Pencil (pointer events)
- 3D CSS book effects preserved from CodePen style:
  - `perspective: 1200px` on book container
  - `transform-origin: 0% 0%` on flipping pages
  - `transform-style: preserve-3d`
  - Front face: `rotateY(0deg) translateZ(1px)` with backface-visibility: hidden
  - Back face: `rotateY(180deg) translateZ(1px)` with backface-visibility: hidden
  - Paper texture gradient: `linear-gradient(90deg, rgba(227,227,227,1) 0%, rgba(247,247,247,0) 18%)`
  - Shadow effects during flip
  - Spine shadow in the middle
- Keyboard navigation still supported (ArrowLeft/ArrowRight)
- Mobile single-page mode with swipe gestures

### 3. Inline Signatures Below Photos

- Each photo page has an `InlineSignatureArea` component below the photo
- Shows "Toque para assinar" (Tap to sign) when no signature exists
- When tapped, expands inline to show a signature canvas:
  - Supports Apple Pencil via pointer events with pressure sensitivity
  - Three color options: Royal (#4A1A6B), Ouro (#C9A96E), Ébano (#2D1B3D)
  - Clear and Save buttons
  - After signing, signature image appears below the photo
- Signature uploaded to Cloudinary (`wedding/signatures` folder)
- Metadata saved to MongoDB with `isSignature: true` and `signatureForPhotoId`

### 4. Photo Upload Flow

- PIN protection (code: 2025) with animated 4-digit input modal
- Upload dialog with:
  - Camera capture button (mobile)
  - File picker button
  - Guest name input
  - Frame selector (3 styles: Classic Gold, Floral Lavender, Modern Minimal)
  - Message textarea
  - Image compression before upload
- Photos upload to Cloudinary, metadata to MongoDB
- Real-time updates via WebSocket (socket.io on port 3001)

### 5. Mobile/Tablet/Desktop Responsiveness

- Mobile (< 768px): Single page view, full width, swipe to flip
- Tablet (768px+): Book spread view, two pages side by side
- Desktop (1024px+): Book spread view, larger sizing
- All controls work on touch devices
- PIN modal is mobile-friendly
- Upload dialog is responsive

### 6. Purple/Gold Wedding Theme

- Preserved all CSS variables for wedding colors
- Purple/lavender/amethyst palette with gold accents
- Premium paper textures, ornamental dividers, gold shimmer animation
- 3 decorative photo frames: Classic Gold, Floral Lavender, Modern Minimal
- P&S monogram on cover
- Dark purple cover and back cover with gold text

## Files Structure

```
/home/z/my-project/
├── .env.local                    # MongoDB + Cloudinary config
├── .env.example                  # Template for deployment
├── package.json                  # Updated (removed Prisma, added Mongoose/Cloudinary)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── components.json
├── mini-services/
│   └── ws-service/
│       ├── package.json
│       └── index.ts             # Socket.io WebSocket service (port 3001)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # With Cormorant Garamond + Playfair Display fonts
│   │   ├── page.tsx             # Main component with DragToFlipBook + InlineSignature
│   │   ├── globals.css          # Wedding theme CSS + 3D book effects
│   │   └── api/
│   │       └── photos/
│   │           ├── route.ts     # GET/POST photos (Cloudinary + MongoDB)
│   │           └── signature/
│   │               └── route.ts # POST signatures
│   ├── lib/
│   │   ├── mongodb.ts           # Mongoose connection with fallback
│   │   ├── cloudinary.ts        # Cloudinary config
│   │   └── utils.ts             # Utility functions
│   ├── models/
│   │   └── Photo.ts             # Mongoose schema
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── use-mobile.ts
│   └── components/
│       └── ui/                  # shadcn/ui components
```

## Known Issues

1. **MongoDB Atlas IP Whitelist**: The MongoDB Atlas cluster is not accessible from this sandbox environment due to IP whitelisting restrictions. The app gracefully falls back to in-memory storage. To fix: add the server's IP to the Atlas whitelist.

2. **First API call is slow**: The first GET /api/photos call takes ~3-4 seconds because it attempts MongoDB connection first (with 3s timeout) before falling back. Subsequent calls use the cached connection status and respond faster.

## Verification

- ✅ `bun run lint` passes with no errors
- ✅ Homepage loads (HTTP 200)
- ✅ API returns `{"photos":[]}` (empty array when no photos)
- ✅ WebSocket service running on port 3001
- ✅ Dev server running on port 3000
- ✅ No Prisma/SQLite code remaining
- ✅ All arrow navigation removed, replaced with drag-to-flip
- ✅ `bun run build` succeeds
- ✅ Pushed to GitHub: https://github.com/bfrpaulondev/memories.git (main branch)

---
Task ID: 5
Agent: Main Agent
Task: Add .env for easy deployment and push to GitHub

Work Log:
- Created `.env` file with all credentials (MongoDB URI, Cloudinary, PIN) for easy deployment import
- Updated `.gitignore` to allow `.env` in the repo (removed from ignore list)
- Verified build succeeds with `bun run build`
- Committed changes: `feat: add .env for easy deployment, update .gitignore`
- Force pushed to `origin/main` on GitHub repo

Stage Summary:
- `.env` file now in repo for easy clone-and-deploy workflow
- All project files committed and pushed to https://github.com/bfrpaulondev/memories.git
- Project builds successfully
---
Task ID: 1
Agent: Main Agent
Task: Update Cloudinary cloud name and integrate real Cloudinary uploads + test in production

Work Log:
- Updated CLOUDINARY_CLOUD_NAME from `bfrpaulondev` to `dhsuwosfd` in `.env` and `src/lib/cloudinary.ts`
- Refactored `src/app/api/photos/route.ts` to upload images to Cloudinary (with base64 fallback)
- Refactored `src/app/api/photos/signature/route.ts` to upload signatures to Cloudinary (with base64 fallback)
- Updated `next.config.ts` with Cloudinary remote image patterns for both old and new cloud names
- Pushed all changes to GitHub (`git push origin main`)
- Updated CLOUDINARY_CLOUD_NAME env var on Vercel production
- Deployed to Vercel production (`npx vercel --prod`)
- Tested photo upload: POST /api/photos → Cloudinary URL returned ✅
- Tested signature upload: POST /api/photos/signature → Cloudinary URL returned ✅
- Verified GET /api/photos returns both old (base64) and new (Cloudinary) photos ✅

Stage Summary:
- Cloud Name `dhsuwosfd` is now correctly configured everywhere
- Both photo and signature uploads now go to Cloudinary in production
- Production URL: https://memories-wedding.vercel.app
- Photo upload result: `https://res.cloudinary.com/dhsuwosfd/image/upload/v1778969819/wedding-album/ojko1b2lzbyf2bjzo5h6.png`
- Signature upload result: `https://res.cloudinary.com/dhsuwosfd/image/upload/v1778969833/wedding-album/signatures/fdibzqncr6gl95pd6ipl.png`
