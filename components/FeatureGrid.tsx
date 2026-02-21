import React from 'react';
import { 
  GitBranch, 
  Search, 
  Lock, 
  Zap, 
  Users, 
  BarChart3 
} from 'lucide-react';

const FeatureGrid: React.FC = () => {
  const features = [
    {
      icon: Search,
      title: "Full Explainability",
      description: "Every sentence in your BRD links back to the original audio timestamp or email thread."
    },
    {
      icon: GitBranch,
      title: "Living Documents",
      description: "Requirements evolve. Our version control tracks changes and notifies stakeholders."
    },
    {
      icon: Lock,
      title: "Enterprise Grade",
      description: "SOC2 compliant data handling. Your business secrets never train public models."
    },
    {
      icon: Zap,
      title: "Instant Gap Analysis",
      description: "The agent proactively spots missing edge cases (e.g., 'What happens if the user goes offline?')."
    },
    {
      icon: Users,
      title: "Collaborative Editing",
      description: "Product Managers and Developers can comment and refine sections in real-time."
    },
    {
      icon: BarChart3,
      title: "Visual Maps",
      description: "Auto-generated dependency graphs help you catch bottlenecks before development starts."
    }
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
      {features.map((feature, idx) => (
        <div key={idx} className="p-6 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md transition-all duration-300">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-600">
            <feature.icon className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
        </div>
      ))}
    </div>
  );
};

export default FeatureGrid;