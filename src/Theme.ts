// theme.ts
// Design tokens for Revive AI — Razorpay-aligned blue/white palette.
// Centralized here so App.tsx and CaseDetails.tsx don't duplicate color logic.
// Pure presentation only — no data or business logic lives in this file.

export const colors = {
  canvas: '#FFFFFF',
  surface: '#F7F7F7',
  ink: '#0B1120',
  inkSoft: '#5B6472',
  primary: '#2872EF',      // CTA — normal
  primaryPress: '#0E54CD', // CTA — hover/active
  primaryTint: '#EAF1FE',
};

/**
 * Case status → badge classes (background / text / border)
 */
export function statusBadgeClass(status: string): string {
  if (status === 'AUTO_RECOVERED') return 'bg-[#E7F6EC] text-[#14804A] border-[#BFE6CC]';
  if (status === 'BLOCKED' || status === 'FAILED') return 'bg-[#FDEDE9] text-[#C4361D] border-[#F5CFC4]';
  if (status === 'PENDING_HUMAN_REVIEW') return 'bg-[#FCF1DC] text-[#A15C00] border-[#F3DDAE]';
  if (status === 'RECOVERY_EXPIRED') return 'bg-[#F1F2F4] text-[#5B6472] border-[#E1E3E7]';
  return 'bg-[#EAF1FE] text-[#0E54CD] border-[#CFE0FB]';
}

/**
 * Policy decision → badge classes
 */
export function policyBadgeClass(decision: string | null): string {
  if (decision === 'AUTO') return 'bg-[#E7F6EC] text-[#14804A] border-[#BFE6CC]';
  if (decision === 'HUMAN') return 'bg-[#FCF1DC] text-[#A15C00] border-[#F3DDAE]';
  return 'bg-[#F1F2F4] text-[#5B6472] border-[#E1E3E7]';
}

/**
 * Pipeline layer colors — this is the visual encoding of your core
 * architectural pitch: AI recommends (violet) -> Policy decides (blue)
 * -> API executes (green). "system" covers the plumbing stages
 * (webhook received / state validated) that aren't part of that story.
 */
export type PipelineLayer = 'system' | 'ai' | 'policy' | 'execute';

export function layerDoneClass(layer: PipelineLayer): string {
  if (layer === 'ai') return 'bg-[#F2ECFB] text-[#6E42CB]';
  if (layer === 'policy') return 'bg-[#EAF1FE] text-[#0E54CD]';
  if (layer === 'execute') return 'bg-[#E7F6EC] text-[#14804A]';
  return 'bg-[#F1F2F4] text-[#5B6472]';
}

export const stageNeutralClass = 'bg-[#F1F2F4] text-[#9AA1AC]';

/**
 * When the pipeline halts (blocked/failed) or is paused (human review),
 * every completed stage switches to a single alert color so the failure
 * reads instantly, overriding the per-layer coloring above.
 */
export function stageOverrideClass(status: string): string | null {
  if (status === 'BLOCKED' || status === 'FAILED') return 'bg-[#FDEDE9] text-[#C4361D]';
  if (status === 'PENDING_HUMAN_REVIEW') return 'bg-[#FCF1DC] text-[#A15C00]';
  return null;
}

export function stageLineClass(status: string): string {
  if (status === 'BLOCKED' || status === 'FAILED') return 'bg-[#F0A38C]';
  if (status === 'PENDING_HUMAN_REVIEW') return 'bg-[#EAC26C]';
  return 'bg-[#8FB4F5]';
}