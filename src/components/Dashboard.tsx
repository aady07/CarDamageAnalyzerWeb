import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, FileText, Download, Calendar, DollarSign, Percent, Car, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { getUserInspections, downloadInspectionPDF, checkPDFAvailability, CarInspection } from '../services/api/inspectionService';

interface DashboardProps {
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onBack }) => {
  const [inspections, setInspections] = useState<CarInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getUserInspections();
      setInspections(response.inspections);
    } catch (err) {
      console.error('Failed to fetch inspections:', err);
      setError('Failed to load inspections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (inspection: CarInspection) => {
    try {
      setDownloadingPdf(inspection.id);
      
      console.log('📄 Checking PDF availability for:', inspection.registrationNumber);
      
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
      
      console.log('📄 PDF is available, downloading:', filename);
      
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
      console.error('Failed to download PDF:', err);
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
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="w-12 h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
            >
              <ArrowLeft className="w-7 h-7" />
            </motion.button>
            <div>
              <h1 className="text-3xl font-bold text-white">Inspection Dashboard</h1>
              <p className="text-gray-400">View and manage your car inspections</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-semibold text-lg">{inspections.length} Inspections</p>
            <p className="text-gray-400 text-sm">Total registered</p>
          </div>
        </div>
      </div>

      {/* Inspections List */}
      <div className="px-8 pb-8">
        {inspections.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center"
          >
            <div className="w-24 h-24 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Car className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">No Inspections Found</h3>
            <p className="text-gray-400 text-lg">You haven't completed any car inspections yet.</p>
          </motion.div>
        ) : (
          <div className="grid gap-6">
            <AnimatePresence>
              {inspections.map((inspection, index) => (
                <motion.div
                  key={inspection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:border-white/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Car className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{inspection.registrationNumber}</h3>
                        <p className="text-gray-400 text-sm">Inspection #{inspection.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className={`px-3 py-1 rounded-full border flex items-center gap-2 ${getStatusColor(inspection.status)}`}>
                        {getStatusIcon(inspection.status)}
                        <span className="font-semibold capitalize">{inspection.status}</span>
                      </div>
                      {inspection.approvalStatus && (
                        <div className={`px-3 py-1 rounded-full border flex items-center gap-2 ${getApprovalStatusColor(inspection.approvalStatus)}`}>
                          {getApprovalStatusIcon(inspection.approvalStatus)}
                          <span className="font-semibold text-xs">{inspection.approvalStatus}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-gray-400 text-sm">Created</p>
                        <p className="text-white font-semibold">{formatDate(inspection.createdAt)}</p>
                      </div>
                    </div>
                    
                    {inspection.completedAt && (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-sm">Completed</p>
                          <p className="text-white font-semibold">{formatDate(inspection.completedAt)}</p>
                        </div>
                      </div>
                    )}

                    {inspection.totalDamagePercentage !== null && (
                      <div className="flex items-center gap-3">
                        <Percent className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-sm">Damage</p>
                          <p className="text-white font-semibold">{inspection.totalDamagePercentage}%</p>
                        </div>
                      </div>
                    )}

                    {inspection.estimatedCost !== null && (
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-sm">Estimated Cost</p>
                          <p className="text-white font-semibold">{formatCurrency(inspection.estimatedCost)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PDF Download Button */}
                  {inspection.status === 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownloadPDF(inspection)}
                      disabled={downloadingPdf === inspection.id}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200"
                    >
                      {downloadingPdf === inspection.id ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Checking PDF...
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5" />
                          Download PDF Report
                        </>
                      )}
                    </motion.button>
                  )}

                  {/* Approval Status Messages */}
                  {inspection.approvalStatus === 'PENDING' && (
                    <div className="w-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span className="font-semibold">PDF Ready - Pending Admin Approval</span>
                      </div>
                      <p className="text-sm mt-1">Your inspection report is ready but awaiting admin approval.</p>
                    </div>
                  )}

                  {inspection.approvalStatus === 'REJECTED' && (
                    <div className="w-full bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Inspection Rejected</span>
                      </div>
                      <p className="text-sm mt-1">
                        {inspection.adminNotes || 'Your inspection was rejected by admin. Please contact support for more information.'}
                      </p>
                    </div>
                  )}

                  {inspection.status === 'completed' && !inspection.approvalStatus && (
                    <div className="w-full bg-gray-500/20 border border-gray-500/30 text-gray-400 font-semibold py-3 px-6 rounded-xl text-center">
                      PDF Report Not Available
                    </div>
                  )}

                  {inspection.status === 'processing' && (
                    <div className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold py-3 px-6 rounded-xl text-center flex items-center justify-center gap-3">
                      <Loader className="w-5 h-5 animate-spin" />
                      Report is being generated...
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
