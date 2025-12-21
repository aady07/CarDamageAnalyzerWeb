import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Loader } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (userId: string, userType: 'head' | 'driver') => Promise<void>;
  clientName?: string;
  userType?: 'head' | 'driver';
  title?: string;
}

const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  clientName,
  userType: initialUserType,
  title
}) => {
  const [userId, setUserId] = useState('');
  const [selectedUserType, setSelectedUserType] = useState<'head' | 'driver'>(initialUserType || 'head');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onAdd(userId.trim(), selectedUserType);
      setUserId('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUserId('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl w-full max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {title || `Add User${clientName ? ` to ${clientName}` : ''}`}
                </h2>
                <p className="text-sm text-gray-400">Enter user ID to add</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* User Type Selection */}
            {!initialUserType && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Select User Type:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="userType"
                      value="head"
                      checked={selectedUserType === 'head'}
                      onChange={() => setSelectedUserType('head')}
                      disabled={loading}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Head User</div>
                      <div className="text-sm text-gray-400">Can access dashboard</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="userType"
                      value="driver"
                      checked={selectedUserType === 'driver'}
                      onChange={() => setSelectedUserType('driver')}
                      disabled={loading}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Driver User</div>
                      <div className="text-sm text-gray-400">Can create inspections</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* User ID Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Enter User ID:
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError('');
                }}
                disabled={loading}
                placeholder="Enter user ID"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !userId.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Add User
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddUserModal;
