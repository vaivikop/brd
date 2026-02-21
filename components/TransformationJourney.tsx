import React, { useEffect, useRef, useState } from 'react';
import { 
  Upload, 
  Brain, 
  FileCheck, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2,
  Zap,
  Target,
  Shield,
  Edit3,
  GitBranch,
  Eye
} from 'lucide-react';
import Button from './Button';
import { useNavigation } from '../context/NavigationContext';

interface StepData {
  step: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  visual: 'upload' | 'process' | 'output' | 'refine';
  gradient: string;
}

const TransformationJourney: React.FC = () => {
  const { navigateTo } = useNavigation();
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Auto-advance steps
  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isVisible]);

  const steps: StepData[] = [
    {
      step: 1,
      title: "Connect Your Context",
      subtitle: "30 seconds",
      description: "Upload meeting recordings, paste email threads, or connect your Slack workspace. Our agent ingests everything.",
      icon: Upload,
      features: ["Transcription included", "100+ file formats", "Direct integrations"],
      visual: 'upload',
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      step: 2,
      title: "AI Extracts Intelligence",
      subtitle: "2-5 minutes",
      description: "Our agent analyzes context, identifies requirements, flags conflicts, and assigns confidence scores automatically.",
      icon: Brain,
      features: ["Semantic understanding", "Conflict detection", "Gap analysis"],
      visual: 'process',
      gradient: "from-purple-500 to-pink-500"
    },
    {
      step: 3,
      title: "Review & Validate",
      subtitle: "Your pace",
      description: "Every extracted requirement traces back to its source. Approve high-confidence items, clarify ambiguous ones.",
      icon: FileCheck,
      features: ["Full traceability", "Confidence scoring", "One-click approval"],
      visual: 'output',
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      step: 4,
      title: "Refine & Export",
      subtitle: "Instant",
      description: "Edit using plain English commands. Export to PDF, Word, Jira, or Confluence with one click.",
      icon: Sparkles,
      features: ["Natural language editing", "Multiple export formats", "Version control"],
      visual: 'refine',
      gradient: "from-orange-500 to-amber-500"
    }
  ];

  const renderVisual = (visual: string, isActive: boolean) => {
    const baseClass = `transition-all duration-700 ${isActive ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`;
    
    switch (visual) {
      case 'upload':
        return (
          <div className={baseClass}>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border-2 border-dashed border-blue-200">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Upload className="h-10 w-10 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Drop your files here</p>
                  <p className="text-sm text-slate-500 mt-1">or connect your tools</p>
                </div>
                <div className="flex gap-3 mt-6">
                  {['Slack', 'Gmail', 'Zoom'].map((tool) => (
                    <div key={tool} className="px-3 py-2 bg-white rounded-lg shadow-sm text-xs font-medium text-slate-600 border">
                      {tool}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'process':
        return (
          <div className={baseClass}>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8">
              <div className="space-y-4">
                {['Analyzing meeting transcript...', 'Extracting key requirements...', 'Detecting conflicts...', 'Assigning confidence scores...'].map((text, i) => (
                  <div 
                    key={i}
                    className={`flex items-center gap-3 ${isActive && i <= (Date.now() / 1000) % 4 ? 'opacity-100' : 'opacity-30'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${i <= 2 ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                      {i <= 2 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
                      )}
                    </div>
                    <span className="text-sm text-slate-700">{text}</span>
                  </div>
                ))}
                <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-500">Processing</span>
                    <span className="text-xs font-bold text-purple-600">78%</span>
                  </div>
                  <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-progress" style={{ width: '78%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'output':
        return (
          <div className={baseClass}>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6">
              <div className="space-y-3">
                {[
                  { req: 'User authentication via OAuth', confidence: 98, status: 'approved' },
                  { req: 'Dashboard analytics module', confidence: 92, status: 'approved' },
                  { req: 'Export functionality', confidence: 67, status: 'review' },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{item.req}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`h-1.5 w-16 rounded-full ${item.confidence > 80 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className={`text-xs font-bold ${item.confidence > 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {item.confidence}% confidence
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.status === 'approved' ? 'Approved' : 'Needs Review'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'refine':
        return (
          <div className={baseClass}>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Natural Language Editor</span>
                </div>
                <div className="p-4">
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 mb-4">
                    <p className="text-sm text-amber-800 italic">"Make the authentication requirement stricter and add rate limiting"</p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Updated 2 requirements</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-center">
                {['PDF', 'Word', 'Jira', 'Confluence'].map((format) => (
                  <div key={format} className="px-3 py-2 bg-white rounded-lg shadow-sm text-xs font-medium text-slate-600 border hover:border-orange-300 transition-colors cursor-pointer">
                    {format}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <section 
      ref={sectionRef}
      id="transformation"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-white via-blue-50/30 to-white overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            The Transformation
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
            From Chaos to Clarity in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">4 Simple Steps</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Watch how ClarityAI transforms scattered conversations into a structured, 
            traceable BRD that your entire team can trust.
          </p>
        </div>

        {/* Main content grid */}
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Left - Steps */}
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-500 cursor-pointer ${
                  activeStep === i 
                    ? 'bg-white border-blue-200 shadow-xl shadow-blue-100/50' 
                    : 'bg-slate-50/50 border-transparent hover:border-slate-200'
                }`}
                onClick={() => setActiveStep(i)}
              >
                {/* Active indicator */}
                {activeStep === i && (
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b ${step.gradient}`} />
                )}
                
                <div className="flex items-start gap-4">
                  {/* Step number & icon */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    activeStep === i 
                      ? `bg-gradient-to-r ${step.gradient} shadow-lg` 
                      : 'bg-slate-100'
                  }`}>
                    <step.icon className={`h-7 w-7 ${activeStep === i ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        activeStep === i 
                          ? `bg-gradient-to-r ${step.gradient} text-white` 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        STEP {step.step}
                      </span>
                      <span className="text-xs text-slate-400">{step.subtitle}</span>
                    </div>
                    <h3 className={`text-lg font-bold mb-2 transition-colors ${
                      activeStep === i ? 'text-slate-900' : 'text-slate-600'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm leading-relaxed transition-colors ${
                      activeStep === i ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {step.description}
                    </p>
                    
                    {/* Features */}
                    {activeStep === i && (
                      <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {step.features.map((feature, fi) => (
                          <span key={fi} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar for active step */}
                {activeStep === i && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 rounded-b-2xl overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${step.gradient} animate-progress-bar`} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right - Visual */}
          <div className="relative">
            <div className="sticky top-24">
              {/* Visual container */}
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 lg:p-8 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-500">ClarityAI Agent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-600">Live</span>
                  </div>
                </div>

                {/* Dynamic visual */}
                <div className="min-h-[320px] flex items-center justify-center">
                  {steps.map((step, i) => (
                    <div key={i} className={`w-full ${activeStep === i ? 'block' : 'hidden'}`}>
                      {renderVisual(step.visual, activeStep === i)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex justify-center gap-6 mt-8">
                {[
                  { icon: Shield, label: "SOC2 Compliant" },
                  { icon: GitBranch, label: "Version Control" },
                  { icon: Eye, label: "Full Traceability" },
                ].map((badge, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-500 text-sm">
                    <badge.icon className="h-4 w-4" />
                    <span>{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`mt-20 text-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <Button 
            size="lg" 
            className="gap-3 px-10 h-16 text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            onClick={() => navigateTo('onboarding')}
          >
            Experience the Transformation
            <ArrowRight className="h-5 w-5" />
          </Button>
          <p className="text-slate-500 text-sm mt-4">No credit card required. Start in under 2 minutes.</p>
        </div>
      </div>
    </section>
  );
};

export default TransformationJourney;
