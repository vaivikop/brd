import React from 'react';
import FeatureGrid from './FeatureGrid';

const Features: React.FC = () => {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Built for Trust & Transparency</h2>
          <p className="text-lg text-slate-600">
            AI shouldn't be a black box, especially for critical business requirements. 
            We prioritize traceability and human-in-the-loop validation.
          </p>
        </div>
        <FeatureGrid />
      </div>
    </section>
  );
};

export default Features;