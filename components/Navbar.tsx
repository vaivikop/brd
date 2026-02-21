import React, { useState } from 'react';
import { Menu, X, FileText, ChevronDown } from 'lucide-react';
import Button from './Button';
import { useNavigation } from '../context/NavigationContext';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { navigateTo } = useNavigation();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all duration-300">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <div 
            className="flex-shrink-0 flex items-center gap-3 cursor-pointer group"
            onClick={() => navigateTo('landing')}
          >
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform duration-200">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-slate-900">ClarityAI</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            <div className="relative group px-4 py-2">
                <button className="flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors">
                    Product <ChevronDown className="h-4 w-4" />
                </button>
                {/* Mega Menu Dropdown */}
                <div className="absolute top-full left-0 w-64 bg-white border border-slate-100 shadow-xl rounded-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
                    <a href="#transformation" className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                        <div className="text-slate-900 font-semibold text-sm">How it Works</div>
                        <div className="text-slate-500 text-xs mt-1">From chaos to clarity in 4 steps</div>
                    </a>
                    <a href="#confidence" className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                        <div className="text-slate-900 font-semibold text-sm">Confidence Engine</div>
                        <div className="text-slate-500 text-xs mt-1">Trust your requirements</div>
                    </a>
                    <a href="#features" className="block px-4 py-3 hover:bg-slate-50 rounded-lg">
                        <div className="text-slate-900 font-semibold text-sm">Features</div>
                        <div className="text-slate-500 text-xs mt-1">Built for trust & transparency</div>
                    </a>
                </div>
            </div>
            <a href="#problem" className="px-4 py-2 text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors">The Problem</a>
            <a href="#social-proof" className="px-4 py-2 text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors">Testimonials</a>
            <a href="#faq" className="px-4 py-2 text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors">FAQ</a>
          </div>

          {/* Action Buttons */}
          <div className="hidden lg:flex items-center space-x-4 pl-4 border-l border-slate-200">
            <Button variant="ghost" size="sm" className="text-slate-600">Log In</Button>
            <Button 
                size="md" 
                className="shadow-lg shadow-blue-600/20"
                onClick={() => navigateTo('onboarding')}
            >
                Get Started Free
            </Button>
          </div>

          {/* Mobile Toggle */}
          <div className="lg:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600 hover:text-slate-900 p-2">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-200 shadow-lg p-6 flex flex-col space-y-4">
          <a href="#transformation" className="text-slate-600 hover:text-blue-600 font-medium py-2 border-b border-slate-50">How it Works</a>
          <a href="#problem" className="text-slate-600 hover:text-blue-600 font-medium py-2 border-b border-slate-50">The Problem</a>
          <a href="#social-proof" className="text-slate-600 hover:text-blue-600 font-medium py-2 border-b border-slate-50">Testimonials</a>
          <a href="#faq" className="text-slate-600 hover:text-blue-600 font-medium py-2 mb-4">FAQ</a>
          <div className="pt-2 flex flex-col gap-3">
             <Button variant="outline" className="w-full justify-center">Log In</Button>
             <Button className="w-full justify-center" onClick={() => navigateTo('onboarding')}>Get Started Free</Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;