import React from 'react';
import Tooltip from './Tooltip';
import { 
  AnimDashboard,
  AnimData,
  AnimTarget,
  AnimInsights,
  AnimDocGen,
  AnimEditing,
  AnimGraph,
  AnimReview
} from './AnimatedIcons';

interface StepProps {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  stepNumber: number;
  tooltipText: string;
}

const StepCard: React.FC<StepProps> = ({ icon: Icon, title, description, color, stepNumber, tooltipText }) => (
  <Tooltip content={tooltipText}>
    <div className="group relative bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 h-full flex flex-col">
      <div className={`absolute -top-4 -right-4 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg transform group-hover:scale-110 transition-transform ${color}`}>
        {stepNumber}
      </div>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${color.replace('bg-', 'bg-opacity-10 text-')} group-hover:bg-opacity-20`}>
        <Icon className={`h-8 w-8 ${color.replace('bg-', 'text-')}`} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-base text-slate-600 leading-relaxed flex-grow">{description}</p>
    </div>
  </Tooltip>
);

const ProcessFlow: React.FC = () => {
  const steps = [
    {
      icon: AnimDashboard,
      title: "Project Dashboard",
      description: "Central hub for project health, task tracking, and real-time alerts.",
      color: "bg-blue-500",
      tooltipText: "View active projects, outstanding blockers, and recent activity."
    },
    {
      icon: AnimData,
      title: "Data Sources",
      description: "Connect emails, Slack, transcripts, and docs as raw context.",
      color: "bg-indigo-500",
      tooltipText: "Integrates with G-Suite, Slack, Jira, and Office 365."
    },
    {
      icon: AnimTarget,
      title: "Context & Scope",
      description: "AI extracts boundaries, identifying in-scope vs out-of-scope.",
      color: "bg-violet-500",
      tooltipText: "Auto-tags requirements based on initial project charter."
    },
    {
      icon: AnimInsights,
      title: "Insights Review",
      description: "Review extracted requirements and confidence levels.",
      color: "bg-purple-500",
      tooltipText: "Approve or reject AI suggestions before document generation."
    },
    {
      icon: AnimDocGen,
      title: "BRD Generation",
      description: "Draft a structured document with Functional requirements.",
      color: "bg-fuchsia-500",
      tooltipText: "Generates industry-standard BRD structure (IEEE 830 compliant)."
    },
    {
      icon: AnimEditing,
      title: "Natural Editing",
      description: "Refine using plain English commands like 'Make it stricter'.",
      color: "bg-pink-500",
      tooltipText: "Conversational editing engine modifies specific sections instantly."
    },
    {
      icon: AnimGraph,
      title: "Graph View",
      description: "Visualize relationships between requirements and goals.",
      color: "bg-rose-500",
      tooltipText: "Interactive node graph showing dependencies and conflicts."
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-slate-50 relative">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <span className="text-blue-600 font-semibold tracking-wide uppercase text-sm">Workflow</span>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-2 mb-6">From Chaos to Clarity</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Our agent guides you through a structured 7-step journey, ensuring no detail is lost and every requirement is fully traceable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <StepCard 
              key={index}
              {...step}
              stepNumber={index + 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessFlow;