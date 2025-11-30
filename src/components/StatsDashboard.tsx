import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, TrendingUp, Clock, CheckCircle2, AlertCircle, DollarSign, BarChart3, Sun, Moon, FileText } from 'lucide-react';
import { getTodayDashboard, DashboardResponse } from '../services/api/carInspectionService';

interface StatsDashboardProps {
  onBack: () => void;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ onBack }) => {
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'processing' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'carNumber' | 'createdAt' | 'damage' | 'cost'>('createdAt');

  const fetchDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await getTodayDashboard('SNAPCABS');
      
      if (data.success) {
        setDashboardData(data);
      } else {
        setError(data.message || 'Failed to fetch dashboard data');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'processing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'processing':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const filteredAndSortedCars = React.useMemo(() => {
    if (!dashboardData?.cars) return [];

    let filtered = [...dashboardData.cars];

    // Filter
    if (filterStatus === 'completed') {
      filtered = filtered.filter(car => car.overallStatus === 'completed');
    } else if (filterStatus === 'processing') {
      filtered = filtered.filter(car => car.overallStatus === 'processing');
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(car => 
        car.morningStatus === 'pending' && car.eveningStatus === 'pending'
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'carNumber':
          return a.carNumber.localeCompare(b.carNumber);
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'damage':
          return (b.totalDamagePercentage || 0) - (a.totalDamagePercentage || 0);
        case 'cost':
          return (b.estimatedCost || 0) - (a.estimatedCost || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [dashboardData, filterStatus, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md text-center border border-white/20"
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Dashboard</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchDashboardData()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl"
            >
              Try Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBack}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl"
            >
              Go Back
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { summary, totalCars, date, cars } = dashboardData;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="px-4 md:px-8 pt-4 md:pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5 md:w-7 md:h-7" />
            </motion.button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3">
                <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                <span className="hidden md:inline">SnapCabs Stats Dashboard</span>
                <span className="md:hidden">Stats Dashboard</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base">Date: {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left md:text-right">
              <p className="text-white font-semibold text-base md:text-lg">{totalCars} Cars</p>
              <p className="text-gray-400 text-xs md:text-sm">Today's Inspections</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, rotate: 180 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 md:w-6 md:h-6 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 pb-6 md:pb-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
              </div>
            </div>
            <h3 className="text-gray-400 text-xs md:text-sm font-medium mb-1">Total Cars</h3>
            <p className="text-2xl md:text-3xl font-bold text-white">{totalCars}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Sun className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
              </div>
            </div>
            <h3 className="text-gray-400 text-xs md:text-sm font-medium mb-1">Morning Done</h3>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {summary.morningDone} <span className="text-base md:text-lg text-gray-400">/ {totalCars}</span>
            </p>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5 md:h-2">
              <div
                className="bg-yellow-500 h-1.5 md:h-2 rounded-full transition-all"
                style={{ width: `${totalCars > 0 ? (summary.morningDone / totalCars) * 100 : 0}%` }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-500/20 rounded-full flex items-center justify-center">
                <Moon className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
              </div>
            </div>
            <h3 className="text-gray-400 text-xs md:text-sm font-medium mb-1">Evening Done</h3>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {summary.eveningDone} <span className="text-base md:text-lg text-gray-400">/ {totalCars}</span>
            </p>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5 md:h-2">
              <div
                className="bg-indigo-500 h-1.5 md:h-2 rounded-full transition-all"
                style={{ width: `${totalCars > 0 ? (summary.eveningDone / totalCars) * 100 : 0}%` }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
              </div>
            </div>
            <h3 className="text-gray-400 text-xs md:text-sm font-medium mb-1">Both Complete</h3>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {summary.bothDone} <span className="text-base md:text-lg text-gray-400">/ {totalCars}</span>
            </p>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5 md:h-2">
              <div
                className="bg-green-500 h-1.5 md:h-2 rounded-full transition-all"
                style={{ width: `${totalCars > 0 ? (summary.bothDone / totalCars) * 100 : 0}%` }}
              />
            </div>
          </motion.div>
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="flex bg-white/10 rounded-lg md:rounded-xl p-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterStatus('all')}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-xs md:text-sm ${
                filterStatus === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterStatus('completed')}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-xs md:text-sm ${
                filterStatus === 'completed'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Completed
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterStatus('processing')}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-xs md:text-sm ${
                filterStatus === 'processing'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Processing
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterStatus('pending')}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-xs md:text-sm ${
                filterStatus === 'pending'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Pending
            </motion.button>
          </div>

          <div className="flex bg-white/10 rounded-lg md:rounded-xl p-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white text-xs md:text-sm px-2 py-1 border-none outline-none"
            >
              <option value="createdAt">Newest First</option>
              <option value="carNumber">Car Number</option>
              <option value="damage">Damage %</option>
              <option value="cost">Cost</option>
            </select>
          </div>

          <div className="ml-auto text-gray-400 text-xs md:text-sm">
            Showing {filteredAndSortedCars.length} of {cars.length} cars
          </div>
        </div>

        {/* Cars List */}
        {filteredAndSortedCars.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl md:rounded-3xl p-8 md:p-12 text-center border border-white/20"
          >
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <BarChart3 className="w-8 h-8 md:w-12 md:h-12 text-gray-400" />
            </div>
            <h3 className="text-lg md:text-2xl font-bold text-white mb-3 md:mb-4">No Cars Found</h3>
            <p className="text-gray-400 text-sm md:text-lg">
              No cars found matching the current filter.
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            <AnimatePresence>
              {filteredAndSortedCars.map((car, index) => (
                <motion.div
                  key={car.inspectionId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 hover:border-white/30 transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 md:mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-white">{car.carNumber}</h3>
                        <p className="text-gray-400 text-xs md:text-sm">Inspection #{car.inspectionId}</p>
                      </div>
                    </div>
                    <div className={`px-2 md:px-3 py-1 rounded-full border flex items-center gap-2 ${getStatusColor(car.overallStatus)}`}>
                      {getStatusIcon(car.overallStatus)}
                      <span className="font-semibold capitalize text-xs md:text-sm">{car.overallStatus}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-3 md:mb-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Sun className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <div>
                        <p className="text-gray-400 text-xs md:text-sm">Morning</p>
                        {car.morningStatus === 'done' ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Done ({car.morningImages})
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            Pending
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-3">
                      <Moon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <div>
                        <p className="text-gray-400 text-xs md:text-sm">Evening</p>
                        {car.eveningStatus === 'done' ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Done ({car.eveningImages})
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            Pending
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                      <FileText className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <div>
                        <p className="text-gray-400 text-xs md:text-sm">Images</p>
                        <p className="text-white font-semibold text-xs md:text-sm">{car.totalImages}/{car.expectedImages}</p>
                        <div className="w-20 h-1 bg-gray-700 rounded-full mt-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full transition-all"
                            style={{ width: `${(car.totalImages / car.expectedImages) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {car.totalDamagePercentage !== null && (
                      <div className="flex items-center gap-2 md:gap-3">
                        <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-xs md:text-sm">Damage</p>
                          <p className="text-white font-semibold text-xs md:text-sm">{car.totalDamagePercentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    )}

                    {car.estimatedCost !== null && (
                      <div className="flex items-center gap-2 md:gap-3">
                        <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-xs md:text-sm">Cost</p>
                          <p className="text-white font-semibold text-xs md:text-sm">₹{car.estimatedCost.toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsDashboard;

