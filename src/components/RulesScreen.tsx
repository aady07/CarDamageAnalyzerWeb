import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Camera, Car, Clock, AlertTriangle, CheckCircle, User } from 'lucide-react';
// UploadLimitsDisplay and useUploadLimitsContext removed in SDK mode

interface RulesScreenProps {
  onStart: (vehicleDetails: { make: string; model: string; regNumber: string }) => void;
  onBack: () => void;
}

const RulesScreen: React.FC<RulesScreenProps> = ({ onStart, onBack }) => {
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  // Upload limits check removed in SDK mode
  const rules = [
    {
      icon: Camera,
      title: 'Camera Setup',
      description: 'Ensure good lighting and stable camera position for accurate analysis',
      color: 'text-blue-400'
    },
    {
      icon: Car,
      title: 'Vehicle Positioning',
      description: 'Position your vehicle in an open area with clear visibility of all sides',
      color: 'text-green-400'
    },
    {
      icon: Clock,
      title: 'Recording Time',
      description: 'Each position takes 5-15 seconds. Total analysis time: 2-3 minutes',
      color: 'text-yellow-400'
    },
    {
      icon: Shield,
      title: 'Safety First',
      description: 'Stay in a safe location while recording. Don\'t record while driving',
      color: 'text-red-400'
    },
    {
      icon: CheckCircle,
      title: 'Follow Instructions',
      description: 'Follow the AI-guided instructions for accurate damage assessment',
      color: 'text-purple-400'
    }
  ];

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-4 md:p-6 pt-8 md:pt-12"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowRight className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
        </motion.button>
        <h1 className="text-lg md:text-xl font-bold text-white">Analysis Rules</h1>
        <div className="w-8 h-8 md:w-10 md:h-10" />
      </motion.div>

      <div className="px-4 md:px-6 pb-16 md:pb-20">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-6 md:mb-8"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
            <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Before We Begin</h2>
          <p className="text-gray-400 text-sm md:text-lg">
            Follow these guidelines for the best damage analysis results
          </p>
        </motion.div>

        {/* Rules List */}
        <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
          {rules.map((rule, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="glass-effect rounded-xl md:rounded-2xl p-4 md:p-6"
            >
              <div className="flex items-start">
                <div className={`w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-full flex items-center justify-center mr-3 md:mr-4 flex-shrink-0`}>
                  <rule.icon className={`w-5 h-5 md:w-6 md:h-6 ${rule.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm md:text-lg font-bold ${rule.color} mb-1 md:mb-2`}>{rule.title}</h3>
                  <p className="text-gray-300 text-xs md:text-sm leading-relaxed">{rule.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Upload Limits Display - Removed in SDK mode */}


        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowVehicleForm(true)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:from-blue-600 hover:to-purple-700"
          >
            <Camera className="w-5 h-5" />
            Start recording with AI analysis
          </motion.button>
          
          {/* Upload limit warning - Removed in SDK mode */}
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="w-full bg-white/10 border border-white/20 text-white font-semibold py-4 px-6 rounded-2xl"
          >
            Go Back
          </motion.button>
        </motion.div>

        {/* Vehicle Details Modal */}
        {showVehicleForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-effect rounded-2xl p-6 w-full max-w-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold">Vehicle Information</h2>
                  <p className="text-gray-400 text-sm">Please provide your vehicle details to begin analysis.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-1">
                  <label className="block text-gray-300 text-sm mb-2">Make *</label>
                  <input
                    type="text"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g., Toyota"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-gray-300 text-sm mb-2">Model *</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g., Corolla"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-gray-300 text-sm mb-2">Registration No.</label>
                  <input
                    type="text"
                    value={vehicleRegNumber}
                    onChange={(e) => setVehicleRegNumber(e.target.value)}
                    placeholder="e.g., MH 12 AB 1234"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowVehicleForm(false)}
                  className="px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20"
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (vehicleMake.trim() && vehicleModel.trim()) {
                      // Clear previous assessment data to prevent mixing old and new claim IDs
                      try {
                        localStorage.removeItem('claimsByPosition');
                        localStorage.removeItem('recentClaimIds');
                      } catch (error) {
                      }
                      onStart({ make: vehicleMake, model: vehicleModel, regNumber: vehicleRegNumber });
                    }
                  }}
                  disabled={!vehicleMake.trim() || !vehicleModel.trim()}
                  className={`px-5 py-3 rounded-xl font-semibold ${
                    !vehicleMake.trim() || !vehicleModel.trim()
                      ? 'bg-blue-500/40 text-white/60 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  Start AI Analysis
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RulesScreen;
