import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getDb();

    const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Client nicht gefunden' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const uploadedBy = (formData.get('uploaded_by') as string) || 'client';

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Datei zu groß (max. 10MB)' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Dateityp nicht erlaubt' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'data', 'uploads', client.id.toString());
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || '';
    const safeName = `${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const result = db.prepare('INSERT INTO client_files (client_id, filename, filepath, uploaded_by) VALUES (?, ?, ?, ?)').run(
      client.id, file.name, filepath, uploadedBy === 'agency' ? 'agency' : 'client',
    );

    return NextResponse.json({
      success: true,
      file: { id: result.lastInsertRowid, filename: file.name },
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
