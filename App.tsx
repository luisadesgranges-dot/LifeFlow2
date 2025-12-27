
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Filter, AlertCircle, Trash2, 
  CheckCircle2, Edit3, X, CalendarRange, 
  Brain, Zap, ArrowRight, Archive, ArchiveRestore,
  LayoutGrid, History, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Check, Settings2,
  Clock, Notebook, Flame, ListChecks, FileSpreadsheet,
  PlusCircle, MoreVertical, CheckCircle, XCircle,
  Download, Upload, Database, ShieldCheck,
  FileText
} from 'lucide-react';
import { Task, TaskFormData, TaskStatus, FrequencyOption, CategoryOption, Habit, NoteList, NoteItem } from './types';
import { DEFAULT_FREQUENCIES, DEFAULT_CATEGORIES } from './constants';
import { GoogleGenAI } from "@google/genai";
import * as XLSX from 'xlsx';

type ViewMode = 'active' | 'completed' | 'calendar' | 'routine' | 'notes';

const App: React.FC = () => {
  // Persistence States with safety checks to prevent crashes if localStorage is empty or corrupted
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-tasks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-habits');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [routine, setRoutine] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-routine');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [noteLists, setNoteLists] = useState<NoteList[]>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-notes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [customFrequencies, setCustomFrequencies] = useState<Record<string, FrequencyOption>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-custom-freqs');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [customCategories, setCustomCategories] = useState<Record<string, CategoryOption>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-custom-cats');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Derived Maps (Must be defined before state initializations that might use them)
  const allFrequencies = useMemo(() => ({ ...DEFAULT_FREQUENCIES, ...customFrequencies }), [customFrequencies]);
  const allCategories = useMemo(() => ({ ...DEFAULT_CATEGORIES, ...customCategories }), [customCategories]);
  const todayStr = new Date().toISOString().split('T')[0];

  // UI States
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  
  // Creation States
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddFreq, setShowAddFreq] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newFreqName, setNewFreqName] = useState('');
  const [newFreqDays, setNewFreqDays] = useState('1');

  // Habit States
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  // Notes States
  const [isAddingNoteList, setIsAddingNoteList] = useState(false);
  const [newNoteListTitle, setNewNoteListTitle] = useState('');
  const [activeAddingItemId, setActiveAddingItemId] = useState<string | null>(null);
  const [newNoteItemText, setNewNoteItemText] = useState('');

  // Calendar States
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);

  // AI States
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
  const [mentalClutterActive, setMentalClutterActive] = useState(false);
  const [similarTaskFound, setSimilarTaskFound] = useState<Task | null>(null);

  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    frequency: 'weekly',
    category: 'routine',
    lastDoneDate: todayStr,
    nextDueDate: ''
  });

  // Backup Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem('lifeflow-tasks', JSON.stringify(tasks));
    localStorage.setItem('lifeflow-habits', JSON.stringify(habits));
    localStorage.setItem('lifeflow-routine', JSON.stringify(routine));
    localStorage.setItem('lifeflow-notes', JSON.stringify(noteLists));
    localStorage.setItem('lifeflow-custom-freqs', JSON.stringify(customFrequencies));
    localStorage.setItem('lifeflow-custom-cats', JSON.stringify(customCategories));
  }, [tasks, habits, routine, noteLists, customFrequencies, customCategories]);

  const activeCount = useMemo(() => tasks.filter(t => t.status === 'active').length, [tasks]);
  const completedCount = useMemo(() => tasks.filter(t => t.status === 'completed').length, [tasks]);

  const calculateNextDate = (lastDate: string, freqId: string): string => {
    const date = new Date(lastDate);
    const freq = allFrequencies[freqId];

    if (freq?.days) {
      date.setDate(date.getDate() + freq.days);
    } else {
      switch (freqId) {
        case 'monthly': date.setMonth(date.getMonth() + 1); break;
        case 'quarterly': date.setMonth(date.getMonth() + 3); break;
        case 'semiannual': date.setMonth(date.getMonth() + 6); break;
        case 'annual': date.setFullYear(date.getFullYear() + 1); break;
        default: date.setDate(date.getDate() + 1);
      }
    }
    return date.toISOString().split('T')[0];
  };

  const handleOpenModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        name: task.name,
        frequency: task.frequency,
        category: task.category,
        lastDoneDate: task.lastDoneDate,
        nextDueDate: task.nextDueDate
      });
    } else {
      setEditingTask(null);
      setFormData({
        name: '',
        frequency: 'weekly',
        category: 'routine',
        lastDoneDate: todayStr,
        nextDueDate: calculateNextDate(todayStr, 'weekly')
      });
    }
    setMentalClutterActive(false);
    setShowAddCat(false);
    setShowAddFreq(false);
    setIsModalOpen(true);
  };

  const handleExportBackup = () => {
    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        tasks,
        habits,
        routine,
        noteLists,
        customFrequencies,
        customCategories
      }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifeflow-backup-${todayStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      const tasksData = tasks.map(t => ({
        ID: t.id,
        Nome: t.name,
        Periodicidade: allFrequencies[t.frequency]?.label || t.frequency,
        Área: allCategories[t.category]?.label || t.category,
        'Última Realização': t.lastDoneDate,
        'Próximo Vencimento': t.nextDueDate,
        Status: t.status === 'active' ? 'Ativa' : 'Concluída',
        'Criado em': t.createdAt
      }));
      const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
      XLSX.utils.book_append_sheet(workbook, tasksSheet, "Demandas");

      const habitsData = habits.map(h => ({
        ID: h.id,
        Nome: h.name,
        'Total de Conclusões': h.completedDates.length,
        'Datas de Conclusão': h.completedDates.join(', ')
      }));
      const habitsSheet = XLSX.utils.json_to_sheet(habitsData);
      XLSX.utils.book_append_sheet(workbook, habitsSheet, "Hábitos");

      const routineData = Object.entries(routine).map(([hour, activity]) => ({
        Horário: `${hour.padStart(2, '0')}:00`,
        Atividade: activity
      }));
      const routineSheet = XLSX.utils.json_to_sheet(routineData);
      XLSX.utils.book_append_sheet(workbook, routineSheet, "Rotina");

      const notesData: any[] = [];
      noteLists.forEach(list => {
        list.items.forEach(item => {
          notesData.push({
            Lista: list.title,
            Item: item.text,
            Status: item.checked ? 'Checked' : 'Pendente'
          });
        });
      });
      const notesSheet = XLSX.utils.json_to_sheet(notesData);
      XLSX.utils.book_append_sheet(workbook, notesSheet, "Notas");

      XLSX.writeFile(workbook, `lifeflow-backup-excel-${todayStr}.xlsx`);
    } catch (error) {
      alert("Houve um erro ao gerar a planilha Excel. Tente usar o backup JSON.");
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = JSON.parse(e.target?.result as string);
        const actualData = result.data || result;
        
        if (confirm("ATENÇÃO: Isso substituirá todos os seus dados atuais. Deseja prosseguir?")) {
          if (actualData.tasks) setTasks(actualData.tasks);
          if (actualData.habits) setHabits(actualData.habits);
          if (actualData.routine) setRoutine(actualData.routine);
          if (actualData.noteLists) setNoteLists(actualData.noteLists);
          if (actualData.customFrequencies) setCustomFrequencies(actualData.customFrequencies);
          if (actualData.customCategories) setCustomCategories(actualData.customCategories);
          
          alert("Banco de dados restaurado com sucesso!");
          setIsSettingsOpen(false);
        }
      } catch (err) {
        alert("Erro crítico: O arquivo de backup parece corrompido ou inválido.");
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const checkSimilarityWithAI = async (inputName: string): Promise<string | null> => {
    if (tasks.length === 0) return null;
    setIsCheckingSimilarity(true);
    try {
      // Use process.env.API_KEY safely
      const apiKey = (window as any).process?.env?.API_KEY || "";
      const ai = new GoogleGenAI({ apiKey });
      const taskListString = tasks.map(t => `ID:${t.id} - Nome:${t.name}`).join('\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise se "${inputName}" é similar a alguma destas tarefas:\n${taskListString}\nResponda apenas o ID ou null.`,
      });
      const result = response.text?.trim() || "null";
      return result !== "null" ? result.replace('ID:', '').trim() : null;
    } catch (error) {
      return tasks.find(t => t.name.toLowerCase() === inputName.toLowerCase())?.id || null;
    } finally {
      setIsCheckingSimilarity(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showAddCat || showAddFreq) return;

    const similarId = await checkSimilarityWithAI(formData.name);
    if (similarId && (!editingTask || similarId !== editingTask.id)) {
      const found = tasks.find(t => t.id === similarId);
      if (found) { setSimilarTaskFound(found); setMentalClutterActive(true); return; }
    }
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...formData } : t));
    } else {
      const newTask: Task = { id: crypto.randomUUID(), ...formData, status: 'active', createdAt: new Date().toISOString() };
      setTasks(prev => [...prev, newTask]);
    }
    setIsModalOpen(false);
  };

  const handleBulkImport = () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newTasks: Task[] = lines.map(line => ({
      id: crypto.randomUUID(),
      name: line,
      frequency: 'weekly',
      category: 'routine',
      lastDoneDate: todayStr,
      nextDueDate: calculateNextDate(todayStr, 'weekly'),
      createdAt: new Date().toISOString(),
      status: 'active'
    }));
    setTasks(prev => [...prev, ...newTasks]);
    setImportText('');
    setIsImportModalOpen(false);
  };

  const completeAndArchive = (task: Task) => {
    const nextDate = calculateNextDate(todayStr, task.frequency);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, lastDoneDate: todayStr, nextDueDate: nextDate, status: 'completed' } : t));
  };

  const handleCreateHabit = () => {
    const name = newHabitName.trim();
    if (!name) return;
    if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
        alert("Este hábito já existe!");
        return;
    }
    setHabits(prev => {
        const updated = [...prev, { id: crypto.randomUUID(), name, completedDates: [] }];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
    });
    setNewHabitName('');
    setIsAddingHabit(false);
  };

  const toggleHabit = (id: string, date: string = todayStr) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const alreadyDone = h.completedDates.includes(date);
        return {
          ...h,
          completedDates: alreadyDone 
            ? h.completedDates.filter(d => d !== date) 
            : [...h.completedDates, date]
        };
      }
      return h;
    }));
  };

  const deleteHabit = (id: string) => {
    if (confirm("Apagar este hábito permanentemente?")) {
      setHabits(prev => prev.filter(h => h.id !== id));
    }
  };

  const updateRoutineSlot = (hour: number, activity: string) => {
    setRoutine(prev => ({ ...prev, [hour]: activity }));
  };

  const handleAddNoteList = () => {
    if (!newNoteListTitle.trim()) return;
    setNoteLists(prev => [...prev, { id: crypto.randomUUID(), title: newNoteListTitle, items: [] }]);
    setNewNoteListTitle('');
    setIsAddingNoteList(false);
  };

  const handleAddNoteItem = (listId: string) => {
    const text = newNoteItemText.trim();
    if (!text) return;
    const list = noteLists.find(l => l.id === listId);
    if (!list) return;
    if (list.items.some(i => i.text.toLowerCase() === text.toLowerCase())) {
      alert("Este item já existe nesta lista.");
      return;
    }
    setNoteLists(prev => prev.map(l => {
      if (l.id === listId) {
        const newItems = [...l.items, { id: crypto.randomUUID(), text, checked: false }];
        newItems.sort((a, b) => a.text.localeCompare(b.text));
        return { ...l, items: newItems };
      }
      return l;
    }));
    setNewNoteItemText('');
    setActiveAddingItemId(null);
  };

  const toggleNoteItem = (listId: string, itemId: string) => {
    setNoteLists(prev => prev.map(l => {
      if (l.id === listId) {
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
        };
      }
      return l;
    }));
  };

  const deleteNoteItem = (listId: string, itemId: string) => {
    setNoteLists(prev => prev.map(l => {
      if (l.id === listId) {
        return {
          ...l,
          items: l.items.filter(i => i.id !== itemId)
        };
      }
      return l;
    }));
  };

  const deleteNoteList = (id: string) => {
    if (confirm("Deseja apagar esta lista permanentemente?")) {
      setNoteLists(prev => prev.filter(l => l.id !== id));
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return days;
  };

  const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  const tasksCalendarData = useMemo(() => {
    const dueMap: Record<string, Task[]> = {};
    const doneMap: Record<string, Task[]> = {};
    const overdueTasks: Task[] = [];
    tasks.forEach(task => {
      if (task.status === 'active') {
        if (!dueMap[task.nextDueDate]) dueMap[task.nextDueDate] = [];
        dueMap[task.nextDueDate].push(task);
        if (task.nextDueDate < todayStr) overdueTasks.push(task);
      }
      if (task.lastDoneDate) {
        if (!doneMap[task.lastDoneDate]) doneMap[task.lastDoneDate] = [];
        doneMap[task.lastDoneDate].push(task);
      }
    });
    return { dueMap, doneMap, overdueTasks };
  }, [tasks, todayStr]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Não definida';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchesStatus = viewMode === 'calendar' ? t.status === 'active' : t.status === viewMode;
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        const matchesFrequency = filterFrequency === 'all' || t.frequency === filterFrequency;
        return matchesStatus && matchesSearch && matchesCategory && matchesFrequency;
      })
      .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  }, [tasks, searchTerm, filterCategory, filterFrequency, viewMode]);

  const handleAddCustomCategoryAction = () => {
    if (!newCatName.trim()) return;
    const id = `custom-${newCatName.toLowerCase().replace(/\s+/g, '-')}`;
    setCustomCategories(prev => ({
      ...prev,
      [id]: { id, label: newCatName, color: 'text-indigo-600' }
    }));
    setFormData(prev => ({ ...prev, category: id }));
    setNewCatName('');
    setShowAddCat(false);
  };

  const handleAddCustomFrequencyAction = () => {
    if (!newFreqName.trim()) return;
    const id = `custom-${newFreqName.toLowerCase().replace(/\s+/g, '-')}`;
    const days = parseInt(newFreqDays);
    setCustomFrequencies(prev => ({
      ...prev,
      [id]: { id, label: newFreqName, days: isNaN(days) ? undefined : days, color: 'bg-indigo-50 text-indigo-700' }
    }));
    setFormData(prev => ({ ...prev, frequency: id }));
    setNewFreqName('');
    setNewFreqDays('1');
    setShowAddFreq(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
      
      {/* Background Wrapper */}
      <div className={`transition-all duration-500 pb-20 px-4 sm:px-6 lg:px-8 ${(mentalClutterActive || isModalOpen || isImportModalOpen || isSettingsOpen) ? 'blur-md grayscale brightness-95 scale-[0.99] pointer-events-none select-none' : ''}`}>
        
        {/* Header */}
        <header className="max-w-5xl mx-auto pt-12 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 flex items-center gap-3 cursor-pointer" onClick={() => setViewMode('active')}>LifeFlow <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" /></h1>
              <p className="text-slate-500 mt-1 font-medium italic">Sincronize suas dimensões.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm hover:bg-slate-50"><Settings2 size={20} /> Banco de Dados</button>
              <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-100"><Plus size={20} /> Nova Demanda</button>
            </div>
          </div>

          <nav className="flex p-1.5 bg-slate-200/50 rounded-3xl w-full mb-8 border border-slate-200 overflow-x-auto gap-1">
            <button onClick={() => setViewMode('active')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <LayoutGrid size={18} /> Ativas
              <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-400">{activeCount}</span>
            </button>
            <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <CalendarIcon size={18} /> Calendário
            </button>
            <button onClick={() => setViewMode('routine')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'routine' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Clock size={18} /> Rotina
            </button>
            <button onClick={() => setViewMode('notes')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'notes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Notebook size={18} /> Notas
            </button>
            <button onClick={() => setViewMode('completed')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${viewMode === 'completed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <History size={18} /> Baú
              <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-400">{completedCount}</span>
            </button>
          </nav>
        </header>

        <main className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          {(viewMode === 'active' || viewMode === 'completed') && (
            <>
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 mb-8 flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input type="text" placeholder="Localizar na mente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" />
                </div>
                <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
                  <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
                    <Filter size={14} className="text-slate-400" />
                    <select className="bg-transparent text-sm font-semibold focus:outline-none" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                      <option value="all">Área</option>
                      {Object.values(allCategories).map((c: CategoryOption) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
                    <CalendarRange size={14} className="text-slate-400" />
                    <select className="bg-transparent text-sm font-semibold focus:outline-none" value={filterFrequency} onChange={(e) => setFilterFrequency(e.target.value)}>
                      <option value="all">Periodicidade</option>
                      {Object.values(allFrequencies).map((f: FrequencyOption) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200 text-slate-300">
                    {viewMode === 'active' ? <Zap size={32} className="mx-auto mb-4" /> : <Archive size={32} className="mx-auto mb-4" />}
                    <h3 className="text-xl font-bold text-slate-900">Silêncio produtivo.</h3>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div key={task.id} className={`bg-white rounded-[2rem] p-6 border transition-all flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-indigo-200 ${task.frequency === 'priority' && task.status === 'active' ? 'border-indigo-400 shadow-lg' : 'border-slate-100 shadow-sm'}`}>
                      <div className="flex-1">
                        <div className="flex gap-2 mb-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${allFrequencies[task.frequency]?.color || 'bg-slate-100 text-slate-600'}`}>{allFrequencies[task.frequency]?.label}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-50 ${allCategories[task.category]?.color || 'text-slate-600'}`}>{allCategories[task.category]?.label}</span>
                        </div>
                        <h3 className={`text-xl font-bold ${task.status === 'completed' ? 'text-slate-400' : 'text-slate-900'}`}>{task.name}</h3>
                        <div className="mt-2 text-xs font-bold text-indigo-500 uppercase tracking-tighter">
                          {task.status === 'active' ? `Próximo ciclo: ${formatDate(task.nextDueDate)}` : `Concluído em: ${formatDate(task.lastDoneDate)}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {task.status === 'active' ? (
                          <button onClick={() => completeAndArchive(task)} title="Concluir" className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><CheckCircle2 size={20}/></button>
                        ) : (
                          <button onClick={() => setTasks(tasks.map(t => t.id === task.id ? {...t, status: 'active'} : t))} title="Resgatar" className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><ArchiveRestore size={20}/></button>
                        )}
                        <button onClick={() => handleOpenModal(task)} className="bg-slate-50 text-slate-400 p-4 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"><Edit3 size={20}/></button>
                        <button onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))} className="bg-red-50 text-red-400 p-4 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {viewMode === 'routine' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Flame className="text-orange-500" size={24} /> Hábitos</h3>
                    <button onClick={() => setIsAddingHabit(true)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition-all"><PlusCircle size={24} /></button>
                  </div>

                  {isAddingHabit && (
                    <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-indigo-100 mb-6 animate-in slide-in-from-top-1 duration-200">
                      <input 
                        className="bg-transparent border-none px-2 py-1 text-sm font-bold flex-1 focus:outline-none"
                        placeholder="Nome do hábito..."
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateHabit();
                          if (e.key === 'Escape') setIsAddingHabit(false);
                        }}
                        autoFocus
                      />
                      <button onClick={handleCreateHabit} className="text-emerald-500"><CheckCircle size={20}/></button>
                      <button onClick={() => setIsAddingHabit(false)} className="text-slate-300"><XCircle size={20}/></button>
                    </div>
                  )}

                  <div className="space-y-6">
                    {habits.length === 0 ? (
                      <p className="text-slate-300 text-sm italic py-4">Nenhum hábito configurado.</p>
                    ) : (
                      habits.map(h => {
                        const isDoneToday = h.completedDates.includes(todayStr);
                        const habitDays = getDaysInMonth(new Date());
                        return (
                          <div key={h.id} className={`p-6 rounded-[2rem] border transition-all ${isDoneToday ? 'bg-white border-indigo-200 shadow-md' : 'bg-white border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className={`font-black text-lg ${isDoneToday ? 'text-indigo-900' : 'text-slate-800'}`}>{h.name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{h.completedDates.length} registros</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => toggleHabit(h.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDoneToday ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:bg-indigo-50 hover:text-indigo-400'}`}>
                                  <Check size={20} strokeWidth={3} />
                                </button>
                                <button onClick={() => deleteHabit(h.id)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-200 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-1.5 pt-4 border-t border-slate-50">
                              {habitDays.map((date, idx) => {
                                if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;
                                const isDayDone = h.completedDates.includes(date);
                                const isToday = date === todayStr;
                                return (
                                  <button 
                                    key={date} 
                                    onClick={() => toggleHabit(h.id, date)}
                                    title={formatDate(date)}
                                    className={`aspect-square rounded-lg flex items-center justify-center transition-all ${isDayDone ? 'bg-indigo-500' : 'bg-slate-50 hover:bg-indigo-100'} ${isToday ? 'ring-2 ring-indigo-200' : ''}`}
                                  >
                                    {isDayDone && <div className="w-1 h-1 rounded-full bg-white" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                  <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2"><Clock className="text-indigo-600" size={24} /> Fluxo Diário</h3>
                  <div className="space-y-4">
                    {Array.from({ length: 19 }, (_, i) => i + 5).map(hour => (
                      <div key={hour} className="flex items-center gap-6 group">
                        <div className="w-16 text-right">
                          <span className="text-sm font-black text-slate-300 group-hover:text-indigo-400 transition-colors">{String(hour).padStart(2, '0')}:00</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            placeholder="Clique para definir atividade..." 
                            value={routine[hour] || ''} 
                            onChange={(e) => updateRoutineSlot(hour, e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 font-semibold text-slate-700 placeholder-slate-200 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
                          />
                          {routine[hour] && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'notes' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-slate-900">Suas Coleções</h2>
                {isAddingNoteList ? (
                  <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                    <input 
                      type="text" 
                      placeholder="Nome da lista..." 
                      className="bg-transparent border-none px-3 py-1 font-bold focus:outline-none text-sm"
                      value={newNoteListTitle}
                      onChange={(e) => setNewNoteListTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNoteList()}
                      autoFocus
                    />
                    <button onClick={handleAddNoteList} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded-lg"><CheckCircle size={20}/></button>
                    <button onClick={() => setIsAddingNoteList(false)} className="text-red-400 hover:bg-red-50 p-1 rounded-lg"><XCircle size={20}/></button>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingNoteList(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all"><Plus size={18} /> Nova Lista</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {noteLists.length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] text-slate-300">
                    <Notebook size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">Nenhuma memória arquivada ainda.</p>
                  </div>
                ) : (
                  noteLists.map(list => (
                    <div key={list.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col min-h-[300px] hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="text-xl font-black text-slate-900 group">{list.title}</h3>
                        <button onClick={() => deleteNoteList(list.id)} className="text-slate-200 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                      </div>
                      <div className="flex-1 space-y-2">
                        {list.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between group/item">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleNoteItem(list.id, item.id)}>
                              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-100 bg-slate-50'}`}>
                                {item.checked && <Check size={12} className="text-white" strokeWidth={4} />}
                              </div>
                              <span className={`text-sm font-semibold transition-all ${item.checked ? 'text-slate-300 line-through' : 'text-slate-700'}`}>{item.text}</span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteNoteItem(list.id, item.id); }} 
                              className="opacity-0 group-hover/item:opacity-100 text-slate-200 hover:text-red-400 transition-all p-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        
                        {activeAddingItemId === list.id && (
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl animate-in fade-in zoom-in duration-200 mt-2">
                            <input 
                              className="bg-transparent border-none px-2 py-1 text-sm font-bold flex-1 focus:outline-none"
                              placeholder="Adicionar..."
                              value={newNoteItemText}
                              onChange={(e) => setNewNoteItemText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddNoteItem(list.id);
                                if (e.key === 'Escape') setActiveAddingItemId(null);
                              }}
                              autoFocus
                            />
                            <button onClick={() => handleAddNoteItem(list.id)} className="text-emerald-500"><CheckCircle size={18}/></button>
                            <button onClick={() => setActiveAddingItemId(null)} className="text-slate-300"><XCircle size={18}/></button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setActiveAddingItemId(list.id); setNewNoteItemText(''); }} className={`mt-6 flex items-center gap-2 font-bold text-xs uppercase tracking-widest hover:gap-3 transition-all ${activeAddingItemId === list.id ? 'text-slate-300 pointer-events-none' : 'text-indigo-600'}`}>
                        <Plus size={14} /> Adicionar Item
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-2xl font-black text-slate-900 capitalize">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-3 rounded-2xl hover:bg-slate-50 border border-slate-100"><ChevronLeft size={20}/></button>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-3 rounded-2xl hover:bg-slate-50 border border-slate-100"><ChevronRight size={20}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 mb-4">{d}</div>)}
                  {calendarDays.map((date, i) => {
                    const isDue = date && tasksCalendarData.dueMap[date];
                    const isDone = date && tasksCalendarData.doneMap[date];
                    const isSelected = date === selectedDay;
                    return (
                      <button key={i} onClick={() => date && setSelectedDay(date)} className={`relative aspect-square rounded-3xl flex flex-col items-center justify-center text-sm font-bold transition-all ${!date ? 'opacity-0 pointer-events-none' : 'hover:bg-slate-50'} ${isSelected ? 'bg-indigo-600 text-white shadow-xl scale-110 z-10' : 'text-slate-600'}`}>
                        {date ? date.split('-')[2] : ''}
                        <div className="flex gap-1 absolute bottom-2">
                          {isDue && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                          {isDone && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Prazos em {selectedDay ? formatDate(selectedDay) : '--'}</h3>
                  <div className="space-y-3">
                    {selectedDay && tasksCalendarData.dueMap[selectedDay] ? tasksCalendarData.dueMap[selectedDay].map(t => (
                      <div key={t.id} className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-sm font-bold text-indigo-700 flex justify-between items-center group">
                        {t.name} <button onClick={() => completeAndArchive(t)} className="hover:scale-110 transition-transform"><CheckCircle2 size={18}/></button>
                      </div>
                    )) : <p className="text-slate-300 text-sm italic">Nenhum evento detectado.</p>}
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                  <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <AlertCircle size={14} /> Dívidas Mentais
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {tasksCalendarData.overdueTasks.length > 0 ? tasksCalendarData.overdueTasks.map(t => (
                      <div key={t.id} className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 group transition-all hover:bg-amber-100/50">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-amber-900 mb-1">{t.name}</p>
                            <p className="text-[10px] font-black text-amber-500 uppercase">Atrasado desde: {formatDate(t.nextDueDate)}</p>
                          </div>
                          <button onClick={() => completeAndArchive(t)} className="text-amber-600 hover:text-emerald-600 transition-colors p-1" title="Quitar dívida">
                            <CheckCircle2 size={20}/>
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-6">
                        <CheckCircle size={24} className="text-emerald-300 mx-auto mb-2" />
                        <p className="text-slate-300 text-sm italic">Mente limpa. Sem dívidas.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><Database size={32} /></div>
              <div>
                <h2 className="text-3xl font-black text-slate-900">Banco de Dados</h2>
                <p className="text-slate-400 font-medium">Controle total sobre sua história.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4 text-slate-900 font-black">
                  <ShieldCheck className="text-indigo-600" size={24} /> 
                  Sincronização & Segurança
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={handleExportExcel} className="flex flex-col items-center justify-center gap-3 bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all group">
                    <FileSpreadsheet className="text-indigo-600 group-hover:text-white group-hover:scale-110 transition-transform" size={32} />
                    <span className="text-[10px] font-black uppercase text-center">Exportar Excel</span>
                  </button>
                  <button onClick={handleExportBackup} className="flex flex-col items-center justify-center gap-3 bg-white p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all group">
                    <FileText className="text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-transform" size={32} />
                    <span className="text-[10px] font-black uppercase text-slate-900 text-center">Exportar Backup</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 bg-white p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-all group">
                    <Upload className="text-emerald-600 group-hover:scale-110 transition-transform" size={32} />
                    <span className="text-[10px] font-black uppercase text-slate-900 text-center">Importar Restore</span>
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                </div>
              </div>
              <button onClick={() => { if(confirm("Zerar tudo?")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-4 text-red-400 text-xs font-black uppercase tracking-widest hover:text-red-600">Zerar Banco de Dados</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-8">{editingTask ? 'Ajustar' : 'Projetar'} Demanda</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required type="text" placeholder="O que sua mente pede?" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isCheckingSimilarity} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Periodicidade</label>
                  <select className="w-full px-5 py-4 rounded-2xl bg-slate-50 font-bold border-none" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value, nextDueDate: calculateNextDate(formData.lastDoneDate, e.target.value) })}>
                    {Object.values(allFrequencies).map((v: FrequencyOption) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Área</label>
                  <select className="w-full px-5 py-4 rounded-2xl bg-slate-50 font-bold border-none" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    {Object.values(allCategories).map((v: CategoryOption) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Última Realização</label>
                  <input type="date" className="w-full px-5 py-4 rounded-2xl bg-slate-50 font-bold border-none" value={formData.lastDoneDate} onChange={(e) => setFormData({ ...formData, lastDoneDate: e.target.value, nextDueDate: calculateNextDate(e.target.value, formData.frequency) })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Próximo Vencimento</label>
                  <input type="date" className="w-full px-5 py-4 rounded-2xl bg-slate-50 font-bold border-none" value={formData.nextDueDate} onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 font-bold text-slate-400">Voltar</button>
                <button type="submit" disabled={isCheckingSimilarity} className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-sm">
                  {isCheckingSimilarity ? 'Analisando...' : 'Materializar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mental Clutter Overlay */}
      {mentalClutterActive && similarTaskFound && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <div className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-8 text-indigo-600"><Brain size={48} /></div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">Espaço Mental Ocupado</h2>
            <p className="text-slate-700 mb-8 leading-relaxed">
              A demanda <b className="text-indigo-600">"{formData.name}"</b> já existe como <b className="text-slate-900">"{similarTaskFound.name}"</b>.
            </p>
            <div className="space-y-3">
              <button onClick={() => { setTasks(prev => prev.map(t => t.id === similarTaskFound.id ? { ...t, status: 'active', frequency: 'priority', nextDueDate: todayStr } : t)); setMentalClutterActive(false); setIsModalOpen(false); setViewMode('active'); }} className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl text-lg"><Zap size={24} className="inline mr-2" /> Resgatar e Priorizar</button>
              <button onClick={() => setMentalClutterActive(false)} className="w-full py-4 text-slate-500 font-bold">Ignorar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
