import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { saveOnboardingState, getOnboardingState, clearOnboardingState, OnboardingState } from '../utils/db';
import Mascot from './Mascot';
import Button from './Button';
import ProjectSetup from './ProjectSetup';
import { ArrowRight, Check, Layout, Mic, FileText, Database, ShieldCheck, ArrowLeft, Sparkles } from 'lucide-react';

const OnboardingFlow: React.FC = () => {
  const { navigateTo } = useNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<'neutral' | 'happy' | 'thinking' | 'excited'>('neutral');

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const state = await getOnboardingState();
        if (state) {
          if (state.completed) {
            // If already completed/skipped previously, go straight to dashboard
            navigateTo('dashboard');
            return;
          }
          if (state.step) setStep(state.step);
          if (state.role) setRole(state.role);
        }
      } catch (e) {
        console.error("Failed to load onboarding state", e);
      } finally {
        setLoading(false);
      }
    };
    loadProgress();
  }, [navigateTo]);

  const handleNext = async () => {
    const nextStep = step + 1;
    setStep(nextStep);
    setMascotState('thinking');
    setTimeout(() => setMascotState('neutral'), 1000);
    await saveOnboardingState({ step: nextStep, role: role || undefined, completed: false });
  };
  
  const handleBack = async () => {
      const prevStep = step - 1;
      if (prevStep < 1) {
          navigateTo('landing');
          return;
      }
      setStep(prevStep);
      await saveOnboardingState({ step: prevStep });
  }

  const handleSkip = async () => {
    await saveOnboardingState({ completed: true });
    navigateTo('dashboard');
  };

  const handleRoleSelect = async (selectedRole: string) => {
    setRole(selectedRole);
    setMascotState('happy');
    // Save immediately so if they refresh they keep selection
    await saveOnboardingState({ step, role: selectedRole });
  };

  const handleComplete = async () => {
    setMascotState('excited');
    await saveOnboardingState({ step, role: role || undefined, completed: true });
    setTimeout(() => {
        navigateTo('dashboard');
    }, 1500);
  };
  
  const resetOnboarding = async () => {
      await clearOnboardingState();
      setStep(1);
      setRole(null);
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Mascot size="sm" expression="thinking" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 transition-all duration-500">
      
      {/* Progress Indicator */}
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-200">
        <div 
            className="h-full bg-blue-600 transition-all duration-700 ease-out"
            style={{ width: `${(step / 6) * 100}%` }}
        />
      </div>

      <div className="absolute top-8 right-8">
           <button onClick={resetOnboarding} className="text-xs text-slate-400 hover:text-slate-600 underline">Start Over</button>
      </div>
      
      {/* Back Button */}
      {step > 1 && (
        <button onClick={handleBack} className="absolute top-8 left-8 p-2 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
            <ArrowLeft className="w-6 h-6" />
        </button>
      )}

      {/* Step 1: Introduction */}
      {step === 1 && (
        <div className="text-center max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <Mascot size="lg" expression="happy" className="mx-auto mb-8" />
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            Hi, I'm Clarity.
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            I'm here to help you transform messy conversations into <br />
            <span className="text-blue-600 font-semibold">crystal-clear documentation</span>.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Button size="lg" onClick={handleNext} className="shadow-xl shadow-blue-500/20 w-48 h-14 text-lg">
                Let's Begin <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <button 
                onClick={handleSkip} 
                className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors hover:underline"
            >
                Skip Onboarding
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Role Selection */}
      {step === 2 && (
        <div className="max-w-4xl w-full text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
           <Mascot size="md" expression={role ? 'happy' : 'neutral'} className="mx-auto mb-6" />
           <h2 className="text-3xl font-bold text-slate-900 mb-2">What is your primary focus?</h2>
           <p className="text-slate-500 mb-10">This helps me tailor the requirements structure for you.</p>
           
           <div className="grid md:grid-cols-3 gap-6">
              {[
                  { id: 'pm', icon: Layout, title: 'Product Manager', desc: 'I need structured functional specs & user stories.' },
                  { id: 'eng', icon: Database, title: 'Engineering', desc: 'I need technical constraints & edge cases defined.' },
                  { id: 'stakeholder', icon: FileText, title: 'Stakeholder', desc: 'I need high-level scope & business goals.' }
              ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => handleRoleSelect(item.id)}
                    className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:-translate-y-1 ${role === item.id ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200' : 'border-slate-100 bg-white hover:border-blue-200 shadow-sm'}`}
                  >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${role === item.id ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          <item.icon className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </button>
              ))}
           </div>

           <div className="mt-12 h-14">
              {role && (
                <Button onClick={handleNext} className="animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-lg">
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              )}
           </div>
        </div>
      )}

      {/* Step 3: Data Flow Explanation */}
      {step === 3 && (
        <div className="max-w-3xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">How I work</h2>
            
            <div className="relative bg-white p-12 rounded-3xl shadow-xl border border-slate-100 mb-10 overflow-hidden">
                {/* Animation Container */}
                <div className="flex items-center justify-between relative z-10">
                    {/* Inputs */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 w-40 animate-pulse">
                            <Mic className="w-5 h-5 text-orange-500" />
                            <span className="text-sm font-medium text-slate-700">Meeting</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 w-40 animate-pulse delay-300">
                            <FileText className="w-5 h-5 text-blue-500" />
                            <span className="text-sm font-medium text-slate-700">Brief</span>
                        </div>
                    </div>

                    {/* Processing Line */}
                    <div className="flex-1 px-8 relative">
                         <div className="h-1 bg-slate-100 rounded-full w-full overflow-hidden">
                             <div className="h-full bg-blue-500 w-1/3 animate-[grow-bar_2s_infinite_linear]"></div>
                         </div>
                         <Mascot size="sm" expression="thinking" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>

                    {/* Output */}
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl w-40 shadow-sm transform transition-all hover:scale-105">
                        <div className="flex justify-center mb-2">
                            <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div className="text-sm font-bold text-emerald-800">Living BRD</div>
                    </div>
                </div>
            </div>

            <p className="text-slate-600 text-lg mb-8 max-w-lg mx-auto">
                I ingest raw audio and text, filter out the noise, and structure the important bits into actionable requirements.
            </p>

            <Button onClick={handleNext}>
                Got it, what else? <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
        </div>
      )}

      {/* Step 4: Trust & Confidence */}
      {step === 4 && (
        <div className="max-w-3xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
             <div className="inline-flex items-center justify-center p-4 bg-blue-50 rounded-full mb-6">
                 <ShieldCheck className="w-8 h-8 text-blue-600" />
             </div>
             <h2 className="text-3xl font-bold text-slate-900 mb-4">I don't hallucinate requirements.</h2>
             <p className="text-xl text-slate-600 mb-10">
                 If I'm not sure, I'll tell you.
             </p>

             <div className="grid md:grid-cols-2 gap-6 mb-12 text-left">
                 <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 hover:border-emerald-200 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">HIGH CONFIDENCE</span>
                        <span className="text-emerald-500 font-mono text-sm">98%</span>
                     </div>
                     <p className="text-slate-800 font-medium">"System must support SSO via Okta."</p>
                     <p className="text-xs text-slate-400 mt-2">Source: CTO Email, 10:42 AM</p>
                 </div>

                 <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 hover:border-orange-200 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">NEEDS REVIEW</span>
                        <span className="text-orange-500 font-mono text-sm">45%</span>
                     </div>
                     <p className="text-slate-800 font-medium">"Export limit should be 50k rows."</p>
                     <p className="text-xs text-slate-400 mt-2">Source: Ambiguous meeting comment</p>
                 </div>
             </div>

             <Button onClick={handleNext}>
                I'm ready <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
        </div>
      )}

      {/* Step 5: Project Setup */}
      {step === 5 && (
        <div className="max-w-4xl w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white mb-6 shadow-lg shadow-blue-500/30">
                    <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Let's set up your workspace</h2>
                <p className="text-slate-500 text-lg">Tell me about the project you're working on.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
                <ProjectSetup onComplete={handleNext} embedded={true} />
            </div>
        </div>
      )}

      {/* Step 6: Ready */}
      {step === 6 && (
        <div className="text-center animate-in fade-in zoom-in-95 duration-700">
            <Mascot size="lg" expression="excited" className="mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-slate-900 mb-4">You're all set!</h1>
            <p className="text-slate-600 text-lg mb-8">
                Your workspace has been configured for <span className="font-semibold text-blue-600">{role === 'pm' ? 'Product Management' : role === 'eng' ? 'Engineering' : 'Stakeholder Review'}</span>.
            </p>
            <div className="flex justify-center gap-4">
                <Button size="lg" onClick={handleComplete} className="shadow-xl shadow-blue-600/20">
                    Go to Dashboard
                </Button>
            </div>
        </div>
      )}

    </div>
  );
};

export default OnboardingFlow;