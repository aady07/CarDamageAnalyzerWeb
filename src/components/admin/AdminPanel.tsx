import React, { useState } from 'react';
import AdminPanelLayout, { AdminPanelView } from './AdminPanelLayout';
import ClientManagement from './ClientManagement';
import AdminManagement from './AdminManagement';
import InspectionManagement from './InspectionManagement';

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [currentView, setCurrentView] = useState<AdminPanelView>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="min-h-screen bg-black p-4 md:p-8">
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-400">Welcome to the SwiftClaim Admin Panel</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
                <h3 className="text-lg font-bold text-white mb-2">Quick Actions</h3>
                <p className="text-gray-400 text-sm">Manage clients, users, and inspections</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
                <h3 className="text-lg font-bold text-white mb-2">System Status</h3>
                <p className="text-gray-400 text-sm">All systems operational</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
                <h3 className="text-lg font-bold text-white mb-2">Recent Activity</h3>
                <p className="text-gray-400 text-sm">View recent admin actions</p>
              </div>
            </div>
          </div>
        );
      case 'clients':
        return <ClientManagement onBack={onBack} />;
      case 'admins':
        return <AdminManagement onBack={onBack} />;
      case 'inspections':
        return <InspectionManagement onBack={onBack} />;
      default:
        return null;
    }
  };

  return (
    <AdminPanelLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      onBack={onBack}
    >
      {renderView()}
    </AdminPanelLayout>
  );
};

export default AdminPanel;
