import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhsuwosfd',
  api_key: process.env.CLOUDINARY_API_KEY || '533928869964219',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'OhUowpf7MfQE12ELIHo6FzlyiFc',
  secure: true,
});

// In-memory fallback when MongoDB is unavailable
let memoryPhotos: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const conn = await dbConnect();

    const contentType = request.headers.get('content-type') || '';
    let fileBuffer: Buffer | null = null;
    let fileName = 'photo.jpg';
    let guestName = 'Convidado';
    let frame = 'classic';
    let message = '';
    let isSignature = false;
    let signatureForPhotoId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('photo') as File | null;
      guestName = (formData.get('guestName') as string) || 'Convidado';
      frame = (formData.get('frame') as string) || 'classic';
      message = (formData.get('message') as string) || '';
      isSignature = formData.get('isSignature') === 'true';
      signatureForPhotoId = (formData.get('signatureForPhotoId') as string) || null;

      if (!file) {
        return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
      }

      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
        return NextResponse.json({ error: 'Tipo inválido. Use JPG, PNG ou WebP.' }, { status: 400 });
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Máximo 10MB.' }, { status: 400 });
      }

      fileName = file.name;
      const bytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(bytes);
    } else {
      const body = await request.json();
      if (body.photo) {
        const base64Data = body.photo.split(',')[1] || body.photo;
        fileBuffer = Buffer.from(base64Data, 'base64');
        fileName = body.filename || 'photo.jpg';
        guestName = body.guestName || 'Convidado';
        frame = body.frame || 'classic';
        message = body.message || '';
        isSignature = body.isSignature || false;
        signatureForPhotoId = body.signatureForPhotoId || null;
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
    }

    // Upload to Cloudinary
    let cloudinaryUrl = '';
    let cloudinaryId = `local-${Date.now()}`;

    try {
      const base64Data = fileBuffer.toString('base64');
      const mimeType = fileName.match(/\.(png|webp)$/i)
        ? (fileName.match(/\.png$/i) ? 'image/png' : 'image/webp')
        : 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64Data}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: 'wedding-album',
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      cloudinaryUrl = uploadResult.secure_url;
      cloudinaryId = uploadResult.public_id;
      console.log(`[Cloudinary] Upload success: ${cloudinaryId} → ${cloudinaryUrl}`);
    } catch (cloudErr) {
      console.error('[Cloudinary] Upload failed, falling back to base64:', cloudErr);
      // Fallback: store as base64 data URL
      const base64Data = fileBuffer.toString('base64');
      const mimeType = fileName.match(/\.(png|webp)$/i)
        ? (fileName.match(/\.png$/i) ? 'image/png' : 'image/webp')
        : 'image/jpeg';
      cloudinaryUrl = `data:${mimeType};base64,${base64Data}`;
    }

    const photoData: any = {
      cloudinaryId,
      cloudinaryUrl,
      originalName: fileName,
      guestName,
      frame,
      message,
      isSignature,
      signatureForPhotoId,
      createdAt: new Date().toISOString(),
    };

    // Save to MongoDB if connected
    if (conn) {
      try {
        const photo = await Photo.create({
          cloudinaryId,
          cloudinaryUrl,
          originalName: fileName,
          guestName,
          size: fileBuffer.length,
          frame,
          message,
          isSignature,
          signatureForPhotoId,
        });
        photoData.id = photo._id.toString();
        photoData.createdAt = photo.createdAt;
        photoData.cloudinaryId = photo.cloudinaryId;
        photoData.cloudinaryUrl = cloudinaryUrl;

        // Notify WebSocket
        try {
          fetch('http://localhost:3001/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'new_photo', photo: { ...photoData, cloudinaryUrl } }),
          });
        } catch {}
      } catch (dbErr) {
        console.error('MongoDB save error:', dbErr);
        photoData.id = `local-${Date.now()}`;
        memoryPhotos.push({ ...photoData, cloudinaryUrl });
      }
    } else {
      photoData.id = `local-${Date.now()}`;
      memoryPhotos.push({ ...photoData, cloudinaryUrl });
    }

    return NextResponse.json({ success: true, photo: photoData });
  } catch (error: any) {
    console.error('Upload error:', error);
    const detail = error?.message || String(error);
    return NextResponse.json({ error: 'Erro ao fazer upload.', detail }, { status: 500 });
  }
}

export async function GET() {
  try {
    const conn = await dbConnect();

    if (conn) {
      try {
        const photos = await Photo.find({}).sort({ createdAt: 1 }).lean();
        return NextResponse.json({
          photos: photos.map((p) => ({
            id: p._id.toString(),
            cloudinaryUrl: p.cloudinaryUrl,
            cloudinaryId: p.cloudinaryId,
            originalName: p.originalName,
            guestName: p.guestName,
            mimeType: p.mimeType,
            size: p.size,
            frame: p.frame,
            message: p.message,
            isSignature: p.isSignature,
            signatureForPhotoId: p.signatureForPhotoId,
            createdAt: p.createdAt,
          })),
        });
      } catch {
        return NextResponse.json({ photos: memoryPhotos });
      }
    }

    return NextResponse.json({ photos: memoryPhotos });
  } catch {
    return NextResponse.json({ photos: memoryPhotos });
  }
}
