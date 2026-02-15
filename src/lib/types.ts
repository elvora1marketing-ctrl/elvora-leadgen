export interface Lead {
  id: number;
  name: string;
  website_original: string | null;
  website_normalized: string;
  phone: string | null;
  phone_normalized: string | null;
  email: string | null;
  city: string;
  score: number;
  rating: string;
  screenshot_desktop: string | null;
  screenshot_mobile: string | null;
  problems: string | null;
  seo_issues: string | null;
  sales_pitch: string | null;
  status: 'pending' | 'qualified' | 'rejected' | 'archived';
  contact_status: 'not_contacted' | 'email_sent' | 'called' | 'meeting' | 'proposal' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  found_via_keywords: string | null;
  times_found: number;
  is_chain: boolean;
  deal_value: number | null;
  followup_date: string | null;
  created_at: string;
  reviewed_at: string | null;
  contacted_at: string | null;
  updated_at: string;
  last_seen_at: string;
}

export interface ScanHistory {
  id: number;
  keyword: string;
  city: string;
  leads_found: number;
  leads_new: number;
  leads_duplicate: number;
  started_at: string;
  completed_at: string | null;
  status: string;
}

export interface Settings {
  key: string;
  value: string;
  updated_at: string;
}

export interface ParsedProblems {
  id: string;
  label: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ParsedSeoIssue {
  id: string;
  label: string;
  impact: 'high' | 'medium' | 'low';
}
