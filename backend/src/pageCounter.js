const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { PDFDocument } = require('pdf-lib');

// Helper to look up LibreOffice path on Windows or POSIX
function getLibreOfficeExecutable() {
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
    return 'soffice'; // Fallback to PATH
  }
  return 'soffice'; // Linux/macOS
}

/**
 * Converts DOC/DOCX/other to PDF and returns the converted PDF filepath.
 * Caller is responsible for deleting the converted PDF.
 */
function convertToPdf(filePath, outDir) {
  return new Promise((resolve, reject) => {
    const loPath = getLibreOfficeExecutable();
    const cmd = `${loPath} --headless --convert-to pdf --outdir "${outDir}" "${filePath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn('LibreOffice conversion failed:', error.message);
        return reject(error);
      }
      
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const convertedPath = path.join(outDir, `${baseName}.pdf`);
      
      if (fs.existsSync(convertedPath)) {
        resolve(convertedPath);
      } else {
        reject(new Error('Converted PDF file not found at expected path: ' + convertedPath));
      }
    });
  });
}

/**
 * Reads PDF file and gets exact page count.
 */
async function getPdfPageCount(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { 
      updateMetadata: false, 
      ignoreEncryption: true 
    });
    return pdfDoc.getPageCount();
  } catch (err) {
    console.error(`Error counting PDF pages for ${filePath}:`, err);
    throw err;
  }
}

/**
 * Primary interface to count pages of files.
 */
async function countPages(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  
  // 1. Images
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext) || mimeType.startsWith('image/')) {
    return 1;
  }
  
  // 2. PDF
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return await getPdfPageCount(filePath);
  }
  
  // 3. Word Documents (DOC/DOCX)
  if (['.doc', '.docx'].includes(ext)) {
    const outDir = path.dirname(filePath);
    try {
      console.log(`Attempting LibreOffice conversion for docx page count...`);
      const convertedPdfPath = await convertToPdf(filePath, outDir);
      const pages = await getPdfPageCount(convertedPdfPath);
      
      // Clean up the temporary converted PDF file
      try {
        fs.unlinkSync(convertedPdfPath);
      } catch (unlinkErr) {
        console.error('Failed to unlink temporary converted PDF:', unlinkErr);
      }
      
      return pages;
    } catch (err) {
      console.warn('Could not count pages using LibreOffice. Falling back to default estimation.', err.message);
      // Fallback: estimation based on size (1 page per 15KB, min 1)
      const stats = fs.statSync(filePath);
      const estimatedPages = Math.max(1, Math.ceil(stats.size / 15000));
      return estimatedPages;
    }
  }
  
  // Default fallback
  return 1;
}

module.exports = {
  countPages
};
