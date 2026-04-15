import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Cpu, 
  BrainCircuit, 
  MessageSquare, 
  TrendingUp,
  Loader2,
  ChevronRight,
  Target,
  Briefcase,
  ExternalLink,
  MapPin,
  Clock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  analyzeResumeWithAI, 
  extractTextFromImage, 
  findJobsWithAI, 
  suggestJobDescription, 
  getRecruiterMatch,
  getCareerRoadmap,
  optimizeResume,
  type AnalysisResult, 
  type Job,
  type RecruiterMatch,
  type CareerRoadmap,
  type ResumeOptimization
} from './lib/gemini';
import { SplineSceneBasic } from './components/SplineSceneBasic';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState<{
    score: number;
    matchPercentage: number;
    aiAnalysis: AnalysisResult | null;
    jobs: Job[];
  } | null>(null);

  const [recruiterMatch, setRecruiterMatch] = useState<RecruiterMatch | null>(null);
  const [careerRoadmap, setCareerRoadmap] = useState<CareerRoadmap | null>(null);
  const [optimizedResume, setOptimizedResume] = useState<ResumeOptimization | null>(null);

  const [isMatching, setIsMatching] = useState(false);
  const [isRoadmapping, setIsRoadmapping] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeTool, setActiveTool] = useState<'match' | 'roadmap' | 'optimize' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'jd' = 'resume') => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    const isPDF = uploadedFile.type === 'application/pdf';
    const isImage = uploadedFile.type.startsWith('image/');

    if (!isPDF && !isImage) {
      setError('Please upload a PDF or an image file.');
      return;
    }

    if (type === 'resume') setFile(uploadedFile);
    setError(null);
    setIsExtracting(true);

    try {
      if (isPDF) {
        const formData = new FormData();
        if (type === 'resume') {
          formData.append('resume', uploadedFile);
          if (jobDescription) formData.append('jobDescriptionText', jobDescription);
        } else {
          formData.append('jobDescription', uploadedFile);
          if (resumeText) formData.append('resumeText', resumeText);
        }

        const response = await fetch('/api/extract-pdf', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        if (type === 'resume') {
          setResumeText(data.text);
          if (data.jobDescription) setJobDescription(data.jobDescription);
        } else {
          setJobDescription(data.jobDescription);
        }

        if (data.analysis) {
          setResults(prev => ({
            score: data.analysis.score,
            matchPercentage: data.analysis.matchPercentage,
            aiAnalysis: prev?.aiAnalysis || null,
            jobs: prev?.jobs || [],
          }));
        }
      } else {
        // Handle Image with Gemini Vision (only for resume)
        if (type === 'jd') {
          setError('Image extraction is only supported for resumes. Please use PDF for job descriptions.');
          return;
        }
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(uploadedFile);
        });
        const base64 = await base64Promise;
        const text = await extractTextFromImage(base64, uploadedFile.type);
        setResumeText(text);
      }
    } catch (err) {
      setError('Failed to extract text. Please try again.');
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSuggestJD = async () => {
    if (!resumeText.trim()) {
      setError('Please upload or paste your resume first.');
      return;
    }
    setIsSuggesting(true);
    setError(null);
    try {
      const suggestion = await suggestJobDescription(resumeText);
      setJobDescription(suggestion);
    } catch (err) {
      setError('Failed to suggest job description.');
      console.error(err);
    } finally {
      setIsSuggesting(false);
    }
  };

  const runAnalysis = async () => {
    const finalResumeText = resumeText.trim();
    if (!finalResumeText) {
      setError(inputMode === 'upload' ? 'Please upload a resume first.' : 'Please paste your resume text.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please provide a job description for matching.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // ML Scoring & Job Matching (Server Side)
      const mlResponse = await fetch('/api/ml-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: finalResumeText, jobDescription }),
      });
      const mlData = await mlResponse.json();
      if (mlData.error) throw new Error(mlData.error);

      // LLM Deep Analysis (Client Side)
      const aiAnalysis = await analyzeResumeWithAI(finalResumeText, jobDescription);

      // Real Job Search (Client Side)
      const jobs = await findJobsWithAI(finalResumeText);

      setResults({
        score: mlData.score,
        matchPercentage: mlData.matchPercentage,
        aiAnalysis,
        jobs,
      });
    } catch (err) {
      setError('Analysis failed. Please check your connection and try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runRecruiterMatch = async () => {
    if (!resumeText || !jobDescription) return;
    setIsMatching(true);
    try {
      const match = await getRecruiterMatch(resumeText, jobDescription);
      setRecruiterMatch(match);
      setActiveTool('match');
    } catch (err) {
      console.error(err);
    } finally {
      setIsMatching(false);
    }
  };

  const runCareerRoadmap = async () => {
    if (!resumeText) return;
    setIsRoadmapping(true);
    try {
      const roadmap = await getCareerRoadmap(resumeText, jobDescription || "Software Engineer");
      setCareerRoadmap(roadmap);
      setActiveTool('roadmap');
    } catch (err) {
      console.error(err);
    } finally {
      setIsRoadmapping(false);
    }
  };

  const runResumeOptimization = async () => {
    if (!resumeText) return;
    setIsOptimizing(true);
    try {
      const optimization = await optimizeResume(resumeText);
      setOptimizedResume(optimization);
      setActiveTool('optimize');
    } catch (err) {
      console.error(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Cpu className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Career<span className="text-blue-500">Copilot</span> AI</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-sm font-medium text-neutral-400">
              <span className="flex items-center gap-1.5 hidden sm:flex"><CheckCircle2 className="w-4 h-4 text-blue-500" /> ML Scoring</span>
              <span className="flex items-center gap-1.5 hidden sm:flex"><CheckCircle2 className="w-4 h-4 text-blue-500" /> AI Insights</span>
            </div>
            
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <input 
                type="file" 
                ref={profileInputRef} 
                onChange={handleProfilePicUpload} 
                className="hidden" 
                accept="image/*"
              />
              <button 
                onClick={() => profileInputRef.current?.click()}
                className="relative group"
              >
                {profilePic ? (
                  <img 
                    src={profilePic} 
                    alt="Profile" 
                    className="w-9 h-9 rounded-full object-cover border-2 border-white/10 shadow-sm ring-1 ring-white/5 transition-all group-hover:ring-blue-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-all group-hover:border-blue-500">
                    <Upload className="w-4 h-4 text-neutral-400 group-hover:text-blue-500" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <SplineSceneBasic 
        score={results?.score} 
        match={results?.matchPercentage} 
      />

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-8">
            <section className="bg-white/[0.03] backdrop-blur-md rounded-3xl border border-white/10 p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Your Resume
                </h2>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  <button 
                    onClick={() => setInputMode('upload')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-lg transition-all",
                      inputMode === 'upload' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-neutral-400 hover:text-white"
                    )}
                  >
                    Upload
                  </button>
                  <button 
                    onClick={() => setInputMode('paste')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-lg transition-all",
                      inputMode === 'paste' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-neutral-400 hover:text-white"
                    )}
                  >
                    Paste
                  </button>
                </div>
              </div>
              
              {inputMode === 'upload' ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group",
                    file ? "border-blue-500/50 bg-blue-500/5" : "border-white/10 hover:border-blue-500/50 hover:bg-white/5"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".pdf,image/*"
                  />
                  {isExtracting ? (
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  ) : file ? (
                    <FileText className="w-12 h-12 text-blue-500" />
                  ) : (
                    <Upload className="w-12 h-12 text-neutral-700 group-hover:text-blue-500 transition-colors" />
                  )}
                  <div className="text-center">
                    <p className="font-medium text-neutral-200">
                      {file ? file.name : "Drop your resume here"}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      {isExtracting ? "Extracting intelligence..." : "PDF or Image (PNG, JPG)"}
                    </p>
                  </div>
                </div>
              ) : (
                <textarea 
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your full resume text here..."
                  className="w-full h-56 p-5 rounded-2xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-sm resize-none text-neutral-200"
                />
              )}

              {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </section>


            <section className="bg-white/[0.03] backdrop-blur-md rounded-3xl border border-white/10 p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Job Description
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => jdFileInputRef.current?.click()}
                    className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                  >
                    Upload PDF
                  </button>
                  <input 
                    type="file" 
                    ref={jdFileInputRef} 
                    onChange={(e) => handleFileUpload(e, 'jd')} 
                    className="hidden" 
                    accept=".pdf"
                  />
                  <button 
                    onClick={handleSuggestJD}
                    disabled={isSuggesting || !resumeText}
                    className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                  >
                    {isSuggesting ? "Suggesting..." : "AI Suggest"}
                  </button>
                </div>
              </div>
              <textarea 
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here..."
                className="w-full h-56 p-5 rounded-2xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-sm resize-none text-neutral-200"
              />
              <button 
                onClick={runAnalysis}
                disabled={isAnalyzing || !resumeText || !jobDescription}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.4)] active:scale-[0.98]"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing with High Thinking...
                  </>
                ) : (
                  <>
                    Analyze with AI Thinking
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {!results && !isAnalyzing ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-16 bg-white/[0.02] rounded-3xl border border-dashed border-white/10"
                >
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 rotate-12">
                    <Search className="text-neutral-700 w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Ready for Analysis</h3>
                  <p className="text-neutral-500 mt-3 max-w-sm text-lg">
                    Upload your resume and provide a job description to unlock deep AI insights.
                  </p>
                </motion.div>
              ) : isAnalyzing ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center p-16 space-y-8"
                >
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-blue-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BrainCircuit className="w-12 h-12 text-blue-500 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white">AI is Thinking Deeply...</h3>
                    <p className="text-neutral-500 text-lg mt-2">Running high-level reasoning models</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8"
                >
                  {/* Summary Card */}
                  <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
                    <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4" />
                      Executive Summary
                    </h4>
                    <p className="text-lg text-neutral-200 leading-relaxed italic">
                      "{results?.aiAnalysis?.summary}"
                    </p>
                  </div>

                  {/* Score Cards */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="bg-white/[0.03] p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative group">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <TrendingUp className="w-32 h-32" />
                      </div>
                      <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">Resume Score</p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-blue-500">{results?.score}</span>
                        <span className="text-neutral-700 font-bold text-xl">/ 100</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-4 font-medium uppercase tracking-wider">ML Regression Engine</p>
                    </div>
                    
                    <div className="bg-white/[0.03] p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative group">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <Target className="w-32 h-32" />
                      </div>
                      <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">Job Match</p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-emerald-500">{results?.matchPercentage}%</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-4 font-medium uppercase tracking-wider">Cosine Similarity Index</p>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div className="bg-white/[0.03] rounded-3xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md">
                    <div className="bg-white/5 px-8 py-6 border-b border-white/10 flex items-center justify-between">
                      <h3 className="text-xl font-bold flex items-center gap-3">
                        <BrainCircuit className="w-6 h-6 text-purple-500" />
                        AI Deep Analysis
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20">High Thinking Mode</span>
                    </div>
                    
                    <div className="p-8 space-y-12">
                      <div className="grid md:grid-cols-2 gap-12">
                        <div>
                          <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            Core Strengths
                          </h4>
                          <ul className="space-y-4">
                            {results?.aiAnalysis?.strengths.map((s, i) => (
                              <li key={i} className="text-neutral-300 flex gap-3 leading-relaxed">
                                <span className="text-emerald-500 font-black">→</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                            Gaps & Weaknesses
                          </h4>
                          <ul className="space-y-4">
                            {results?.aiAnalysis?.weaknesses.map((w, i) => (
                              <li key={i} className="text-neutral-300 flex gap-3 leading-relaxed">
                                <span className="text-rose-500 font-black">→</span> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-10 border-t border-white/5">
                        <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-6">Improvement Strategy</h4>
                        <div className="grid gap-4">
                          {results?.aiAnalysis?.suggestions.map((s, i) => (
                            <div key={i} className="bg-blue-500/5 p-5 rounded-2xl text-blue-200 border border-blue-500/10 leading-relaxed">
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-10 border-t border-white/5">
                        <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                          <Briefcase className="w-5 h-5 text-blue-500" />
                          Recommended Live Jobs
                        </h4>
                        <div className="grid gap-4">
                          {results?.jobs && results.jobs.length > 0 ? (
                            results.jobs.slice(0, 5).map((job) => (
                              <div key={job.job_id} className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-blue-500/30 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h5 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{job.job_title}</h5>
                                    <p className="text-blue-500 font-medium text-sm">{job.employer_name}</p>
                                  </div>
                                  <a 
                                    href={job.job_apply_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                                  >
                                    <ExternalLink className="w-4 h-4 text-white" />
                                  </a>
                                </div>
                                <div className="flex gap-4 text-xs text-neutral-500">
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {job.job_city}, {job.job_state}
                                  </div>
                                  {job.job_posted_at_datetime_utc && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(job.job_posted_at_datetime_utc).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-neutral-500 text-sm italic">No live jobs found for your profile at this moment.</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-10 border-t border-white/5">
                        <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                          <BrainCircuit className="w-5 h-5 text-purple-500" />
                          Advanced AI Tools
                        </h4>
                        
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <button 
                            onClick={runRecruiterMatch}
                            disabled={isMatching || !resumeText || !jobDescription}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                              activeTool === 'match' ? "bg-blue-600/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                            )}
                          >
                            {isMatching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">Recruiter Match</span>
                          </button>
                          
                          <button 
                            onClick={runCareerRoadmap}
                            disabled={isRoadmapping || !resumeText}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                              activeTool === 'roadmap' ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                            )}
                          >
                            {isRoadmapping ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">Career Roadmap</span>
                          </button>
                          
                          <button 
                            onClick={runResumeOptimization}
                            disabled={isOptimizing || !resumeText}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                              activeTool === 'optimize' ? "bg-purple-600/20 border-purple-500 text-purple-400" : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10"
                            )}
                          >
                            {isOptimizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">ATS Optimizer</span>
                          </button>
                        </div>

                        <AnimatePresence mode="wait">
                          {activeTool === 'match' && recruiterMatch && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-6 bg-blue-500/5 p-6 rounded-3xl border border-blue-500/20"
                            >
                              <div className="flex items-center justify-between">
                                <h5 className="font-bold text-blue-400">AI Recruiter Insights</h5>
                                <span className="text-2xl font-black text-white">{recruiterMatch.match_percentage}</span>
                              </div>
                              <p className="text-neutral-300 text-sm italic">"{recruiterMatch.reason}"</p>
                              <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Matched Skills</p>
                                  <div className="flex flex-wrap gap-2">
                                    {recruiterMatch.matched_skills.map((s, i) => (
                                      <span key={i} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">{s}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">Missing Skills</p>
                                  <div className="flex flex-wrap gap-2">
                                    {recruiterMatch.missing_skills.map((s, i) => (
                                      <span key={i} className="px-3 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/20">{s}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {activeTool === 'roadmap' && careerRoadmap && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-6 bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/20"
                            >
                              <div className="flex items-center justify-between">
                                <h5 className="font-bold text-emerald-400">Career Learning Roadmap</h5>
                                <span className="text-xs font-bold text-white bg-emerald-500/20 px-3 py-1 rounded-full">{careerRoadmap.target_role}</span>
                              </div>
                              <div className="space-y-4">
                                {careerRoadmap.roadmap.map((step, i) => (
                                  <div key={i} className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-emerald-400">
                                      {i + 1}
                                    </div>
                                    <p className="text-neutral-200 text-sm mt-1.5">{step}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-4 border-t border-emerald-500/10">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Final Project Suggestion</p>
                                <p className="text-neutral-300 text-sm font-medium">{careerRoadmap.final_project}</p>
                              </div>
                            </motion.div>
                          )}

                          {activeTool === 'optimize' && optimizedResume && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-6 bg-purple-500/5 p-6 rounded-3xl border border-purple-500/20"
                            >
                              <h5 className="font-bold text-purple-400">ATS Optimized Bullet Points</h5>
                              <div className="space-y-4">
                                {optimizedResume.improved_resume.map((point, i) => (
                                  <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all group">
                                    <p className="text-neutral-200 text-sm leading-relaxed group-hover:text-white transition-colors">{point}</p>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[10px] text-neutral-500 italic">Copy these into your resume to improve ATS ranking and professional impact.</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="pt-10 border-t border-white/5">
                        <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                          <MessageSquare className="w-5 h-5 text-neutral-600" />
                          Strategic Interview Prep
                        </h4>
                        <div className="space-y-4">
                          {results?.aiAnalysis?.interviewQuestions.map((q, i) => (
                            <div key={i} className="flex gap-4 p-5 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group">
                              <span className="font-mono text-xs text-neutral-600 mt-1 group-hover:text-blue-500 transition-colors">0{i+1}</span>
                              <p className="text-neutral-200 leading-relaxed font-medium">{q}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-20 text-center border-t border-white/5">
        <p className="text-neutral-600 text-sm tracking-widest uppercase font-bold">
          © 2026 Career Copilot AI • Powered by Gemini 3.1 Pro Thinking Mode
        </p>
      </footer>
    </div>
  );
}
