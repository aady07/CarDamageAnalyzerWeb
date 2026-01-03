import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, UserPlus, X, Loader, AlertCircle, CheckCircle, Users } from 'lucide-react';
import {
  getInspectionDashboardUsers,
  addInspectionDashboardUser,
  removeInspectionDashboardUser,
  InspectionDashboardUser
} from '../../services/api/adminService';
import { useCognitoAuth } from '../../hooks/useCognitoAuth';
import ConfirmationDialog from './ConfirmationDialog';

interface InspectionDashboardManagementProps {
  onBack: () => void;
}

const InspectionDashboardManagement: React.FC<InspectionDashboardManagementProps> = ({ onBack }) => {
  const { getUserId } = useCognitoAuth();
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [users, setUsers] = useState<InspectionDashboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    const userId = getUserId();
    setCurrentUserId(userId || '');
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getInspectionDashboardUsers();
      setUsers(response.users);
    } catch (err: any) {
      setError('Failed to load dashboard users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserId.trim()) return;

    try {
      setAddingUser(true);
      setError('');
      await addInspectionDashboardUser(newUserId.trim());
      setSuccessMessage(`User '${newUserId.trim()}' has been added to inspection dashboard`);
      setNewUserId('');
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to add user to dashboard');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!removeUserId) return;

    try {
      setActionLoading(removeUserId);
      await removeInspectionDashboardUser(removeUserId);
      setSuccessMessage(`User '${removeUserId}' has been removed from inspection dashboard`);
      await fetchUsers();
      setRemoveUserId(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to remove user from dashboard');
      setRemoveUserId(null);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Eye className="w-8 h-8 text-blue-400" />
          Inspection Dashboard Management
        </h1>
        <p className="text-gray-400">Manage users who have access to the inspection dashboard</p>
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

      {/* Current Users */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Dashboard Users ({users.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No users have access to the inspection dashboard yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">User ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Added At</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => {
                      const isCurrentUser = user.userId === currentUserId;
                      return (
                        <tr key={`user-${user.userId}-${index}`} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="flex items-center gap-2">
                              {user.userId}
                              {isCurrentUser && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">You</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {formatDate(user.addedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setRemoveUserId(user.userId)}
                              disabled={!!actionLoading}
                              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-1.5 px-3 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {actionLoading === user.userId ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              Remove
                            </motion.button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add New User */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-green-400" />
          Add User to Dashboard
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Enter a user ID to grant them access to the inspection dashboard. They will be able to view and inspect pending images.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="Enter user ID"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 focus:outline-none"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddUser}
            disabled={!newUserId.trim() || addingUser}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingUser ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Add User
              </>
            )}
          </motion.button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!removeUserId}
        onClose={() => setRemoveUserId(null)}
        onConfirm={handleRemoveUser}
        title="Remove Dashboard Access"
        message={`Are you sure you want to remove inspection dashboard access from '${removeUserId}'?`}
        confirmText="Remove"
        loading={!!actionLoading}
        variant="danger"
      />
    </div>
  );
};

export default InspectionDashboardManagement;

