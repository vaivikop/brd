import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, RefreshCw, ShieldAlert } from 'lucide-react';
import Button from './Button';

const ConfidenceEngine: React.FC = () => {
  const [isResolved, setIsResolved] = useState(false);

  return (
    <section id="confidence" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-sm font-medium mb-6">
              <ShieldAlert className="h-4 w-4" />
              Core Feature
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Requirement Confidence & <br /> <span className="text-orange-500">Action Engine</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Not all requirements are created equal. Our engine assigns a confidence score to every extracted requirement based on source clarity and consensus.
            </p>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <div className="mt-1 bg-red-100 p-1 rounded text-red-600">
                   <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Auto-Flag Ambiguity</h4>
                  <p className="text-slate-600 text-sm">Low-confidence items automatically become "Action Items" on your dashboard.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 bg-emerald-100 p-1 rounded text-emerald-600">
                   <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Traceability Back to Source</h4>
                  <p className="text-slate-600 text-sm">Click any requirement to see the exact email or transcript snippet that generated it.</p>
                </div>
              </li>
            </ul>
            <Button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore the Engine <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Right Interactive Example */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-50 to-blue-50 rounded-3xl -rotate-2 transform scale-105 -z-10"></div>
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 md:p-8">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Requirement #1042</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold transition-colors duration-500 ${isResolved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {isResolved ? 'HIGH CONFIDENCE (98%)' : 'LOW CONFIDENCE (32%)'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                  <p className="text-slate-900 font-medium mt-1">
                    "The system should support user authentication via social providers."
                  </p>
                </div>

                <div className={`p-4 rounded-lg border transition-all duration-500 ${isResolved ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="flex items-start gap-3">
                    {isResolved ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <h4 className={`text-sm font-bold ${isResolved ? 'text-emerald-800' : 'text-red-800'}`}>
                        {isResolved ? 'Ambiguity Resolved' : 'Ambiguity Detected'}
                      </h4>
                      <p className={`text-xs mt-1 ${isResolved ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isResolved 
                          ? 'Stakeholder clarified: "Only Google and GitHub OAuth required."' 
                          : 'Source conflict: Meeting A mentions "Google Only", Email B mentions "All Socials".'}
                      </p>
                    </div>
                  </div>
                </div>

                {!isResolved && (
                  <div className="pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <p className="text-xs text-slate-500 mb-3 text-center">See how the AI Agent resolves conflicts:</p>
                    <button 
                      onClick={() => setIsResolved(true)}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      <RefreshCw className="h-4 w-4" /> Resolve Conflict via Agent
                    </button>
                  </div>
                )}

                {isResolved && (
                  <div className="pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button 
                      onClick={() => setIsResolved(false)}
                      className="w-full py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      Reset Example
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ConfidenceEngine;