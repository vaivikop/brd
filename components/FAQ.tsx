import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, HelpCircle, MessageCircle } from 'lucide-react';
import Button from './Button';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
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

  const faqs: FAQItem[] = [
    {
      question: "How does ClarityAI extract requirements from conversations?",
      answer: "Our AI agent uses advanced natural language processing to analyze meeting transcripts, emails, and documents. It identifies requirement patterns, stakeholder preferences, and decision points, then structures them into a standardized BRD format while maintaining full traceability to the source material.",
      category: "product"
    },
    {
      question: "What file formats and integrations do you support?",
      answer: "We support audio files (MP3, WAV, M4A), video files (MP4, MOV), text documents (PDF, DOCX, TXT), and direct integrations with Slack, Gmail, Google Meet, Zoom, Microsoft Teams, Jira, and Confluence. If you don't see your tool, let us know - we're constantly adding new integrations.",
      category: "product"
    },
    {
      question: "How accurate is the AI at extracting requirements?",
      answer: "Our AI achieves 92-98% accuracy on requirement extraction, with confidence scores assigned to each item. Lower confidence requirements are automatically flagged for human review. The system learns from your corrections, improving accuracy over time for your specific domain.",
      category: "product"
    },
    {
      question: "Is my data secure? What about confidentiality?",
      answer: "Absolutely. We are SOC2 Type II compliant and GDPR ready. Your data is encrypted at rest and in transit, never used to train public models, and you can delete it anytime. We also offer on-premise deployment for enterprise customers with strict data residency requirements.",
      category: "security"
    },
    {
      question: "Can I edit the generated BRD?",
      answer: "Yes! You can edit using natural language commands like 'Make the authentication requirement stricter' or 'Add rate limiting to the API section.' You can also make direct edits in our visual editor. All changes are tracked with full version history.",
      category: "product"
    },
    {
      question: "What's the pricing model?",
      answer: "We offer a free 14-day trial with full features. Paid plans start at $49/month for individual users, with team and enterprise plans available. All plans include unlimited BRD generation, integrations, and export formats. Contact us for custom enterprise pricing.",
      category: "pricing"
    },
    {
      question: "How long does it take to generate a BRD?",
      answer: "Initial processing typically takes 2-5 minutes depending on the amount of source material. After that, you can review, validate, and refine the generated BRD. Most users complete their first BRD within 30 minutes, compared to days or weeks with traditional methods.",
      category: "product"
    },
    {
      question: "Can multiple team members collaborate on a BRD?",
      answer: "Yes! Our platform supports real-time collaboration. Team members can comment, suggest changes, approve requirements, and track changes. You can also set up approval workflows and stakeholder notifications for enterprise-level coordination.",
      category: "product"
    }
  ];

  const categories = [
    { id: 'all', label: 'All Questions' },
    { id: 'product', label: 'Product' },
    { id: 'security', label: 'Security' },
    { id: 'pricing', label: 'Pricing' },
  ];

  const filteredFaqs = activeCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === activeCategory);

  return (
    <section 
      ref={sectionRef}
      id="faq"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-white via-slate-50 to-white overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-50 rounded-full filter blur-3xl opacity-60" />
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-50 rounded-full filter blur-3xl opacity-60" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section header */}
        <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-6">
            <HelpCircle className="h-4 w-4" />
            Got Questions?
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
            Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Questions</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about ClarityAI and how it can transform your requirements process.
          </p>
        </div>

        {/* Category filters */}
        <div className={`flex flex-wrap justify-center gap-2 mb-10 transition-all duration-1000 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div className={`space-y-4 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {filteredFaqs.map((faq, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl border transition-all duration-300 ${
                openIndex === index 
                  ? 'border-blue-200 shadow-lg shadow-blue-100/50' 
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <span className={`font-semibold pr-4 transition-colors ${
                  openIndex === index ? 'text-blue-600' : 'text-slate-800'
                }`}>
                  {faq.question}
                </span>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  openIndex === index 
                    ? 'bg-blue-100 rotate-180' 
                    : 'bg-slate-100'
                }`}>
                  <ChevronDown className={`h-5 w-5 transition-colors ${
                    openIndex === index ? 'text-blue-600' : 'text-slate-500'
                  }`} />
                </div>
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ${
                openIndex === index ? 'max-h-96' : 'max-h-0'
              }`}>
                <div className="px-6 pb-5">
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-slate-600 leading-relaxed pt-4">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions CTA */}
        <div className={`mt-16 text-center transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 mb-4">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Still have questions?</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Our team is here to help. Schedule a demo or chat with us directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" className="border-2">
                Schedule a Demo
              </Button>
              <Button>
                Chat with Us
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
