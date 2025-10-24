import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TestTube } from 'lucide-react';
import UploadLimitsDisplay from './UploadLimitsDisplay';
import { getMockLimitInfo } from '../services/api/limitService';

const UploadLimitsTest: React.FC = () => {
  const [testScenario, setTestScenario] = useState<'normal' | 'limited' | 'unlimited'>('normal');
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async (scenario: 'normal' | 'limited' | 'unlimited') => {
    setIsLoading(true);
    setTestScenario(scenario);
    
    // Simulate API call
    try {
      const mockData = await getMockLimitInfo(scenario);
      console.log('Mock API Response:', mockData);
      
      // Calculate expected values
      const remainingAssessments = Math.floor(mockData.stats.remainingUploads / 4);
      const canPerform = mockData.stats.remainingUploads >= 4;
      
      console.log('Calculated Values:', {
        remainingAssessments,
        canPerform,
        remainingUploads: mockData.stats.remainingUploads
      });
      
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <TestTube className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Upload Limits Test</h1>
          </div>
          
          <p className="text-gray-300 mb-6">
            Test different upload limit scenarios to verify the functionality works correctly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => runTest('normal')}
              disabled={isLoading}
              className={`p-4 rounded-xl font-semibold ${
                testScenario === 'normal' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <div className="text-sm font-bold mb-1">Normal Scenario</div>
              <div className="text-xs opacity-80">19 uploads remaining (4 inspections)</div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => runTest('limited')}
              disabled={isLoading}
              className={`p-4 rounded-xl font-semibold ${
                testScenario === 'limited' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <div className="text-sm font-bold mb-1">Limited Scenario</div>
              <div className="text-xs opacity-80">2 uploads remaining (0 inspections)</div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => runTest('unlimited')}
              disabled={isLoading}
              className={`p-4 rounded-xl font-semibold ${
                testScenario === 'unlimited' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <div className="text-sm font-bold mb-1">Unlimited Scenario</div>
              <div className="text-xs opacity-80">Premium tier (unlimited)</div>
            </motion.button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading test data...</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <UploadLimitsDisplay />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-effect rounded-2xl p-6 mt-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">Test Instructions</h2>
          <div className="text-gray-300 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <span>Click on different test scenarios to see how the upload limits display changes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <span>Check the console for detailed API response and calculated values</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <span>Verify that the remaining assessments are calculated correctly (uploads ÷ 4)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
              <span>Test that functionality is disabled when remaining uploads &lt; 4</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadLimitsTest;
