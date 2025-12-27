import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, FileText, Download, Calendar, DollarSign, Percent, Car, Clock, CheckCircle, AlertCircle, Loader, TrendingUp, Bell, LayoutDashboard } from 'lucide-react';
import { getUserInspections, downloadInspectionPDF, checkPDFAvailability, CarInspection } from '../services/api/inspectionService';
import InspectionDashboard from './InspectionDashboard';

interface DashboardProps {
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onBack }) => {
  const [inspections, setInspections] = useState<CarInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [viewingDashboard, setViewingDashboard] = useState<number | null>(null);
  const lastUpdatedRef = useRef<Map<number, string>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInspections();
    
    // Start polling every 45 seconds (between 30-60 as specified)
    pollingIntervalRef.current = setInterval(() => {
      fetchInspections(true); // silent refresh
    }, 45000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchInspections = async (silent: boolean = false) => {
    try {
      if (!silent) {
      setLoading(true);
      }
      setError('');
      const response = await getUserInspections();
      
      // Detect changes by comparing lastUpdatedAt
      const newNotifications: string[] = [];
      response.inspections.forEach((inspection) => {
        const previousLastUpdated = lastUpdatedRef.current.get(inspection.id);
        const currentLastUpdated = inspection.lastUpdatedAt;
        
        if (previousLastUpdated && currentLastUpdated && previousLastUpdated !== currentLastUpdated) {
          // Check if evening session was added
          const previousInspection = inspections.find(i => i.id === inspection.id);
          const previousEveningSubmitted = previousInspection?.sessions?.evening?.submitted;
          const currentEveningSubmitted = inspection.sessions?.evening?.submitted;
          
          if (!previousEveningSubmitted && currentEveningSubmitted) {
            newNotifications.push(`EVENING session added for ${inspection.registrationNumber}`);
          } else if (inspection.lastUpdatedAt) {
            newNotifications.push(`Inspection ${inspection.registrationNumber} updated`);
          }
        }
        
        if (currentLastUpdated) {
          lastUpdatedRef.current.set(inspection.id, currentLastUpdated);
        }
      });
      
      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev].slice(0, 5)); // Keep last 5 notifications
        // Auto-remove notifications after 5 seconds
        setTimeout(() => {
          setNotifications(prev => prev.slice(1));
        }, 5000);
      }
      
      setInspections(response.inspections);
    } catch (err) {
      if (!silent) {
      setError('Failed to load inspections. Please try again.');
      }
    } finally {
      if (!silent) {
      setLoading(false);
      }
    }
  };

  const handleDownloadPDF = async (inspection: CarInspection) => {
    try {
      setDownloadingPdf(inspection.id);
      
      // First check if PDF is available for download
      const availabilityResponse = await checkPDFAvailability(inspection.registrationNumber);
      
      if (!availabilityResponse.success) {
        // Show appropriate message based on approval status
        if (availabilityResponse.approvalStatus === 'PENDING') {
          alert('PDF is ready but pending admin approval. Please wait for approval.');
        } else if (availabilityResponse.approvalStatus === 'REJECTED') {
          alert(`Inspection was rejected: ${availabilityResponse.adminNotes || 'Please contact support for more information.'}`);
        } else {
          alert(availabilityResponse.message || 'PDF is not available for download.');
        }
        return;
      }
      
      // PDF is available, proceed with download
      const filename = availabilityResponse.filename || `inspection_${inspection.registrationNumber}.pdf`;
      
      // Download PDF blob using filename
      const pdfBlob = await downloadInspectionPDF(filename);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'processing':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
      case 'failed':
        return 'bg-red-500/20 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
    }
  };

  const getApprovalStatusIcon = (approvalStatus?: string) => {
    switch (approvalStatus) {
      case 'APPROVED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'REJECTED':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getApprovalStatusColor = (approvalStatus?: string) => {
    switch (approvalStatus) {
      case 'APPROVED':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'REJECTED':
        return 'bg-red-500/20 border-red-500/30 text-red-400';
      case 'PENDING':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getSessionBadge = (session: { submitted: boolean; imageCount: number } | undefined, sessionName: 'MORNING' | 'EVENING') => {
    if (!session) {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
          {sessionName} ⏳
        </span>
      );
    }
    
    if (session.submitted) {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
          {sessionName} ✓
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          {sessionName} ⏳
        </span>
      );
    }
  };

  const getOverallStatus = (inspection: CarInspection): string => {
    const sessions = inspection.sessions;
    if (!sessions) return 'Unknown';
    
    const morningSubmitted = sessions.morning?.submitted;
    const eveningSubmitted = sessions.evening?.submitted;
    
    if (morningSubmitted && eveningSubmitted) return 'Completed';
    if (morningSubmitted || eveningSubmitted) return 'Processing';
    return 'Pending';
  };

  const hasRecentUpdate = (inspection: CarInspection): boolean => {
    if (!inspection.lastUpdatedAt) return false;
    const lastUpdated = new Date(inspection.lastUpdatedAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
    return diffMinutes < 5; // Updated in last 5 minutes
  };

  const isDashboardReady = (inspection: CarInspection): boolean => {
    return inspection.approvalStatus === 'APPROVED' && inspection.pdfReady === true;
  };

  // If viewing a dashboard, show the InspectionDashboard component
  if (viewingDashboard !== null) {
    return (
      <InspectionDashboard
        inspectionId={viewingDashboard}
        onBack={() => setViewingDashboard(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading inspections...</p>
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
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md mx-4 text-center"
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
              onClick={fetchInspections}
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

  return (
    <div className="min-h-screen bg-black">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          <AnimatePresence>
            {notifications.map((notification, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className="bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-3 rounded-xl flex items-center gap-3 backdrop-blur-lg"
              >
                <Bell className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-semibold">{notification}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

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
              <h1 className="text-xl md:text-3xl font-bold text-white">Inspection Dashboard</h1>
              <p className="text-gray-400 text-sm md:text-base">View and manage your car inspections</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-white font-semibold text-base md:text-lg">{inspections.length} Inspections</p>
            <p className="text-gray-400 text-xs md:text-sm">Total registered</p>
          </div>
        </div>
      </div>

      {/* Inspections List */}
      <div className="px-4 md:px-8 pb-8">
        {inspections.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl md:rounded-3xl p-8 md:p-12 text-center"
          >
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <Car className="w-8 h-8 md:w-12 md:h-12 text-gray-400" />
            </div>
            <h3 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-4">No Inspections Found</h3>
            <p className="text-gray-400 text-sm md:text-lg">You haven't completed any car inspections yet.</p>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            <AnimatePresence>
              {inspections.map((inspection, index) => (
                <motion.div
                  key={inspection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 hover:border-white/30 transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Car className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                        <h3 className="text-lg md:text-xl font-bold text-white">{inspection.registrationNumber}</h3>
                          {hasRecentUpdate(inspection) && (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
                              Updated
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs md:text-sm">Inspection #{inspection.id}</p>
                      </div>
                    </div>
                    <div className={`px-2 md:px-3 py-1 rounded-full border flex items-center gap-2 bg-blue-500/20 border-blue-500/30 text-blue-400`}>
                      <span className="font-semibold text-xs md:text-sm">{getOverallStatus(inspection)}</span>
                    </div>
                  </div>

                  {/* Session Badges */}
                  {inspection.sessions && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {getSessionBadge(inspection.sessions.morning, 'MORNING')}
                      {getSessionBadge(inspection.sessions.evening, 'EVENING')}
                      {inspection.sessions.morning && inspection.sessions.evening && (
                        <span className="text-gray-400 text-xs">
                          MORNING: {inspection.sessions.morning.imageCount} {inspection.sessions.morning.submitted ? '✓' : '⏳'}, EVENING: {inspection.sessions.evening.imageCount} {inspection.sessions.evening.submitted ? '✓' : '⏳'}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <div>
                        <p className="text-gray-400 text-xs md:text-sm">Created</p>
                        <p className="text-white font-semibold text-sm md:text-base">{formatDate(inspection.createdAt)}</p>
                      </div>
                    </div>
                    
                    {inspection.completedAt && (
                      <div className="flex items-center gap-2 md:gap-3">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-xs md:text-sm">Completed</p>
                          <p className="text-white font-semibold text-sm md:text-base">{formatDate(inspection.completedAt)}</p>
                        </div>
                      </div>
                    )}

                    {inspection.lastUpdatedAt && (
                      <div className="flex items-center gap-2 md:gap-3">
                        <Clock className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-xs md:text-sm">Last Updated</p>
                          <p className="text-white font-semibold text-sm md:text-base">{formatDate(inspection.lastUpdatedAt)}</p>
                        </div>
                      </div>
                    )}


                  </div>

                  {/* Action Buttons */}
                  {inspection.status === 'completed' && (
                    <div className="space-y-3">
                      {/* View Dashboard Button - Only show if approved and PDF ready */}
                      {isDashboardReady(inspection) && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setViewingDashboard(inspection.id)}
                          className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 transition-all duration-200 text-sm md:text-base"
                        >
                          <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">View Inspection Dashboard</span>
                          <span className="md:hidden">View Dashboard</span>
                        </motion.button>
                      )}
                      
                      {/* PDF Download Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownloadPDF(inspection)}
                      disabled={downloadingPdf === inspection.id}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 transition-all duration-200 text-sm md:text-base"
                    >
                      {downloadingPdf === inspection.id ? (
                        <>
                          <Loader className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                          <span className="hidden md:inline">Checking PDF...</span>
                          <span className="md:hidden">Checking...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Download PDF Report</span>
                          <span className="md:hidden">Download PDF</span>
                        </>
                      )}
                    </motion.button>
                    </div>
                  )}

                  {/* Approval Status Messages */}
                  {inspection.approvalStatus === 'PENDING' && (
                    <div className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                        <span className="font-semibold text-sm md:text-base">AI Assessment in Progress. Will be ready soon.</span>
                      </div>
                    </div>
                  )}

                  {inspection.approvalStatus === 'APPROVED' && (
                    <div className="w-full bg-green-500/20 border border-green-500/30 text-green-400 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="font-semibold text-sm md:text-base">Upload-completed</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="font-semibold text-sm md:text-base">AI damage assessment- completed</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
