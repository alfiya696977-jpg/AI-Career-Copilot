import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface AnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  interviewQuestions: string[];
}

export interface RecruiterMatch {
  match_percentage: string;
  matched_skills: string[];
  missing_skills: string[];
  reason: string;
}

export interface CareerRoadmap {
  target_role: string;
  missing_skills: string[];
  roadmap: string[];
  final_project: string;
}

export interface ResumeOptimization {
  improved_resume: string[];
}

export interface Job {
  job_id: string;
  employer_name: string;
  job_title: string;
  job_apply_link: string;
  job_description: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_posted_at_datetime_utc?: string;
}

export async function extractTextFromImage(base64Image: string, mimeType: string): Promise<string> {
  const prompt = "Extract all text from this resume image. Maintain the structure as much as possible.";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          }
        ]
      }
    ]
  });

  return response.text || "";
}

export async function analyzeResumeWithAI(resumeText: string, jobDescription: string): Promise<AnalysisResult> {
  const prompt = `
    Analyze the following resume in the context of the provided job description.
    
    Resume:
    ${resumeText}
    
    Job Description:
    ${jobDescription}
    
    Provide a structured analysis including:
    1. A concise professional summary of the candidate (2-3 sentences).
    2. Top 3-5 strengths.
    3. Top 3-5 weaknesses or gaps.
    4. Specific improvement suggestions.
    5. 5 relevant interview questions based on the resume and job.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      thinkingLevel: "HIGH",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          interviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["summary", "strengths", "weaknesses", "suggestions", "interviewQuestions"],
      },
    } as any,
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {
      summary: "Analysis failed",
      strengths: ["Analysis failed"],
      weaknesses: ["Analysis failed"],
      suggestions: ["Analysis failed"],
      interviewQuestions: ["Analysis failed"],
    };
  }
}

export async function findJobsWithAI(resumeText: string): Promise<Job[]> {
  // First, use Gemini with Search Grounding to identify the best job titles and locations
  const searchPrompt = `
    Based on this resume, identify the top 3 specific job titles and the top 2 most likely preferred locations (city/state) for this candidate.
    
    Resume:
    ${resumeText}
    
    Return only a JSON object with:
    {
      "jobTitles": ["Title 1", "Title 2", "Title 3"],
      "locations": ["City, State 1", "City, State 2", "Remote"]
    }
  `;

  const searchResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
    tools: [
      {
        googleSearch: {},
      },
    ] as any,
  } as any);

  let searchData: { jobTitles: string[], locations: string[] };
  try {
    const text = searchResponse.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    searchData = jsonMatch ? JSON.parse(jsonMatch[0]) : { jobTitles: ["Software Developer"], locations: ["Remote"] };
    if (!searchData.locations) searchData.locations = ["Remote"];
  } catch (e) {
    console.error("Failed to parse search data", e);
    searchData = { jobTitles: ["Software Developer"], locations: ["Remote"] };
  }

  // Now use JSearch API to find real jobs for each title and location combination
  // We'll limit to a few combinations to avoid hitting rate limits or taking too long
  const allJobs: Job[] = [];
  const seenJobIds = new Set<string>();

  // Use top 2 titles and top 2 locations for a balanced search
  const titlesToSearch = searchData.jobTitles.slice(0, 2);
  const locationsToSearch = searchData.locations.slice(0, 2);

  const searchPromises = [];

  for (const title of titlesToSearch) {
    for (const location of locationsToSearch) {
      const query = `${title} jobs in ${location}`;
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1&date_posted=all`;
      
      searchPromises.push(
        fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': 'jsearch.p.rapidapi.com',
            'x-rapidapi-key': '30bb3df63cmsh27dd019fbd99a2ap10a9d0jsn0082d423f8db'
          }
        })
        .then(res => res.json())
        .then(data => data.data || [])
        .catch(e => {
          console.error(`Failed to fetch jobs for ${query}`, e);
          return [];
        })
      );
    }
  }

  const results = await Promise.all(searchPromises);
  
  for (const jobBatch of results) {
    for (const job of jobBatch) {
      if (!seenJobIds.has(job.job_id)) {
        seenJobIds.add(job.job_id);
        allJobs.push(job);
      }
    }
  }

  // Sort by date if available
  return allJobs.sort((a, b) => {
    const dateA = a.job_posted_at_datetime_utc ? new Date(a.job_posted_at_datetime_utc).getTime() : 0;
    const dateB = b.job_posted_at_datetime_utc ? new Date(b.job_posted_at_datetime_utc).getTime() : 0;
    return dateB - dateA;
  }).slice(0, 10); // Return top 10 most relevant/recent
}

export async function getRecruiterMatch(resumeText: string, jobDescription: string): Promise<RecruiterMatch> {
  const prompt = `
    You are an AI recruiter.
    Your task is to compare a user's resume with a job description and explain the match.

    You must:
    1. Identify matching skills
    2. Identify missing skills
    3. Calculate a realistic match percentage
    4. Give a short explanation

    Return output in this format:
    {
      "match_percentage": "number%",
      "matched_skills": ["skill1", "skill2"],
      "missing_skills": ["skill1", "skill2"],
      "reason": "short explanation"
    }

    Rules:
    - Match % should be logical (not random)
    - Keep explanation short and clear
    - Focus on technical skills only

    Resume:
    ${resumeText}

    Job Description:
    ${jobDescription}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          match_percentage: { type: Type.STRING },
          matched_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          missing_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          reason: { type: Type.STRING },
        },
        required: ["match_percentage", "matched_skills", "missing_skills", "reason"],
      },
    } as any,
  });

  return JSON.parse(response.text || '{}');
}

export async function getCareerRoadmap(resumeText: string, targetRole: string): Promise<CareerRoadmap> {
  const prompt = `
    You are an AI career mentor.
    Your task is to create a structured learning roadmap based on the user's resume.

    You must:
    1. Identify missing skills for the target job role
    2. Create a step-by-step roadmap (week-wise)
    3. Keep it practical and realistic
    4. Include a final project suggestion

    Return output in this format:
    {
      "target_role": "job role",
      "missing_skills": ["skill1", "skill2"],
      "roadmap": [
        "Week 1–2: topic",
        "Week 3–4: topic",
        "Week 5–6: topic"
      ],
      "final_project": "project idea"
    }

    Rules:
    - Keep roadmap beginner-friendly but powerful
    - Focus on industry-relevant skills
    - Make timeline realistic

    Resume:
    ${resumeText}
    
    Target Role:
    ${targetRole}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          target_role: { type: Type.STRING },
          missing_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          roadmap: { type: Type.ARRAY, items: { type: Type.STRING } },
          final_project: { type: Type.STRING },
        },
        required: ["target_role", "missing_skills", "roadmap", "final_project"],
      },
    } as any,
  });

  return JSON.parse(response.text || '{}');
}

export async function optimizeResume(resumeText: string): Promise<ResumeOptimization> {
  const prompt = `
    You are an expert ATS resume optimizer and senior recruiter.
    Your task is to improve the given resume to increase hiring chances.

    You must:
    1. Rewrite bullet points to be more impactful and professional
    2. Use strong action verbs (e.g., Built, Developed, Optimized)
    3. Make content ATS-friendly (include relevant keywords)
    4. Keep it concise and results-oriented
    5. Improve clarity and structure

    Return output in this format:
    {
      "improved_resume": [
        "Rewritten bullet point 1",
        "Rewritten bullet point 2",
        "Rewritten bullet point 3"
      ]
    }

    Rules:
    - Do not add explanations
    - Do not repeat original text
    - Make each point stronger and more professional
    - Focus on technical and measurable impact

    Resume:
    ${resumeText}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          improved_resume: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["improved_resume"],
      },
    } as any,
  });

  return JSON.parse(response.text || '{}');
}

export async function suggestJobDescription(resumeText: string): Promise<string> {
  const prompt = `
    Based on the following resume, generate a professional and detailed job description that would be a perfect match for this candidate's skills and experience.
    
    Resume:
    ${resumeText}
    
    The job description should include:
    - Job Title
    - Role Overview
    - Key Responsibilities
    - Required Skills & Qualifications
    
    Format it cleanly as a professional job posting.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return response.text || "Failed to generate suggestion.";
}
