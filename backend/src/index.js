require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { initDB, dbRun, dbGet, dbAll } = require('./db');
const { countPages } = require('./pageCounter');
const { startCleanupCron } = require('./cleanup');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocket.Server({ server });

// WebSocket broadcasting helper
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Determine the root uploads directory
let UPLOAD_ROOT = process.env.UPLOAD_DIR || (process.platform === 'win32'
  ? path.join(process.cwd(), 'tmp', 'uploads')
  : '/tmp/uploads');

// Verify UPLOAD_ROOT is writable, otherwise fallback to a safe option
try {
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
  // Test write permission
  const testFile = path.join(UPLOAD_ROOT, '.write-test-' + Date.now());
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
} catch (err) {
  console.warn(`Upload directory ${UPLOAD_ROOT} is not writable:`, err.message);
  UPLOAD_ROOT = process.platform === 'win32'
    ? path.join(process.cwd(), 'tmp', 'uploads')
    : '/tmp/uploads';
  console.warn(`Falling back to upload directory: ${UPLOAD_ROOT}`);
  try {
    if (!fs.existsSync(UPLOAD_ROOT)) {
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    }
  } catch (e) {
    console.error('Critical: Failed to create fallback upload directory:', e.message);
  }
}

// In-memory rate limiter: Max 30 upload/api requests per minute per IP
const rateLimitWindowMs = 60 * 1000;
const rateLimitMaxRequests = 30;
const ipRequestCounts = new Map();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (!ipRequestCounts.has(ip)) {
    ipRequestCounts.set(ip, []);
  }
  
  const timestamps = ipRequestCounts.get(ip).filter(t => now - t < rateLimitWindowMs);
  timestamps.push(now);
  ipRequestCounts.set(ip, timestamps);
  
  if (timestamps.length > rateLimitMaxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  next();
}

// Ensure the directory for a shop exists
function getShopUploadDir(shopId) {
  const shopDir = path.join(UPLOAD_ROOT, shopId);
  if (!fs.existsSync(shopDir)) {
    fs.mkdirSync(shopDir, { recursive: true });
  }
  return shopDir;
}

// Sanitize filename
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Extract shopId from query or body
    const shopId = req.query.shopId || req.body.shopId || 'default';
    const shopDir = getShopUploadDir(shopId);
    cb(null, shopDir);
  },
  filename: (req, file, cb) => {
    const jobId = uuidv4();
    const cleanName = sanitizeFilename(file.originalname);
    // Prefix with jobId_ as required: {jobId}_{filename}
    const finalFilename = `${jobId}_${cleanName}`;
    // Attach jobId to request object so we can use it in the handler
    file.jobId = jobId;
    file.finalFilename = finalFilename;
    cb(null, finalFilename);
  }
});

// File validation filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Images (PNG/JPG), and Word files (DOC/DOCX) are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit
  }
});

// Helper for LibreOffice executable path (for preview conversion)
function getLibreOfficeExecutable() {
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
    return 'soffice';
  }
  return 'soffice';
}

// Endpoints

// 1. File Upload
app.post('/upload', rateLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { shopId, copies, color, paperSize, duplex, customerName } = req.body;
    if (!shopId) {
      // Clean up uploaded file if shopId is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'shopId is required.' });
    }

    const jobId = req.file.jobId;
    const filename = req.file.finalFilename;
    const originalName = req.file.originalname;
    const filepath = req.file.path;
    const mimeType = req.file.mimetype;

    // Default parameters if not sent
    const parsedCopies = parseInt(copies) || 1;
    const parsedColor = color === 'false' || color === '0' ? 0 : 1; // 1 = Color, 0 = B&W
    const parsedPaperSize = paperSize || 'A4';
    const parsedDuplex = duplex === 'true' || duplex === '1' ? 1 : 0; // 1 = Double, 0 = Single
    const cleanCustomerName = (customerName || 'Anonymous').trim();

    // Calculate pages
    console.log(`Calculating pages for: ${originalName} (${mimeType})`);
    let pages = 1;
    try {
      pages = await countPages(filepath, mimeType);
    } catch (countErr) {
      console.warn('Failed to count pages, defaulting to 1:', countErr.message);
    }

    // Insert job into database
    await dbRun(
      `INSERT INTO jobs (id, shop_id, customer_name, filename, original_name, filepath, mime_type, pages, copies, color, paper_size, duplex, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, shopId, cleanCustomerName, filename, originalName, filepath, mimeType, pages, parsedCopies, parsedColor, parsedPaperSize, parsedDuplex, 'waiting']
    );

    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);

    res.status(201).json({
      message: 'Job created successfully',
      job: {
        id: job.id,
        shopId: job.shop_id,
        customerName: job.customer_name,
        filename: job.filename,
        originalName: job.original_name,
        pages: job.pages,
        copies: job.copies,
        color: job.color === 1,
        paperSize: job.paper_size,
        duplex: job.duplex === 1,
        status: job.status,
        createdAt: job.created_at
      }
    });

  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: err.message || 'Server error occurred during upload.' });
  }
});

// 2. Get Jobs for a shop
app.get('/jobs', async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId) {
      return res.status(400).json({ error: 'shopId parameter is required' });
    }

    const rows = await dbAll(
      `SELECT * FROM jobs WHERE shop_id = ? ORDER BY created_at DESC`,
      [shopId]
    );

    // Map DB schema to camelCase JSON response
    const jobs = rows.map(job => ({
      id: job.id,
      shopId: job.shop_id,
      customerName: job.customer_name,
      filename: job.filename,
      originalName: job.original_name,
      pages: job.pages,
      copies: job.copies,
      color: job.color === 1,
      paperSize: job.paper_size,
      duplex: job.duplex === 1,
      status: job.status,
      createdAt: job.created_at,
      hasFile: !!job.filepath
    }));

    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve jobs.' });
  }
});

// 3. Get Single Job
app.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      shopId: job.shop_id,
      customerName: job.customer_name,
      filename: job.filename,
      originalName: job.original_name,
      pages: job.pages,
      copies: job.copies,
      color: job.color === 1,
      paperSize: job.paper_size,
      duplex: job.duplex === 1,
      status: job.status,
      createdAt: job.created_at,
      hasFile: !!job.filepath
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve job details.' });
  }
});

// 4. Update Job options (Save instantly / Optimistic UI backend support)
app.post('/update', async (req, res) => {
  try {
    const { jobId, copies, color, paperSize, duplex, status } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Merge changes
    const updatedCopies = copies !== undefined ? parseInt(copies) : job.copies;
    const updatedColor = color !== undefined ? (color === true || color === 'true' || color === 1 ? 1 : 0) : job.color;
    const updatedPaperSize = paperSize !== undefined ? paperSize : job.paper_size;
    const updatedDuplex = duplex !== undefined ? (duplex === true || duplex === 'true' || duplex === 1 ? 1 : 0) : job.duplex;
    const updatedStatus = status !== undefined ? status : job.status;

    await dbRun(
      `UPDATE jobs 
       SET copies = ?, color = ?, paper_size = ?, duplex = ?, status = ?
       WHERE id = ?`,
      [updatedCopies, updatedColor, updatedPaperSize, updatedDuplex, updatedStatus, jobId]
    );

    // Notify connected dashboards
    broadcast({ event: 'job_updated', shopId: job.shop_id, jobId });

    res.json({ message: 'Job updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update job.' });
  }
});

// 5. Print Confirmation (Mark status = done, delete physical file)
app.post('/print', async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Delete the file if it exists
    if (job.filepath && fs.existsSync(job.filepath)) {
      try {
        fs.unlinkSync(job.filepath);
        console.log(`Deleted file after print confirmation: ${job.filepath}`);
      } catch (unlinkErr) {
        console.error(`Failed to delete file ${job.filepath}:`, unlinkErr);
      }
    }

    // Mark job = done, clear filepath
    await dbRun(
      `UPDATE jobs SET status = 'done', filepath = NULL WHERE id = ?`,
      [jobId]
    );

    // Notify connected dashboards
    broadcast({ event: 'job_updated', shopId: job.shop_id, jobId });

    res.json({ message: 'Job marked as printed and file deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete print operation.' });
  }
});

// 6. Secure File Streaming & Preview Conversion
app.get('/file/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const preview = req.query.preview === 'true';
    
    const job = await dbGet('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job || !job.filepath) {
      return res.status(404).json({ error: 'File not found or already deleted.' });
    }

    if (!fs.existsSync(job.filepath)) {
      return res.status(404).json({ error: 'Physical file does not exist on disk.' });
    }

    const ext = path.extname(job.filepath).toLowerCase();

    // Word Doc preview conversion on-the-fly
    if (['.doc', '.docx'].includes(ext) && preview) {
      const outDir = path.dirname(job.filepath);
      const loPath = getLibreOfficeExecutable();
      
      console.log(`Converting ${job.filepath} to PDF for dashboard preview...`);
      const cmd = `${loPath} --headless --convert-to pdf --outdir "${outDir}" "${job.filepath}"`;
      
      const { exec } = require('child_process');
      exec(cmd, async (loErr) => {
        if (loErr) {
          console.warn('On-the-fly LibreOffice conversion failed. Falling back to Mammoth HTML preview.');
          try {
            const mammoth = require('mammoth');
            const result = await mammoth.convertToHtml({ path: job.filepath });
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body {
                    font-family: system-ui, -apple-system, sans-serif;
                    line-height: 1.6;
                    color: #e2e8f0;
                    background-color: #0f172a;
                    padding: 2.5rem;
                    max-width: 800px;
                    margin: 0 auto;
                  }
                  p { margin-bottom: 1.2em; }
                  h1, h2, h3 { color: #f8fafc; margin-top: 1.6em; margin-bottom: 0.6em; }
                  h1 { font-size: 1.75rem; border-bottom: 1px solid #334155; padding-bottom: 0.4rem; }
                  h2 { font-size: 1.4rem; }
                  table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
                  th, td { border: 1px solid #334155; padding: 0.65rem; text-align: left; }
                  th { background-color: #1e293b; color: #f8fafc; }
                  img { max-width: 100%; height: auto; border-radius: 0.5rem; }
                  ul, ol { margin: 1em 0; padding-left: 2em; }
                  li { margin-bottom: 0.4em; }
                </style>
              </head>
              <body>
                <div style="background-color: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); padding: 1rem; border-radius: 1rem; margin-bottom: 2rem; font-size: 0.85rem; color: #a5b4fc; display: flex; items-center: center; gap: 0.5rem;">
                  <span>ℹ️</span> 
                  <span><strong>HTML Fallback Preview</strong> (Headless LibreOffice not available on server)</span>
                </div>
                ${result.value}
              </body>
              </html>
            `;
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', 'inline; filename="preview.html"');
            return res.send(html);
          } catch (mammothErr) {
            console.error('Mammoth conversion failed:', mammothErr);
            return res.status(500).json({ error: 'Could not generate preview for Word Document. Install LibreOffice on server.' });
          }
        }

        const baseName = path.basename(job.filepath, ext);
        const convertedPdfPath = path.join(outDir, `${baseName}.pdf`);

        if (fs.existsSync(convertedPdfPath)) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
          
          const stream = fs.createReadStream(convertedPdfPath);
          stream.pipe(res);

          // Clean up converted file after streaming completes
          res.on('finish', () => {
            try {
              fs.unlinkSync(convertedPdfPath);
            } catch (cleanupErr) {
              console.error('Failed to clean up temporary preview PDF:', cleanupErr);
            }
          });
        } else {
          res.status(500).json({ error: 'Converted preview PDF not found.' });
        }
      });
      return;
    }

    // Normal streaming for PDF and images
    let contentType = job.mime_type;
    
    // Extension-based mime-type override to prevent browser downloading instead of viewing
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (['.png'].includes(ext)) {
      contentType = 'image/png';
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      contentType = 'image/jpeg';
    } else if (['.webp'].includes(ext)) {
      contentType = 'image/webp';
    }
    
    res.setHeader('Content-Type', contentType);
    
    // Set headers to open in browser (inline) rather than download
    if (ext === '.pdf' || contentType.startsWith('image/')) {
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(job.filepath)}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(job.filepath)}"`);
    }

    const stream = fs.createReadStream(job.filepath);
    stream.pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stream file.' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start Database & Listen
const startServer = async () => {
  await initDB();
  
  // Create UPLOAD_ROOT recursive directory
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    console.log(`Upload root directory created at ${UPLOAD_ROOT}`);
  }

  // Start Cron Job
  startCleanupCron();

  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer();
