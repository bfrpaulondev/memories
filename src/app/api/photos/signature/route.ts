import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';
import cloudinary from '@/lib/cloudinary';

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

    const uploadResult = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'wedding/signatures', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
        (error, result) => {
          if (error) reject(error);
          else resolve({ public_id: result!.public_id, secure_url: result!.secure_url });
        }
      ).end(fileBuffer);
    });

    const signatureData: any = {
      cloudinaryId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
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
          cloudinaryId: uploadResult.public_id,
          cloudinaryUrl: uploadResult.secure_url,
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
            body: JSON.stringify({ type: 'new_signature', photo: { ...signatureData } }),
          });
        } catch {}
      } catch {
        signatureData.id = `local-sig-${Date.now()}`;
      }
    } else {
      signatureData.id = `local-sig-${Date.now()}`;
    }

    return NextResponse.json({ success: true, signature: signatureData });
  } catch (error) {
    console.error('Signature upload error:', error);
    return NextResponse.json({ error: 'Erro ao salvar assinatura.' }, { status: 500 });
  }
}
