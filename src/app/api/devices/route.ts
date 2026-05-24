import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const db = getDb();
    const devices = db.prepare('SELECT id, device_name, ip_address, created_at, last_used_at FROM trusted_devices ORDER BY last_used_at DESC').all();
    const whitelistEnabled = (db.prepare("SELECT value FROM settings WHERE key = 'device_whitelist_enabled'").get() as { value: string } | undefined)?.value === '1';
    const currentDeviceToken = request.cookies.get('elvora_device')?.value;

    return NextResponse.json({ devices, whitelist_enabled: whitelistEnabled, current_device_token: currentDeviceToken });
  } catch (error) {
    console.error('Devices list error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });
    }

    const db = getDb();
    const currentDeviceToken = request.cookies.get('elvora_device')?.value;

    // Prevent deleting your own device
    if (currentDeviceToken) {
      const device = db.prepare('SELECT device_token FROM trusted_devices WHERE id = ?').get(id) as { device_token: string } | undefined;
      if (device?.device_token === currentDeviceToken) {
        return NextResponse.json({ error: 'Du kannst dein aktuelles Gerät nicht entfernen.' }, { status: 400 });
      }
    }

    db.prepare('DELETE FROM trusted_devices WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Device delete error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
