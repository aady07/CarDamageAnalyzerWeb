import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, Upload, FileText, File, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { 
  ReportFormatsResponse,
  ReportUploadResponse,
  getReportFormats,
  downloadReport,
  uploadModifiedReport
} from '../services/api/adminService';

interface ReportManagerProps {
  inspectionId: number;
  registrationNumber: string;
  onBack: () => void;
  onUpload: () => void;
}

const ReportManager: React.FC<ReportManagerProps> = ({ inspectionId, registrationNumber, onBack, onUpload }) => {
  const [formats, setFormats] = useState<ReportFormatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    loadFormats();
  }, [inspectionId]);

  const loadFormats = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getReportFormats(inspectionId);
      setFormats(data);
    } catch (err) {
      setError('Failed to load report formats. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: string) => {
    try {
      setDownloading(format);
      setError('');
      
      const blob = await downloadReport(inspectionId, format);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inspection-report-${inspectionId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError('Failed to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a PDF or DOCX file.');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        return;
      }
      
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !editReason.trim()) {
      setError('Please select a file and provide an edit reason.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const response: ReportUploadResponse = await uploadModifiedReport(inspectionId, selectedFile, editReason);
      
      // Reset form
      setSelectedFile(null);
      setEditReason('');
      
      // Reload formats to get updated info
      await loadFormats();
      
      // Notify parent component
      onUpload();
      
    } catch (err) {
      setError('Failed to upload report. Please try again.');
    } finally {
      setUploading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading report formats...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !formats) {
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
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Report</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadFormats}
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
              <h1 className="text-3xl font-bold text-white">Report Manager</h1>
              <p className="text-gray-400">{registrationNumber} - Inspection #{inspectionId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-8 mb-6">
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

      {/* Main Content */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Download Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Download className="w-6 h-6 text-blue-400" />
              Download Report
            </h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-gray-400 text-sm">Current Format: {formats?.currentFormat?.toUpperCase() || 'Unknown'}</span>
              </div>

              <div className="space-y-3">
                {formats?.availableFormats?.length ? (
                  formats.availableFormats.map((format) => (
                    <motion.button
                      key={format}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownload(format)}
                      disabled={downloading === format}
                      className={`w-full p-4 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                        format === formats.currentFormat
                          ? 'bg-green-500/20 border-green-500/30 text-green-400'
                          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5" />
                        <span className="font-semibold">{format.toUpperCase()} Report</span>
                      </div>
                      {downloading === format ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </motion.button>
                  ))
                ) : (
                  <div className="bg-gray-500/20 border border-gray-500/30 text-gray-400 px-4 py-3 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold">No Formats Available</span>
                    </div>
                    <p className="text-sm mt-1">No report formats are available for download.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Upload className="w-6 h-6 text-purple-400" />
              Upload Modified Report
            </h2>

            {formats?.canUpload ? (
              <div className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Select Modified Report
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all duration-200 cursor-pointer">
                      {selectedFile ? (
                        <div className="flex items-center gap-3">
                          <File className="w-5 h-5 text-green-400" />
                          <span className="font-semibold">{selectedFile.name}</span>
                          <span className="text-gray-400 text-sm">
                            ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span>Click to select PDF or DOCX file (max 10MB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Reason */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Edit Reason
                  </label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={3}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none resize-none"
                    placeholder="Describe the changes made to the report..."
                  />
                </div>

                {/* Upload Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !editReason.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200"
                >
                  {uploading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Uploading Report...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload Modified Report
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <div className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-xl text-center">
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Upload Not Available</span>
                </div>
                <p className="text-sm mt-1">Report upload is not available for this inspection.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ReportManager;
