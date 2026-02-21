import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles, CheckCircle2, Zap, Clock, Shield } from 'lucide-react';
import Button from './Button';
import { useNavigation } from '../context/NavigationContext';

const FinalCTA: React.FC = () => {
  const { navigateTo } = useNavigation();
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

  const benefits = [
    { icon: Clock, text: "Start in under 2 minutes" },
    { icon: Shield, text: "No credit card required" },
    { icon: Zap, text: "Generate your first BRD today" },
  ];

  return (
    <section 
      ref={sectionRef}
      id="cta"
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating orbs */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full filter blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-400/20 rounded-full filter blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-blue-300/20 rounded-full filter blur-3xl animate-float" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:60px_60px]" />
        
        {/* Sparkle decorations */}
        <div className="absolute top-20 right-1/4 text-white/30 animate-pulse">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="absolute bottom-32 left-1/4 text-white/20 animate-pulse" style={{ animationDelay: '1s' }}>
          <Sparkles className="h-6 w-6" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold mb-8">
            <Sparkles className="h-4 w-4 text-yellow-300" />
            Ready to Transform Your Process?
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white mb-6 leading-tight">
            Stop Writing BRDs.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-200 to-orange-200">
              Start Building Products.
            </span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join thousands of product teams who've already transformed their requirements process. 
            Your first AI-generated BRD is just minutes away.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Button 
              size="lg" 
              className="group gap-3 px-10 h-16 text-lg bg-white text-black hover:bg-blue-50 shadow-2xl shadow-black/20 hover:shadow-black/30 hover:scale-105 transition-all duration-300"
              onClick={() => navigateTo('onboarding')}
            >
              Get Started Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="gap-3 px-10 h-16 text-lg border-2 border-white/30 text-black bg-white/90 hover:bg-white backdrop-blur-sm"
            >
              Watch Demo
            </Button>
          </div>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6">
            {benefits.map((benefit, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 text-blue-100"
              >
                <benefit.icon className="h-5 w-5 text-emerald-300" />
                <span className="text-sm font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial strip */}
        <div className={`mt-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {['SC', 'MR', 'EW', 'DK'].map((initials, i) => (
                    <div
                      key={i}
                      className={`w-10 h-10 rounded-full border-2 border-white/50 flex items-center justify-center text-xs font-bold text-white ${
                        i === 0 ? 'bg-blue-500' :
                        i === 1 ? 'bg-purple-500' :
                        i === 2 ? 'bg-emerald-500' :
                        'bg-orange-500'
                      }`}
                    >
                      {initials}
                    </div>
                  ))}
                  <div className="w-10 h-10 rounded-full border-2 border-white/50 bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                    +2k
                  </div>
                </div>
                <div className="text-white">
                  <div className="font-semibold">Loved by 2,500+ teams</div>
                  <div className="text-blue-200 text-sm">5.0 average rating</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="h-12 w-px bg-white/20 hidden md:block" />
                <div className="flex flex-wrap gap-4">
                  {['SOC2', 'GDPR', '99.9%'].map((badge, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-blue-100 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span>{badge}{i === 2 ? ' uptime' : ' compliant'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final message */}
        <div className={`mt-12 text-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-blue-200 text-sm">
            Questions? <a href="#faq" className="text-white underline underline-offset-4 hover:text-blue-100 transition-colors">Check our FAQ</a> or <a href="#" className="text-white underline underline-offset-4 hover:text-blue-100 transition-colors">chat with us</a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
