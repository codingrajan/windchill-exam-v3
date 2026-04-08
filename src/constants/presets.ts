export const PRESET_SLOTS = [
  { id: 'preset_1', label: 'Slot A', targetCount: 25 },
  { id: 'preset_2', label: 'Slot B', targetCount: 50 },
  { id: 'preset_3', label: 'Slot C', targetCount: 75 },
] as const;

export type SlotId = (typeof PRESET_SLOTS)[number]['id'];
