import React, { useEffect, useState, useRef, useCallback } from 'react';
import Button from './Button';
import { ArrowRight, Sparkles, Play, CheckCircle2, Zap, Brain, FileText, Terminal, Activity, Shield, Target, Star, TrendingUp, Users, Clock, ChevronRight } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';

// Animated counter hook
const useAnimatedCounter = (end: number, duration: number = 2000, startOnView: boolean = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;
    
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [hasStarted, end, duration]);

  return { count, ref };
};

// Interactive AI Terminal Demo
const AITerminalDemo: React.FC = () => {
  const [lines, setLines] = useState<{ text: string; type: 'input' | 'processing' | 'success' | 'output' }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const demoSequence = [
    { text: '> clarityai analyze --sources meeting.mp3 emails.pdf slack.json', type: 'input' as const, delay: 100 },
    { text: '   Ingesting 3 data sources...', type: 'processing' as const, delay: 800 },
    { text: '   Transcribing meeting audio... [████████████] 100%', type: 'processing' as const, delay: 1200 },
    { text: '   Extracting entities & context...', type: 'processing' as const, delay: 800 },
    { text: '   ✓ Found 47 stakeholder statements', type: 'success' as const, delay: 600 },
    { text: '   ✓ Detected 3 conflicting requirements', type: 'success' as const, delay: 500 },
    { text: '   ✓ Assigned confidence scores (avg: 94%)', type: 'success' as const, delay: 500 },
    { text: '   ✓ Generated BRD with 23 requirements', type: 'success' as const, delay: 600 },
    { text: '', type: 'output' as const, delay: 300 },
    { text: '╔═══════════════════════════════════════════════╗', type: 'output' as const, delay: 100 },
    { text: '║  BRD Generated Successfully!                  ║', type: 'output' as const, delay: 100 },
    { text: '║  • 23 requirements extracted                  ║', type: 'output' as const, delay: 100 },
    { text: '║  • 3 conflicts flagged for review             ║', type: 'output' as const, delay: 100 },
    { text: '║  • Full traceability enabled                  ║', type: 'output' as const, delay: 100 },
    { text: '╚═══════════════════════════════════════════════╝', type: 'output' as const, delay: 100 },
  ];

  const runDemo = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setLines([]);
    setCurrentStep(0);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || currentStep >= demoSequence.length) {
      if (currentStep >= demoSequence.length) {
        setTimeout(() => {
          setIsRunning(false);
        }, 3000);
      }
      return;
    }

    const timer = setTimeout(() => {
      setLines(prev => [...prev, demoSequence[currentStep]]);
      setCurrentStep(prev => prev + 1);
    }, demoSequence[currentStep].delay);

    return () => clearTimeout(timer);
  }, [isRunning, currentStep]);

  // Auto-start on mount
  useEffect(() => {
    const timer = setTimeout(runDemo, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Loop the demo
  useEffect(() => {
    if (!isRunning && lines.length > 0) {
      const timer = setTimeout(runDemo, 4000);
      return () => clearTimeout(timer);
    }
  }, [isRunning, lines.length, runDemo]);

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 transform hover:scale-[1.02] transition-transform duration-500">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-400 transition-colors" />
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
          <Terminal className="h-3 w-3" />
          clarityai-cli v2.0
        </div>
        <button 
          onClick={runDemo}
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700"
        >
          <Play className="h-3 w-3" /> Replay
        </button>
      </div>
      
      {/* Terminal body */}
      <div className="p-4 font-mono text-sm h-[300px] overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="space-y-1">
          {lines.map((line, i) => (
            <div 
              key={i}
              className={`animate-terminal-line ${
                line.type === 'input' ? 'text-cyan-400 font-semibold' :
                line.type === 'processing' ? 'text-slate-400' :
                line.type === 'success' ? 'text-emerald-400' :
                'text-blue-300'
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {line.text}
            </div>
          ))}
          {isRunning && currentStep < demoSequence.length && (
            <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1" />
          )}
        </div>
      </div>
    </div>
  );
};

// Constellation/Neural Network Background
const ConstellationBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize nodes
    const nodeCount = 60;
    nodesRef.current = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      // Update and draw nodes
      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.offsetWidth) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.offsetHeight) node.vy *= -1;

        const distToMouse = Math.hypot(node.x - mouse.x, node.y - mouse.y);
        const isNearMouse = distToMouse < 150;
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, isNearMouse ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = isNearMouse ? 'rgba(59, 130, 246, 0.9)' : 'rgba(148, 163, 184, 0.35)';
        ctx.fill();

        // Draw connections
        nodes.slice(i + 1).forEach(other => {
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.12 * (1 - dist / 100)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        if (isNearMouse) {
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.4 * (1 - distToMouse / 150)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ opacity: 0.7 }}
    />
  );
};

// Trust Logos Bar
const TrustBar: React.FC = () => {
  const companies = [
    { name: 'Acme Corp', initial: 'A' },
    { name: 'TechFlow', initial: 'T' },
    { name: 'DataSync', initial: 'D' },
    { name: 'CloudNine', initial: 'C' },
    { name: 'InnoLabs', initial: 'I' },
    { name: 'ScalePro', initial: 'S' },
  ];

  return (
    <div className="py-6">
      <p className="text-center text-xs text-slate-500 mb-5 font-medium uppercase tracking-wider">Trusted by innovative teams worldwide</p>
      <div className="flex justify-center items-center flex-wrap gap-6 sm:gap-10">
        {companies.map((company, i) => (
          <div 
            key={i} 
            className="flex items-center gap-2 group cursor-default opacity-50 hover:opacity-100 transition-all duration-300"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center group-hover:from-blue-50 group-hover:to-indigo-100 transition-all duration-300 shadow-sm">
              <span className="text-sm font-bold text-slate-500 group-hover:text-blue-600 transition-colors">{company.initial}</span>
            </div>
            <span className="text-sm font-medium text-slate-500 group-hover:text-slate-700 hidden sm:block transition-colors">{company.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Live Activity Feed
const LiveActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState([
    { id: 1, type: 'brd', message: 'BRD generated for "E-commerce Platform"', time: '2s ago' },
    { id: 2, type: 'conflict', message: 'Conflict resolved in "Mobile App Redesign"', time: '15s ago' },
    { id: 3, type: 'insight', message: 'Edge case detected in "API Integration"', time: '32s ago' },
  ]);

  useEffect(() => {
    const newActivities = [
      { type: 'brd', message: 'BRD generated for "Dashboard Analytics"', time: 'Just now' },
      { type: 'insight', message: '5 requirements extracted from meeting', time: 'Just now' },
      { type: 'conflict', message: 'Ambiguity flagged in "Payment System"', time: 'Just now' },
    ];

    const interval = setInterval(() => {
      setActivities(prev => {
        const newActivity = {
          id: Date.now(),
          ...newActivities[Math.floor(Math.random() * newActivities.length)]
        };
        return [newActivity, ...prev.slice(0, 2)];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute -right-4 top-1/2 -translate-y-1/2 hidden xl:block">
      <div className="bg-white/90 backdrop-blur-lg rounded-xl shadow-xl border border-slate-100 p-4 w-72 animate-slide-in-right">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Activity</span>
        </div>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-2 animate-fade-slide-in">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                activity.type === 'brd' ? 'bg-blue-100' :
                activity.type === 'conflict' ? 'bg-amber-100' : 'bg-emerald-100'
              }`}>
                {activity.type === 'brd' ? <FileText className="h-3 w-3 text-blue-600" /> :
                 activity.type === 'conflict' ? <Shield className="h-3 w-3 text-amber-600" /> :
                 <Sparkles className="h-3 w-3 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate">{activity.message}</p>
                <p className="text-[10px] text-slate-400">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Feature Rotating Cards
const RotatingFeatures: React.FC<{ activeIndex: number }> = ({ activeIndex }) => {
  const features = [
    { icon: Brain, title: 'AI-Powered Extraction', desc: 'Natural language processing that truly understands context', color: 'from-purple-500 to-indigo-500' },
    { icon: Shield, title: 'Full Traceability', desc: 'Every requirement linked directly to its source', color: 'from-emerald-500 to-teal-500' },
    { icon: Activity, title: 'Confidence Scoring', desc: 'Know exactly which requirements need attention', color: 'from-orange-500 to-amber-500' },
  ];

  return (
    <div className="flex gap-3 mt-6">
      {features.map((feature, i) => (
        <div
          key={i}
          className={`flex-1 p-4 rounded-xl border transition-all duration-500 cursor-pointer ${
            activeIndex === i 
              ? 'bg-gradient-to-br from-white to-slate-50 border-blue-200 shadow-lg scale-105' 
              : 'bg-white/50 border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 ${activeIndex === i ? 'animate-pulse' : ''}`}>
            <feature.icon className="h-5 w-5 text-white" />
          </div>
          <h4 className={`text-sm font-bold mb-1 transition-colors ${activeIndex === i ? 'text-slate-900' : 'text-slate-600'}`}>
            {feature.title}
          </h4>
          <p className={`text-xs transition-colors ${activeIndex === i ? 'text-slate-600' : 'text-slate-400'}`}>
            {feature.desc}
          </p>
        </div>
      ))}
    </div>
  );
};

const StoryHero: React.FC = () => {
  const { navigateTo } = useNavigation();
  const [isVisible, setIsVisible] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [activeFeature, setActiveFeature] = useState(0);
  const fullText = 'Turn chaos into clarity.';

  // Animated counters
  const brdCount = useAnimatedCounter(12847, 2500);
  const timesSaved = useAnimatedCounter(94, 2000);
  const satisfactionRate = useAnimatedCounter(98, 2000);

  useEffect(() => {
    setIsVisible(true);
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // Rotate features
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { value: brdCount.count.toLocaleString(), suffix: '+', label: 'BRDs Generated', ref: brdCount.ref, icon: FileText, color: 'from-blue-500 to-indigo-500' },
    { value: timesSaved.count, suffix: '%', label: 'Time Saved', ref: timesSaved.ref, icon: Clock, color: 'from-emerald-500 to-teal-500' },
    { value: satisfactionRate.count, suffix: '%', label: 'Team Satisfaction', ref: satisfactionRate.ref, icon: Star, color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Constellation Background */}
      <div className="absolute inset-0 pointer-events-none">
        <ConstellationBackground />
      </div>

      {/* Animated gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[5%] w-[500px] h-[500px] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
        <div className="absolute top-60 right-[10%] w-[400px] h-[400px] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-[30%] w-[450px] h-[450px] bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000" />
        
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(255,255,255,0.8)_70%)]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        
        {/* Trust bar at top */}
        <div className={`mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <TrustBar />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center relative">
          {/* Left Content */}
          <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            
            {/* Badge with live indicator */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-100/50 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-700">Live</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">AI-Powered Requirements Engineering</span>
              </div>
            </div>

            {/* Headline with typewriter */}
            <div className="space-y-5">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                <span className="block">Stop losing context.</span>
                <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x">
                  {typedText}
                  <span className="animate-pulse text-indigo-600">|</span>
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-600 max-w-xl leading-relaxed">
                Your meetings, emails, and docs contain everything you need for a perfect BRD. 
                Our <span className="font-semibold text-slate-800">AI Agent</span> connects the dots, so you can focus on building what matters.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="group gap-3 px-8 h-14 text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/35 transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 relative overflow-hidden"
                onClick={() => navigateTo('onboarding')}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Building Your BRD
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2 px-8 h-14 text-lg hover:bg-white/80 backdrop-blur-sm border-2 border-slate-200 hover:border-slate-300 group"
                onClick={() => document.getElementById('transformation')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Play className="h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform" />
                See How It Works
              </Button>
            </div>

            {/* Trust indicators with icons */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2">
              {[
                { icon: CheckCircle2, text: 'No credit card required' },
                { icon: Zap, text: 'Setup in 5 minutes' },
                { icon: Users, text: 'Join 2,500+ teams' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-600 text-sm group">
                  <item.icon className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="group-hover:text-slate-800 transition-colors">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Rotating Feature Cards */}
            <RotatingFeatures activeIndex={activeFeature} />
          </div>

          {/* Right Visual - AI Terminal Demo */}
          <div className={`relative transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <AITerminalDemo />
            
            {/* Floating notification cards */}
            <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-3 border border-emerald-100 animate-float z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Conflict Resolved</div>
                  <div className="text-[10px] text-slate-500">OAuth providers clarified</div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-3 border border-blue-100 animate-float-delayed z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">AI Insight</div>
                  <div className="text-[10px] text-slate-500">3 edge cases detected</div>
                </div>
              </div>
            </div>

            {/* Decorative glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl -z-10" />
          </div>

          {/* Live Activity Feed */}
          <LiveActivityFeed />
        </div>

        {/* Animated Stats Bar */}
        <div className={`mt-20 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white/60 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {stats.map((stat, i) => (
                <div 
                  key={i} 
                  ref={stat.ref}
                  className="text-center group cursor-default"
                >
                  <div className="flex justify-center mb-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-300">
                    {stat.value}{stat.suffix}
                  </div>
                  <div className="text-slate-600 mt-2 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block">
        <div className="w-6 h-10 rounded-full border-2 border-slate-300 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-slate-400 rounded-full animate-scroll-indicator" />
        </div>
      </div>
    </section>
  );
};

export default StoryHero;
