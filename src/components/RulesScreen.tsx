import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Camera, Car, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface RulesScreenProps {
  onStart: () => void;
  onBack: () => void;
}

const RulesScreen: React.FC<RulesScreenProps> = ({ onStart, onBack }) => {
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
      description: 'Follow the on-screen stencil guides for accurate damage assessment',
      color: 'text-purple-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-6 pt-12"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </motion.button>
        <h1 className="text-xl font-bold text-white">Analysis Rules</h1>
        <div className="w-10 h-10" />
      </motion.div>

      <div className="px-6 pb-20">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Before We Begin</h2>
          <p className="text-gray-400 text-lg">
            Follow these guidelines for the best damage analysis results
          </p>
        </motion.div>

        {/* Rules List */}
        <div className="space-y-4 mb-8">
          {rules.map((rule, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="glass-effect rounded-2xl p-6"
            >
              <div className="flex items-start">
                <div className={`w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mr-4 flex-shrink-0`}>
                  <rule.icon className={`w-6 h-6 ${rule.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${rule.color} mb-2`}>{rule.title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{rule.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-start">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-yellow-400 font-bold mb-2">Important Notice</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                This analysis is for preliminary assessment only. For accurate repair estimates, 
                always consult with a professional mechanic or body shop.
              </p>
            </div>
          </div>
        </motion.div>

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
            onClick={onStart}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3"
          >
            <Camera className="w-5 h-5" />
            Start Analysis
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="w-full bg-white/10 border border-white/20 text-white font-semibold py-4 px-6 rounded-2xl"
          >
            Go Back
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default RulesScreen;
