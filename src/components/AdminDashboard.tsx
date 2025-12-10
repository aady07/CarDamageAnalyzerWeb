import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, FileText, CheckCircle, XCircle, Clock, Eye, AlertCircle, Loader, Search, SortAsc, SortDesc, User } from 'lucide-react';
import { 
  AdminInspection, 
  AdminInspectionDetails,
  AdminInspectionsResponse,
  ApprovalRequest,
  getPendingInspections,
  getAllInspections,
  getInspectionDetails,
  approveInspection,
  rejectInspection
} from '../services/api/adminService';
import ReportManager from './ReportManager';

interface AdminDashboardProps {
  onBack: () => void;
}

type ViewMode = 'pending' | 'all';
type DetailView = 'list' | 'details' | 'report';
type SortField = 'createdAt' | 'completedAt' | 'registrationNumber' | 'approvalStatus' | 'lastUpdatedAt';
type SortOrder = 'asc' | 'desc';
type SessionFilter = 'all' | 'morning-only' | 'evening-only' | 'both-complete' | 'pending';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [inspections, setInspections] = useState<AdminInspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<AdminInspectionDetails | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [detailView, setDetailView] = useState<DetailView>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [approving, setApproving] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastUpdatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');

  // Get unique client names from inspections
  const getUniqueClients = (): string[] => {
    const clients = new Set<string>();
    inspections.forEach(inspection => {
      if (inspection.clientName) {
        clients.add(inspection.clientName);
      }
    });
    return Array.from(clients).sort();
  };

  useEffect(() => {
    loadInspections();
  }, [viewMode]);

  const loadInspections = async () => {
    try {
      setLoading(true);
      setError('');
      const response: AdminInspectionsResponse = viewMode === 'pending' 
        ? await getPendingInspections()
        : await getAllInspections();
      
      setInspections(response.inspections);
    } catch (err) {
      setError('Failed to load inspections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadInspectionDetails = async (inspectionId: number) => {
    try {
      const details = await getInspectionDetails(inspectionId);
      setSelectedInspection(details);
      setDetailView('details');
    } catch (err) {
      setError('Failed to load inspection details.');
    }
  };

  const handleApprove = async (inspectionId: number) => {
    if (!adminNotes.trim()) {
      setError('Please provide admin notes for approval.');
      return;
    }

    try {
      setApproving(inspectionId);
      setError('');
      
      const request: ApprovalRequest = {
        adminNotes: adminNotes
      };
      
      await approveInspection(inspectionId, request);
      
      // Update local state
      setInspections(prev => prev.map(inspection => 
        inspection.id === inspectionId 
          ? { ...inspection, approvalStatus: 'APPROVED' as const }
          : inspection
      ));
      
      if (selectedInspection?.id === inspectionId) {
        setSelectedInspection(prev => prev ? { ...prev, approvalStatus: 'APPROVED' as const } : null);
      }
      
      setAdminNotes('');
      setDetailView('list');
    } catch (err) {
      setError('Failed to approve inspection. Please try again.');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (inspectionId: number) => {
    if (!adminNotes.trim()) {
      setError('Please provide admin notes for rejection.');
      return;
    }

    try {
      setRejecting(inspectionId);
      setError('');
      
      const request: ApprovalRequest = {
        adminNotes: adminNotes
      };
      
      await rejectInspection(inspectionId, request);
      
      // Update local state
      setInspections(prev => prev.map(inspection => 
        inspection.id === inspectionId 
          ? { ...inspection, approvalStatus: 'REJECTED' as const }
          : inspection
      ));
      
      if (selectedInspection?.id === inspectionId) {
        setSelectedInspection(prev => prev ? { ...prev, approvalStatus: 'REJECTED' as const } : null);
      }
      
      setAdminNotes('');
      setDetailView('list');
    } catch (err) {
      setError('Failed to reject inspection. Please try again.');
    } finally {
      setRejecting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getSessionBadge = (session: { status: 'done' | 'pending'; imageCount: number } | undefined, sessionName: 'MORNING' | 'EVENING') => {
    if (!session) {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
          {sessionName} ⏳ 0
        </span>
      );
    }
    
    if (session.status === 'done') {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
          {sessionName} ✓ {session.imageCount}
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          {sessionName} ⏳ {session.imageCount}
        </span>
      );
    }
  };

  const getOverallStatus = (inspection: AdminInspection): string => {
    const breakdown = inspection.sessionBreakdown;
    if (!breakdown) return 'Unknown';
    
    const morningDone = breakdown.morning?.status === 'done';
    const eveningDone = breakdown.evening?.status === 'done';
    
    if (morningDone && eveningDone) return 'Completed';
    if (morningDone || eveningDone) return 'Processing';
    return 'Pending';
  };

  const filteredInspections = inspections
    .filter(inspection => {
      // Search filter (registration number or client name)
      const matchesSearch = inspection.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inspection.clientName && inspection.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Client filter
      const matchesClient = clientFilter === 'all' || 
        (inspection.clientName && inspection.clientName === clientFilter);
      
      // Session filter
      const breakdown = inspection.sessionBreakdown;
      let matchesSession = true;
      if (sessionFilter !== 'all' && breakdown) {
        const morningDone = breakdown.morning?.status === 'done';
        const eveningDone = breakdown.evening?.status === 'done';
        
        switch (sessionFilter) {
          case 'morning-only':
            matchesSession = morningDone && !eveningDone;
            break;
          case 'evening-only':
            matchesSession = !morningDone && eveningDone;
            break;
          case 'both-complete':
            matchesSession = morningDone && eveningDone;
            break;
          case 'pending':
            matchesSession = !morningDone || !eveningDone;
            break;
        }
      }
      
      return matchesSearch && matchesClient && matchesSession;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'completedAt':
          aValue = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          bValue = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          break;
        case 'registrationNumber':
          aValue = a.registrationNumber.toLowerCase();
          bValue = b.registrationNumber.toLowerCase();
          break;
        case 'approvalStatus':
          aValue = a.approvalStatus.toLowerCase();
          bValue = b.approvalStatus.toLowerCase();
          break;
        case 'lastUpdatedAt':
          aValue = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          bValue = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  if (detailView === 'report' && selectedInspection) {
    return (
      <ReportManager
        inspectionId={selectedInspection.id}
        registrationNumber={selectedInspection.registrationNumber}
        onBack={() => setDetailView('details')}
        onUpload={() => {
          loadInspectionDetails(selectedInspection.id);
          loadInspections();
        }}
      />
    );
  }

  if (detailView === 'details' && selectedInspection) {
    return (
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="px-4 md:px-8 pt-4 md:pt-8 pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setDetailView('list')}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5 md:w-7 md:h-7" />
              </motion.button>
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-white">Inspection Details</h1>
                <p className="text-gray-400 text-sm md:text-base">{selectedInspection.registrationNumber} - #{selectedInspection.id}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className={`px-2 md:px-3 py-1 rounded-full border flex items-center gap-2 ${getStatusColor(selectedInspection.approvalStatus)}`}>
                {getStatusIcon(selectedInspection.approvalStatus)}
                <span className="font-semibold text-xs md:text-sm">{selectedInspection.approvalStatus}</span>
              </div>
              {selectedInspection.isEdited && (
                <div className="bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold">
                  Edited {selectedInspection.editCount} times
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-4 md:px-8 mb-4 md:mb-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base">{error}</span>
              </div>
            </motion.div>
          </div>
        )}

        {/* Details Content */}
        <div className="px-4 md:px-8 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
            {/* Inspection Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20"
            >
              <h2 className="text-lg md:text-2xl font-bold text-white mb-4 md:mb-6">Inspection Information</h2>
              
              <div className="space-y-3 md:space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm md:text-base">Registration:</span>
                  <span className="text-white font-semibold text-sm md:text-base">{selectedInspection.registrationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm md:text-base">Status:</span>
                  <span className="text-white font-semibold text-sm md:text-base">{selectedInspection.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm md:text-base">PDF Ready:</span>
                  <span className="text-white font-semibold text-sm md:text-base">{selectedInspection.pdfReady ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm md:text-base">Created:</span>
                  <span className="text-white font-semibold text-sm md:text-base">{formatDate(selectedInspection.createdAt)}</span>
                </div>
                {selectedInspection.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm md:text-base">Completed:</span>
                    <span className="text-white font-semibold text-sm md:text-base">{formatDate(selectedInspection.completedAt)}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4 md:space-y-6"
            >
              {/* Report Actions */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20">
                <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Report Actions</h3>
                
                <div className="space-y-2 md:space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDetailView('report')}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base"
                  >
                    <FileText className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden md:inline">Manage Report</span>
                    <span className="md:hidden">Manage</span>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {/* TODO: Implement PDF view */}}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base"
                  >
                    <Eye className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden md:inline">View PDF</span>
                    <span className="md:hidden">View</span>
                  </motion.button>
                </div>
              </div>

              {/* Approval Actions */}
              {selectedInspection.approvalStatus === 'PENDING' && (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20">
                  <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Approval Actions</h3>
                  
                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                        Admin Notes
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={3}
                        className="w-full bg-white/10 border border-white/20 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none resize-none text-sm md:text-base"
                        placeholder="Enter admin notes..."
                      />
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleApprove(selectedInspection.id)}
                        disabled={approving === selectedInspection.id}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base"
                      >
                        {approving === selectedInspection.id ? (
                          <>
                            <Loader className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                            <span className="hidden md:inline">Approving...</span>
                            <span className="md:hidden">Approving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden md:inline">Approve</span>
                            <span className="md:hidden">Approve</span>
                          </>
                        )}
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleReject(selectedInspection.id)}
                        disabled={rejecting === selectedInspection.id}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base"
                      >
                        {rejecting === selectedInspection.id ? (
                          <>
                            <Loader className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                            <span className="hidden md:inline">Rejecting...</span>
                            <span className="md:hidden">Rejecting...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden md:inline">Reject</span>
                            <span className="md:hidden">Reject</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
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

  if (error && !inspections.length) {
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
              onClick={loadInspections}
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
                <Shield className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                <span className="hidden md:inline">Admin Dashboard</span>
                <span className="md:hidden">Admin</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base">Manage car inspections and approvals</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-white font-semibold text-base md:text-lg">{filteredInspections.length} Inspections</p>
            <p className="text-gray-400 text-xs md:text-sm">{viewMode === 'pending' ? 'Pending' : 'All'}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 md:px-8 pb-4 md:pb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          {/* View Mode Toggle */}
          <div className="flex bg-white/10 rounded-lg md:rounded-xl p-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewMode('pending')}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-xs md:text-sm ${
                viewMode === 'pending'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="hidden md:inline">Pending</span>
              <span className="md:hidden">Pending</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewMode('all')}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-xs md:text-sm ${
                viewMode === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="hidden md:inline">All Inspections</span>
              <span className="md:hidden">All</span>
            </motion.button>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by registration or client name..."
                className="w-full bg-white/10 border border-white/20 rounded-lg md:rounded-xl pl-10 md:pl-10 pr-4 py-2 md:py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none text-sm md:text-base"
              />
            </div>
          </div>

          {/* Client Filter */}
          <div className="flex bg-white/10 rounded-lg md:rounded-xl p-1">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="bg-transparent text-white text-xs md:text-sm px-2 py-1 border-none outline-none"
            >
              <option value="all">All Clients</option>
              {getUniqueClients().map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>

          {/* Session Filter */}
          <div className="flex bg-white/10 rounded-lg md:rounded-xl p-1">
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value as SessionFilter)}
              className="bg-transparent text-white text-xs md:text-sm px-2 py-1 border-none outline-none"
            >
              <option value="all">All Sessions</option>
              <option value="morning-only">MORNING only</option>
              <option value="evening-only">EVENING only</option>
              <option value="both-complete">Both complete</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="flex bg-white/10 rounded-lg md:rounded-xl p-1">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-transparent text-white text-xs md:text-sm px-2 py-1 border-none outline-none"
              >
                <option value="createdAt">Created Date</option>
                <option value="completedAt">Completed Date</option>
                <option value="lastUpdatedAt">Last Updated</option>
                <option value="registrationNumber">Registration</option>
                <option value="approvalStatus">Status</option>
              </select>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4" />
              ) : (
                <SortDesc className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Inspections List */}
      <div className="px-4 md:px-8 pb-6 md:pb-8">
        {filteredInspections.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl md:rounded-3xl p-8 md:p-12 text-center"
          >
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <FileText className="w-8 h-8 md:w-12 md:h-12 text-gray-400" />
            </div>
            <h3 className="text-lg md:text-2xl font-bold text-white mb-3 md:mb-4">No Inspections Found</h3>
            <p className="text-gray-400 text-sm md:text-lg">
              {viewMode === 'pending' 
                ? 'No pending inspections to review.' 
                : 'No inspections found matching your search.'}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            <AnimatePresence>
              {filteredInspections.map((inspection, index) => (
                <motion.div
                  key={inspection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 hover:border-white/30 transition-all duration-200 cursor-pointer"
                  onClick={() => loadInspectionDetails(inspection.id)}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 md:mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-white">{inspection.registrationNumber}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-gray-400 text-xs md:text-sm">Inspection #{inspection.id}</p>
                          {inspection.clientName && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <p className="text-gray-400 text-xs md:text-sm">
                                {inspection.clientName}
                            </p>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                    <div className={`px-2 md:px-3 py-1 rounded-full border flex items-center gap-2 ${getStatusColor(inspection.approvalStatus)}`}>
                      {getStatusIcon(inspection.approvalStatus)}
                      <span className="font-semibold capitalize text-xs md:text-sm">{inspection.approvalStatus}</span>
                      </div>
                      <div className={`px-2 md:px-3 py-1 rounded-full border flex items-center gap-2 bg-blue-500/20 border-blue-500/30 text-blue-400`}>
                        <span className="font-semibold text-xs md:text-sm">{getOverallStatus(inspection)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Session Badges */}
                  {inspection.sessionBreakdown && (
                    <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-2">
                      {getSessionBadge(inspection.sessionBreakdown.morning, 'MORNING')}
                      {getSessionBadge(inspection.sessionBreakdown.evening, 'EVENING')}
                      {inspection.sessionBreakdown.morning && inspection.sessionBreakdown.evening && (
                        <span className="text-gray-400 text-xs">
                          {inspection.sessionBreakdown.morning.imageCount} MORNING, {inspection.sessionBreakdown.evening.imageCount} EVENING
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Clock className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <div>
                        <p className="text-gray-400 text-xs md:text-sm">Created</p>
                        <p className="text-white font-semibold text-xs md:text-sm">{formatDate(inspection.createdAt)}</p>
                      </div>
                    </div>
                    
                    {inspection.completedAt && (
                      <div className="flex items-center gap-2 md:gap-3">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-xs md:text-sm">Completed</p>
                          <p className="text-white font-semibold text-xs md:text-sm">{formatDate(inspection.completedAt)}</p>
                        </div>
                      </div>
                    )}

                    {inspection.lastUpdatedAt && (
                      <div className="flex items-center gap-2 md:gap-3">
                        <Clock className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-400 text-xs md:text-sm">Last Updated</p>
                          <p className="text-white font-semibold text-xs md:text-sm">{formatDate(inspection.lastUpdatedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${inspection.pdfReady ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                        <span className="text-gray-400 text-xs md:text-sm">
                          PDF {inspection.pdfReady ? 'Ready' : 'Not Ready'}
                        </span>
                      </div>
                      {inspection.isEdited && (
                        <div className="bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-1 rounded-full text-xs font-semibold">
                          Edited {inspection.editCount} times
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs md:text-sm">
                      Click to view details
                    </div>
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

export default AdminDashboard;
