import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Calendar, 
  Info, 
  Plus, 
  X, 
  ArrowRight, 
  Shield, 
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Button from './Button';
import Tooltip from './Tooltip';
import { ProjectState, updateProjectContext } from '../utils/db';

interface ProjectContextProps {
  project: ProjectState;
  onUpdate: (project: ProjectState) => void;
  onContinue: () => void;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ project, onUpdate, onContinue }) => {
  const [description, setDescription] = useState(project.description || '');
  const [startDate, setStartDate] = useState(project.dateRange?.start || '');
  const [endDate, setEndDate] = useState(project.dateRange?.end || '');
  const [goalTags, setGoalTags] = useState<string[]>(project.goalTags || []);
  const [newGoal, setNewGoal] = useState('');
  const [prioritize, setPrioritize] = useState<string[]>(project.focusSignals?.prioritize || []);
  const [newPrioritize, setNewPrioritize] = useState('');
  const [ignore, setIgnore] = useState<string[]>(project.focusSignals?.ignore || []);
  const [newIgnore, setNewIgnore] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSave();
    }, 1000);
    return () => clearTimeout(timer);
  }, [description, startDate, endDate, goalTags, prioritize, ignore]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<ProjectState> = {
        description,
        dateRange: { start: startDate, end: endDate },
        goalTags,
        focusSignals: { prioritize, ignore }
      };
      const updated = await updateProjectContext(updates);
      onUpdate(updated);
    } catch (error) {
      console.error("Failed to save context", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, value: string, setValue: React.Dispatch<React.SetStateAction<string>>) => {
    if (value.trim() && !list.includes(value.trim())) {
      setList([...list, value.trim()]);
      setValue('');
    }
  };

  const removeTag = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const calculateCompleteness = () => {
    let score = 0;
    if (description.length > 10) score += 25;
    if (startDate && endDate) score += 25;
    if (goalTags.length > 0) score += 25;
    if (prioritize.length > 0 || ignore.length > 0) score += 25;
    return score;
  };

  const completeness = calculateCompleteness();

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="mb-12 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100">
          <Shield className="h-3.5 w-3.5" /> Step 3: Scope & Context
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Refine Project Lens</h1>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
          Help me understand the boundaries. Clear context prevents noise and ensures 
          <span className="text-indigo-600 font-semibold"> high-precision requirements</span> generation.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Project Identity */}
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Project Identity</h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Core definition</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  Project Name
                </label>
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 font-medium">
                  {project.name}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  One-line Description
                  <Tooltip content="A concise summary helps the AI categorize requirements correctly.">
                    <Info className="h-3.5 w-3.5 text-slate-300 cursor-help" />
                  </Tooltip>
                </label>
                <input 
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Modernizing the checkout flow for mobile users"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>
          </section>

          {/* Time Scope */}
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Time Scope</h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Relevant period</p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Start Date</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">End Date</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-900"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400 flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              I will prioritize conversations and documents within this range.
            </p>
          </section>

          {/* Goals & Objectives */}
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Goals & Objectives</h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Success metrics</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag(goalTags, setGoalTags, newGoal, setNewGoal)}
                  placeholder="Add a goal (e.g. Reduce churn, Increase speed)"
                  className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-900"
                />
                <Button onClick={() => addTag(goalTags, setGoalTags, newGoal, setNewGoal)} className="rounded-xl px-4">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {goalTags.map((tag, i) => (
                    <motion.span 
                      key={tag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100"
                    >
                      {tag}
                      <button onClick={() => removeTag(goalTags, setGoalTags, i)} className="hover:text-indigo-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                {goalTags.length === 0 && (
                  <span className="text-sm text-slate-400 italic py-2">No goals added yet.</span>
                )}
              </div>
            </div>
          </section>

          {/* Focus Signals */}
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Focus Signals</h2>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Prioritization</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-10">
              {/* Prioritize */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-500" /> Prioritize
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newPrioritize}
                    onChange={(e) => setNewPrioritize(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag(prioritize, setPrioritize, newPrioritize, setNewPrioritize)}
                    placeholder="e.g. Security, UX"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-medium"
                  />
                  <button 
                    onClick={() => addTag(prioritize, setPrioritize, newPrioritize, setNewPrioritize)}
                    className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {prioritize.map((tag, i) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
                      {tag}
                      <button onClick={() => removeTag(prioritize, setPrioritize, i)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Ignore */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-red-500" /> Ignore
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newIgnore}
                    onChange={(e) => setNewIgnore(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag(ignore, setIgnore, newIgnore, setNewIgnore)}
                    placeholder="e.g. Marketing, Legal"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm font-medium"
                  />
                  <button 
                    onClick={() => addTag(ignore, setIgnore, newIgnore, setNewIgnore)}
                    className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {ignore.map((tag, i) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-100">
                      {tag}
                      <button onClick={() => removeTag(ignore, setIgnore, i)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar / Status */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 sticky top-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Context Health</h3>
            
            <div className="relative h-48 flex items-center justify-center mb-8">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-50"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * completeness) / 100}
                  strokeLinecap="round"
                  className={`${completeness > 75 ? 'text-emerald-500' : completeness > 40 ? 'text-indigo-500' : 'text-orange-500'} transition-all duration-1000 ease-out`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-900">{completeness}%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defined</span>
              </div>
            </div>

            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-sm font-medium">
                {description.length > 10 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-slate-200" />}
                <span className={description.length > 10 ? 'text-slate-900' : 'text-slate-400'}>Project Identity</span>
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                {startDate && endDate ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-slate-200" />}
                <span className={startDate && endDate ? 'text-slate-900' : 'text-slate-400'}>Time Scope</span>
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                {goalTags.length > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-slate-200" />}
                <span className={goalTags.length > 0 ? 'text-slate-900' : 'text-slate-400'}>Goals & Metrics</span>
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                {prioritize.length > 0 || ignore.length > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-slate-200" />}
                <span className={prioritize.length > 0 || ignore.length > 0 ? 'text-slate-900' : 'text-slate-400'}>Focus Signals</span>
              </li>
            </ul>

            <Button 
              onClick={onContinue}
              className="w-full h-16 rounded-2xl text-lg font-bold shadow-xl shadow-indigo-500/20"
            >
              Confirm Context <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <div className="mt-6 text-center">
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${isSaving ? 'text-indigo-500' : 'text-slate-300'}`}>
                {isSaving ? (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full"
                    />
                    Saving to Workspace...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    All changes saved
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectContext;
