import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type View = 'landing' | 'onboarding' | 'dashboard';

interface NavigationContextType {
  currentView: View;
  navigateTo: (view: View) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const STORAGE_KEY = 'clarityai_navigation_view';
const PROJECT_KEY = 'clarityai_project';

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<View>(() => {
    // Check if there's a saved view
    const savedView = localStorage.getItem(STORAGE_KEY) as View | null;
    // Check if there's a project (we check for the key existence)
    const hasProject = localStorage.getItem(PROJECT_KEY) !== null;
    
    // If there's a project, go to dashboard; otherwise use saved view or landing
    if (hasProject && savedView === 'dashboard') {
      return 'dashboard';
    }
    return savedView || 'landing';
  });

  const navigateTo = (view: View) => {
    setCurrentView(view);
    localStorage.setItem(STORAGE_KEY, view);
    window.scrollTo(0, 0);
  };

  // Also check on mount if IndexedDB has project data
  useEffect(() => {
    const checkForProject = async () => {
      try {
        const request = indexedDB.open('ClarityAI_BRD', 1);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['projects'], 'readonly');
          const store = transaction.objectStore('projects');
          const getRequest = store.get('main');
          getRequest.onsuccess = () => {
            if (getRequest.result && currentView === 'landing') {
              // Project exists, redirect to dashboard
              setCurrentView('dashboard');
              localStorage.setItem(STORAGE_KEY, 'dashboard');
            }
          };
        };
      } catch (e) {
        // Ignore errors - just stay on current view
      }
    };
    checkForProject();
  }, []);

  return (
    <NavigationContext.Provider value={{ currentView, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};