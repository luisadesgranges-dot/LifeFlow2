
import { FrequencyOption, CategoryOption } from './types';

export const DEFAULT_FREQUENCIES: Record<string, FrequencyOption> = {
  priority: { id: 'priority', label: 'Prioritária', days: 1, color: 'bg-red-100 text-red-700' },
  weekly: { id: 'weekly', label: 'Semanal', days: 7, color: 'bg-blue-100 text-blue-700' },
  monthly: { id: 'monthly', label: 'Mensal', color: 'bg-indigo-100 text-indigo-700' },
  quarterly: { id: 'quarterly', label: 'Trimestral', color: 'bg-purple-100 text-purple-700' },
  semiannual: { id: 'semiannual', label: 'Semestral', color: 'bg-pink-100 text-pink-700' },
  annual: { id: 'annual', label: 'Anual', color: 'bg-amber-100 text-amber-700' },
};

export const DEFAULT_CATEGORIES: Record<string, CategoryOption> = {
  routine: { id: 'routine', label: 'Rotina', color: 'text-slate-600' },
  relationship: { id: 'relationship', label: 'Relacionamento', color: 'text-rose-600' },
  family: { id: 'family', label: 'Família', color: 'text-emerald-600' },
  work: { id: 'work', label: 'Trabalho', color: 'text-sky-600' },
  studies: { id: 'studies', label: 'Estudos', color: 'text-violet-600' },
  house: { id: 'house', label: 'Casa', color: 'text-orange-600' },
  leisure: { id: 'leisure', label: 'Lazer', color: 'text-teal-600' },
  health: { id: 'health', label: 'Saúde', color: 'text-red-500' },
};
