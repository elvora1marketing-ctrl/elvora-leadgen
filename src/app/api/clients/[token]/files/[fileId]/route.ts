import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import getDb from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; fileId: string }> }
) {
  try {
    const { token, fileId } = await params;
    const db = getDb();

    const client = db.prepare('SELECT id FROM clients WHERE token = ?').get(token) as { id: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: 'Client nicht gefunden' }, { status: 404 });
    }

    const file = db.prepare('SELECT * FROM client_files WHERE id = ? AND client_id = ?').get(parseInt(fileId), client.id) as { filepath: string; filename: string } | undefined;
    if (!file) {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
    }

    const buffer = await readFile(file.filepath);
    const ext = path.extname(file.filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.zip': 'application/zip',
    };

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
