import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProcessFlow from './components/ProcessFlow';
import ConfidenceEngine from './components/ConfidenceEngine';
import Features from './components/Features';
import Footer from './components/Footer';
import OnboardingFlow from './components/OnboardingFlow';
import DashboardLayout from './components/DashboardLayout';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { ToastProvider } from './context/ToastContext';

const AppContent: React.FC = () => {
  const { currentView } = useNavigation();

  if (currentView === 'onboarding') {
    return <OnboardingFlow />;
  }

  if (currentView === 'dashboard') {
    return <DashboardLayout />;
  }

  return (
    <div className="min-h-screen flex flex-col animate-in fade-in duration-500">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <ProcessFlow />
        <ConfidenceEngine />
        <Features />
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </ToastProvider>
  );
};

export default App;