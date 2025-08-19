import { PDFDocument } from 'pdf-lib';

export type ReportItem = {
  part: string;
  price: number;
  confidence?: string;
};

export type GenerateWebReportOptions = {
  claimId?: string | number;
  assessmentId?: string | number;
  vehicleMake?: string;
  vehicleModel?: string;
  total?: number;
  items?: ReportItem[];
  photoUrls?: string[];
  generatedAt?: string;
};

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

export async function generateAndDownloadReport(options: GenerateWebReportOptions) {
  const templateUrl = new URL('../assets/report-template.pdf', import.meta.url).href;
  const templateBytes = new Uint8Array(await fetchArrayBuffer(templateUrl));
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  const now = new Date();
  const generatedAt = options.generatedAt || now.toISOString();
  const fmt = (n?: number) => (n != null ? `INR ${Number(n).toLocaleString()}` : '');
  try { form.getTextField('report.claim.id').setText(String(options.claimId || '')); } catch {}
  try { form.getTextField('report.vehicle.make').setText(String(options.vehicleMake || '')); } catch {}
  try { form.getTextField('report.vehicle.model').setText(String(options.vehicleModel || '')); } catch {}
  try { form.getTextField('report.summary.total').setText(fmt(options.total)); } catch {}
  try { form.getTextField('report.generatedAt').setText(generatedAt); } catch {}

  const items = options.items || [];
  let partsTotal = 0;
  for (let i = 0; i < Math.min(items.length, 8); i += 1) {
    const r = i + 1;
    const it = items[i];
    try { form.getTextField(`report.items.r${r}.part`).setText(it.part || ''); } catch {}
    try { form.getTextField(`report.items.r${r}.confidence`).setText(it.confidence || ''); } catch {}
    const price = Number(it.price || 0);
    try { form.getTextField(`report.items.r${r}.price`).setText(price ? fmt(price) : ''); } catch {}
    partsTotal += price;
  }
  try { form.getTextField('report.items.total').setText(partsTotal ? fmt(partsTotal) : ''); } catch {}

  // Draw images on page 4 if provided
  if (options.photoUrls && options.photoUrls.length) {
    const pageIndex = 1; // Photos on page 2 in simplified template
    const page = pdfDoc.getPage(pageIndex);
    const mm = (n: number) => (n * 72) / 25.4;
    const photoW = mm(85);
    const photoH = mm(60);
    const gap = mm(10);
    let px = mm(12);
    const height = page.getSize().height;
    let py = height - mm(42) - mm(10) - photoH;
    for (let i = 0; i < Math.min(options.photoUrls.length, 6); i += 1) {
      const bytes = new Uint8Array(await fetchArrayBuffer(options.photoUrls[i]));
      let img;
      try { img = await pdfDoc.embedJpg(bytes); } catch { img = await pdfDoc.embedPng(bytes); }
      page.drawImage(img, { x: px, y: py, width: photoW, height: photoH });
      px += photoW + gap;
      if ((i + 1) % 2 === 0) { px = mm(12); py -= photoH + mm(18); }
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `damage-report-${Date.now()}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}


