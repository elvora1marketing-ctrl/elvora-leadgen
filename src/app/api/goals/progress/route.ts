import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface Goal {
  id: number;
  activity_type: string;
  period: string;
  target: number;
  created_at: string;
}

function getPeriodFilter(period: string): string {
  switch (period) {
    case 'daily':
      return "date(created_at) = date('now')";
    case 'weekly':
      return "strftime('%W', created_at) = strftime('%W', 'now') AND strftime('%Y', created_at) = strftime('%Y', 'now')";
    case 'monthly':
      return "strftime('%m', created_at) = strftime('%m', 'now') AND strftime('%Y', created_at) = strftime('%Y', 'now')";
    default:
      return "date(created_at) = date('now')";
  }
}

function calculateStreak(db: ReturnType<typeof getDb>): number {
  // Get all daily goals
  const dailyGoals = db.prepare(
    "SELECT activity_type, target FROM activity_goals WHERE period = 'daily'"
  ).all() as { activity_type: string; target: number }[];

  if (dailyGoals.length === 0) return 0;

  let streak = 0;

  // Check each of the last 30 days (starting from yesterday, since today is in progress)
  for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
    const dateOffset = `-${daysAgo} days`;
    let allMet = true;

    for (const goal of dailyGoals) {
      let count = 0;

      // Count from lead_activities
      const activityCount = db.prepare(`
        SELECT COUNT(*) as cnt FROM lead_activities
        WHERE type = ? AND date(created_at) = date('now', ?)
      `).get(goal.activity_type, dateOffset) as { cnt: number };
      count += activityCount.cnt;

      // For email goals, also count delivered emails from email_events
      if (goal.activity_type === 'email') {
        const emailEventCount = db.prepare(`
          SELECT COUNT(*) as cnt FROM email_events
          WHERE event_type = 'delivered' AND date(created_at) = date('now', ?)
        `).get(dateOffset) as { cnt: number };
        count += emailEventCount.cnt;
      }

      if (count < goal.target) {
        allMet = false;
        break;
      }
    }

    if (allMet) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function GET() {
  try {
    const db = getDb();

    const goals = db.prepare('SELECT * FROM activity_goals ORDER BY activity_type, period').all() as Goal[];

    const goalsWithProgress = goals.map((goal) => {
      const periodFilter = getPeriodFilter(goal.period);

      // Count matching activities from lead_activities
      const activityCount = db.prepare(`
        SELECT COUNT(*) as cnt FROM lead_activities
        WHERE type = ? AND ${periodFilter}
      `).get(goal.activity_type) as { cnt: number };

      let current = activityCount.cnt;

      // For email goals, also count delivered emails from email_events
      if (goal.activity_type === 'email') {
        const emailEventCount = db.prepare(`
          SELECT COUNT(*) as cnt FROM email_events
          WHERE event_type = 'delivered' AND ${periodFilter}
        `).get() as { cnt: number };
        current += emailEventCount.cnt;
      }

      const percentage = goal.target > 0 ? Math.min(Math.round((current / goal.target) * 100), 100) : 0;

      return {
        id: goal.id,
        activity_type: goal.activity_type,
        period: goal.period,
        target: goal.target,
        current,
        percentage,
      };
    });

    const streak = calculateStreak(db);

    return NextResponse.json({ goals: goalsWithProgress, streak });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
