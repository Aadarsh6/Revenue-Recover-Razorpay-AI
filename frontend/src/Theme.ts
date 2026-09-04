// Theme.ts — Revive AI design tokens
// One place documenting every color used across the app. Tailwind needs
// literal hex strings in classNames (can't interpolate JS values into
// utility classes), so components hardcode these same hex values in
// their className strings — this file is the source of truth to copy
// from when adding new UI, not a runtime import for styling.

export const colors = {
  canvas: '#FFFFFF',
  surface: '#F9FAFB',
  border: '#EAECF0',

  ink900: '#0B1120', // headings, primary numbers
  ink700: '#344054', // emphasis body text
  ink500: '#667085', // secondary text — labels, captions
  ink400: '#98A2B3', // tertiary — muted text, icons, dividers-adjacent

  primary: '#2872EF',       // CTA — normal
  primaryPress: '#0E54CD',  // CTA — hover / active
  primaryTint: '#EFF4FF',
  primaryBorder: '#B2CCFF',

  violet: '#6941C6',        // AI layer accent
  violetTint: '#F4F3FF',
  violetBorder: '#D9D6FE',
  violetHeading: '#42307D',
  violetBody: '#5925DC',

  success: '#079455',
  successTint: '#ECFDF3',
  successBorder: '#ABEFC6',

  danger: '#D92D20',
  dangerTint: '#FEF3F2',
  dangerBorder: '#FECDCA',
  dangerHeading: '#912018',
  dangerBody: '#B42318',

  warning: '#DC6803',
  warningTint: '#FFFAEB',
  warningBorder: '#FEDF89',
  warningHeading: '#93370D',
  warningBody: '#B54708',

  sidebarFrom: '#0B0F1A',
  sidebarTo: '#10162A',
  sidebarText: '#8B93A7',
  sidebarTextDim: '#5D6579',
};

/** Case status → badge classes */
export function statusBadgeClass(status: string): string {
  if (status === 'AUTO_RECOVERED') return 'bg-[#ECFDF3] text-[#079455] border-[#ABEFC6]';
  if (status === 'BLOCKED' || status === 'FAILED') return 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]';
  if (status === 'PENDING_HUMAN_REVIEW') return 'bg-[#FFFAEB] text-[#DC6803] border-[#FEDF89]';
  if (status === 'RECOVERY_EXPIRED') return 'bg-[#F2F4F7] text-[#667085] border-[#EAECF0]';
  return 'bg-[#EFF4FF] text-[#2872EF] border-[#B2CCFF]';
}

/** Policy decision → badge classes */
export function policyBadgeClass(decision: string | null): string {
  if (decision === 'AUTO') return 'bg-[#ECFDF3] text-[#079455] border-[#ABEFC6]';
  if (decision === 'HUMAN') return 'bg-[#FFFAEB] text-[#DC6803] border-[#FEDF89]';
  return 'bg-[#F2F4F7] text-[#667085] border-[#EAECF0]';
}

/**
 * Pipeline layer colors — encodes the core pitch directly in the UI:
 * AI recommends (violet) -> Policy decides (blue) -> API executes (green).
 */
export type PipelineLayer = 'system' | 'ai' | 'policy' | 'execute';

export function layerDoneClass(layer: PipelineLayer): string {
  if (layer === 'ai') return 'bg-[#F4F3FF] text-[#6941C6]';
  if (layer === 'policy') return 'bg-[#EFF4FF] text-[#2872EF]';
  if (layer === 'execute') return 'bg-[#ECFDF3] text-[#079455]';
  return 'bg-[#F2F4F7] text-[#667085]';
}

export const stageNeutralClass = 'bg-[#F2F4F7] text-[#98A2B3]';

export function stageOverrideClass(status: string): string | null {
  if (status === 'BLOCKED' || status === 'FAILED') return 'bg-[#FEF3F2] text-[#D92D20]';
  if (status === 'PENDING_HUMAN_REVIEW') return 'bg-[#FFFAEB] text-[#DC6803]';
  return null;
}

export function stageLineClass(status: string): string {
  if (status === 'BLOCKED' || status === 'FAILED') return 'bg-[#F0A6A0]';
  if (status === 'PENDING_HUMAN_REVIEW') return 'bg-[#F3C57E]';
  return 'bg-[#9AC0F7]';
}