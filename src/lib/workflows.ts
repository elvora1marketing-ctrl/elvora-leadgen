import type Database from 'better-sqlite3';

interface WorkflowAction {
  type: 'send_email' | 'create_task' | 'change_status' | 'add_tag' | 'update_field' | 'send_notification';
  config: Record<string, any>;
}

interface WorkflowCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'contains';
  value?: any;
}

interface Workflow {
  id: number;
  name: string;
  trigger_type: string;
  trigger_config: string;
  conditions: string;
  actions: string;
  is_active: number;
}

export function executeWorkflows(
  db: Database.Database,
  triggerType: string,
  lead: any,
  eventData?: Record<string, any>
): { executed: number; logs: any[] } {
  const workflows = db.prepare(
    'SELECT * FROM workflows WHERE trigger_type = ? AND is_active = 1'
  ).all(triggerType) as Workflow[];

  const logs: any[] = [];
  let executed = 0;

  for (const wf of workflows) {
    try {
      const triggerConfig = JSON.parse(wf.trigger_config || '{}');
      const conditions = JSON.parse(wf.conditions || '[]') as WorkflowCondition[];
      const actions = JSON.parse(wf.actions || '[]') as WorkflowAction[];

      if (!matchesTrigger(triggerType, triggerConfig, lead, eventData)) continue;
      if (!matchesConditions(conditions, lead)) continue;

      const alreadyRan = db.prepare(
        "SELECT id FROM workflow_logs WHERE workflow_id = ? AND lead_id = ? AND created_at > datetime('now', '-24 hours')"
      ).get(wf.id, lead.id);
      if (alreadyRan) continue;

      const actionsExecuted: string[] = [];
      for (const action of actions) {
        executeAction(db, action, lead);
        actionsExecuted.push(action.type);
      }

      db.prepare(
        "UPDATE workflows SET run_count = run_count + 1, last_run_at = datetime('now') WHERE id = ?"
      ).run(wf.id);

      db.prepare(
        "INSERT INTO workflow_logs (workflow_id, lead_id, trigger_type, actions_executed, status) VALUES (?, ?, ?, ?, 'success')"
      ).run(wf.id, lead.id, triggerType, JSON.stringify(actionsExecuted));

      executed++;
      logs.push({ workflow: wf.name, actions: actionsExecuted });
    } catch (e: any) {
      db.prepare(
        "INSERT INTO workflow_logs (workflow_id, lead_id, trigger_type, status, error) VALUES (?, ?, ?, 'error', ?)"
      ).run(wf.id, lead.id, triggerType, e.message);
      logs.push({ workflow: wf.name, error: e.message });
    }
  }

  return { executed, logs };
}

function matchesTrigger(
  type: string,
  config: Record<string, any>,
  lead: any,
  eventData?: Record<string, any>
): boolean {
  switch (type) {
    case 'score_threshold':
      return lead.score >= (config.threshold || 0);
    case 'status_change':
      if (config.to_status && eventData?.to_status !== config.to_status) return false;
      if (config.from_status && eventData?.from_status !== config.from_status) return false;
      return true;
    case 'email_event':
      return !config.event_type || eventData?.event_type === config.event_type;
    case 'proposal_event':
      return !config.event_type || eventData?.event_type === config.event_type;
    case 'tag_added':
      return !config.tag_name || eventData?.tag_name === config.tag_name;
    case 'new_lead':
      return true;
    case 'inactivity': {
      if (!lead.last_activity_at && !lead.updated_at) return true;
      const lastActivity = new Date(lead.last_activity_at || lead.updated_at);
      const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= (config.days || 7);
    }
    default:
      return true;
  }
}

function matchesConditions(conditions: WorkflowCondition[], lead: any): boolean {
  for (const cond of conditions) {
    const val = lead[cond.field];
    switch (cond.op) {
      case 'eq': if (val !== cond.value) return false; break;
      case 'neq': if (val === cond.value) return false; break;
      case 'gt': if (!(val > cond.value)) return false; break;
      case 'gte': if (!(val >= cond.value)) return false; break;
      case 'lt': if (!(val < cond.value)) return false; break;
      case 'lte': if (!(val <= cond.value)) return false; break;
      case 'in': if (!Array.isArray(cond.value) || !cond.value.includes(val)) return false; break;
      case 'not_in': if (Array.isArray(cond.value) && cond.value.includes(val)) return false; break;
      case 'exists': if (!val) return false; break;
      case 'not_exists': if (val) return false; break;
      case 'contains': if (!String(val || '').includes(String(cond.value))) return false; break;
    }
  }
  return true;
}

function executeAction(db: Database.Database, action: WorkflowAction, lead: any): void {
  const config = action.config || {};

  switch (action.type) {
    case 'create_task': {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (config.due_days || 1));
      const title = replacePlaceholders(config.title || 'Workflow Task', lead);
      db.prepare(
        "INSERT INTO tasks (lead_id, title, type, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).run(lead.id, title, config.task_type || 'todo', dueDate.toISOString().split('T')[0]);
      break;
    }
    case 'change_status': {
      if (config.contact_status) {
        db.prepare("UPDATE leads SET contact_status = ?, updated_at = datetime('now') WHERE id = ?")
          .run(config.contact_status, lead.id);
      }
      if (config.status) {
        db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?")
          .run(config.status, lead.id);
      }
      break;
    }
    case 'add_tag': {
      if (config.tag_id) {
        db.prepare('INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?, ?)')
          .run(lead.id, config.tag_id);
      }
      break;
    }
    case 'update_field': {
      if (config.field && config.value !== undefined) {
        const allowed = ['priority', 'deal_value', 'notes', 'category'];
        if (allowed.includes(config.field)) {
          db.prepare(`UPDATE leads SET ${config.field} = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(config.value, lead.id);
        }
      }
      break;
    }
    case 'send_notification': {
      const title = replacePlaceholders(config.title || 'Workflow Notification', lead);
      db.prepare(
        "INSERT INTO trigger_events (lead_id, trigger_type, severity, title, details) VALUES (?, 'workflow', 'medium', ?, ?)"
      ).run(lead.id, title, config.details || '');
      break;
    }
    case 'send_email': {
      db.prepare(
        "INSERT INTO lead_activities (lead_id, type, content, metadata) VALUES (?, 'email', ?, ?)"
      ).run(lead.id, 'Workflow-Email geplant', JSON.stringify({ workflow: true, subject: config.subject }));
      break;
    }
  }
}

function replacePlaceholders(text: string, lead: any): string {
  return text
    .replace(/{firmenname}/g, lead.name || '')
    .replace(/{stadt}/g, lead.city || '')
    .replace(/{website}/g, lead.website_original || '')
    .replace(/{score}/g, String(lead.score || 0))
    .replace(/{email}/g, lead.email || '');
}
