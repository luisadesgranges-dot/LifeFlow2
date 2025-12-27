
export type TaskStatus = 'active' | 'completed';

export interface FrequencyOption {
  id: string;
  label: string;
  days?: number; // null for special logic like monthly/annual
  color: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  color: string;
}

export interface Task {
  id: string;
  name: string;
  frequency: string; // ID of FrequencyOption
  category: string;  // ID of CategoryOption
  lastDoneDate: string; // ISO format
  nextDueDate: string;   // ISO format
  createdAt: string;     // ISO format
  status: TaskStatus;
}

export interface TaskFormData {
  name: string;
  frequency: string;
  category: string;
  lastDoneDate: string;
  nextDueDate: string;
}

export interface Habit {
  id: string;
  name: string;
  completedDates: string[]; // Array de strings ISO YYYY-MM-DD
}

export interface RoutineSlot {
  hour: number;
  activity: string;
}

export interface NoteItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NoteList {
  id: string;
  title: string;
  items: NoteItem[];
}
