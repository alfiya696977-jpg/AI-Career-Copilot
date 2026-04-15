import natural from 'natural';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

/**
 * Simple Linear Regression implementation
 */
class SimpleLinearRegression {
  private weights: number[] = [];
  private bias: number = 0;

  train(X: number[][], y: number[], epochs: number = 1000, lr: number = 0.01) {
    const nSamples = X.length;
    const nFeatures = X[0].length;
    this.weights = new Array(nFeatures).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < nSamples; i++) {
        const prediction = this.predict(X[i]);
        const error = prediction - y[i];

        for (let j = 0; j < nFeatures; j++) {
          this.weights[j] -= lr * error * X[i][j];
        }
        this.bias -= lr * error;
      }
    }
  }

  predict(x: number[]): number {
    return x.reduce((sum, val, i) => sum + val * this.weights[i], 0) + this.bias;
  }
}

/**
 * Feature Extraction Engine
 * Transforms raw resume text into a normalized numerical vector
 */
export function extractFeatures(text: string): number[] {
  const lowerText = text.toLowerCase();
  const tokens = tokenizer.tokenize(lowerText) || [];
  
  // 1. Length Score (Optimized for 800 words)
  const lengthScore = Math.min(tokens.length / 800, 1);
  
  // 2. Keyword Score (Hard Skills & Sections)
  const keywords = ['experience', 'education', 'skills', 'project', 'summary', 'leadership', 'technical', 'certification', 'languages', 'volunteer'];
  const keywordCount = keywords.filter(k => lowerText.includes(k)).length;
  const keywordScore = keywordCount / keywords.length;
  
  // 3. Formatting Score (Bullet points)
  const bulletPoints = (text.match(/[•\-\*]/g) || []).length;
  const formattingScore = Math.min(bulletPoints / 15, 1);

  // 4. Soft Skills Score
  const softSkills = [
    'communication', 'teamwork', 'leadership', 'problem solving', 'adaptability', 
    'time management', 'critical thinking', 'interpersonal', 'creativity', 
    'collaboration', 'emotional intelligence', 'conflict resolution'
  ];
  const softSkillMatches = softSkills.filter(skill => lowerText.includes(skill)).length;
  const softSkillsScore = Math.min(softSkillMatches / 5, 1);

  // 5. Achievement Score (Quantifying results)
  const achievementRegex = /(\d+%|\$\d+|increased|decreased|improved|saved|reduced|growth|revenue|users|clients|managed)/gi;
  const achievements = (text.match(achievementRegex) || []).length;
  const achievementScore = Math.min(achievements / 10, 1);

  // 6. Action Verb Score
  const actionVerbs = [
    'managed', 'developed', 'implemented', 'created', 'designed', 'led', 
    'coordinated', 'analyzed', 'negotiated', 'presented', 'executed', 
    'streamlined', 'transformed', 'pioneered', 'orchestrated'
  ];
  const verbMatches = actionVerbs.filter(verb => lowerText.includes(verb)).length;
  const actionVerbScore = Math.min(verbMatches / 8, 1);

  return [
    lengthScore, 
    keywordScore, 
    formattingScore, 
    softSkillsScore, 
    achievementScore, 
    actionVerbScore
  ];
}

// Synthetic Training Data (Raw Resumes)
const rawTrainingData = [
  {
    text: "EXPERIENCE: Senior Developer. Led a team of 10. Increased revenue by 25% and saved $50k. Developed complex systems using React. Skills: Leadership, Communication, Problem Solving. * Managed projects * Designed architecture",
    score: 98
  },
  {
    text: "I worked at a place. I did some things. I like computers.",
    score: 30
  },
  {
    text: "EDUCATION: BS Computer Science. SKILLS: Java, Python, SQL. EXPERIENCE: Software Intern. Improved database performance by 10%. Teamwork and Adaptability. - Fixed bugs - Wrote tests",
    score: 75
  },
  {
    text: "SUMMARY: Highly motivated leader with emotional intelligence and conflict resolution skills. Orchestrated a company-wide transformation. Streamlined operations and improved user growth by 40%. * Communication * Creativity * Collaboration",
    score: 92
  },
  {
    text: "Project Manager. Managed 5 clients. Negotiated contracts. Leadership and time management. - Coordinated events - Presented reports",
    score: 65
  }
];

// Process raw data into feature vectors for training
const X = rawTrainingData.map(item => extractFeatures(item.text));
const y = rawTrainingData.map(item => item.score);

const model = new SimpleLinearRegression();
model.train(X, y);

/**
 * Calculate Cosine Similarity between two strings
 */
export function calculateCosineSimilarity(str1: string, str2: string): number {
  const tfidf = new TfIdf();
  tfidf.addDocument(str1);
  tfidf.addDocument(str2);

  const vec1: Record<string, number> = {};
  const vec2: Record<string, number> = {};

  tfidf.listTerms(0).forEach(item => vec1[item.term] = item.tfidf);
  tfidf.listTerms(1).forEach(item => vec2[item.term] = item.tfidf);

  const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  allTerms.forEach(term => {
    const v1 = vec1[term] || 0;
    const v2 = vec2[term] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Predict Resume Score using the improved ML model
 */
export function predictResumeScore(text: string): number {
  const features = extractFeatures(text);
  const score = model.predict(features);
  return Math.max(0, Math.min(100, Math.round(score)));
}
