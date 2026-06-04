'use client';

import { Hero01 } from '../../elvora-baukasten/blocks/hero-01/Hero01';
import type { ComponentType } from 'react';

export interface EditableField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'link' | 'select' | 'image';
  options?: string[];
  group?: string;
}

export interface RegistryEntry {
  component: ComponentType<Record<string, unknown>>;
  demoProps: Record<string, unknown>;
  fields: EditableField[];
}

export const blockRegistry: Record<string, RegistryEntry> = {
  'hero-01': {
    component: Hero01 as ComponentType<Record<string, unknown>>,
    demoProps: {
      headline: 'Digitale Loesungen die begeistern',
      subline: 'Wir entwickeln massgeschneiderte Websites und digitale Strategien, die Ihr Unternehmen auf das naechste Level bringen. Modern, schnell, ueberzeugend.',
      ctaPrimary: { label: 'Jetzt starten', href: '#kontakt' },
      ctaSecondary: { label: 'Mehr erfahren', href: '#features' },
      image: {
        src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop&q=80',
        alt: 'Dashboard Vorschau',
      },
      trustLogos: [
        { src: 'https://placehold.co/120x30/1a1a1a/666?text=Partner+1', alt: 'Partner 1', width: 100 },
        { src: 'https://placehold.co/120x30/1a1a1a/666?text=Partner+2', alt: 'Partner 2', width: 100 },
        { src: 'https://placehold.co/120x30/1a1a1a/666?text=Partner+3', alt: 'Partner 3', width: 100 },
      ],
      variant: 'imageRight',
    },
    fields: [
      { key: 'headline', label: 'Headline', type: 'text' },
      { key: 'subline', label: 'Subline', type: 'textarea' },
      { key: 'ctaPrimary.label', label: 'CTA Primaer — Text', type: 'text', group: 'CTA' },
      { key: 'ctaPrimary.href', label: 'CTA Primaer — Link', type: 'text', group: 'CTA' },
      { key: 'ctaSecondary.label', label: 'CTA Sekundaer — Text', type: 'text', group: 'CTA' },
      { key: 'ctaSecondary.href', label: 'CTA Sekundaer — Link', type: 'text', group: 'CTA' },
      { key: 'image.src', label: 'Bild URL', type: 'image' },
      { key: 'image.alt', label: 'Bild Alt-Text', type: 'text' },
      { key: 'variant', label: 'Variante', type: 'select', options: ['imageRight', 'imageLeft'] },
    ],
  },
};

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}
