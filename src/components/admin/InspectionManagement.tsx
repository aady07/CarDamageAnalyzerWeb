import React from 'react';
import AdminDashboard from '../AdminDashboard';

interface InspectionManagementProps {
  onBack: () => void;
}

const InspectionManagement: React.FC<InspectionManagementProps> = ({ onBack }) => {
  return <AdminDashboard onBack={onBack} />;
};

export default InspectionManagement;
