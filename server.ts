import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import { predictResumeScore, calculateCosineSimilarity } from './ml-engine';

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for PDF uploads
const upload = multer({ dest: uploadDir });

async function startServer() {
  // API Routes
  app.use(express.json());

  app.post('/api/extract-pdf', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'jobDescription', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const resumeFile = files['resume']?.[0];
      const jdFile = files['jobDescription']?.[0];
      
      let resumeText = req.body.resumeText || '';
      let jobDescription = req.body.jobDescriptionText || '';

      if (resumeFile) {
        const dataBuffer = fs.readFileSync(resumeFile.path);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        resumeText = result.text;
        fs.unlinkSync(resumeFile.path);
      }

      if (jdFile) {
        const dataBuffer = fs.readFileSync(jdFile.path);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        jobDescription = result.text;
        fs.unlinkSync(jdFile.path);
      }

      if (!resumeText && !jobDescription) {
        return res.status(400).json({ error: 'No content provided for extraction' });
      }

      // If both are present, perform ML analysis
      let analysis = null;
      if (resumeText && jobDescription) {
        const score = predictResumeScore(resumeText);
        const matchSim = calculateCosineSimilarity(resumeText, jobDescription);
        analysis = {
          score,
          matchPercentage: Math.round(matchSim * 100)
        };
      }

      res.json({ 
        text: resumeText, 
        jobDescription: jobDescription,
        analysis 
      });
    } catch (error) {
      console.error('Extraction Error:', error);
      res.status(500).json({ error: 'Failed to extract content' });
    }
  });

  app.post('/api/ml-analyze', (req, res) => {
    try {
      const { resumeText, jobDescription } = req.body;
      if (!resumeText || !jobDescription) {
        return res.status(400).json({ error: 'Missing resume text or job description' });
      }

      const score = predictResumeScore(resumeText);
      const matchSim = calculateCosineSimilarity(resumeText, jobDescription);
      const matchPercentage = Math.round(matchSim * 100);

      res.json({ score, matchPercentage });
    } catch (error) {
      console.error('ML Analysis Error:', error);
      res.status(500).json({ error: 'ML analysis failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
