import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, Car, CheckCircle, Clock, Download, AlertCircle, Loader, Bell, Users, LayoutDashboard } from 'lucide-react';
import { checkClientAccess, getClientDashboard, DashboardResponse, DashboardCar } from '../services/api/clientService';
import { checkPDFAvailability, downloadInspectionPDF } from '../services/api/inspectionService';
import InspectionDashboard from './InspectionDashboard';

interface ClientDashboardProps {
  onBack: () => void;
  clientName?: string;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ onBack, clientName = 'SNAPCABS' }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState<string>('');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [verifiedPdfStatus, setVerifiedPdfStatus] = useState<Map<string, { isAvailable: boolean; isPending: boolean }>>(new Map());
  const [viewingDashboard, setViewingDashboard] = useState<number | null>(null);
  const lastUpdatedRef = useRef<Map<number, string>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await checkClientAccess(clientName);
        setHasAccess(response.hasAccess);
        setClientDisplayName(response.clientDisplayName || response.clientName);
        if (!response.hasAccess) {
          setError('You don\'t have permission to view this dashboard. Only client head users can access.');
        }
      } catch (err) {
        setHasAccess(false);
        setError('Failed to check access. Please try again.');
      }
    };
    checkAccess();
  }, [clientName]);

  // Format date for API
  const formatDateForAPI = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) {
      // Return today's date if invalid
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0]; // "2024-01-15"
  };

  // Verify PDF availability for all cars
  const verifyPdfAvailabilityForCars = async (cars: DashboardCar[]) => {
    // Only check cars that show as pdfReady
    const carsToCheck = cars.filter(car => car.pdfReady);
    
    if (carsToCheck.length === 0) return;

    // Check PDF availability for each car in parallel
    const availabilityChecks = carsToCheck.map(async (car) => {
      try {
        const availabilityResponse = await checkPDFAvailability(car.carNumber);
        return {
          carNumber: car.carNumber,
          isAvailable: availabilityResponse.success,
          isPending: (availabilityResponse.approvalStatus as string) === 'PENDING'
        };
      } catch (err) {
        // If check fails, assume not available
        return {
          carNumber: car.carNumber,
          isAvailable: false,
          isPending: false
        };
      }
    });

    const results = await Promise.all(availabilityChecks);
    
    // Update verified status
    setVerifiedPdfStatus(prev => {
      const newMap = new Map(prev);
      results.forEach(result => {
        newMap.set(result.carNumber, {
          isAvailable: result.isAvailable,
          isPending: result.isPending
        });
      });
      return newMap;
    });
  };


  // Fetch dashboard data
  const fetchDashboardData = async (silent: boolean = false) => {
    if (!hasAccess) return;

    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');
      const dateStr = formatDateForAPI(selectedDate);
      const data = await getClientDashboard(clientName, dateStr);
      
      // Detect changes by comparing lastUpdatedAt
      const newNotifications: string[] = [];
      if (data.cars) {
        data.cars.forEach((car) => {
          const previousLastUpdated = lastUpdatedRef.current.get(car.inspectionId);
          const currentLastUpdated = car.lastUpdatedAt;
          
          if (previousLastUpdated && currentLastUpdated && previousLastUpdated !== currentLastUpdated) {
            // Check if evening/second inspection session was added
            const previousCar = dashboardData?.cars.find(c => c.inspectionId === car.inspectionId);
            const previousEveningDone = previousCar?.sessions.evening.status === 'done';
            const currentEveningDone = car.sessions.evening.status === 'done';
            
            if (!previousEveningDone && currentEveningDone) {
              newNotifications.push(`EVENING session added for ${car.carNumber}`);
            } else if (currentLastUpdated) {
              newNotifications.push(`Inspection ${car.carNumber} updated`);
            }
          }
          
          if (currentLastUpdated) {
            lastUpdatedRef.current.set(car.inspectionId, currentLastUpdated);
          }
        });
      }
      
      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev].slice(0, 5)); // Keep last 5 notifications
        // Auto-remove notifications after 5 seconds
        setTimeout(() => {
          setNotifications(prev => prev.slice(1));
        }, 5000);
      }
      
      setDashboardData(data);
      
      // Update client display name from response if available
      if (data.clientDisplayName) {
        setClientDisplayName(data.clientDisplayName);
      }
      
      // Verify PDF availability for all cars that show as pdfReady
      if (data.cars && data.cars.length > 0) {
        verifyPdfAvailabilityForCars(data.cars);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You don\'t have permission to view this dashboard. Only client head users can access.');
        setHasAccess(false);
      } else {
        if (!silent) {
          setError('Failed to load dashboard data. Please try again.');
        }
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Fetch data when date changes or access is confirmed
  useEffect(() => {
    if (hasAccess === true) {
      fetchDashboardData();
    }
  }, [selectedDate, hasAccess, clientName]);

  // Start polling every 30 seconds
  useEffect(() => {
    if (hasAccess === true) {
      pollingIntervalRef.current = setInterval(() => {
        fetchDashboardData(true); // silent refresh
      }, 30000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [hasAccess, selectedDate, clientName]);

  const handleDownloadPDF = async (car: DashboardCar, sessionType?: 'morning' | 'evening', inspectionId?: number) => {
    try {
      // For REFUX, use inspectionId as the key; for others use carNumber
      const downloadKey = clientName === 'REFUX' && inspectionId 
        ? `inspection-${inspectionId}` 
        : sessionType 
        ? `${car.carNumber}-${sessionType}` 
        : car.carNumber;
      setDownloadingPdf(downloadKey);
      
      // For REFUX, use data from dashboard response (pdfPath, pdfReady, approvalStatus)
      if (clientName === 'REFUX' && inspectionId) {
        // Step 1: Check if PDF is ready
        if (!car.pdfReady) {
          alert('PDF is not ready yet. Please wait for the inspection to complete.');
          setDownloadingPdf(null);
          return;
        }
        
        // Step 2: Check approval status (only if approvalStatus is provided)
        if (car.approvalStatus && car.approvalStatus !== 'APPROVED') {
          if (car.approvalStatus === 'PENDING') {
            alert('PDF is ready but pending admin approval. Please wait for approval.');
          } else if (car.approvalStatus === 'REJECTED') {
            alert('PDF was rejected. Please contact support for more information.');
          } else {
            alert('PDF is not available for download.');
          }
          setDownloadingPdf(null);
          return;
        }
        
        // Step 2: Extract filename from pdfPath
        if (!car.pdfPath) {
          alert('PDF path is not available. Please try again later.');
          setDownloadingPdf(null);
          return;
        }
        
        const filename = car.pdfPath.split('/').pop() || `inspection_${inspectionId}.pdf`;
        
        // Step 3: Download using filename endpoint
        try {
          const pdfBlob = await downloadInspectionPDF(filename);
          
          // Create download link
          const downloadFilename = `inspection_${car.carNumber}_${inspectionId}.pdf`;
          const url = window.URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = downloadFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          setDownloadingPdf(null);
          return;
        } catch (downloadErr: any) {
          alert(`Failed to download PDF: ${downloadErr.message || 'Please try again.'}`);
          setDownloadingPdf(null);
          return;
        }
      }
      
      // For REFUX with session type, construct filename with inspectionId and session
      let filename: string;
      let apiPath: string;
      
      if (clientName === 'REFUX' && sessionType) {
        // For REFUX, use inspectionId and session type to get the specific PDF
        filename = `inspection_${car.inspectionId}_${sessionType}_${car.carNumber}.pdf`;
        // Try to use inspectionId-based endpoint if available, otherwise fall back to registration number
        apiPath = `/api/car-inspection/pdf/inspection/${car.inspectionId}/${sessionType}`;
      } else {
        // For other clients or when no session type specified, use registration number
      const availabilityResponse = await checkPDFAvailability(car.carNumber);
      
      if (!availabilityResponse.success) {
        // Update verified status to reflect actual availability
          const approvalStatus = availabilityResponse.approvalStatus as string;
        setVerifiedPdfStatus(prev => {
          const newMap = new Map(prev);
            if (approvalStatus === 'PENDING') {
            newMap.set(car.carNumber, { isAvailable: false, isPending: true });
          } else {
            newMap.set(car.carNumber, { isAvailable: false, isPending: false });
          }
          return newMap;
        });

        // Show appropriate message based on approval status
          if (approvalStatus === 'PENDING') {
          alert('PDF is ready but pending admin approval. Please wait for approval.');
          } else if (approvalStatus === 'REJECTED') {
          alert(`Inspection was rejected: ${availabilityResponse.adminNotes || 'Please contact support for more information.'}`);
        } else {
          alert(availabilityResponse.message || 'PDF is not available for download.');
        }
        return;
      }
      
        filename = availabilityResponse.filename || `inspection_${car.carNumber}.pdf`;
        apiPath = `/api/car-inspection/pdf/${filename}`;
      }
      
      // Download PDF blob
      let pdfBlob: Blob;
      try {
        // Try inspectionId-based endpoint first for REFUX
        if (clientName === 'REFUX' && sessionType) {
          const { apiClient } = await import('../services/api/authenticatedApiService');
          const response = await apiClient.get(apiPath, { responseType: 'blob' });
          pdfBlob = response.data;
        } else {
          pdfBlob = await downloadInspectionPDF(filename);
        }
      } catch (apiErr: any) {
        // If inspectionId endpoint fails, fall back to registration number for REFUX
        if (clientName === 'REFUX' && sessionType) {
          const availabilityResponse = await checkPDFAvailability(car.carNumber);
          if (!availabilityResponse.success) {
            throw new Error('PDF not available');
          }
          const fallbackFilename = availabilityResponse.filename || `inspection_${car.carNumber}.pdf`;
          pdfBlob = await downloadInspectionPDF(fallbackFilename);
        } else {
          throw apiErr;
        }
      }
      
      // Update verified status
      setVerifiedPdfStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(car.carNumber, { isAvailable: true, isPending: false });
        return newMap;
      });
      
      // Create download link with descriptive filename
      const sessionLabel = sessionType === 'morning' ? 'MORNING' : sessionType === 'evening' ? 'EVENING' : '';
      const downloadFilename = sessionLabel 
        ? `inspection_${car.carNumber}_${sessionLabel}.pdf`
        : filename;
      
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      // Update verified status on error
      setVerifiedPdfStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(car.carNumber, { isAvailable: false, isPending: false });
        return newMap;
      });

      if (err.response?.status === 403) {
        alert('PDF is not available for download. It may be pending approval or not yet ready.');
      } else {
        const sessionLabel = sessionType === 'morning' ? 'MORNING' : sessionType === 'evening' ? 'EVENING' : '';
        const errorMsg = sessionLabel 
          ? `Failed to download ${sessionLabel} inspection PDF. Please try again.`
          : 'Failed to download PDF. Please try again.';
        alert(errorMsg);
      }
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Get actual PDF status (verified or from backend)
  const getActualPdfStatus = (car: DashboardCar) => {
    const verified = verifiedPdfStatus.get(car.carNumber);
    if (verified) {
      return verified;
    }
    // If not verified yet, use backend status
    return { isAvailable: car.pdfReady, isPending: false };
  };

  // Group REFUX inspections by car number and sort by createdAt
  const groupRefuxInspectionsByCar = (cars: DashboardCar[]): Map<string, DashboardCar[]> => {
    const grouped = new Map<string, DashboardCar[]>();
    
    cars.forEach(car => {
      const carNum = car.carNumber;
      if (!grouped.has(carNum)) {
        grouped.set(carNum, []);
      }
      grouped.get(carNum)!.push(car);
    });
    
    // Sort each group by createdAt (earlier = 1st inspection)
    grouped.forEach((inspections) => {
      inspections.sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });
    
    return grouped;
  };

  const getSessionBadge = (session: { status: 'done' | 'pending'; imageCount: number }, sessionName: string) => {
    const isComplete = session.status === 'done';
    const imageCount = session.imageCount || 0;
    // Dynamic max images based on client: REFUX captures 14 images, others capture 10
    const maxImages = clientName === 'REFUX' ? 14 : 10;
    const isOverLimit = imageCount > maxImages;
    
    
    return (
      <div className="flex flex-col gap-1.5">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          isComplete 
            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}>
          {isComplete ? (
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
          )}
          <span className="font-semibold">{sessionName}</span>
        </div>
        {/* Hide image count display for REFUX, show for other clients */}
        {clientName !== 'REFUX' && (
        <div className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-medium ${
          isComplete 
            ? 'bg-green-500/5 text-green-300 border border-green-500/20' 
            : 'bg-yellow-500/5 text-yellow-300 border border-yellow-500/20'
        }`}>
          <span className={isOverLimit ? 'text-orange-400' : ''}>
            {imageCount}/{maxImages}
          </span>
          {isOverLimit && (
            <span className="ml-1 text-orange-400 text-[10px]">(over)</span>
          )}
        </div>
        )}
      </div>
    );
  };

  // Get session display name based on client
  const getSessionDisplayName = (sessionType: 'morning' | 'evening'): string => {
    if (clientName === 'REFUX' || clientName === 'SNAPCABS') {
      return sessionType === 'morning' ? 'MORNING' : 'EVENING';
    }
    return ''; // Other clients don't show session tags
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'processing':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
      case 'pending':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
    }
  };


  // Get max date (today)
  const maxDate = new Date().toISOString().split('T')[0];

  // If viewing a dashboard, show the InspectionDashboard component
  if (viewingDashboard !== null) {
    return (
      <InspectionDashboard
        inspectionId={viewingDashboard}
        onBack={() => setViewingDashboard(null)}
      />
    );
  }

  if (hasAccess === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Checking access...</p>
        </motion.div>
      </div>
    );
  }

  if (hasAccess === false) {
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
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">{error || 'You don\'t have permission to view this dashboard. Only client head users can access.'}</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl"
          >
            Go Back
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (loading && !dashboardData) {
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
      <div className="px-4 md:px-6 pt-2 md:pt-4 pb-3 md:pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="w-10 h-10 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" />
                <span className="truncate">{clientDisplayName || clientName} Dashboard</span>
              </h1>
              <p className="text-gray-400 text-xs md:text-sm">View all inspections from your drivers and head users</p>
            </div>
          </div>
          <div className="text-left md:text-right flex-shrink-0">
            {dashboardData && (
              <>
                <p className="text-white font-semibold text-sm md:text-base">{dashboardData.summary.totalCars} Cars</p>
                <p className="text-gray-400 text-xs">{formatDateForAPI(selectedDate)}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Date Picker */}
      <div className="px-4 md:px-6 pb-3 md:pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3"
        >
          <label className="text-white font-semibold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Select Date:
          </label>
          <div className="relative">
            <input
              type="date"
              value={formatDateForAPI(selectedDate)}
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  const newDate = new Date(value);
                  // Validate the date
                  if (!isNaN(newDate.getTime())) {
                    setSelectedDate(newDate);
                  } else {
                    // If invalid, keep current date or set to today
                    setSelectedDate(new Date());
                  }
                } else {
                  // If cleared, set to today's date
                  setSelectedDate(new Date());
                }
              }}
              max={maxDate}
              className="date-picker-custom bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl px-4 py-2.5 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 focus:outline-none text-sm font-medium cursor-pointer hover:bg-white/15 transition-all duration-200 min-w-[200px]"
            />
          </div>
        </motion.div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 md:px-8 mb-4 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Summary Cards */}
      {dashboardData && dashboardData.summary && (
        <div className="px-4 md:px-8 pb-6 md:pb-8">
          <div className={`grid ${clientName === 'REFUX' ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-5'} gap-4 md:gap-6 mb-6 md:mb-8`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 text-center"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <Car className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
              </div>
              <h3 className="text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Total Cars</h3>
              <p className="text-white font-bold text-xl md:text-3xl">{dashboardData.summary.totalCars}</p>
            </motion.div>

            {(clientName === 'SNAPCABS' || clientName === 'REFUX') && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 text-center"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Morning Done</h3>
                  <p className="text-white font-bold text-xl md:text-3xl">{dashboardData.summary.morningDone}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 text-center"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Evening Done</h3>
                  <p className="text-white font-bold text-xl md:text-3xl">{dashboardData.summary.eveningDone}</p>
                </motion.div>

                {clientName === 'SNAPCABS' && (
                  <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 text-center"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Both Complete</h3>
                  <p className="text-white font-bold text-xl md:text-3xl">{dashboardData.summary.bothDone}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/20 text-center"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <Clock className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm mb-1 md:mb-2">Pending</h3>
                  <p className="text-white font-bold text-xl md:text-3xl">{dashboardData.summary.pending}</p>
                </motion.div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Cars Table */}
          {dashboardData.cars && dashboardData.cars.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl md:rounded-3xl p-8 md:p-12 text-center"
            >
              <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                <Car className="w-8 h-8 md:w-12 md:h-12 text-gray-400" />
              </div>
              <h3 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-4">No Inspections Found</h3>
              <p className="text-gray-400 text-sm md:text-lg">No inspections found for the selected date.</p>
            </motion.div>
          ) : (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl md:rounded-2xl border border-white/20 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className={`px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider ${clientName === 'REFUX' ? 'px-2 md:px-4' : ''}`}>Car Number</th>
                      <th className={`px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider ${clientName === 'REFUX' ? 'px-2 md:px-4' : ''}`}>Inspection ID</th>
                      <th className={`px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider ${
                        clientName === 'REFUX' 
                          ? 'hidden md:table-cell px-2 md:px-4' 
                          : clientName === 'SNAPCABS' 
                          ? '' 
                          : 'hidden md:table-cell'
                      }`}>Created By</th>
                      {clientName === 'REFUX' ? (
                        <th className="px-2 md:px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider hidden sm:table-cell">Inspections</th>
                      ) : clientName === 'SNAPCABS' ? (
                        <>
                          <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">MORNING</th>
                          <th className="px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">EVENING</th>
                        </>
                      ) : null}
                      <th className={`px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider ${
                        clientName === 'REFUX' 
                          ? 'hidden sm:table-cell px-2 md:px-4' 
                          : clientName === 'SNAPCABS' 
                          ? '' 
                          : 'hidden md:table-cell'
                      }`}>Status</th>
                      <th className={`px-4 py-3 md:px-6 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider ${clientName === 'REFUX' ? 'px-2 md:px-4' : ''}`}>PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    <AnimatePresence>
                      {(() => {
                        // For REFUX, group by carNumber and show one row per car
                        if (clientName === 'REFUX' && dashboardData.cars) {
                          const groupedCars = groupRefuxInspectionsByCar(dashboardData.cars);
                          const rows: JSX.Element[] = [];
                          let rowIndex = 0;
                          
                          groupedCars.forEach((inspections, carNumber) => {
                            const firstInspection = inspections[0];
                            const secondInspection = inspections[1];
                            
                            rows.push(
                              <motion.tr
                                key={carNumber}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ delay: rowIndex * 0.05 }}
                                className="hover:bg-white/5 transition-colors duration-200"
                              >
                                <td className="px-2 md:px-4 py-4 md:px-6 md:py-5 text-white font-semibold text-xs md:text-sm align-top">
                                  {carNumber}
                                </td>
                                <td className="px-2 md:px-4 py-4 md:px-6 md:py-5 align-top">
                                  <div className="flex flex-col gap-2 md:gap-3">
                                    {/* 1st Inspection */}
                                    <div className="flex flex-col gap-0.5 md:gap-1">
                                      <span className="text-gray-300 text-[10px] md:text-xs font-semibold">1st</span>
                                      <span className="text-gray-400 text-xs md:text-sm font-mono">#{firstInspection.inspectionId}</span>
                                    </div>
                                    {/* 2nd Inspection (if exists) */}
                                    {secondInspection && (
                                      <div className="flex flex-col gap-0.5 md:gap-1">
                                        <span className="text-gray-300 text-[10px] md:text-xs font-semibold">2nd</span>
                                        <span className="text-gray-400 text-xs md:text-sm font-mono">#{secondInspection.inspectionId}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="hidden md:table-cell px-4 py-4 md:px-6 md:py-5 align-top">
                                  <div className="max-w-[150px] md:max-w-[200px]">
                                    <span className="text-gray-300 text-sm md:text-base truncate block" title={firstInspection.createdBy}>
                                      {firstInspection.createdBy.length > 20 ? `${firstInspection.createdBy.substring(0, 20)}...` : firstInspection.createdBy}
                                    </span>
                                  </div>
                                </td>
                                <td className="hidden sm:table-cell px-2 md:px-4 py-4 md:px-6 md:py-5 align-top">
                                  <div className="flex flex-col gap-2 md:gap-3">
                                    {/* 1st Inspection Status */}
                                    <div className="flex flex-col gap-0.5 md:gap-1">
                                      <div className={`inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium border ${
                                        firstInspection.pdfReady 
                                          ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                          : firstInspection.status === 'processing'
                                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                      }`}>
                                        {firstInspection.pdfReady ? (
                                          <CheckCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        ) : (
                                          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        )}
                                        <span className="hidden sm:inline">MORNING</span>
                                        <span className="sm:hidden">M</span>
                                      </div>
                                    </div>
                                    {/* 2nd Inspection Status (if exists) */}
                                    {secondInspection && (
                                      <div className="flex flex-col gap-0.5 md:gap-1">
                                        <div className={`inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium border ${
                                          secondInspection.pdfReady 
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                            : secondInspection.status === 'processing'
                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                        }`}>
                                          {secondInspection.pdfReady ? (
                                            <CheckCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                          ) : (
                                            <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                          )}
                                          <span className="hidden sm:inline">EVENING</span>
                                          <span className="sm:hidden">E</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="hidden sm:table-cell px-2 md:px-4 py-4 md:px-6 md:py-5 align-top">
                                  <div className="flex flex-col gap-2 md:gap-3">
                                    {/* 1st Inspection Status */}
                                    <span className={`inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold border capitalize ${getStatusColor(firstInspection.status)}`}>
                                      {firstInspection.status}
                                    </span>
                                    {/* 2nd Inspection Status (if exists) */}
                                    {secondInspection && (
                                      <span className={`inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold border capitalize ${getStatusColor(secondInspection.status)}`}>
                                        {secondInspection.status}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 md:px-4 py-4 md:px-6 md:py-5 align-top">
                                  <div className="flex flex-col gap-1.5 md:gap-2 min-w-[100px] md:min-w-[140px]">
                                    {/* 1st Inspection Actions */}
                                    {firstInspection.pdfReady && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setViewingDashboard(firstInspection.inspectionId)}
                                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 md:py-1 px-2 md:px-2 rounded-lg text-xs flex items-center justify-center gap-1 md:gap-1.5 w-full min-h-[36px] md:min-h-0 touch-manipulation"
                                      >
                                        <LayoutDashboard className="w-3.5 h-3.5 md:w-3 md:h-3" />
                                        <span className="text-xs md:text-xs">Dashboard</span>
                                      </motion.button>
                                    )}
                                    {/* 2nd Inspection Actions (if exists) */}
                                    {secondInspection && secondInspection.pdfReady && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setViewingDashboard(secondInspection.inspectionId)}
                                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 md:py-1 px-2 md:px-2 rounded-lg text-xs flex items-center justify-center gap-1 md:gap-1.5 w-full min-h-[36px] md:min-h-0 touch-manipulation"
                                      >
                                        <LayoutDashboard className="w-3.5 h-3.5 md:w-3 md:h-3" />
                                        <span className="text-xs md:text-xs">Dashboard</span>
                                      </motion.button>
                                    )}
                                    {!firstInspection.pdfReady && (!secondInspection || !secondInspection.pdfReady) && (
                                      <span className="text-gray-400 text-[10px] md:text-xs text-center">No Dashboard</span>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            );
                            rowIndex++;
                          });
                          
                          return rows;
                        } else {
                          // For SNAPCABS and other clients, show original table structure
                          return dashboardData.cars.map((car, index) => (
                        <motion.tr
                          key={car.inspectionId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="hover:bg-white/5 transition-colors duration-200"
                        >
                          <td className="px-4 py-4 md:px-6 md:py-5 text-white font-semibold text-sm md:text-base">{car.carNumber}</td>
                          <td className="px-4 py-4 md:px-6 md:py-5 text-gray-300 text-sm md:text-base font-mono">#{car.inspectionId}</td>
                          <td className={`px-4 py-4 md:px-6 md:py-5 ${clientName !== 'SNAPCABS' ? 'hidden md:table-cell' : ''}`}>
                            <div className="max-w-[150px] md:max-w-[200px]">
                              <span className="text-gray-300 text-sm md:text-base truncate block" title={car.createdBy}>
                                {car.createdBy.length > 20 ? `${car.createdBy.substring(0, 20)}...` : car.createdBy}
                              </span>
                            </div>
                          </td>
                              {(clientName === 'SNAPCABS' || clientName === 'REFUX') && (
                            <>
                              <td className="px-4 py-4 md:px-6 md:py-5 align-top">
                                <div className="min-w-[110px]">
                                      {getSessionBadge(car.sessions.morning, getSessionDisplayName('morning'))}
                                </div>
                              </td>
                              <td className="px-4 py-4 md:px-6 md:py-5 align-top">
                                <div className="min-w-[110px]">
                                      {getSessionBadge(car.sessions.evening, getSessionDisplayName('evening'))}
                                </div>
                              </td>
                            </>
                          )}
                          <td className={`px-4 py-4 md:px-6 md:py-5 ${clientName !== 'SNAPCABS' ? 'hidden md:table-cell' : ''}`}>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize ${getStatusColor(car.status)}`}>
                              {car.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 md:px-6 md:py-5">
                            {(() => {
                              const pdfStatus = getActualPdfStatus(car);
                              const isAvailable = pdfStatus.isAvailable;
                              const isPending = pdfStatus.isPending;
                              
                              // For SNAPCABS: Show PDF download button (default behavior)
                              if (clientName === 'SNAPCABS') {
                                return (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${
                                        isAvailable 
                                          ? 'bg-green-400' 
                                          : isPending 
                                          ? 'bg-yellow-400' 
                                          : 'bg-gray-400'
                                      }`}></div>
                                      <span className="text-gray-400 text-xs">
                                        PDF {
                                          isAvailable 
                                            ? 'Ready' 
                                            : isPending 
                                            ? 'Pending Approval' 
                                            : 'Not Ready'
                                        }
                                      </span>
                                    </div>
                                    {isAvailable && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleDownloadPDF(car)}
                                        disabled={downloadingPdf === car.carNumber}
                                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-bold py-1 md:py-2 px-3 md:px-4 rounded-lg text-xs md:text-sm flex items-center gap-2 w-full justify-center"
                                      >
                                        {downloadingPdf === car.carNumber ? (
                                          <>
                                            <Loader className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                                            <span className="hidden md:inline">Downloading...</span>
                                            <span className="md:hidden">Loading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Download className="w-3 h-3 md:w-4 md:h-4" />
                                            <span className="hidden md:inline">Download PDF</span>
                                            <span className="md:hidden">PDF</span>
                                          </>
                                        )}
                                      </motion.button>
                                    )}
                                  </div>
                                );
                              }
                              
                              // For other clients (not REFUX, not SNAPCABS): Show Dashboard button
                              return (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      isAvailable 
                                        ? 'bg-green-400' 
                                        : isPending 
                                        ? 'bg-yellow-400' 
                                        : 'bg-gray-400'
                                    }`}></div>
                                    <span className="text-gray-400 text-xs">
                                      PDF {
                                        isAvailable 
                                          ? 'Ready' 
                                          : isPending 
                                          ? 'Pending Approval' 
                                          : 'Not Ready'
                                      }
                                    </span>
                                  </div>
                                  {isAvailable && (
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => setViewingDashboard(car.inspectionId)}
                                      className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 md:py-2 px-3 md:px-4 rounded-lg text-xs md:text-sm flex items-center gap-2 w-full justify-center"
                                    >
                                      <LayoutDashboard className="w-3 h-3 md:w-4 md:h-4" />
                                      <span className="hidden md:inline">View Dashboard</span>
                                      <span className="md:hidden">Dashboard</span>
                                    </motion.button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </motion.tr>
                          ));
                        }
                      })()}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
