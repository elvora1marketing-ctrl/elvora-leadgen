import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BAUKASTEN_DIR = join(process.cwd(), 'elvora-baukasten');

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'catalog';
  const blockId = searchParams.get('id');

  if (action === 'catalog') {
    const catalogPath = join(BAUKASTEN_DIR, 'catalog.json');
    if (!existsSync(catalogPath)) {
      return Response.json({ blocks: [] });
    }
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    return Response.json({ blocks: catalog });
  }

  if (action === 'block' && blockId) {
    const catalogPath = join(BAUKASTEN_DIR, 'catalog.json');
    if (!existsSync(catalogPath)) {
      return Response.json({ error: 'Katalog nicht gefunden' }, { status: 404 });
    }
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    const entry = catalog.find((b: { id: string }) => b.id === blockId);
    if (!entry) {
      return Response.json({ error: 'Block nicht gefunden' }, { status: 404 });
    }

    let code = '';
    const codePath = join(BAUKASTEN_DIR, entry.file);
    if (existsSync(codePath)) {
      code = readFileSync(codePath, 'utf-8');
    }

    let specContent = '';
    const specPath = join(BAUKASTEN_DIR, entry.spec);
    if (existsSync(specPath)) {
      specContent = readFileSync(specPath, 'utf-8');
    }

    return Response.json({ ...entry, code, specContent });
  }

  if (action === 'tokens') {
    const preset = searchParams.get('preset') || 'elvora';
    const tokensPath = join(BAUKASTEN_DIR, 'presets', `${preset}.tokens.json`);
    if (!existsSync(tokensPath)) {
      return Response.json({ error: 'Preset nicht gefunden' }, { status: 404 });
    }
    const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'));
    return Response.json(tokens);
  }

  return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
