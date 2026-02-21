import React, { useState } from 'react';
import Button from './Button';
import { FileText, Calendar, Target, ArrowRight, Loader, AlertCircle, Sparkles } from 'lucide-react';
import { createProject } from '../utils/db';

interface ProjectSetupProps {
  onComplete: () => void;
  embedded?: boolean;
}

const ProjectSetup: React.FC<ProjectSetupProps> = ({ onComplete, embedded = false }) => {
  const [formData, setFormData] = useState({
    name: '',
    timeline: '',
    goals: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: {[key: string]: string} = {};
    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.timeline.trim()) newErrors.timeline = 'Timeline is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await createProject({ 
        name: formData.name, 
        timeline: formData.timeline, 
        goals: formData.goals 
      });
      onComplete();
    } catch (error) {
      console.error("Failed to create project", error);
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const content = (
    <div className={`${embedded ? 'w-full' : 'bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-100 p-8 animate-in fade-in zoom-in-95 duration-500 relative z-10'}`}>
      {!embedded && (
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white mb-6 shadow-lg shadow-blue-500/30">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Initialize Workspace</h1>
          <p className="text-slate-500 mt-3 text-lg">Define your mission parameters.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <FileText className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Apollo Redesign 2024"
              className={`w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-900 border text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none ${errors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'}`}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
              <AlertCircle className="h-3 w-3" /> {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Target Timeline <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={formData.timeline}
              onChange={(e) => handleChange('timeline', e.target.value)}
              placeholder="e.g. Q3 Launch"
              className={`w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-900 border text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none ${errors.timeline ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'}`}
            />
          </div>
           {errors.timeline && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
              <AlertCircle className="h-3 w-3" /> {errors.timeline}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Primary Goal <span className="text-slate-400 font-normal text-xs uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">Optional</span>
          </label>
           <div className="relative">
            <div className="absolute top-3.5 left-3 pointer-events-none text-slate-400">
              <Target className="h-5 w-5" />
            </div>
            <textarea
              value={formData.goals}
              onChange={(e) => handleChange('goals', e.target.value)}
              placeholder="What defines success for this project?"
              className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none h-28 resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="pt-6">
          <Button 
              type="submit" 
              className="w-full h-14 text-lg font-semibold shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 transition-all transform hover:-translate-y-0.5"
              disabled={isSubmitting}
          >
            {isSubmitting ? (
              <><Loader className="mr-2 h-5 w-5 animate-spin" /> Initializing Workspace...</>
            ) : (
              <>Create Project <ArrowRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      </div>
      {content}
    </div>
  );
};

export default ProjectSetup;