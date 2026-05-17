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

export async function POST(request: NextRequest) {
  try {
    const conn = await dbConnect();

    const formData = await request.formData();
    const file = formData.get('signature') as File | null;
    const photoId = formData.get('photoId') as string;
    const guestName = (formData.get('guestName') as string) || 'Convidado';

    if (!file) {
      return NextResponse.json({ error: 'Nenhuma assinatura enviada' }, { status: 400 });
    }

    if (!photoId) {
      return NextResponse.json({ error: 'ID da foto não informado' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    // Upload to Cloudinary
    let cloudinaryUrl = '';
    let cloudinaryId = `local-sig-${Date.now()}`;

    try {
      const base64Data = fileBuffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64Data}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: 'wedding-album/signatures',
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      cloudinaryUrl = uploadResult.secure_url;
      cloudinaryId = uploadResult.public_id;
      console.log(`[Cloudinary] Signature upload success: ${cloudinaryId} → ${cloudinaryUrl}`);
    } catch (cloudErr) {
      console.error('[Cloudinary] Signature upload failed, falling back to base64:', cloudErr);
      // Fallback: store as base64 data URL
      const base64Data = fileBuffer.toString('base64');
      cloudinaryUrl = `data:image/png;base64,${base64Data}`;
    }

    const signatureData: any = {
      cloudinaryId,
      cloudinaryUrl,
      originalName: `assinatura-${Date.now()}.png`,
      guestName,
      frame: 'classic',
      message: '',
      isSignature: true,
      signatureForPhotoId: photoId,
      createdAt: new Date().toISOString(),
    };

    if (conn) {
      try {
        const signature = await Photo.create({
          cloudinaryId,
          cloudinaryUrl,
          originalName: `assinatura-${Date.now()}.png`,
          guestName,
          size: fileBuffer.length,
          frame: 'classic',
          message: '',
          isSignature: true,
          signatureForPhotoId: photoId,
        });
        signatureData.id = signature._id.toString();
        signatureData.createdAt = signature.createdAt;

        try {
          fetch('http://localhost:3001/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'new_signature', photo: { ...signatureData, cloudinaryUrl } }),
          });
        } catch {}
      } catch (dbErr) {
        console.error('MongoDB signature save error:', dbErr);
        signatureData.id = `local-sig-${Date.now()}`;
      }
    } else {
      signatureData.id = `local-sig-${Date.now()}`;
    }

    return NextResponse.json({ success: true, signature: signatureData });
  } catch (error: any) {
    console.error('Signature upload error:', error);
    const detail = error?.message || String(error);
    return NextResponse.json({ error: 'Erro ao salvar assinatura.', detail }, { status: 500 });
  }
}
