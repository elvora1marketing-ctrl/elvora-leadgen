import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ── CORS helper ──────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = request.nextUrl;
    const action = url.searchParams.get('action');

    // PUBLIC: fetch form config by slug (used by embed widget)
    if (action === 'form') {
      const slug = url.searchParams.get('slug');
      if (!slug) {
        return NextResponse.json({ error: 'slug parameter required' }, { status: 400, headers: corsHeaders() });
      }
      const form = db.prepare(
        'SELECT id, name, slug, fields, submit_label, success_message, color FROM contact_forms WHERE slug = ? AND is_active = 1'
      ).get(slug) as Record<string, unknown> | undefined;

      if (!form) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders() });
      }

      return NextResponse.json({
        form: {
          ...form,
          fields: JSON.parse(form.fields as string),
        },
      }, { headers: corsHeaders() });
    }

    // AUTH: list all forms
    if (action === 'forms') {
      const authError = requireAuth(request);
      if (authError) return authError;

      const forms = db.prepare('SELECT * FROM contact_forms ORDER BY created_at DESC').all() as Record<string, unknown>[];
      return NextResponse.json({
        forms: forms.map(f => ({ ...f, fields: JSON.parse(f.fields as string) })),
      });
    }

    // AUTH: list submissions for a form
    if (action === 'submissions') {
      const authError = requireAuth(request);
      if (authError) return authError;

      const formId = url.searchParams.get('form_id');
      if (!formId) {
        return NextResponse.json({ error: 'form_id parameter required' }, { status: 400 });
      }
      const submissions = db.prepare(
        'SELECT * FROM contact_submissions WHERE form_id = ? ORDER BY created_at DESC'
      ).all(Number(formId)) as Record<string, unknown>[];

      return NextResponse.json({
        submissions: submissions.map(s => ({ ...s, data: JSON.parse(s.data as string) })),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Contact form GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { action } = body;

    // ── PUBLIC: submit form ──────────────────────────────────────────
    if (action === 'submit') {
      const { slug, data, page_url, consent_given, consent_text } = body;
      if (!slug || !data) {
        return NextResponse.json({ error: 'slug and data are required' }, { status: 400, headers: corsHeaders() });
      }

      // DSGVO: Einwilligung ist Pflicht (Art. 6 Abs. 1 lit. a / Art. 7 DSGVO)
      if (consent_given !== true) {
        return NextResponse.json(
          { error: 'Bitte stimmen Sie der Datenschutzerklärung zu, um das Formular abzusenden.' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const form = db.prepare(
        'SELECT * FROM contact_forms WHERE slug = ? AND is_active = 1'
      ).get(slug) as Record<string, unknown> | undefined;

      if (!form) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders() });
      }

      // Validate required fields
      const fields = JSON.parse(form.fields as string) as { name: string; label: string; type: string; required?: boolean }[];
      const missing: string[] = [];
      for (const field of fields) {
        if (field.required && (!data[field.name] || String(data[field.name]).trim() === '')) {
          missing.push(field.label);
        }
      }
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Pflichtfelder fehlen: ${missing.join(', ')}` },
          { status: 400, headers: corsHeaders() }
        );
      }

      // Basic email validation
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return NextResponse.json(
          { error: 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.' },
          { status: 400, headers: corsHeaders() }
        );
      }

      // Get IP address
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

      // Create lead if configured
      let leadId: number | null = null;
      if (form.create_lead === 1) {
        const timestamp = Date.now();
        const normalizedWebsite = `form:${slug}:${timestamp}`;
        try {
          const leadResult = db.prepare(`
            INSERT INTO leads (name, email, phone, city, website_original, website_normalized, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
          `).run(
            data.name || 'Kontaktformular-Lead',
            data.email || null,
            data.phone || null,
            'Unbekannt',
            page_url || null,
            normalizedWebsite,
            `Kontaktformular-Einreichung (${form.name}):\n${JSON.stringify(data, null, 2)}`
          );
          leadId = leadResult.lastInsertRowid as number;
        } catch (e) {
          console.error('[ContactForm] Lead creation error:', e);
          // Don't fail the submission if lead creation fails
        }
      }

      // Insert submission — incl. consent record for Nachweispflicht (Art. 7 Abs. 1 DSGVO)
      const submissionResult = db.prepare(`
        INSERT INTO contact_submissions (form_id, data, lead_id, page_url, ip_address, consent_given, consent_text, consent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        form.id as number,
        JSON.stringify(data),
        leadId,
        page_url || null,
        ip,
        1,
        typeof consent_text === 'string' ? consent_text : 'Einwilligung zur Datenverarbeitung erteilt.',
        new Date().toISOString()
      );

      // Increment submissions count
      db.prepare('UPDATE contact_forms SET submissions_count = submissions_count + 1 WHERE id = ?').run(form.id as number);

      return NextResponse.json({
        success: true,
        submission_id: submissionResult.lastInsertRowid,
        lead_id: leadId,
        success_message: form.success_message,
        redirect_url: form.redirect_url || null,
      }, { headers: corsHeaders() });
    }

    // ── AUTH: create form ────────────────────────────────────────────
    if (action === 'create_form') {
      const authError = requireAuth(request);
      if (authError) return authError;

      const { name, slug, fields, submit_label, success_message, color, notify_email, create_lead, redirect_url } = body;
      if (!name || !slug) {
        return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
      }

      // Check slug uniqueness
      const existing = db.prepare('SELECT id FROM contact_forms WHERE slug = ?').get(slug);
      if (existing) {
        return NextResponse.json({ error: 'Ein Formular mit diesem Slug existiert bereits.' }, { status: 409 });
      }

      const result = db.prepare(`
        INSERT INTO contact_forms (name, slug, fields, submit_label, success_message, color, notify_email, create_lead, redirect_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        slug,
        JSON.stringify(fields || []),
        submit_label || 'Absenden',
        success_message || 'Vielen Dank! Wir melden uns bei Ihnen.',
        color || '#8B5CF6',
        notify_email || null,
        create_lead !== undefined ? (create_lead ? 1 : 0) : 1,
        redirect_url || null
      );

      return NextResponse.json({ success: true, id: result.lastInsertRowid });
    }

    // ── AUTH: update form ────────────────────────────────────────────
    if (action === 'update_form') {
      const authError = requireAuth(request);
      if (authError) return authError;

      const { id, name, slug, fields, submit_label, success_message, color, notify_email, create_lead, redirect_url, is_active } = body;
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      const existing = db.prepare('SELECT id FROM contact_forms WHERE id = ?').get(id);
      if (!existing) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404 });
      }

      // Check slug uniqueness if changed
      if (slug) {
        const slugConflict = db.prepare('SELECT id FROM contact_forms WHERE slug = ? AND id != ?').get(slug, id);
        if (slugConflict) {
          return NextResponse.json({ error: 'Ein Formular mit diesem Slug existiert bereits.' }, { status: 409 });
        }
      }

      const updates: string[] = [];
      const values: (string | number | null)[] = [];

      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (slug !== undefined) { updates.push('slug = ?'); values.push(slug); }
      if (fields !== undefined) { updates.push('fields = ?'); values.push(JSON.stringify(fields)); }
      if (submit_label !== undefined) { updates.push('submit_label = ?'); values.push(submit_label); }
      if (success_message !== undefined) { updates.push('success_message = ?'); values.push(success_message); }
      if (color !== undefined) { updates.push('color = ?'); values.push(color); }
      if (notify_email !== undefined) { updates.push('notify_email = ?'); values.push(notify_email || null); }
      if (create_lead !== undefined) { updates.push('create_lead = ?'); values.push(create_lead ? 1 : 0); }
      if (redirect_url !== undefined) { updates.push('redirect_url = ?'); values.push(redirect_url || null); }
      if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      values.push(id);
      db.prepare(`UPDATE contact_forms SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      return NextResponse.json({ success: true });
    }

    // ── AUTH: delete form ────────────────────────────────────────────
    if (action === 'delete_form') {
      const authError = requireAuth(request);
      if (authError) return authError;

      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      db.prepare('DELETE FROM contact_submissions WHERE form_id = ?').run(id);
      db.prepare('DELETE FROM contact_forms WHERE id = ?').run(id);

      return NextResponse.json({ success: true });
    }

    // ── AUTH: mark submission read ───────────────────────────────────
    if (action === 'mark_read') {
      const authError = requireAuth(request);
      if (authError) return authError;

      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      db.prepare('UPDATE contact_submissions SET is_read = 1 WHERE id = ?').run(id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Contact form POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
