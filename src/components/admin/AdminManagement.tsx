import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, UserPlus, X, Loader, AlertCircle, CheckCircle, Crown } from 'lucide-react';
import {
  getAllAdmins,
  makeUserAdmin,
  removeAdminAccess,
  AdminUser
} from '../../services/api/adminService';
import { useCognitoAuth } from '../../hooks/useCognitoAuth';
import ConfirmationDialog from './ConfirmationDialog';

interface AdminManagementProps {
  onBack: () => void;
}

const AdminManagement: React.FC<AdminManagementProps> = ({ onBack }) => {
  const { getUserId } = useCognitoAuth();
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    const userId = getUserId();
    setCurrentUserId(userId || '');
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAllAdmins();
      setAdmins(response.admins);
    } catch (err: any) {
      setError('Failed to load admins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminUserId.trim()) return;

    try {
      setAddingAdmin(true);
      setError('');
      await makeUserAdmin(newAdminUserId.trim());
      setSuccessMessage(`User '${newAdminUserId.trim()}' is now an admin`);
      setNewAdminUserId('');
      await fetchAdmins();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to make user admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeUserId) return;

    try {
      setActionLoading(removeUserId);
      await removeAdminAccess(removeUserId);
      setSuccessMessage(`Admin access removed from '${removeUserId}'`);
      await fetchAdmins();
      setRemoveUserId(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to remove admin access');
      setRemoveUserId(null);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-400" />
          Admin Management
        </h1>
        <p className="text-gray-400">Manage admin users and permissions</p>
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

      {/* Current Admins */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">
            Current Admins ({admins.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {admins.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No admins found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">User ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Tier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => {
                      const isCurrentUser = admin.userId === currentUserId;
                      return (
                        <tr key={admin.userId} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="flex items-center gap-2">
                              {admin.userId}
                              {isCurrentUser && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">You</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{admin.userRole}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              admin.userTier === 'PREMIUM'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}>
                              {admin.userTier}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isCurrentUser ? (
                              <span className="text-xs text-gray-500">Cannot remove yourself</span>
                            ) : (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setRemoveUserId(admin.userId)}
                                disabled={!!actionLoading}
                                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-1.5 px-3 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {actionLoading === admin.userId ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                                Remove
                              </motion.button>
                            )}
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

      {/* Make New Admin */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          Make New Admin
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newAdminUserId}
            onChange={(e) => setNewAdminUserId(e.target.value)}
            placeholder="Enter user ID"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 focus:outline-none"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddAdmin}
            disabled={!newAdminUserId.trim() || addingAdmin}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingAdmin ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Make Admin
              </>
            )}
          </motion.button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!removeUserId}
        onClose={() => setRemoveUserId(null)}
        onConfirm={handleRemoveAdmin}
        title="Remove Admin Access"
        message={`Are you sure you want to remove admin access from '${removeUserId}'?`}
        confirmText="Remove"
        loading={!!actionLoading}
        variant="danger"
      />
    </div>
  );
};

export default AdminManagement;
