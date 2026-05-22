import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface SmartListRule {
  field: string;
  op: string;
  value: string | number | string[];
}

interface SmartListRow {
  id: number;
  name: string;
  rules: string;
  match_type: 'all' | 'any';
}

export function buildWhereClause(rules: SmartListRule[], matchType: 'all' | 'any'): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  for (const rule of rules) {
    switch (rule.field) {
      case 'score':
      case 'engagement_score': {
        const col = rule.field;
        const val = Number(rule.value);
        if (rule.op === 'gte') { conditions.push(`${col} >= ?`); params.push(val); }
        else if (rule.op === 'lte') { conditions.push(`${col} <= ?`); params.push(val); }
        else if (rule.op === 'gt') { conditions.push(`${col} > ?`); params.push(val); }
        else if (rule.op === 'lt') { conditions.push(`${col} < ?`); params.push(val); }
        else if (rule.op === 'eq') { conditions.push(`${col} = ?`); params.push(val); }
        break;
      }
      case 'contact_status': {
        if (rule.op === 'in' && Array.isArray(rule.value)) {
          const placeholders = rule.value.map(() => '?').join(', ');
          conditions.push(`contact_status IN (${placeholders})`);
          params.push(...rule.value);
        } else if (rule.op === 'eq') {
          conditions.push('contact_status = ?');
          params.push(String(rule.value));
        }
        break;
      }
      case 'status': {
        if (rule.op === 'in' && Array.isArray(rule.value)) {
          const placeholders = rule.value.map(() => '?').join(', ');
          conditions.push(`status IN (${placeholders})`);
          params.push(...rule.value);
        } else if (rule.op === 'eq') {
          conditions.push('status = ?');
          params.push(String(rule.value));
        }
        break;
      }
      case 'city': {
        if (rule.op === 'eq') {
          conditions.push('city = ?');
          params.push(String(rule.value));
        }
        break;
      }
      case 'email': {
        if (rule.op === 'exists') {
          conditions.push("email IS NOT NULL AND email != ''");
        } else if (rule.op === 'not_exists') {
          conditions.push("(email IS NULL OR email = '')");
        }
        break;
      }
      case 'phone': {
        if (rule.op === 'exists') {
          conditions.push("phone IS NOT NULL AND phone != ''");
        } else if (rule.op === 'not_exists') {
          conditions.push("(phone IS NULL OR phone = '')");
        }
        break;
      }
      case 'last_activity_at': {
        if (rule.op === 'older_than_days') {
          conditions.push("(last_activity_at IS NULL OR julianday('now') - julianday(last_activity_at) > ?)");
          params.push(Number(rule.value));
        }
        break;
      }
      case 'tags': {
        if (rule.op === 'contains') {
          conditions.push("EXISTS (SELECT 1 FROM lead_tags lt JOIN tags t ON lt.tag_id = t.id WHERE lt.lead_id = leads.id AND t.name = ?)");
          params.push(String(rule.value));
        }
        break;
      }
    }
  }

  if (conditions.length === 0) {
    return { sql: '1=1', params: [] };
  }

  const joiner = matchType === 'any' ? ' OR ' : ' AND ';
  return { sql: conditions.join(joiner), params };
}

function countLeads(db: ReturnType<typeof getDb>, rules: SmartListRule[], matchType: 'all' | 'any'): number {
  const { sql, params } = buildWhereClause(rules, matchType);
  const result = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE ${sql}`).get(...params) as { count: number };
  return result.count;
}

export async function GET() {
  try {
    const db = getDb();

    const smartLists = db.prepare('SELECT * FROM smart_lists ORDER BY is_pinned DESC, created_at DESC').all() as SmartListRow[];

    const updatedLists = smartLists.map((list) => {
      const rules: SmartListRule[] = JSON.parse(list.rules);
      const leadCount = countLeads(db, rules, list.match_type);

      db.prepare("UPDATE smart_lists SET lead_count = ?, updated_at = datetime('now') WHERE id = ?")
        .run(leadCount, list.id);

      return { ...list, lead_count: leadCount };
    });

    return NextResponse.json({ smart_lists: updatedLists });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json() as {
      name: string;
      rules: SmartListRule[];
      match_type?: 'all' | 'any';
      icon?: string;
      color?: string;
      is_pinned?: boolean;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!Array.isArray(body.rules) || body.rules.length === 0) {
      return NextResponse.json({ error: 'At least one rule is required' }, { status: 400 });
    }

    const matchType = body.match_type === 'any' ? 'any' : 'all';
    const leadCount = countLeads(db, body.rules, matchType);

    const result = db.prepare(`
      INSERT INTO smart_lists (name, icon, color, rules, match_type, lead_count, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.name.trim(),
      body.icon || 'list',
      body.color || '#8b5cf6',
      JSON.stringify(body.rules),
      matchType,
      leadCount,
      body.is_pinned ? 1 : 0
    );

    const smartList = db.prepare('SELECT * FROM smart_lists WHERE id = ?').get(Number(result.lastInsertRowid));

    return NextResponse.json({ success: true, smart_list: smartList }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
