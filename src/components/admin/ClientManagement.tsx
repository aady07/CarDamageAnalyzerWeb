import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, ArrowRight, Loader, AlertCircle } from 'lucide-react';
import { getAllClients, Client } from '../../services/api/adminService';
import ManageClientUsers from './ManageClientUsers';

interface ClientManagementProps {
  onBack: () => void;
}

const ClientManagement: React.FC<ClientManagementProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAllClients();
      setClients(response.clients);
    } catch (err: any) {
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (selectedClient) {
    return (
      <ManageClientUsers
        clientName={selectedClient}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-400" />
          Client Management
        </h1>
        <p className="text-gray-400">Manage clients and their users</p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : clients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border border-white/20"
        >
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Clients Found</h3>
          <p className="text-gray-400">No clients have been registered yet.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {clients.map((client, index) => (
            <motion.div
              key={client.clientName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 hover:border-white/30 transition-all duration-200 cursor-pointer group"
              onClick={() => setSelectedClient(client.clientName)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-3">{client.clientName}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Head Users:</span>
                        <span className="text-white font-semibold">{client.headUsersCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Driver Users:</span>
                        <span className="text-white font-semibold">{client.driverUsersCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm pt-2 border-t border-white/10">
                        <span className="text-gray-400">Total Users:</span>
                        <span className="text-blue-400 font-semibold">{client.totalUsersCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Manage Users</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientManagement;
