import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const guestName = (formData.get('guestName') as string) || 'Convidado';

    if (!file) {
      return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      return NextResponse.json({ error: 'Tipo de arquivo não suportado. Use JPG, PNG ou WebP.' }, { status: 400 });
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 20MB.' }, { status: 400 });
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write file
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

    // Notify WebSocket service
    try {
      await fetch(`http://localhost:3001/broadcast?XTransformPort=3001`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_photo',
          photo: {
            id: photo.id,
            filename: photo.filename,
            guestName: photo.guestName,
            createdAt: photo.createdAt,
          },
        }),
      });
    } catch {
      // WebSocket service might not be running yet, that's ok
    }

    return NextResponse.json({ success: true, photo });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload da foto' }, { status: 500 });
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
