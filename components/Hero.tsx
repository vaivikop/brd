import React from 'react';
import Button from './Button';
import { PlayCircle, ArrowRight } from 'lucide-react';
import { HeroChatIcon, HeroProcessingIcon, HeroDocIcon } from './AnimatedIcons';
import { useNavigation } from '../context/NavigationContext';

const Hero: React.FC = () => {
  const { navigateTo } = useNavigation();

  return (
    <section className="relative overflow-hidden pt-24 pb-28 lg:pt-36 lg:pb-48 bg-slate-50/50">
      {/* Abstract background shapes */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-40 pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-20 right-10 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold mb-10 hover:bg-blue-100 transition-colors cursor-pointer shadow-sm">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse"></span>
          Now supporting Real-time Meeting Transcription
        </div>
        
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-tight">
          Turn Conversations into <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Clear, Actionable BRDs</span>
        </h1>
        
        <p className="max-w-3xl mx-auto text-xl text-slate-600 mb-12 leading-relaxed font-normal">
          Stop manually synthesizing emails, meetings, and docs. Our AI Agent transforms scattered business context into a structured, explainable, and living Business Requirements Document.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20">
          <Button 
            size="lg" 
            className="w-full sm:w-auto gap-2 px-8 h-14 text-lg shadow-blue-500/25 shadow-xl hover:shadow-2xl transition-all"
            onClick={() => navigateTo('onboarding')}
          >
            Generate My BRD <ArrowRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 px-8 h-14 text-lg hover:bg-white/80 backdrop-blur-sm" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
            <PlayCircle className="h-5 w-5" /> See How It Works
          </Button>
        </div>

        {/* Floating cards visual */}
        <div className="relative max-w-5xl mx-auto mt-8 hidden lg:block h-80 perspective-1000">
           {/* Card 1: Input */}
           <div className="absolute left-10 top-16 w-72 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 transform -rotate-6 transition-all duration-500 hover:-rotate-3 hover:scale-105 z-10 hover:z-30 group cursor-default">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-orange-50 p-3 rounded-xl">
                  <HeroChatIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-900">Stakeholder Call</div>
                  <div className="text-xs text-slate-500">Audio • 45m 12s</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-2.5 bg-slate-100 rounded-full w-full"></div>
                <div className="h-2.5 bg-slate-100 rounded-full w-4/5"></div>
                <div className="h-2.5 bg-slate-100 rounded-full w-5/6"></div>
              </div>
              <div className="mt-4 flex gap-2">
                 <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                 <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                 <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
              </div>
           </div>

           {/* Arrow 1 */}
           <div className="absolute left-[32%] top-1/2 -translate-y-1/2 text-slate-300">
             <ArrowRight className="h-10 w-10 animate-pulse text-blue-200" />
           </div>

           {/* Card 2: Processing (Center) */}
           <div className="absolute left-1/2 -translate-x-1/2 top-0 w-80 bg-white p-8 rounded-3xl shadow-[0_25px_60px_rgba(37,99,235,0.15)] border border-blue-50 z-20 hover:scale-105 transition-transform duration-500">
              <div className="flex justify-between items-center mb-6">
                 <span className="text-xs font-extrabold tracking-widest text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded">Agent Active</span>
                 <HeroProcessingIcon className="h-8 w-8" />
              </div>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span className="text-sm text-emerald-900 font-semibold">Scope Defined</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-600">100%</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-sm text-slate-700 font-medium">Drafting Reqs</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">85%</span>
                 </div>
              </div>
           </div>

            {/* Arrow 2 */}
           <div className="absolute right-[32%] top-1/2 -translate-y-1/2 text-slate-300">
             <ArrowRight className="h-10 w-10 animate-pulse text-blue-200" />
           </div>

           {/* Card 3: Output */}
           <div className="absolute right-10 top-16 w-72 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-emerald-100 transform rotate-6 transition-all duration-500 hover:rotate-3 hover:scale-105 z-10 hover:z-30">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-emerald-50 p-3 rounded-xl">
                  <HeroDocIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-900">Final BRD v1.0</div>
                  <div className="text-xs text-slate-500">PDF • DOCX • Jira</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-2.5 bg-emerald-50 rounded-full w-full"></div>
                <div className="h-2.5 bg-emerald-50 rounded-full w-full"></div>
                <div className="h-2.5 bg-emerald-50 rounded-full w-3/4"></div>
                <div className="mt-6 flex justify-between items-center">
                    <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold rounded-md tracking-wide">Approved</div>
                    <div className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white"></div>
                </div>
              </div>
           </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;