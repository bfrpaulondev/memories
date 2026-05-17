import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';

// Route config for Vercel — increase body size limit for photo uploads
export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhsuwosfd',
  api_key: process.env.CLOUDINARY_API_KEY || '533928869964219',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'OhUowpf7MfQE12ELIHo6FzlyiFc',
  secure: true,
});

// Master password for admin operations
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '1997';

// In-memory fallback when MongoDB is unavailable
let memoryPhotos: any[] = [];

// Helper: safely upload to Cloudinary with retry
async function safeCloudinaryUpload(dataUri: string, options: any, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await cloudinary.uploader.upload(dataUri, options);
    } catch (err: any) {
      console.error(`[Cloudinary] Upload attempt ${attempt + 1} failed:`, err?.message);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Cloudinary upload failed after retries');
}

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

      const uploadResult = await safeCloudinaryUpload(dataUri, {
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

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { masterPassword, photoId, deleteAll } = body;

    // Verify master password
    if (masterPassword !== MASTER_PASSWORD) {
      return NextResponse.json({ error: 'Senha master incorreta' }, { status: 403 });
    }

    const conn = await dbConnect();

    if (deleteAll) {
      // Delete ALL photos and signatures
      let deletedCount = 0;
      let cloudinaryErrors = 0;

      if (conn) {
        try {
          const allPhotos = await Photo.find({}).lean();
          for (const photo of allPhotos) {
            // Delete from Cloudinary
            if (photo.cloudinaryId && !photo.cloudinaryId.startsWith('local-')) {
              try {
                await cloudinary.uploader.destroy(photo.cloudinaryId);
                console.log(`[Cloudinary] Deleted: ${photo.cloudinaryId}`);
              } catch (cloudErr) {
                console.error(`[Cloudinary] Delete failed for ${photo.cloudinaryId}:`, cloudErr);
                cloudinaryErrors++;
              }
            }
          }
          const result = await Photo.deleteMany({});
          deletedCount = result.deletedCount || 0;
        } catch (dbErr) {
          console.error('MongoDB delete all error:', dbErr);
          return NextResponse.json({ error: 'Erro ao deletar fotos do banco' }, { status: 500 });
        }
      }

      // Also clear in-memory
      memoryPhotos = [];

      return NextResponse.json({
        success: true,
        deletedCount,
        cloudinaryErrors,
        message: `${deletedCount} itens deletados`,
      });
    }

    if (photoId) {
      // Delete a single photo/signature
      if (conn) {
        try {
          const photo = await Photo.findById(photoId);
          if (!photo) {
            return NextResponse.json({ error: 'Foto não encontrada' }, { status: 404 });
          }

          // Delete from Cloudinary
          if (photo.cloudinaryId && !photo.cloudinaryId.startsWith('local-')) {
            try {
              await cloudinary.uploader.destroy(photo.cloudinaryId);
              console.log(`[Cloudinary] Deleted: ${photo.cloudinaryId}`);
            } catch (cloudErr) {
              console.error(`[Cloudinary] Delete failed for ${photo.cloudinaryId}:`, cloudErr);
            }
          }

          // Also delete any signatures linked to this photo
          const linkedSigs = await Photo.find({ signatureForPhotoId: photoId });
          for (const sig of linkedSigs) {
            if (sig.cloudinaryId && !sig.cloudinaryId.startsWith('local-')) {
              try {
                await cloudinary.uploader.destroy(sig.cloudinaryId);
              } catch {}
            }
            await sig.deleteOne();
          }

          await photo.deleteOne();
        } catch (dbErr) {
          console.error('MongoDB delete error:', dbErr);
          return NextResponse.json({ error: 'Erro ao deletar foto' }, { status: 500 });
        }
      } else {
        // In-memory fallback
        memoryPhotos = memoryPhotos.filter((p) => p.id !== photoId && p.cloudinaryId !== photoId);
      }

      return NextResponse.json({ success: true, message: 'Item deletado' });
    }

    return NextResponse.json({ error: 'Especifique photoId ou deleteAll' }, { status: 400 });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Erro ao deletar', detail: error?.message }, { status: 500 });
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
