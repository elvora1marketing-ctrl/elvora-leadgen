import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authError = requireAuth(request);
    if (authError) return authError;

    const db = getDb();
    const { lead_id } = await request.json();

    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id) as any;
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const activities = db.prepare(
      'SELECT type, content, created_at FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(lead_id) as any[];

    const proposals = db.prepare(
      'SELECT title, amount, status, created_at, viewed_at, accepted_at FROM proposals WHERE lead_id = ? ORDER BY created_at DESC LIMIT 3'
    ).all(lead_id) as any[];

    const competitors = db.prepare(
      'SELECT competitor_name, competitor_score FROM competitor_analyses WHERE lead_id = ? LIMIT 3'
    ).all(lead_id) as any[];

    const openTasks = db.prepare(
      'SELECT title, type, due_date FROM tasks WHERE lead_id = ? AND is_completed = 0 ORDER BY due_date ASC LIMIT 5'
    ).all(lead_id) as any[];

    const emailEvents = db.prepare(
      'SELECT event_type, created_at FROM email_events WHERE lead_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(lead_id) as any[];

    const insights = JSON.parse(lead.deal_insights || '[]');
    const healthScore = lead.deal_health_score || 50;

    const daysSinceActivity = lead.last_activity_at
      ? Math.floor((Date.now() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24))
      : lead.updated_at
        ? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

    const hasOpened = emailEvents.some((e: any) => e.event_type === 'opened');
    const hasClicked = emailEvents.some((e: any) => e.event_type === 'clicked');
    const hasReplied = activities.some((a: any) => a.type === 'email' && a.content?.includes('Antwort'));
    const hasProposal = proposals.length > 0;
    const proposalViewed = proposals.some((p: any) => p.viewed_at);
    const proposalUnresponded = proposals.some((p: any) => p.status === 'sent' || p.status === 'viewed');

    let recommended_action = '';
    let risk_level: 'niedrig' | 'mittel' | 'hoch' = 'mittel';
    let pitch_angle = '';
    let reasoning = '';

    // Decision logic based on lead state
    if (lead.contact_status === 'not_contacted') {
      if (lead.score >= 60 && lead.email) {
        recommended_action = 'Personalisierte Erstmail senden';
        risk_level = 'niedrig';
        reasoning = `Score ${lead.score}/100 zeigt hohen Bedarf. Email-Adresse vorhanden.`;
        pitch_angle = lead.score >= 80
          ? 'Dringlichkeit betonen — kritische Website-Probleme gefunden'
          : 'Verbesserungspotenzial aufzeigen — konkrete Probleme nennen';
      } else if (lead.score >= 60 && !lead.email) {
        recommended_action = 'Email-Adresse recherchieren, dann kontaktieren';
        risk_level = 'mittel';
        reasoning = 'Hoher Score aber keine Kontaktdaten.';
      } else {
        recommended_action = 'Lead weiter qualifizieren — Score zu niedrig für Outreach';
        risk_level = 'niedrig';
        reasoning = `Score ${lead.score}/100 noch nicht überzeugend.`;
      }
    } else if (lead.contact_status === 'email_sent') {
      if (hasOpened && !hasReplied) {
        recommended_action = 'Telefonisch nachfassen — Email wurde geöffnet';
        risk_level = 'mittel';
        reasoning = `Lead hat die Email geöffnet${hasClicked ? ' und Links angeklickt' : ''}, aber nicht geantwortet. Telefonat ist der logische nächste Schritt.`;
        pitch_angle = hasClicked ? 'Bezug auf angeklickte Inhalte nehmen' : 'Kurz und direkt — auf die Email-Analyse verweisen';
      } else if (daysSinceActivity > 7) {
        recommended_action = 'Follow-up Email senden oder Sequenz starten';
        risk_level = 'hoch';
        reasoning = `${daysSinceActivity} Tage seit letztem Kontakt. Deal droht kalt zu werden.`;
      } else {
        recommended_action = 'Abwarten — Email ist noch frisch';
        risk_level = 'niedrig';
        reasoning = `Erst ${daysSinceActivity} Tage seit dem Versand. Noch im normalen Zeitfenster.`;
      }
    } else if (lead.contact_status === 'called') {
      if (daysSinceActivity > 5) {
        recommended_action = 'Meeting vorschlagen — Anruf-Momentum nutzen';
        risk_level = 'mittel';
        reasoning = `${daysSinceActivity} Tage seit dem Gespräch. Schnell handeln bevor das Interesse nachlässt.`;
      } else {
        recommended_action = 'Meeting-Termin vereinbaren';
        risk_level = 'niedrig';
        reasoning = 'Gespräch war kürzlich — idealer Zeitpunkt für den nächsten Schritt.';
      }
      pitch_angle = 'Konkreten Mehrwert aufzeigen mit Zahlen aus der Analyse';
    } else if (lead.contact_status === 'meeting') {
      if (!hasProposal) {
        recommended_action = 'Angebot erstellen und innerhalb 24h senden';
        risk_level = daysSinceActivity > 3 ? 'hoch' : 'mittel';
        reasoning = hasProposal
          ? 'Meeting hatte stattgefunden, Angebot fehlt noch.'
          : `Meeting war vor ${daysSinceActivity} Tagen — Angebot sollte schnell folgen.`;
      } else {
        recommended_action = 'Angebot nachfassen — per Telefon oder persönlich';
        risk_level = 'mittel';
        reasoning = 'Angebot wurde erstellt, jetzt aktiv nachfassen.';
      }
    } else if (lead.contact_status === 'proposal') {
      if (proposalViewed && daysSinceActivity > 3) {
        recommended_action = 'Sofort anrufen — Angebot wurde angesehen';
        risk_level = 'hoch';
        reasoning = 'Das Angebot wurde angesehen aber noch nicht beantwortet. Jetzt ist der ideale Moment.';
        pitch_angle = 'Rückfragen klären, Einwände behandeln, Abschluss suchen';
      } else if (proposalUnresponded && daysSinceActivity > 7) {
        recommended_action = 'Letztes Follow-up — Deadline setzen';
        risk_level = 'hoch';
        reasoning = `Angebot seit ${daysSinceActivity} Tagen ohne Antwort. Entweder jetzt oder nie.`;
        pitch_angle = 'Angebots-Gültigkeit betonen, ggf. Sonderkonditionen anbieten';
      } else {
        recommended_action = 'Geduld — Angebot noch im Entscheidungszeitraum';
        risk_level = 'niedrig';
        reasoning = 'Noch im normalen Zeitfenster für eine Entscheidung.';
      }
    }

    // Enrich with competitor data
    if (competitors.length > 0 && !pitch_angle) {
      const betterCompetitor = competitors.find((c: any) => c.competitor_score < lead.score);
      if (betterCompetitor) {
        pitch_angle = `Konkurrent "${betterCompetitor.competitor_name}" hat bessere Website (Score ${betterCompetitor.competitor_score}) — Wettbewerbsdruck nutzen`;
      }
    }

    if (!pitch_angle) {
      const problems = JSON.parse(lead.problems || '[]');
      if (problems.length > 0) {
        pitch_angle = `Top-Problem adressieren: ${problems[0]?.text || problems[0] || 'Website-Optimierung'}`;
      }
    }

    return NextResponse.json({
      recommended_action: recommended_action || 'Keine spezifische Empfehlung — Lead-Daten prüfen',
      risk_level,
      pitch_angle: pitch_angle || 'Individuelle Analyse der Website-Schwächen',
      reasoning: reasoning || 'Zu wenig Daten für eine fundierte Einschätzung.',
      health_score: healthScore,
      insights,
      open_tasks: openTasks.length,
      days_since_activity: daysSinceActivity,
    });
  } catch (error) {
    console.error('Deal advisor error:', error);
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 });
  }
}
