import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ArrowRight, Loader, AlertCircle, Edit2, X, Search, ChevronDown, ChevronUp, Car } from 'lucide-react';
import { getAllClients, Client, getAllInspections, AdminInspection } from '../../services/api/adminService';
import ManageClientUsers from './ManageClientUsers';
import ClientInspectionEditor from '../ClientInspectionEditor';

interface ClientManagementProps {
  onBack: () => void;
}

interface GroupedInspections {
  [registrationNumber: string]: AdminInspection[];
}

const ClientManagement: React.FC<ClientManagementProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showCarGroupingView, setShowCarGroupingView] = useState(false);
  const [inspections, setInspections] = useState<AdminInspection[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [expandedCars, setExpandedCars] = useState<Set<string>>(new Set());
  const [selectedDriverUserId, setSelectedDriverUserId] = useState<string>('all');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAllClients();
      setClients(response.clients);
    } catch (err: any) {
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditInspections = async () => {
    setShowCarGroupingView(true);
    setLoadingInspections(true);
    setError('');
    try {
      const response = await getAllInspections();
      // Filter only approved inspections
      const approvedInspections = response.inspections.filter(
        (inspection: AdminInspection) => 
          inspection.approvalStatus === 'APPROVED'
      );
      setInspections(approvedInspections);
      // Don't expand by default - keep them collapsed for compact view
      setExpandedCars(new Set());
    } catch (err: any) {
      setError('Failed to load inspections. Please try again.');
    } finally {
      setLoadingInspections(false);
    }
  };

  // Get unique driver user IDs from inspections
  const uniqueDriverUserIds = useMemo(() => {
    const userIds = new Set<string>();
    inspections.forEach((inspection) => {
      if (inspection.userId) {
        userIds.add(inspection.userId);
      }
    });
    return Array.from(userIds).sort();
  }, [inspections]);

  // Filter inspections by driver user ID first, then group by registration number
  const groupedInspections = useMemo(() => {
    // Filter by driver user ID if selected
    let filteredInspections = inspections;
    if (selectedDriverUserId !== 'all') {
      filteredInspections = inspections.filter(inspection => inspection.userId === selectedDriverUserId);
    }

    const grouped: GroupedInspections = {};
    filteredInspections.forEach((inspection) => {
      const regNum = inspection.registrationNumber;
      if (!grouped[regNum]) {
        grouped[regNum] = [];
      }
      grouped[regNum].push(inspection);
    });
    // Sort inspections within each group by date (newest first)
    Object.keys(grouped).forEach((regNum) => {
      grouped[regNum].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    return grouped;
  }, [inspections, selectedDriverUserId]);

  // Filter grouped inspections by search term and sort by oldest inspection first
  const filteredGroupedInspections = useMemo(() => {
    let filtered = groupedInspections;
    if (searchTerm) {
      filtered = {};
      Object.keys(groupedInspections).forEach((regNum) => {
        if (regNum.toLowerCase().includes(searchTerm.toLowerCase())) {
          filtered[regNum] = groupedInspections[regNum];
        }
      });
    }
    
    // Sort cars by oldest inspection date (ascending - first inspection at top)
    const sortedEntries = Object.entries(filtered).sort(([, inspectionsA], [, inspectionsB]) => {
      // Get the oldest inspection date for each car
      const oldestA = Math.min(...inspectionsA.map(i => new Date(i.createdAt).getTime()));
      const oldestB = Math.min(...inspectionsB.map(i => new Date(i.createdAt).getTime()));
      return oldestA - oldestB; // Ascending order (oldest first)
    });
    
    // Convert back to object
    const sorted: GroupedInspections = {};
    sortedEntries.forEach(([regNum, inspections]) => {
      sorted[regNum] = inspections;
    });
    return sorted;
  }, [groupedInspections, searchTerm]);

  const toggleCarExpansion = (registrationNumber: string) => {
    setExpandedCars((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(registrationNumber)) {
        newSet.delete(registrationNumber);
      } else {
        newSet.add(registrationNumber);
      }
      return newSet;
    });
  };

  if (selectedInspectionId) {
    return (
      <ClientInspectionEditor
        inspectionId={selectedInspectionId}
        onBack={() => setSelectedInspectionId(null)}
      />
    );
  }

  if (selectedClient) {
    return (
      <ManageClientUsers
        clientName={selectedClient}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  // Car Grouping View
  if (showCarGroupingView) {
    return (
      <div className="min-h-screen bg-black p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Edit2 className="w-8 h-8 text-purple-400" />
                Edit Inspections
              </h1>
              <p className="text-gray-400">Select a car and inspection to edit</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCarGroupingView(false)}
              className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2 text-white flex items-center gap-2 transition-colors"
            >
              <X className="w-5 h-5" />
              <span>Close</span>
            </motion.button>
          </div>
        </div>

        {/* Error Message */}
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

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Driver User ID Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">Filter by Driver User ID</label>
            <select
              value={selectedDriverUserId}
              onChange={(e) => setSelectedDriverUserId(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-400 appearance-none cursor-pointer"
            >
              <option value="all" className="bg-gray-800 text-white">All Drivers</option>
              {uniqueDriverUserIds.map((userId) => (
                <option key={userId} value={userId} className="bg-gray-800 text-white">
                  {userId}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by car registration number..."
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>

        {/* Loading State */}
        {loadingInspections ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : Object.keys(filteredGroupedInspections).length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border border-white/20"
          >
            <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Approved Inspections Found</h3>
            <p className="text-gray-400">No approved inspections available to edit.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Object.entries(filteredGroupedInspections).map(([registrationNumber, carInspections], index) => {
              const isExpanded = expandedCars.has(registrationNumber);
              // Get oldest inspection date for this car
              const oldestInspection = carInspections.reduce((oldest, current) => {
                return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
              });
              
              return (
                <motion.div
                  key={registrationNumber}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 overflow-hidden"
                >
                  {/* Car Header - Compact, Clickable to expand/collapse */}
                  <motion.div
                    whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                    onClick={() => toggleCarExpansion(registrationNumber)}
                    className="p-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center flex-shrink-0">
                          <Car className="w-4 h-4 text-purple-400" />
                        </div>
                        <h3 className="text-base font-bold text-white truncate">
                          {registrationNumber}
                        </h3>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </motion.div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-gray-400">
                        {carInspections.length} inspection{carInspections.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-gray-500">
                        First: {new Date(oldestInspection.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </motion.div>

                  {/* Inspections List - Expandable */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/10"
                      >
                        <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
                          {carInspections.map((inspection) => (
                            <motion.div
                              key={inspection.id}
                              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInspectionId(inspection.id);
                              }}
                              className="bg-white/5 hover:bg-white/10 border border-white/20 rounded p-2 cursor-pointer transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded text-[10px] font-semibold">
                                      APPROVED
                                    </span>
                                    {inspection.isEdited && (
                                      <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded text-[10px] font-semibold">
                                        EDITED
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-white font-semibold text-xs mb-0.5">
                                    {new Date(inspection.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </p>
                                  <p className="text-gray-400 text-[10px]">
                                    {new Date(inspection.createdAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0 mt-1" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-400" />
          Client Management
        </h1>
        <p className="text-gray-400">Manage clients and their users</p>
      </div>

      {/* Error Message */}
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

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : clients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border border-white/20"
        >
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Clients Found</h3>
          <p className="text-gray-400">No clients have been registered yet.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {clients.map((client, index) => (
            <motion.div
              key={client.clientName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 hover:border-white/30 transition-all duration-200 cursor-pointer group"
              onClick={() => setSelectedClient(client.clientName)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-3">{client.clientName}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Head Users:</span>
                        <span className="text-white font-semibold">{client.headUsersCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Driver Users:</span>
                        <span className="text-white font-semibold">{client.driverUsersCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm pt-2 border-t border-white/10">
                        <span className="text-gray-400">Total Users:</span>
                        <span className="text-blue-400 font-semibold">{client.totalUsersCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClient(client.clientName);
                    }}
                    className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Manage Users</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditInspections();
                    }}
                    className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Inspections</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
};

export default ClientManagement;
