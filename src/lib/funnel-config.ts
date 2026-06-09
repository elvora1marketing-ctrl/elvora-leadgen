export interface FunnelBranding {
  companyName: string;
  logo?: string;
  primaryColor: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  borderRadius?: number;
}

export interface FunnelChoiceOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

interface StepBase {
  id: string;
  question: string;
  description?: string;
  required?: boolean;
}

export interface SingleChoiceStep extends StepBase {
  type: 'single-choice';
  options: FunnelChoiceOption[];
  columns?: 1 | 2 | 3;
}

export interface MultiChoiceStep extends StepBase {
  type: 'multi-choice';
  options: FunnelChoiceOption[];
  minSelect?: number;
  maxSelect?: number;
  columns?: 1 | 2 | 3;
}

export interface TextStep extends StepBase {
  type: 'text';
  inputType?: 'text' | 'email' | 'tel' | 'number';
  placeholder?: string;
  validation?: { pattern?: string; minLength?: number; maxLength?: number; errorMessage?: string };
}

export interface TextareaStep extends StepBase {
  type: 'textarea';
  placeholder?: string;
  rows?: number;
  validation?: { minLength?: number; maxLength?: number; errorMessage?: string };
}

export interface ContactStep extends StepBase {
  type: 'contact';
  fields: {
    name: boolean | { required?: boolean; placeholder?: string };
    email: boolean | { required?: boolean; placeholder?: string };
    phone?: boolean | { required?: boolean; placeholder?: string };
    preferredTime?: boolean | { required?: boolean; placeholder?: string };
  };
}

export interface ResultStep extends StepBase {
  type: 'result';
  resultTemplate: string;
  laborIllusion?: { enabled: boolean; text?: string; durationMs?: number };
}

export type FunnelStep = SingleChoiceStep | MultiChoiceStep | TextStep | TextareaStep | ContactStep | ResultStep;

export interface FunnelTrustElement {
  type: 'badge' | 'review' | 'logo' | 'stat';
  icon?: string;
  text?: string;
  name?: string;
  stars?: number;
  reviewText?: string;
  src?: string;
  alt?: string;
  value?: string;
  label?: string;
}

export interface FunnelConfig {
  branding: FunnelBranding;
  meta: { title: string; description?: string; privacyUrl: string };
  steps: FunnelStep[];
  trust?: { position?: 'start' | 'submit' | 'both'; elements: FunnelTrustElement[] };
  scarcity?: { enabled: boolean; text: string };
  submitButton: { label: string; microcopy?: string };
  thankYou: {
    headline: string;
    body: string;
    responseTime?: string;
    extra?: { label: string; url: string };
  };
  notify: {
    email?: string;
    webhookUrl?: string;
    confirmationEmail?: { subject: string; body: string };
  };
  retentionDays: number;
  spam?: {
    honeypot?: boolean;
    minSubmitTimeMs?: number;
    rateLimit?: { maxPerHour?: number; maxPerDay?: number };
  };
}

export function validateConfig(c: unknown): c is FunnelConfig {
  if (!c || typeof c !== 'object') return false;
  const cfg = c as Record<string, unknown>;
  if (!cfg.branding || !cfg.meta || !cfg.steps || !cfg.submitButton || !cfg.thankYou || !cfg.notify) return false;
  const meta = cfg.meta as Record<string, unknown>;
  if (!meta.title || !meta.privacyUrl) return false;
  if (!Array.isArray(cfg.steps) || cfg.steps.length === 0) return false;
  for (const s of cfg.steps as Record<string, unknown>[]) {
    if (!s.id || !s.type || !s.question) return false;
    const validTypes = ['single-choice', 'multi-choice', 'text', 'textarea', 'contact', 'result'];
    if (!validTypes.includes(s.type as string)) return false;
  }
  if (typeof (cfg as Record<string, unknown>).retentionDays !== 'number') return false;
  return true;
}

export function resolveTemplate(template: string, answers: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = answers[key];
    if (Array.isArray(val)) return val.join(', ');
    return val != null ? String(val) : '';
  });
}
