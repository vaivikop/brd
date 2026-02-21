import React, { useEffect, useRef, useState } from 'react';
import { Star, Quote, TrendingUp, Clock, Target, Users, Building2, Sparkles } from 'lucide-react';

const SocialProof: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
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

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isVisible]);

  const stats = [
    { 
      value: "10x", 
      label: "Faster Documentation",
      description: "Average time saved per BRD",
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500"
    },
    { 
      value: "85%", 
      label: "Less Rework",
      description: "Reduction in requirement changes",
      icon: Target,
      gradient: "from-emerald-500 to-teal-500"
    },
    { 
      value: "3hrs", 
      label: "Saved Weekly",
      description: "Per product manager",
      icon: Clock,
      gradient: "from-purple-500 to-pink-500"
    },
    { 
      value: "2,500+", 
      label: "BRDs Generated",
      description: "And counting",
      icon: Sparkles,
      gradient: "from-orange-500 to-amber-500"
    },
  ];

  const testimonials = [
    {
      quote: "ClarityAI turned our 2-week BRD process into a 2-hour workflow. The traceability feature alone saved us countless hours of back-and-forth with stakeholders.",
      author: "Sarah Chen",
      role: "Head of Product",
      company: "TechFlow Inc.",
      avatar: "SC",
      avatarBg: "bg-gradient-to-r from-blue-500 to-cyan-500",
      rating: 5
    },
    {
      quote: "Finally, a tool that understands that requirements live in conversations, not spreadsheets. The AI's ability to detect conflicting requirements has been a game-changer.",
      author: "Marcus Rodriguez",
      role: "Senior PM",
      company: "ScaleUp Solutions",
      avatar: "MR",
      avatarBg: "bg-gradient-to-r from-purple-500 to-pink-500",
      rating: 5
    },
    {
      quote: "Our engineering team used to complain about vague requirements constantly. Since implementing ClarityAI, requirement clarity has improved by 90%.",
      author: "Emily Watson",
      role: "VP Engineering",
      company: "CloudBase",
      avatar: "EW",
      avatarBg: "bg-gradient-to-r from-emerald-500 to-teal-500",
      rating: 5
    },
    {
      quote: "The confidence scoring feature is brilliant. We now know exactly which requirements need more clarification before development starts.",
      author: "David Kim",
      role: "Product Lead",
      company: "InnovateCo",
      avatar: "DK",
      avatarBg: "bg-gradient-to-r from-orange-500 to-amber-500",
      rating: 5
    }
  ];

  const companies = [
    "TechFlow", "ScaleUp", "CloudBase", "InnovateCo", "DataSync", "NextGen"
  ];

  return (
    <section 
      ref={sectionRef}
      id="social-proof"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-blue-400 text-sm font-semibold mb-6 backdrop-blur-sm">
            <Users className="h-4 w-4" />
            Trusted by Teams Everywhere
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
            Join <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">2,500+</span> Teams Already Building Better
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            See why product teams are switching to AI-powered requirements engineering.
          </p>
        </div>

        {/* Stats grid */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {stats.map((stat, i) => (
            <div 
              key={i}
              className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              
              {/* Value */}
              <div className={`text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient} mb-1`}>
                {stat.value}
              </div>
              
              {/* Label */}
              <div className="text-white font-semibold mb-1">{stat.label}</div>
              <div className="text-sm text-slate-400">{stat.description}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className={`mb-16 transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Main testimonial */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -top-8 -left-8 text-blue-500/20">
              <Quote className="h-24 w-24" />
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 lg:p-12 border border-white/10 relative overflow-hidden">
              {/* Active testimonial */}
              <div className="relative z-10">
                {testimonials.map((testimonial, i) => (
                  <div 
                    key={i}
                    className={`transition-all duration-500 ${
                      activeTestimonial === i 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'
                    }`}
                  >
                    {/* Stars */}
                    <div className="flex gap-1 mb-6">
                      {[...Array(testimonial.rating)].map((_, si) => (
                        <Star key={si} className="h-5 w-5 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    
                    {/* Quote */}
                    <blockquote className="text-xl lg:text-2xl text-white font-medium leading-relaxed mb-8">
                      "{testimonial.quote}"
                    </blockquote>
                    
                    {/* Author */}
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full ${testimonial.avatarBg} flex items-center justify-center text-white font-bold text-lg`}>
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{testimonial.author}</div>
                        <div className="text-slate-400 text-sm">{testimonial.role} at {testimonial.company}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Background gradient */}
              <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${testimonials[activeTestimonial].avatarBg} transition-all duration-500`} />
            </div>

            {/* Testimonial nav dots */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    activeTestimonial === i 
                      ? 'bg-blue-500 w-8' 
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Company logos */}
        <div className={`transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-center text-slate-500 text-sm mb-8 uppercase tracking-wider font-medium">
            Trusted by innovative teams at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
            {companies.map((company, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors group"
              >
                <Building2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-semibold">{company}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
