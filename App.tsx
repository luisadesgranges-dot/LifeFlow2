
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
import { Task, TaskFormData, Habit, NoteList, FrequencyOption, CategoryOption } from './types';
import { DEFAULT_FREQUENCIES, DEFAULT_CATEGORIES } from './constants';
import { GoogleGenAI } from "@google/genai";
import * as XLSX from 'xlsx';

type ViewMode = 'active' | 'completed' | 'calendar' | 'routine' | 'notes';

const App: React.FC = () => {
  // Persistence States
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

  // Fix: Explicitly typed states to avoid 'unknown' inference during mapping
  const [customFrequencies, setCustomFrequencies] = useState<Record<string, FrequencyOption>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-custom-freqs');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [customCategories, setCustomCategories] = useState<Record<string, CategoryOption>>(() => {
    try {
      const saved = localStorage.getItem('lifeflow-custom-cats');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Constants & Derived
  const allFrequencies = useMemo(() => ({ ...DEFAULT_FREQUENCIES, ...customFrequencies }), [customFrequencies]);
  const allCategories = useMemo(() => ({ ...DEFAULT_CATEGORIES, ...customCategories }), [customCategories]);
  const todayStr = new Date().toISOString().split('T')[0];

  // UI States
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  
  // Creation Helpers
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [isAddingNoteList, setIsAddingNoteList] = useState(false);
  const [newNoteListTitle, setNewNoteListTitle] = useState('');
  const [activeAddingItemId, setActiveAddingItemId] = useState<string | null>(null);
  const [newNoteItemText, setNewNoteItemText] = useState('');

  // Calendar
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

  // Sync effect
  useEffect(() => {
    localStorage.setItem('lifeflow-tasks', JSON.stringify(tasks));
    localStorage.setItem('lifeflow-habits', JSON.stringify(habits));
    localStorage.setItem('lifeflow-routine', JSON.stringify(routine));
    localStorage.setItem('lifeflow-notes', JSON.stringify(noteLists));
    localStorage.setItem('lifeflow-custom-freqs', JSON.stringify(customFrequencies));
    localStorage.setItem('lifeflow-custom-cats', JSON.stringify(customCategories));
  }, [tasks, habits, routine, noteLists, customFrequencies, customCategories]);

  // Logic Helpers
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

  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Demandas
      const tasksData = tasks.map(t => ({
        Nome: t.name, Periodicidade: allFrequencies[t.frequency]?.label || t.frequency,
        Área: allCategories[t.category]?.label || t.category,
        'Último Ciclo': t.lastDoneDate, 'Próximo Ciclo': t.nextDueDate,
        Status: t.status === 'active' ? 'Ativa' : 'Concluída'
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tasksData), "Demandas");

      // Hábitos
      const habitsData = habits.map(h => ({
        Nome: h.name, 'Total Realizado': h.completedDates.length, 'Datas': h.completedDates.join(', ')
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(habitsData), "Hábitos");

      // Rotina
      const routineData = Object.entries(routine).map(([hour, activity]) => ({
        Horário: `${hour.padStart(2, '0')}:00`, Atividade: activity
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(routineData), "Rotina");

      XLSX.writeFile(workbook, `lifeflow-backup-${todayStr}.xlsx`);
    } catch (error) {
      alert("Erro ao exportar Excel.");
    }
  };

  // Fix: Updated to follow GenAI guidelines: use process.env.API_KEY directly and correct GoogleGenAI initialization
  const checkSimilarityWithAI = async (inputName: string): Promise<string | null> => {
    if (tasks.length === 0) return null;
    setIsCheckingSimilarity(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const taskListString = tasks.map(t => t.name).join(', ');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Compare "${inputName}" com esta lista: [${taskListString}]. Se houver algo muito similar, responda o NOME exato da tarefa da lista. Caso contrário responda 'null'.`,
      });
      const result = response.text?.trim() || "null";
      const found = tasks.find(t => t.name.toLowerCase() === result.toLowerCase());
      return found ? found.id : null;
    } catch {
      return tasks.find(t => t.name.toLowerCase() === inputName.toLowerCase())?.id || null;
    } finally { setIsCheckingSimilarity(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) {
      const similarId = await checkSimilarityWithAI(formData.name);
      if (similarId) {
        const found = tasks.find(t => t.id === similarId);
        if (found) { setSimilarTaskFound(found); setMentalClutterActive(true); return; }
      }
    }
    
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...formData } : t));
    } else {
      const newTask: Task = { id: crypto.randomUUID(), ...formData, status: 'active', createdAt: new Date().toISOString() };
      setTasks(prev => [...prev, newTask]);
    }
    setIsModalOpen(false);
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

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear(), month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = Array(firstDay).fill(null);
    for (let d = 1; d <= totalDays; d++) days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return days;
  }, [currentMonth]);

  const tasksCalendarData = useMemo(() => {
    const dueMap: Record<string, Task[]> = {}, doneMap: Record<string, Task[]> = {}, overdue: Task[] = [];
    tasks.forEach(t => {
      if (t.status === 'active') {
        if (!dueMap[t.nextDueDate]) dueMap[t.nextDueDate] = [];
        dueMap[t.nextDueDate].push(t);
        if (t.nextDueDate < todayStr) overdue.push(t);
      }
    });
    return { dueMap, overdue };
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* HEADER */}
      <header className="max-w-5xl mx-auto pt-10 px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('active')}>
            LifeFlow <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
          </h1>
          <p className="text-slate-400 font-medium">Organização em alta performance.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"><Settings2 size={24} /></button>
          <button onClick={() => handleOpenModal()} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-all flex items-center gap-2">
            <Plus size={20}/> Novo Registro
          </button>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="max-w-5xl mx-auto mt-10 px-6 overflow-x-auto">
        <div className="flex p-1.5 bg-slate-200/50 rounded-3xl border border-slate-200 gap-1 min-w-max">
          {(['active', 'calendar', 'routine', 'notes', 'completed'] as ViewMode[]).map((m) => (
            <button key={m} onClick={() => setViewMode(m)} className={`px-6 py-3 rounded-2xl font-bold text-sm capitalize transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {m === 'active' ? 'Ativas' : m === 'calendar' ? 'Calendário' : m === 'routine' ? 'Hábitos' : m === 'notes' ? 'Notas' : 'Arquivo'}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto mt-10 px-6">
        
        {/* LIST VIEW (ACTIVE/COMPLETED) */}
        {(viewMode === 'active' || viewMode === 'completed') && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 flex gap-4 items-center mb-6">
              <Search className="text-slate-300 ml-2" />
              <input placeholder="Buscar na mente..." className="flex-1 bg-transparent border-none font-medium focus:ring-0" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-20 text-slate-300">
                <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold">Nada por aqui.</p>
              </div>
            ) : filteredTasks.map(t => (
              <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all">
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${allFrequencies[t.frequency]?.color}`}>{allFrequencies[t.frequency]?.label}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-50 ${allCategories[t.category]?.color}`}>{allCategories[t.category]?.label}</span>
                  </div>
                  <h3 className={`text-xl font-bold ${t.status === 'completed' ? 'text-slate-400 line-through' : ''}`}>{t.name}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">Próximo ciclo: {t.nextDueDate.split('-').reverse().join('/')}</p>
                </div>
                <div className="flex gap-2">
                  {t.status === 'active' && <button onClick={() => setTasks(prev => prev.map(x => x.id === t.id ? {...x, status: 'completed', lastDoneDate: todayStr, nextDueDate: calculateNextDate(todayStr, x.frequency)} : x))} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><CheckCircle2 size={20}/></button>}
                  <button onClick={() => handleOpenModal(t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit3 size={20}/></button>
                  <button onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CALENDAR VIEW */}
        {viewMode === 'calendar' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black capitalize">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth()-1)))} className="p-2 border rounded-xl hover:bg-slate-50"><ChevronLeft size={20}/></button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth()+1)))} className="p-2 border rounded-xl hover:bg-slate-50"><ChevronRight size={20}/></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 mb-4">{d}</div>)}
                {calendarDays.map((date, i) => (
                  <button key={i} onClick={() => date && setSelectedDay(date)} className={`aspect-square rounded-2xl text-sm font-bold flex flex-col items-center justify-center relative transition-all ${!date ? 'opacity-0' : 'hover:bg-indigo-50'} ${selectedDay === date ? 'bg-indigo-600 text-white shadow-lg' : ''}`}>
                    {date?.split('-')[2]}
                    {date && tasksCalendarData.dueMap[date] && <div className={`w-1 h-1 rounded-full absolute bottom-2 ${selectedDay === date ? 'bg-white' : 'bg-indigo-500'}`} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Prazos de hoje</h3>
                {selectedDay && tasksCalendarData.dueMap[selectedDay] ? tasksCalendarData.dueMap[selectedDay].map(t => (
                  <div key={t.id} className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-sm font-bold text-indigo-700 mb-2">{t.name}</div>
                )) : <p className="text-sm text-slate-300 italic">Nada para este dia.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ROUTINE/HABITS VIEW */}
        {viewMode === 'routine' && (
          <div className="grid lg:grid-cols-3 gap-8">
             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black flex items-center gap-2"><Flame size={20} className="text-orange-500" /> Hábitos</h3>
                  <button onClick={() => setIsAddingHabit(true)} className="text-indigo-600"><PlusCircle size={24} /></button>
                </div>
                {isAddingHabit && (
                  <div className="mb-4 flex gap-2">
                    <input autoFocus className="flex-1 p-2 bg-slate-50 rounded-xl text-sm font-bold" placeholder="Novo hábito..." value={newHabitName} onChange={e => setNewHabitName(e.target.value)} />
                    <button onClick={() => { if(newHabitName) { setHabits([...habits, {id: crypto.randomUUID(), name: newHabitName, completedDates: []}]); setNewHabitName(''); setIsAddingHabit(false); } }} className="text-emerald-500"><CheckCircle size={24}/></button>
                  </div>
                )}
                <div className="space-y-4">
                  {habits.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <span className="font-bold text-sm">{h.name}</span>
                      <button onClick={() => toggleHabit(h.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${h.completedDates.includes(todayStr) ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
                        <Check size={20} />
                      </button>
                    </div>
                  ))}
                </div>
             </div>
             <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="text-xl font-black mb-6">Fluxo Diário</h3>
                <div className="space-y-2">
                  {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(hour => (
                    <div key={hour} className="flex items-center gap-4">
                      <span className="text-xs font-black text-slate-300 w-10">{hour}:00</span>
                      <input className="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-medium border-none focus:bg-white focus:ring-1 focus:ring-indigo-100" placeholder="..." value={routine[hour] || ''} onChange={e => setRoutine({...routine, [hour]: e.target.value})} />
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {/* NOTES VIEW */}
        {viewMode === 'notes' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button onClick={() => setIsAddingNoteList(true)} className="aspect-square border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-slate-300 hover:text-indigo-500 hover:border-indigo-200 transition-all">
              <Plus size={48} className="mb-2" />
              <span className="font-bold">Nova Lista</span>
            </button>
            {noteLists.map(list => (
              <div key={list.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm min-h-[300px]">
                <div className="flex justify-between mb-4">
                   <h3 className="font-black text-xl">{list.title}</h3>
                   <button onClick={() => setNoteLists(noteLists.filter(l => l.id !== list.id))} className="text-slate-200 hover:text-red-400"><Trash2 size={16}/></button>
                </div>
                <div className="space-y-2">
                  {list.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <input type="checkbox" checked={item.checked} onChange={() => setNoteLists(noteLists.map(l => l.id === list.id ? {...l, items: l.items.map(i => i.id === item.id ? {...i, checked: !i.checked} : i)} : l))} className="rounded border-slate-200 text-indigo-600 focus:ring-0" />
                      <span className={`text-sm font-medium ${item.checked ? 'text-slate-300 line-through' : ''}`}>{item.text}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex gap-2">
                    <input className="flex-1 bg-slate-50 border-none rounded-lg p-2 text-xs font-bold" placeholder="Add..." onKeyDown={e => {
                      if(e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if(val) {
                          setNoteLists(noteLists.map(l => l.id === list.id ? {...l, items: [...l.items, {id: crypto.randomUUID(), text: val, checked: false}]} : l));
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODALS */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in">
             <h2 className="text-3xl font-black mb-8 flex items-center gap-3"><Database size={32} /> Banco de Dados</h2>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={handleExportExcel} className="p-8 bg-indigo-50 border-2 border-indigo-100 rounded-3xl flex flex-col items-center gap-3 hover:bg-indigo-600 hover:text-white transition-all group">
                  <FileSpreadsheet size={32} className="text-indigo-600 group-hover:text-white" />
                  <span className="text-xs font-black uppercase">Exportar (.xlsx)</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-8 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:border-emerald-300 transition-all">
                  <Upload size={32} className="text-emerald-500" />
                  <span className="text-xs font-black uppercase">Importar Backup</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={e => {
                  const file = e.target.files?.[0];
                  if(file) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                      try {
                        const data = JSON.parse(re.target?.result as string).data;
                        if(data) {
                          setTasks(data.tasks || []);
                          setHabits(data.habits || []);
                          setRoutine(data.routine || {});
                          setNoteLists(data.noteLists || []);
                          alert("Dados importados!");
                        }
                      } catch { alert("Erro ao ler backup."); }
                    };
                    reader.readAsText(file);
                  }
                }} />
             </div>
             <button onClick={() => { if(confirm("Deseja apagar TUDO?")) { localStorage.clear(); location.reload(); } }} className="w-full mt-10 py-4 text-red-400 font-black uppercase tracking-widest hover:text-red-600">Zerar Tudo</button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in">
             <h2 className="text-2xl font-black mb-8">{editingTask ? 'Editar' : 'Nova'} Demanda</h2>
             <form onSubmit={handleSubmit} className="space-y-6">
               <input required autoFocus className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-lg" placeholder="Qual o desafio?" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <select className="p-4 bg-slate-50 border-none rounded-2xl font-bold" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value, nextDueDate: calculateNextDate(formData.lastDoneDate, e.target.value)})}>
                    {/* Fix: Explicitly typing elements of Object.values to avoid 'unknown' errors */}
                    {Object.values(allFrequencies).map((f: FrequencyOption) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <select className="p-4 bg-slate-50 border-none rounded-2xl font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {/* Fix: Explicitly typing elements of Object.values to avoid 'unknown' errors */}
                    {Object.values(allCategories).map((c: CategoryOption) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
               </div>
               <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">
                  {isCheckingSimilarity ? 'Analisando duplicatas...' : 'Materializar'}
               </button>
             </form>
          </div>
        </div>
      )}

      {/* CLUTTER ALERT MODAL */}
      {mentalClutterActive && similarTaskFound && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <div className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600"><Brain size={40}/></div>
            <h2 className="text-2xl font-black mb-4">Já temos algo assim.</h2>
            <p className="text-slate-500 mb-8 font-medium">Você já gerencia <b className="text-slate-900">"{similarTaskFound.name}"</b>. Criar algo similar gera ruído mental.</p>
            <div className="space-y-3">
               <button onClick={() => { setTasks(tasks.map(t => t.id === similarTaskFound.id ? {...t, status: 'active', nextDueDate: todayStr} : t)); setMentalClutterActive(false); setIsModalOpen(false); setViewMode('active'); }} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"><Zap size={20}/> Resgatar Existente</button>
               <button onClick={() => setMentalClutterActive(false)} className="w-full py-4 text-slate-400 font-bold">Ignorar e criar novo</button>
            </div>
          </div>
        </div>
      )}

      {isAddingNoteList && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsAddingNoteList(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-xl font-black mb-6">Nome da Lista</h2>
            <input autoFocus className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold" placeholder="Ex: Filmes, Compras..." value={newNoteListTitle} onChange={e => setNewNoteListTitle(e.target.value)} />
            <button onClick={() => { if(newNoteListTitle) { setNoteLists([...noteLists, {id: crypto.randomUUID(), title: newNoteListTitle, items: []}]); setNewNoteListTitle(''); setIsAddingNoteList(false); } }} className="w-full mt-4 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest">Criar</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
