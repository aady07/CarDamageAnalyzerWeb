import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, UserPlus, X, Crown, Car, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import {
  getClientUsers,
  addHeadUser,
  addDriverUser,
  removeHeadUser,
  removeDriverUser,
  ClientUsersResponse
} from '../../services/api/adminService';
import AddUserModal from './AddUserModal';
import ConfirmationDialog from './ConfirmationDialog';

interface ManageClientUsersProps {
  clientName: string;
  onBack: () => void;
}

const ManageClientUsers: React.FC<ManageClientUsersProps> = ({ clientName, onBack }) => {
  const [headUsers, setHeadUsers] = useState<string[]>([]);
  const [driverUsers, setDriverUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showAddHeadModal, setShowAddHeadModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [removeUserId, setRemoveUserId] = useState<{ userId: string; type: 'head' | 'driver' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [clientName]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getClientUsers(clientName);
      setHeadUsers(response.headUsers);
      setDriverUsers(response.driverUsers);
    } catch (err: any) {
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userId: string, userType: 'head' | 'driver') => {
    try {
      if (userType === 'head') {
        await addHeadUser(clientName, userId);
        setSuccessMessage(`User '${userId}' added as head user`);
      } else {
        await addDriverUser(clientName, userId);
        setSuccessMessage(`User '${userId}' added as driver user`);
      }
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to add user');
    }
  };

  const handleRemoveUser = async () => {
    if (!removeUserId) return;

    try {
      setActionLoading(removeUserId.userId);
      if (removeUserId.type === 'head') {
        await removeHeadUser(clientName, removeUserId.userId);
        setSuccessMessage(`Head user '${removeUserId.userId}' removed`);
      } else {
        await removeDriverUser(clientName, removeUserId.userId);
        setSuccessMessage(`Driver user '${removeUserId.userId}' removed`);
      }
      await fetchUsers();
      setRemoveUserId(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to remove user');
      setRemoveUserId(null);
    } finally {
      setActionLoading(null);
    }
  };

  const UserList = ({ users, type }: { users: string[]; type: 'head' | 'driver' }) => (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {type === 'head' ? (
              <Crown className="w-5 h-5 text-yellow-400" />
            ) : (
              <Car className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="text-lg font-bold text-white">
              {type === 'head' ? 'Head Users' : 'Driver Users'} ({users.length})
            </h3>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => type === 'head' ? setShowAddHeadModal(true) : setShowAddDriverModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add {type === 'head' ? 'Head' : 'Driver'} User
          </motion.button>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {type === 'head' ? 'Can access dashboard' : 'Can create inspections'}
        </p>
      </div>
      <div className="divide-y divide-white/10">
        {users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No {type === 'head' ? 'head' : 'driver'} users added yet
          </div>
        ) : (
          users.map((userId) => (
            <div
              key={userId}
              className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="text-white font-medium">{userId}</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRemoveUserId({ userId, type })}
                disabled={actionLoading === userId}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-1.5 px-3 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === userId ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                Remove
              </motion.button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="mb-4 w-10 h-10 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Manage Users: {clientName}
        </h1>
        <p className="text-gray-400">Add or remove head and driver users for this client</p>
      </div>

      {/* Messages */}
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

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="space-y-6">
          <UserList users={headUsers} type="head" />
          <UserList users={driverUsers} type="driver" />
        </div>
      )}

      {/* Modals */}
      <AddUserModal
        isOpen={showAddHeadModal}
        onClose={() => setShowAddHeadModal(false)}
        onAdd={handleAddUser}
        clientName={clientName}
        userType="head"
        title={`Add Head User to ${clientName}`}
      />

      <AddUserModal
        isOpen={showAddDriverModal}
        onClose={() => setShowAddDriverModal(false)}
        onAdd={handleAddUser}
        clientName={clientName}
        userType="driver"
        title={`Add Driver User to ${clientName}`}
      />

      <ConfirmationDialog
        isOpen={!!removeUserId}
        onClose={() => setRemoveUserId(null)}
        onConfirm={handleRemoveUser}
        title="Remove User"
        message={`Are you sure you want to remove ${removeUserId?.type === 'head' ? 'head' : 'driver'} user '${removeUserId?.userId}' from ${clientName}?`}
        confirmText="Remove"
        loading={!!actionLoading}
        variant="danger"
      />
    </div>
  );
};

export default ManageClientUsers;
