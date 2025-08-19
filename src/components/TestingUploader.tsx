import React, { useCallback, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Car, Play, ArrowLeft } from 'lucide-react';
import { getPresignedUploadUrl, uploadFileToS3, startS3Processing } from '../services/api/uploadService';
import { fetchClaimResults } from '../services/api/claimService';

// Sample images (stand-ins for a, b, c, d)
import imageA from '../assets/images/11.jpeg';
import imageB from '../assets/images/22.jpeg';
import imageC from '../assets/images/33.jpeg';
import imageD from '../assets/images/44.jpeg';

type Position = 'front' | 'right' | 'back' | 'left';

interface TestingUploaderProps {
  onBack: () => void;
  onComplete: () => void;
}

const SAMPLES: Array<{ label: string; url: string; position: Position }> = [
  { label: 'a', url: imageA, position: 'front' },
  { label: 'b', url: imageB, position: 'right' },
  { label: 'c', url: imageC, position: 'back' },
  { label: 'd', url: imageD, position: 'left' },
];

const TestingUploader: React.FC<TestingUploaderProps> = ({ onBack, onComplete }) => {
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [previewParts, setPreviewParts] = useState<Array<{ part: string; mean: number; confidence?: string }>>([]);
  const [previewMeanPerClaim, setPreviewMeanPerClaim] = useState<number>(0);
  const [previewTotal, setPreviewTotal] = useState<number>(0);

  const log = useCallback((line: string) => {
    setLogLines((prev) => [...prev, line]);
    console.log(`[TEST-UPLOAD] ${line}`);
  }, []);

  const toBlob = async (url: string): Promise<Blob> => {
    const res = await fetch(url);
    return await res.blob();
  };

  const runTest = useCallback(async () => {
    if (!carMake.trim() || !carModel.trim()) return;
    setIsRunning(true);
    setLogLines([]);
    log(`Starting test upload for make=${carMake}, model=${carModel}`);
    const positionToClaimId: Record<Position, number | null> = {
      front: null,
      right: null,
      back: null,
      left: null,
    };

    try {
      for (const sample of SAMPLES) {
        log(`Preparing ${sample.label.toUpperCase()} (${sample.position})`);
        const fileName = `test-${sample.label}-${Date.now()}.jpg`;
        const contentType = 'image/jpeg';
        const blob = await toBlob(sample.url);
        log(`Got blob for ${sample.label} (${Math.round(blob.size / 1024)} KB)`);

        const { presignedUrl, fileKey, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
        log(`Received presigned URL for ${sample.label}: key=${fileKey}`);

        const putRes = await uploadFileToS3({ presignedUrl, file: blob, contentType });
        log(`PUT to S3 for ${sample.label}: ok=${putRes.ok}`);

        const resp = await startS3Processing({ carMake, carModel, imageUrl: s3Url, fileKey });
        log(`Start processing for ${sample.label}: claimId=${resp.claimId}, status=${resp.status}`);
        positionToClaimId[sample.position] = resp.claimId;
      }

      // Persist for dashboard
      try {
        localStorage.setItem('claimsByPosition', JSON.stringify(positionToClaimId));
        const ids = Object.values(positionToClaimId).filter((v): v is number => typeof v === 'number');
        localStorage.setItem('recentClaimIds', JSON.stringify(ids));
        log(`Saved claim IDs to localStorage: ${JSON.stringify(ids)}`);
      } catch (e) {
        log(`Failed saving to localStorage: ${String(e)}`);
      }

      // Fetch results preview for the uploaded 4 claims
      try {
        const ids = Object.values(positionToClaimId).filter((v): v is number => typeof v === 'number');
        if (ids.length) {
          const results = await Promise.all(ids.map((id) => fetchClaimResults(id).catch(() => null)));
          const costings = results
            .filter((r): r is NonNullable<typeof r> => !!r)
            .flatMap((r) => r.costings || []);
          const parsePriceRangeToMean = (price: string | number): number => {
            if (typeof price === 'number') return price || 0;
            const cleaned = String(price).replace(/[^0-9\-]/g, '');
            const parts = cleaned.split('-').map((v) => parseInt(v, 10)).filter((n) => !isNaN(n));
            if (parts.length === 0) return 0;
            if (parts.length === 1) return parts[0];
            const [min, max] = [Math.min(parts[0], parts[1]), Math.max(parts[0], parts[1])];
            return Math.round((min + max) / 2);
          };
          const items = costings.map((c) => ({ part: c.part, mean: parsePriceRangeToMean(c.price as any), confidence: c.confidence as string | undefined }));
          const total = items.reduce((s, it) => s + (it.mean || 0), 0);
          const perClaimTotals = results
            .filter((r): r is NonNullable<typeof r> => !!r)
            .map((r) => (r.costings || []).reduce((s, c) => s + parsePriceRangeToMean(c.price as any), 0));
          const meanPerClaim = perClaimTotals.length ? Math.round(perClaimTotals.reduce((a, b) => a + b, 0) / perClaimTotals.length) : 0;
          setPreviewParts(items);
          setPreviewTotal(total);
          setPreviewMeanPerClaim(meanPerClaim);
          log(`Preview totals: total=${total}, meanPerClaim=${meanPerClaim}, items=${items.length}`);
        }
      } catch (e) {
        log(`Failed to fetch preview results: ${String(e)}`);
      }

      log('Test upload complete. Navigating to buffering...');
      onComplete();
    } catch (err: any) {
      log(`Error: ${err?.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  }, [carMake, carModel, log, onComplete]);

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      <div className="flex items-center justify-between p-6 pt-12">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="text-xl font-bold text-white">Test Uploader</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="px-6 pb-20">
        <div className="glass-effect rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white text-lg font-bold">Enter Vehicle Details</h2>
              <p className="text-gray-400 text-sm">Used for request body; registration not sent.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-1">
              <label className="block text-gray-300 text-sm mb-2">Make</label>
              <input
                type="text"
                value={carMake}
                onChange={(e) => setCarMake(e.target.value)}
                placeholder="e.g., Honda"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-gray-300 text-sm mb-2">Model</label>
              <input
                type="text"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                placeholder="e.g., City"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-gray-300 text-sm mb-2">Registration No. (optional)</label>
              <input
                type="text"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="e.g., MH 12 AB 1234"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-gray-400 text-sm">Uploads 4 sample images (a,b,c,d) and starts AI processing.</div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!carMake.trim() || !carModel.trim() || isRunning}
              onClick={runTest}
              className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 ${
                !carMake.trim() || !carModel.trim() || isRunning
                  ? 'bg-blue-500/40 text-white/60 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Test Scenario'}
            </motion.button>
          </div>
        </div>

        <div className="glass-effect rounded-2xl p-6">
          <h3 className="text-white font-bold mb-3">Logs</h3>
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 h-64 overflow-auto text-sm text-gray-300">
            {logLines.length === 0 ? (
              <div className="text-gray-500">No logs yet.</div>
            ) : (
              <ul className="space-y-1">
                {logLines.map((l, i) => (
                  <li key={i} className="font-mono">{l}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Results Preview */}
        {(previewParts.length > 0) && (
          <div className="glass-effect rounded-2xl p-6 mt-6">
            <h3 className="text-white font-bold mb-4">Results Preview</h3>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-gray-300">Mean per-claim total ({previewParts.length ? 4 : 0} claims)</span>
              <span className="text-blue-400 font-bold">₹{previewMeanPerClaim.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {previewParts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 text-[10px] font-bold uppercase">{p.confidence || 'n/a'}</span>
                    </div>
                    <span className="text-white font-semibold">{p.part}</span>
                  </div>
                  <span className="text-gray-300 font-bold">₹{p.mean.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 my-4" />
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-lg">Total Amount</span>
              <span className="text-green-400 font-bold text-2xl">₹{previewTotal.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestingUploader;


