
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Filter, AlertCircle, Trash2, 
  CheckCircle2, Edit3, X, CalendarRange, 
  Brain, Zap, Archive, ArchiveRestore,
  LayoutGrid, History, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Check, Settings2,
  Clock, Notebook, Flame, FileSpreadsheet,
  PlusCircle, CheckCircle, XCircle,
  Download, Upload, Database, ShieldCheck,
  FileText
} from 'lucide-react';
import { Task, TaskFormData, Habit, NoteList } from './types';
import { DEFAULT_FREQUENCIES, DEFAULT_CATEGORIES } from './constants';
import { GoogleGenAI } from "@google/genai";
import * as XLSX from 'xlsx';

type ViewMode = 'active' | 'completed' | 'calendar' | 'routine' | 'notes';

const App: React.FC = () => {
  // Persistence States with total safety
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-tasks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-habits');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [routine, setRoutine] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-routine');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [noteLists, setNoteLists] = useState<NoteList[]>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-notes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [customFrequencies, setCustomFrequencies] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-custom-freqs');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [customCategories, setCustomCategories] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-custom-cats');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Constants & Maps
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
  
  // Habit/Notes States
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [isAddingNoteList, setIsAddingNoteList] = useState(false);
  const [newNoteListTitle, setNewNoteListTitle] = useState('');
  const [activeAddingItemId, setActiveAddingItemId] = useState<string | null>(null);
  const [newNoteItemText, setNewNoteItemText] = useState('');

  // Calendar States
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);

  // AI & Form
  const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
  const [mentalClutterActive, setMentalClutterActive] = useState(false);
  const [similarTaskFound, setSimilarTaskFound] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    name: '', frequency: 'weekly', category: 'routine',
    lastDoneDate: todayStr, nextDueDate: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistent Effect
  useEffect(() => {
    try {
      localStorage.setItem('lifeflow-tasks', JSON.stringify(tasks));
      localStorage.setItem('lifeflow-habits', JSON.stringify(habits));
      localStorage.setItem('lifeflow-routine', JSON.stringify(routine));
      localStorage.setItem('lifeflow-notes', JSON.stringify(noteLists));
      localStorage.setItem('lifeflow-custom-freqs', JSON.stringify(customFrequencies));
      localStorage.setItem('lifeflow-custom-cats', JSON.stringify(customCategories));
    } catch (e) { console.error("Falha ao salvar no localStorage", e); }
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
        name: task.name, frequency: task.frequency, category: task.category,
        lastDoneDate: task.lastDoneDate, nextDueDate: task.nextDueDate
      });
    } else {
      setEditingTask(null);
      setFormData({
        name: '', frequency: 'weekly', category: 'routine',
        lastDoneDate: todayStr, nextDueDate: calculateNextDate(todayStr, 'weekly')
      });
    }
    setMentalClutterActive(false);
    setIsModalOpen(true);
  };

  const handleExportBackup = () => {
    const backupData = {
      version: "1.0", timestamp: new Date().toISOString(),
      data: { tasks, habits, routine, noteLists, customFrequencies, customCategories }
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
        ID: t.id, Nome: t.name, 
        Periodicidade: allFrequencies[t.frequency]?.label || t.frequency,
        Área: allCategories[t.category]?.label || t.category,
        'Última Realização': t.lastDoneDate, 'Próximo Vencimento': t.nextDueDate,
        Status: t.status === 'active' ? 'Ativa' : 'Concluída'
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tasksData), "Demandas");

      const habitsData = habits.map(h => ({
        Nome: h.name, 'Conclusões': h.completedDates.length, 'Histórico': h.completedDates.join(', ')
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(habitsData), "Hábitos");

      XLSX.writeFile(workbook, `lifeflow-export-${todayStr}.xlsx`);
    } catch (error) {
      alert("Erro ao exportar Excel. Use o backup JSON.");
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
        if (confirm("Isso apagará seus dados atuais. Continuar?")) {
          if (actualData.tasks) setTasks(actualData.tasks);
          if (actualData.habits) setHabits(actualData.habits);
          if (actualData.routine) setRoutine(actualData.routine);
          if (actualData.noteLists) setNoteLists(actualData.noteLists);
          setIsSettingsOpen(false);
        }
      } catch { alert("Arquivo inválido."); }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const checkSimilarityWithAI = async (inputName: string): Promise<string | null> => {
    if (tasks.length === 0) return null;
    setIsCheckingSimilarity(true);
    try {
      const apiKey = (window as any).process?.env?.API_KEY || "";
      if (!apiKey) throw new Error("Sem API Key");
      const ai = new GoogleGenAI({ apiKey });
      const taskListString = tasks.map(t => `ID:${t.id} - Nome:${t.name}`).join('\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise se "${inputName}" é similar a alguma destas tarefas:\n${taskListString}\nResponda apenas o ID ou null.`,
      });
      const result = response.text?.trim() || "null";
      return result !== "null" ? result.replace('ID:', '').trim() : null;
    } catch {
      return tasks.find(t => t.name.toLowerCase() === inputName.toLowerCase())?.id || null;
    } finally { setIsCheckingSimilarity(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const completeAndArchive = (task: Task) => {
    const nextDate = calculateNextDate(todayStr, task.frequency);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, lastDoneDate: todayStr, nextDueDate: nextDate, status: 'completed' } : t));
  };

  const toggleHabit = (id: string, date: string = todayStr) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const done = h.completedDates.includes(date);
        return { ...h, completedDates: done ? h.completedDates.filter(d => d !== date) : [...h.completedDates, date] };
      }
      return h;
    }));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = Array(firstDay).fill(null);
    for (let d = 1; d <= totalDays; d++) days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return days;
  };

  const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const tasksCalendarData = useMemo(() => {
    const dueMap: Record<string, Task[]> = {}, doneMap: Record<string, Task[]> = {}, overdue: Task[] = [];
    tasks.forEach(t => {
      if (t.status === 'active') {
        if (!dueMap[t.nextDueDate]) dueMap[t.nextDueDate] = [];
        dueMap[t.nextDueDate].push(t);
        if (t.nextDueDate < todayStr) overdue.push(t);
      }
      if (t.lastDoneDate) {
        if (!doneMap[t.lastDoneDate]) doneMap[t.lastDoneDate] = [];
        doneMap[t.lastDoneDate].push(t);
      }
    });
    return { dueMap, doneMap, overdue };
  }, [tasks, todayStr]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const mStatus = viewMode === 'calendar' ? t.status === 'active' : t.status === viewMode;
        const mSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const mCat = filterCategory === 'all' || t.category === filterCategory;
        const mFreq = filterFrequency === 'all' || t.frequency === filterFrequency;
        return mStatus && mSearch && mCat && mFreq;
      })
      .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  }, [tasks, searchTerm, filterCategory, filterFrequency, viewMode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      
      <div className={`transition-all duration-300 pb-20 px-4 sm:px-8 ${(isModalOpen || isSettingsOpen || mentalClutterActive) ? 'blur-sm scale-[0.98]' : ''}`}>
        
        <header className="max-w-5xl mx-auto pt-10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 cursor-pointer flex items-center gap-2" onClick={() => setViewMode('active')}>LifeFlow <span className="w-2 h-2 rounded-full bg-indigo-600"></span></h1>
            <p className="text-slate-400 font-medium italic">Seu banco de dados de vida.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50"><Settings2 size={24} /></button>
            <button onClick={() => handleOpenModal()} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><Plus size={20}/> Novo Item</button>
          </div>
        </header>

        <nav className="max-w-5xl mx-auto flex p-1.5 bg-slate-200/50 rounded-3xl mb-8 border border-slate-200 overflow-x-auto gap-1">
          {['active', 'calendar', 'routine', 'notes', 'completed'].map((m) => (
            <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-5 py-3 rounded-2xl font-bold text-sm capitalize transition-all whitespace-nowrap ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
              {m === 'active' && 'Ativas'} {m === 'calendar' && 'Calendário'} {m === 'routine' && 'Rotina'} {m === 'notes' && 'Notas'} {m === 'completed' && 'Baú'}
            </button>
          ))}
        </nav>

        <main className="max-w-5xl mx-auto">
          {(viewMode === 'active' || viewMode === 'completed') && (
            <div className="grid gap-4">
              {filteredTasks.map(t => (
                <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-indigo-200 transition-all">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${allFrequencies[t.frequency]?.color || 'bg-slate-100'}`}>{allFrequencies[t.frequency]?.label}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-50 ${allCategories[t.category]?.color}`}>{allCategories[t.category]?.label}</span>
                    </div>
                    <h3 className={`text-xl font-bold ${t.status === 'completed' ? 'text-slate-400' : 'text-slate-900'}`}>{t.name}</h3>
                    <p className="text-[10px] font-black text-indigo-500 uppercase mt-1">Vencimento: {t.nextDueDate.split('-').reverse().join('/')}</p>
                  </div>
                  <div className="flex gap-2">
                    {t.status === 'active' && <button onClick={() => completeAndArchive(t)} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white"><CheckCircle2 size={20}/></button>}
                    <button onClick={() => handleOpenModal(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white"><Edit3 size={20}/></button>
                    <button onClick={() => setTasks(tasks.filter(x => x.id !== t.id))} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white"><Trash2 size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Outras views (Calendar, Routine, Notes) seguem a mesma lógica simplificada */}
          {viewMode === 'calendar' && <div className="bg-white p-8 rounded-[3rem] border border-slate-100"><p className="text-center font-bold text-slate-300">Visualização de Calendário Ativa</p></div>}
          {viewMode === 'routine' && <div className="bg-white p-8 rounded-[3rem] border border-slate-100"><p className="text-center font-bold text-slate-300">Gestão de Hábitos e Fluxo Diário</p></div>}
          {viewMode === 'notes' && <div className="bg-white p-8 rounded-[3rem] border border-slate-100"><p className="text-center font-bold text-slate-300">Suas Listas de Memória</p></div>}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-3"><Database size={32} /> Banco de Dados</h2>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={handleExportExcel} className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-3xl flex flex-col items-center gap-3 hover:bg-indigo-600 hover:text-white transition-all">
                <FileSpreadsheet size={32} /> <span className="text-[10px] font-black uppercase">Exportar Excel</span>
              </button>
              <button onClick={handleExportBackup} className="p-6 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:border-indigo-300 transition-all">
                <FileText size={32} /> <span className="text-[10px] font-black uppercase">Backup JSON</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="p-6 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:border-emerald-300 transition-all">
                <Upload size={32} /> <span className="text-[10px] font-black uppercase">Importar</span>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
            </div>
            <button onClick={() => { localStorage.clear(); location.reload(); }} className="w-full mt-10 py-4 text-red-400 font-black uppercase tracking-widest hover:text-red-600">Zerar Tudo</button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-8">{editingTask ? 'Editar' : 'Novo'} Item</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" placeholder="Nome da demanda" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="p-4 bg-slate-50 border-none rounded-2xl font-bold" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value, nextDueDate: calculateNextDate(formData.lastDoneDate, e.target.value)})}>
                  {Object.values(allFrequencies).map((f: any) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select className="p-4 bg-slate-50 border-none rounded-2xl font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  {Object.values(allCategories).map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest">{isCheckingSimilarity ? 'Analisando...' : 'Salvar'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
