import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Camera, Car, User, X, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { getPresignedUploadUrl, uploadFileToS3, startS3Processing } from '../services/api/uploadService';

interface ManualUploadScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

const ManualUploadScreen: React.FC<ManualUploadScreenProps> = ({ onComplete, onBack }) => {
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile device
  React.useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    setIsMobile(isMobileDevice);
    console.log('Mobile device detected:', isMobileDevice);
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setDebugInfo(`Files selected: ${files.length} files`);
    
    const imageFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        setDebugInfo(prev => prev + `\nRejected: ${file.name} (${file.type})`);
      }
      return isImage;
    });
    
    if (uploadedImages.length + imageFiles.length > 4) {
      setErrorMessage('You can only upload a maximum of 4 images');
      return;
    }

    // Check file sizes (mobile browsers might have issues with large files)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      setErrorMessage(`Files too large (max 10MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setDebugInfo(prev => prev + `\nAdding: ${imageFiles.map(f => `${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`).join(', ')}`);
    setUploadedImages(prev => [...prev, ...imageFiles]);
    setErrorMessage(''); // Clear any previous errors
    
    // Clear the input for mobile browsers
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartUpload = async () => {
    if (uploadedImages.length !== 4) {
      alert('Please upload exactly 4 images for analysis');
      return;
    }

    if (!vehicleMake.trim() || !vehicleModel.trim()) {
      alert('Please provide vehicle make and model');
      return;
    }

    setIsUploading(true);
    
    try {
      // Store vehicle details in localStorage for the report
      localStorage.setItem('vehicleDetails', JSON.stringify({
        make: vehicleMake,
        model: vehicleModel,
        regNumber: vehicleRegNumber
      }));

      // Upload each image and get claim IDs (same as camera flow)
      const claimIds: number[] = [];
      const positions = ['front', 'right', 'back', 'left'];
      
      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        const position = positions[i];
        
        console.log(`Uploading ${position} image:`, file.name, file.size, file.type);
        
        // Create file name
        const fileName = `${position}-${Date.now()}.jpg`;
        const contentType = 'image/jpeg';
        
        try {
          // Get presigned URL with timeout
          setDebugInfo(prev => prev + `\nGetting URL for ${position}...`);
          const { presignedUrl, fileKey, s3Url } = await Promise.race([
            getPresignedUploadUrl({ 
              fileName, 
              contentType 
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout getting presigned URL')), 30000)
            )
          ]);
          
          // Upload file to S3 with timeout
          setDebugInfo(prev => prev + `\nUploading ${position} to S3...`);
          const uploadResult = await Promise.race([
            uploadFileToS3({ 
              presignedUrl, 
              file, 
              contentType 
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout uploading to S3')), 60000)
            )
          ]);
          
          if (!uploadResult.ok) {
            throw new Error(`S3 upload failed for ${position} image`);
          }
          
          // Start S3 processing and get claim ID with timeout
          setDebugInfo(prev => prev + `\nProcessing ${position}...`);
          const result = await Promise.race([
            startS3Processing({
              carMake: vehicleMake,
              carModel: vehicleModel,
              imageUrl: s3Url,
              fileKey,
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout starting S3 processing')), 30000)
            )
          ]);
          
          setDebugInfo(prev => prev + `\n✅ ${position} completed (ID: ${result.claimId})`);
          claimIds.push(result.claimId);
          
          // Store claim ID mapped to position in localStorage (same as camera)
          try {
            const mapJson = localStorage.getItem('claimsByPosition');
            const currentMap: Record<string, number | null> = mapJson ? JSON.parse(mapJson) : { front: null, right: null, back: null, left: null };
            currentMap[position] = result.claimId;
            localStorage.setItem('claimsByPosition', JSON.stringify(currentMap));
          } catch (localStorageError) {
            console.warn('Failed to store claim ID in localStorage:', localStorageError);
          }
          
        } catch (uploadError) {
          const errorMsg = `Failed to upload ${position} image: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`;
          setDebugInfo(prev => prev + `\n❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }

      // Store claim IDs for dashboard use (same as camera)
      localStorage.setItem('recentClaimIds', JSON.stringify(claimIds));
      setDebugInfo(prev => prev + `\n🎉 All uploads completed! Claim IDs: ${claimIds.join(', ')}`);

      onComplete();
    } catch (error) {
      // More detailed error message for debugging
      let errorMessage = 'Upload failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Browser security error. Please try using a different browser or clear your browser cache.';
        } else if (error.message.includes('Failed to upload')) {
          errorMessage = `Upload error: ${error.message}`;
        } else if (error.message.includes('Timeout')) {
          errorMessage = `Timeout error: ${error.message}. Please check your internet connection.`;
        }
      }
      
      setErrorMessage(errorMessage);
      setDebugInfo(prev => prev + `\n❌ Final error: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
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
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="text-xl font-bold text-white">Manual Upload</h1>
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
            <Upload className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Upload Vehicle Images</h2>
          <p className="text-gray-400 text-lg">
            Upload 4 clear images of your vehicle for damage analysis
          </p>
        </motion.div>

        {/* Upload Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-effect rounded-2xl p-6 mb-6"
        >
          <div className="flex items-start">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
              <Camera className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-400 mb-2">Image Requirements</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Upload exactly 4 images</li>
                <li>• Ensure good lighting and clear visibility</li>
                <li>• Include all sides of the vehicle</li>
                <li>• Supported formats: JPG, PNG, JPEG</li>
                <li>• Maximum file size: 10MB per image</li>
                {isMobile && (
                  <li>• On mobile: Use camera or select from gallery</li>
                )}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Image Upload Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <h3 className="text-white font-bold mb-4">Upload Images ({uploadedImages.length}/4)</h3>
          
          {/* Upload Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="relative">
                {uploadedImages[index] ? (
                  <div className="relative w-full h-32 rounded-2xl overflow-hidden">
                    <img
                      src={URL.createObjectURL(uploadedImages[index])}
                      alt={`Uploaded image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-green-500/80 rounded-full px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-white/20 rounded-2xl flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                  >
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-white/60 mx-auto mb-2" />
                      <p className="text-white/60 text-xs">Click to upload</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {uploadedImages.length > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white/10 border border-white/20 text-white font-semibold py-3 px-6 rounded-2xl hover:bg-white/20 transition-colors"
            >
              Add More Images
            </motion.button>
          )}
        </motion.div>

        {/* Error Message */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4"
          >
            <div className="flex items-start">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-red-400 font-bold mb-2">Upload Error</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Debug Info (only show on mobile or when there are errors) */}
        {(isMobile || errorMessage || debugInfo) && debugInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4"
          >
            <div className="flex items-start">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                <HelpCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-blue-400 font-bold mb-2">Debug Info</h3>
                <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                  {debugInfo}
                </pre>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowVehicleForm(true)}
            disabled={uploadedImages.length !== 4 || isUploading}
            className={`w-full font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 ${
              uploadedImages.length !== 4 || isUploading
                ? 'bg-blue-500/40 text-white/60 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
            }`}
          >
            <Car className="w-5 h-5" />
            {isUploading ? 'Uploading Images...' : 'Continue to Vehicle Details'}
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
                  onClick={handleStartUpload}
                  disabled={!vehicleMake.trim() || !vehicleModel.trim() || isUploading}
                  className={`px-5 py-3 rounded-xl font-semibold ${
                    !vehicleMake.trim() || !vehicleModel.trim() || isUploading
                      ? 'bg-blue-500/40 text-white/60 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isUploading ? 'Uploading...' : 'Start Analysis'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ManualUploadScreen;
