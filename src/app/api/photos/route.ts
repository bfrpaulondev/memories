import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let file: File | null = null;
    let guestName = 'Convidado';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('photo') as File | null;
      guestName = (formData.get('guestName') as string) || 'Convidado';
    } else {
      // JSON body with base64
      const body = await request.json();
      if (body.photo) {
        // Convert base64 to File
        const base64Data = body.photo.split(',')[1] || body.photo;
        const buffer = Buffer.from(base64Data, 'base64');
        file = new File([buffer], body.filename || 'photo.jpg', { type: body.mimeType || 'image/jpeg' }) as any;
        file.size = buffer.length;
        guestName = body.guestName || 'Convidado';
      }
    }

    if (!file) {
      return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      return NextResponse.json({ error: 'Tipo inválido. Use JPG, PNG ou WebP.' }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Máximo 10MB.' }, { status: 400 });
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Read and write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Save to database
    const photo = await db.photo.create({
      data: {
        filename,
        originalName: file.name,
        guestName,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
      },
    });

    // Notify WebSocket (fire and forget)
    try {
      fetch(`http://localhost:3001/broadcast?XTransformPort=3001`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_photo',
          photo: { id: photo.id, filename: photo.filename, guestName: photo.guestName, createdAt: photo.createdAt },
        }),
      });
    } catch {}

    return NextResponse.json({ success: true, photo });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const photos = await db.photo.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ photos });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json({ error: 'Erro ao listar fotos' }, { status: 500 });
  }
}
