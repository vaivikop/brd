import React, { useEffect, useRef, useState } from 'react';
import { 
  MessageSquareOff, 
  Clock, 
  Puzzle, 
  AlertTriangle, 
  Mail, 
  Video, 
  FileQuestion,
  Users,
  Zap
} from 'lucide-react';

const ProblemStory: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const painPoints = [
    {
      icon: MessageSquareOff,
      title: "Lost in Translation",
      description: "Critical requirements buried in 47-email threads that nobody has time to read again.",
      color: "from-red-500 to-orange-500",
      bgColor: "bg-red-50",
      delay: "0ms"
    },
    {
      icon: Clock,
      title: "Time Vampire",
      description: "Product managers spend 40% of their week just documenting what was already discussed.",
      color: "from-orange-500 to-amber-500",
      bgColor: "bg-orange-50",
      delay: "100ms"
    },
    {
      icon: Puzzle,
      title: "Missing Pieces",
      description: "That one Slack message with the crucial clarification? Gone. Lost to infinite scroll.",
      color: "from-amber-500 to-yellow-500",
      bgColor: "bg-amber-50",
      delay: "200ms"
    },
    {
      icon: AlertTriangle,
      title: "Conflicting Truths",
      description: "Engineering says one thing, Sales says another. Which requirement is actually valid?",
      color: "from-yellow-500 to-lime-500",
      bgColor: "bg-yellow-50",
      delay: "300ms"
    }
  ];

  const chaosItems = [
    { icon: Mail, label: "Emails", count: "127 unread" },
    { icon: Video, label: "Recordings", count: "8 hours" },
    { icon: FileQuestion, label: "Docs", count: "23 versions" },
    { icon: Users, label: "Stakeholders", count: "12 opinions" },
  ];

  return (
    <section 
      ref={sectionRef}
      id="problem"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-white via-slate-50 to-white overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-20 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-100 text-red-700 text-sm font-semibold mb-6">
            <AlertTriangle className="h-4 w-4" />
            The Problem We All Know Too Well
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
            Sound Familiar?
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Every project starts with conversations. But by the time you write the BRD, 
            <span className="font-semibold text-slate-800"> half the context is already lost.</span>
          </p>
        </div>

        {/* Chaos visualization */}
        <div className={`mb-20 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          <div className="relative max-w-4xl mx-auto">
            {/* Central chaos hub */}
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 lg:p-10 relative z-10">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 mb-4 animate-pulse">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">The Requirements Black Hole</h3>
                <p className="text-slate-500 mt-2">Where good ideas go to get lost</p>
              </div>

              {/* Chaos items */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {chaosItems.map((item, i) => (
                  <div 
                    key={i}
                    className="group relative bg-slate-50 hover:bg-slate-100 rounded-xl p-4 text-center transition-all duration-300 hover:scale-105 cursor-default"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="absolute -top-2 -right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      CHAOS
                    </div>
                    <item.icon className="h-8 w-8 mx-auto text-slate-400 group-hover:text-red-500 transition-colors mb-2" />
                    <div className="font-semibold text-slate-700 text-sm">{item.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.count}</div>
                  </div>
                ))}
              </div>

              {/* Messy connecting lines */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl opacity-20">
                <svg className="w-full h-full" viewBox="0 0 400 300">
                  <path 
                    d="M50,150 Q100,50 200,100 T350,150" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    fill="none" 
                    className="text-red-400 animate-dash"
                  />
                  <path 
                    d="M50,200 Q150,250 250,180 T350,220" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    fill="none" 
                    className="text-orange-400 animate-dash-delayed"
                  />
                  <path 
                    d="M100,50 Q200,150 300,80" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    fill="none" 
                    className="text-amber-400 animate-dash"
                  />
                </svg>
              </div>
            </div>

            {/* Floating pain indicators */}
            <div className="absolute -top-4 -left-4 md:-left-8 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold animate-bounce-slow shadow-lg">
              "Where's that doc?"
            </div>
            <div className="absolute -top-4 -right-4 md:-right-8 bg-orange-100 text-orange-700 px-3 py-2 rounded-lg text-xs font-bold animate-bounce-slow shadow-lg" style={{ animationDelay: '500ms' }}>
              "Wait, I thought we agreed..."
            </div>
            <div className="absolute -bottom-4 left-1/4 bg-amber-100 text-amber-700 px-3 py-2 rounded-lg text-xs font-bold animate-bounce-slow shadow-lg" style={{ animationDelay: '1000ms' }}>
              "This wasn't in scope!"
            </div>
            <div className="absolute -bottom-4 right-1/4 bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg text-xs font-bold animate-bounce-slow shadow-lg" style={{ animationDelay: '1500ms' }}>
              "Who approved this?"
            </div>
          </div>
        </div>

        {/* Pain point cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {painPoints.map((point, i) => (
            <div
              key={i}
              className={`group relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: point.delay }}
            >
              {/* Top gradient bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${point.color}`} />
              
              {/* Icon */}
              <div className={`w-14 h-14 ${point.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <point.icon className={`h-7 w-7 bg-gradient-to-r ${point.color} bg-clip-text`} style={{ color: 'transparent', backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }} />
                <point.icon className={`h-7 w-7 text-red-500`} />
              </div>
              
              {/* Content */}
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                {point.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom hook */}
        <div className={`mt-20 text-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white">
            <span className="text-lg font-medium">But what if there was a better way?</span>
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemStory;
