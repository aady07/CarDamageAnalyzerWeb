import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  FileText, 
  Menu, 
  X,
  ChevronRight 
} from 'lucide-react';

export type AdminPanelView = 'dashboard' | 'clients' | 'admins' | 'inspections';

interface AdminPanelLayoutProps {
  currentView: AdminPanelView;
  onViewChange: (view: AdminPanelView) => void;
  children: React.ReactNode;
  onBack: () => void;
}

const AdminPanelLayout: React.FC<AdminPanelLayoutProps> = ({
  currentView,
  onViewChange,
  children,
  onBack
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard' as AdminPanelView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients' as AdminPanelView, label: 'Client Management', icon: Users },
    { id: 'admins' as AdminPanelView, label: 'Admin Management', icon: Shield },
    { id: 'inspections' as AdminPanelView, label: 'Inspection Management', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: sidebarOpen ? 0 : -280 }}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white/5 backdrop-blur-lg border-r border-white/10 transition-transform duration-300`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">Admin Panel</h2>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </motion.button>
              );
            })}
          </nav>

          {/* Back Button */}
          <div className="p-4 border-t border-white/10">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBack}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span className="font-medium">Back to App</span>
            </motion.button>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Sidebar Toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-30 md:hidden w-10 h-10 bg-white/10 backdrop-blur-lg rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminPanelLayout;
