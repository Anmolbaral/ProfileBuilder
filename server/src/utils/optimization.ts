import { OpenAI } from 'openai';
import { 
  OptimizationPlanJson, 
  RoleJson, 
  ProjectJson, 
  BulletJson, 
  CoverageBucketJson, 
  FitMetricsJson,
  stableId 
} from './planStore.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateOptimizationPlan(
  originalResumeJson: any, 
  jobDescription: string,
  companyName?: string
): Promise<OptimizationPlanJson> {
  console.log('🎯 Generating optimization plan...');
  
  // Gather company research for enhanced scoring
  const companyContext = companyName ? await gatherCompanyResearch(companyName, jobDescription) : null;
  console.log('🏢 Company context gathered:', companyContext ? 'Yes' : 'No');
  
  const roles: RoleJson[] = [];
  const projects: ProjectJson[] = [];
  
  // Process experience/roles
  if (originalResumeJson.experience && Array.isArray(originalResumeJson.experience)) {
    for (const exp of originalResumeJson.experience) {
      const bullets: BulletJson[] = [];
      
      // Process impact bullets
      if (exp.impactBullets && Array.isArray(exp.impactBullets)) {
        for (const bulletText of exp.impactBullets) {
          const bulletId = stableId([exp.company || '', exp.position || '', exp.duration || '', bulletText]);
          const jdMatchScore = calculateJDMatchScore(bulletText, jobDescription, companyContext);
          const impactScore = calculateImpactScore(bulletText, companyContext);
          
          bullets.push({
            id: bulletId,
            text: bulletText,
            jdMatchScore,
            impactScore,
            suggested: false
          });
        }
      }
      
      // Generate suggested bullets if none exist
      if (bullets.length === 0) {
        const suggestedBullets = await generateSuggestedBullets(exp, jobDescription, companyContext);
        for (const bulletText of suggestedBullets) {
          const bulletId = stableId([exp.company || '', exp.position || '', exp.duration || '', bulletText]);
          bullets.push({
            id: bulletId,
            text: bulletText,
            jdMatchScore: calculateJDMatchScore(bulletText, jobDescription, companyContext),
            impactScore: calculateImpactScore(bulletText, companyContext),
            suggested: true
          });
        }
      }
      
      const roleId = stableId([exp.company || '', exp.position || '', exp.duration || '']);
      const jdMatchScore = bullets.reduce((sum, b) => sum + b.jdMatchScore, 0) / Math.max(bullets.length, 1);
      const impactScore = bullets.reduce((sum, b) => sum + b.impactScore, 0) / Math.max(bullets.length, 1);
      
      roles.push({
        id: roleId,
        company: exp.company || 'Unknown Company',
        position: exp.position || 'Unknown Position',
        duration: exp.duration || '',
        location: exp.location || '',
        bullets,
        jdMatchScore,
        impactScore
      });
    }
  }
  
  // Process projects
  if (originalResumeJson.projects && Array.isArray(originalResumeJson.projects)) {
    for (const proj of originalResumeJson.projects) {
      const bullets: BulletJson[] = [];
      
      if (proj.impactBullets && Array.isArray(proj.impactBullets)) {
        for (const bulletText of proj.impactBullets) {
          const bulletId = stableId([proj.projectName || '', proj.techStack || '', bulletText]);
          bullets.push({
            id: bulletId,
            text: bulletText,
            jdMatchScore: calculateJDMatchScore(bulletText, jobDescription, companyContext),
            impactScore: calculateImpactScore(bulletText, companyContext),
            suggested: false
          });
        }
      }
      
      const projectId = stableId([proj.projectName || '', proj.techStack || '']);
      const jdMatchScore = bullets.reduce((sum, b) => sum + b.jdMatchScore, 0) / Math.max(bullets.length, 1);
      
      projects.push({
        id: projectId,
        projectName: proj.projectName || 'Unknown Project',
        techStack: proj.techStack || '',
        bullets,
        jdMatchScore
      });
    }
  }
  
  // Calculate coverage
  const coverage = calculateCoverage(originalResumeJson, jobDescription);
  
  return {
    id: '', // Will be set by caller
    roles,
    projects,
    coverage
  };
}

export async function calculateFitMetrics(
  plan: OptimizationPlanJson, 
  jobDescription: string
): Promise<FitMetricsJson> {
  console.log('📊 Calculating fit metrics...');
  
  // Experience match score
  const experienceMatch = plan.roles.reduce((sum: number, role: RoleJson) => sum + role.jdMatchScore, 0) / Math.max(plan.roles.length, 1);
  
  // Project match score
  const projectMatch = plan.projects.reduce((sum: number, project: ProjectJson) => sum + project.jdMatchScore, 0) / Math.max(plan.projects.length, 1);
  
  // Skill coverage (convert from percentage to decimal, ensure it doesn't exceed 100%)
  const skillCoverage = Math.min(1.0, plan.coverage.reduce((sum: number, bucket: CoverageBucketJson) => sum + Math.min(100, bucket.percentage), 0) / Math.max(plan.coverage.length, 1) / 100);
  
  // Overall score (weighted average)
  const overallScore = (experienceMatch * 0.4 + projectMatch * 0.3 + skillCoverage * 0.3);
  
  // Missing keywords (simplified for now)
  const missingKeywords = extractMissingKeywords(jobDescription, plan);
  
  return {
    overallScore: Math.round(overallScore * 1000) / 1000, // Keep as decimal (0-1)
    experienceMatch: Math.round(experienceMatch * 1000) / 1000, // Keep as decimal (0-1)
    projectMatch: Math.round(projectMatch * 1000) / 1000, // Keep as decimal (0-1)
    skillCoverage: Math.round(skillCoverage * 1000) / 1000, // Keep as decimal (0-1)
    missingKeywords
  };
}

export async function applyUserDecisions(
  originalResumeJson: any,
  plan: OptimizationPlanJson,
  roleDecisions: any[],
  projectDecisions: any[]
): Promise<any> {
  console.log('🔄 Applying user decisions...');
  
  const updatedResumeJson = { ...originalResumeJson };
  
  // Apply role decisions
  const updatedExperience = [];
  for (const role of plan.roles) {
    const decision = roleDecisions.find(d => d.roleId === role.id);
    if (!decision || decision.action === 'HIDE') {
      continue; // Skip this role
    }
    
    const originalRole = originalResumeJson.experience?.find((exp: any) => 
      stableId([exp.company || '', exp.position || '', exp.duration || '']) === role.id
    );
    
    if (originalRole) {
      let updatedRole = { ...originalRole };
      
      if (decision.action === 'CONDENSE' && decision.selectedBullets) {
        // Only include selected bullets
        const selectedBullets = role.bullets.filter((bullet: BulletJson) => 
          decision.selectedBullets.includes(bullet.id)
        );
        updatedRole.impactBullets = selectedBullets.map((b: BulletJson) => b.text);
      }
      
      updatedExperience.push(updatedRole);
    }
  }
  
  updatedResumeJson.experience = updatedExperience;
  
  // Apply project decisions
  const updatedProjects = [];
  for (const project of plan.projects) {
    const decision = projectDecisions.find(d => d.projectId === project.id);
    if (!decision || decision.action === 'HIDE') {
      continue; // Skip this project
    }
    
    const originalProject = originalResumeJson.projects?.find((proj: any) => 
      stableId([proj.projectName || '', proj.techStack || '']) === project.id
    );
    
    if (originalProject) {
      let updatedProject = { ...originalProject };
      
      if (decision.action === 'CONDENSE' && decision.selectedBullets) {
        // Only include selected bullets
        const selectedBullets = project.bullets.filter((bullet: BulletJson) => 
          decision.selectedBullets.includes(bullet.id)
        );
        updatedProject.impactBullets = selectedBullets.map((b: BulletJson) => b.text);
      }
      
      updatedProjects.push(updatedProject);
    }
  }
  
  updatedResumeJson.projects = updatedProjects;
  
  return updatedResumeJson;
}

export async function generateBulletSuggestions(
  currentText: string,
  jobDescription: string,
  mustInclude: string[]
): Promise<string[]> {
  console.log('💡 Generating bullet suggestions...');
  
  try {
    // Extract key skills and requirements from job description
    const jdSkills = extractSkillsFromJD(jobDescription);
    const keyRequirements = extractKeyRequirements(jobDescription);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a resume optimization expert. Generate 3 alternative bullet points that are more impactful and relevant to the job description. Each suggestion should:
- Be under 220 characters
- Use the STAR method (Situation, Task, Action, Result)
- Include quantifiable metrics when possible
- Incorporate relevant keywords from the job description
- Be more specific and action-oriented than the original
- Focus on achievements and impact rather than just responsibilities`
        },
        {
          role: "user",
          content: `Current bullet: "${currentText}"
Job description: "${jobDescription}"
Key skills from JD: ${jdSkills.join(', ')}
Key requirements: ${keyRequirements.join(', ')}
Must include keywords: ${mustInclude.join(', ')}

Generate 3 improved bullet points, each on a new line starting with a number (1., 2., 3.):`
        }
      ],
      max_tokens: 400,
      temperature: 0.4
    });
    
    const suggestions = response.choices[0].message.content
      ?.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0 && line.length <= 220)
      .slice(0, 3) || [];
    
    return suggestions;
  } catch (error) {
    console.error('Failed to generate bullet suggestions:', error);
    return [
      'Improved bullet point with quantifiable results and specific metrics',
      'Enhanced version focusing on achievements and measurable impact',
      'Optimized bullet incorporating relevant keywords and clear outcomes'
    ];
  }
}

// Helper functions
// Enhanced scoring system with company research and methodology analysis
function calculateJDMatchScore(text: string, jobDescription: string, companyContext?: any): number {
  const textLower = text.toLowerCase();
  const jdLower = jobDescription.toLowerCase();
  
  // Base keyword matching (improved)
  const keywordScore = calculateKeywordMatch(textLower, jdLower);
  
  // Company methodology alignment
  const methodologyScore = calculateMethodologyAlignment(text, companyContext);
  
  // Experience relevance scoring
  const experienceScore = calculateExperienceRelevance(text, jobDescription);
  
  // Project alignment scoring
  const projectScore = calculateProjectAlignment(text, jobDescription);
  
  // Educational background relevance
  const educationScore = calculateEducationRelevance(text, jobDescription);
  
  // Industry-specific scoring
  const industryScore = calculateIndustryAlignment(text, jobDescription, companyContext);
  
  // Weighted combination
  const weightedScore = (
    keywordScore * 0.25 +
    methodologyScore * 0.20 +
    experienceScore * 0.20 +
    projectScore * 0.15 +
    educationScore * 0.10 +
    industryScore * 0.10
  );
  
  return Math.min(1.0, weightedScore);
}

function calculateKeywordMatch(text: string, jdText: string): number {
  // Enhanced keyword matching with semantic similarity
  const keywords = jdText.match(/\b\w+\b/g) || [];
  const matches = keywords.filter(keyword => 
    keyword.length > 3 && text.includes(keyword)
  );
  
  // Add synonym matching
  const synonyms = extractSynonyms(jdText);
  const synonymMatches = synonyms.filter(synonym => text.includes(synonym));
  
  const totalMatches = matches.length + synonymMatches.length;
  const totalKeywords = keywords.length + synonyms.length;
  
  return Math.min(1.0, totalMatches / Math.max(totalKeywords, 1));
}

function calculateMethodologyAlignment(text: string, companyContext?: any): number {
  let score = 0.5; // Base score
  
  // Agile/Scrum methodology
  const agileKeywords = ['agile', 'scrum', 'sprint', 'kanban', 'lean', 'iterative', 'sprint planning', 'retrospective'];
  const agileMatches = agileKeywords.filter(keyword => text.includes(keyword));
  if (agileMatches.length > 0) score += 0.2;
  
  // DevOps practices
  const devopsKeywords = ['ci/cd', 'continuous integration', 'continuous deployment', 'devops', 'automation', 'infrastructure as code'];
  const devopsMatches = devopsKeywords.filter(keyword => text.includes(keyword));
  if (devopsMatches.length > 0) score += 0.15;
  
  // Remote work experience
  const remoteKeywords = ['remote', 'distributed team', 'virtual', 'global team', 'cross-functional'];
  const remoteMatches = remoteKeywords.filter(keyword => text.includes(keyword));
  if (remoteMatches.length > 0) score += 0.1;
  
  // Data-driven approach
  const dataKeywords = ['analytics', 'metrics', 'kpi', 'data-driven', 'measurement', 'performance tracking'];
  const dataMatches = dataKeywords.filter(keyword => text.includes(keyword));
  if (dataMatches.length > 0) score += 0.15;
  
  return Math.min(1.0, score);
}

function calculateExperienceRelevance(text: string, jobDescription: string): number {
  let score = 0.5;
  
  // Extract experience level from job description
  const experienceLevel = extractExperienceLevel(jobDescription);
  const candidateExperience = extractCandidateExperience(text);
  
  // Match experience levels
  if (experienceLevel === candidateExperience) score += 0.3;
  else if (Math.abs(experienceLevel - candidateExperience) <= 1) score += 0.2;
  else if (candidateExperience > experienceLevel) score += 0.1;
  
  // Industry experience
  const industryMatch = calculateIndustryExperience(text, jobDescription);
  score += industryMatch * 0.2;
  
  return Math.min(1.0, score);
}

function calculateProjectAlignment(text: string, jobDescription: string): number {
  let score = 0.5;
  
  // Project scale matching
  const projectScale = extractProjectScale(jobDescription);
  const candidateScale = extractCandidateProjectScale(text);
  
  if (projectScale === candidateScale) score += 0.3;
  else if (Math.abs(projectScale - candidateScale) <= 1) score += 0.2;
  
  // Technology stack alignment
  const techStackMatch = calculateTechStackAlignment(text, jobDescription);
  score += techStackMatch * 0.2;
  
  return Math.min(1.0, score);
}

function calculateEducationRelevance(text: string, jobDescription: string): number {
  let score = 0.5;
  
  // Degree relevance
  const requiredDegree = extractRequiredDegree(jobDescription);
  const candidateDegree = extractCandidateDegree(text);
  
  if (requiredDegree === candidateDegree) score += 0.3;
  else if (isRelatedDegree(requiredDegree, candidateDegree)) score += 0.2;
  
  // Institution ranking (if available)
  const institutionScore = calculateInstitutionRelevance(text, jobDescription);
  score += institutionScore * 0.2;
  
  return Math.min(1.0, score);
}

function calculateIndustryAlignment(text: string, jobDescription: string, companyContext?: any): number {
  let score = 0.5;
  
  // Industry keywords
  const industryKeywords = extractIndustryKeywords(jobDescription);
  const candidateIndustry = extractCandidateIndustry(text);
  
  const industryMatch = industryKeywords.filter(keyword => 
    candidateIndustry.includes(keyword)
  ).length / Math.max(industryKeywords.length, 1);
  
  score += industryMatch * 0.3;
  
  // Company size alignment
  const companySize = extractCompanySize(jobDescription);
  const candidateCompanySize = extractCandidateCompanySize(text);
  
  if (companySize === candidateCompanySize) score += 0.2;
  
  return Math.min(1.0, score);
}

// Helper functions for enhanced analysis
function extractSynonyms(text: string): string[] {
  // Common tech synonyms
  const synonymMap: { [key: string]: string[] } = {
    'javascript': ['js', 'es6', 'es2015', 'node.js', 'react', 'vue', 'angular'],
    'python': ['py', 'django', 'flask', 'fastapi', 'pandas', 'numpy'],
    'java': ['spring', 'hibernate', 'maven', 'gradle'],
    'sql': ['mysql', 'postgresql', 'oracle', 'database', 'rdbms'],
    'aws': ['amazon web services', 'cloud', 'ec2', 's3', 'lambda'],
    'docker': ['containerization', 'kubernetes', 'k8s', 'microservices'],
    'agile': ['scrum', 'kanban', 'lean', 'iterative', 'sprint'],
    'leadership': ['management', 'supervision', 'mentoring', 'team lead'],
    'communication': ['collaboration', 'stakeholder', 'presentation', 'documentation']
  };
  
  const synonyms: string[] = [];
  Object.entries(synonymMap).forEach(([key, values]) => {
    if (text.includes(key)) {
      synonyms.push(...values);
    }
  });
  
  return [...new Set(synonyms)];
}

function extractExperienceLevel(jobDescription: string): number {
  const jdLower = jobDescription.toLowerCase();
  
  if (jdLower.includes('senior') || jdLower.includes('lead') || jdLower.includes('principal')) return 4;
  if (jdLower.includes('mid') || jdLower.includes('intermediate') || jdLower.includes('3+ years')) return 3;
  if (jdLower.includes('junior') || jdLower.includes('entry') || jdLower.includes('0-2 years')) return 2;
  if (jdLower.includes('intern') || jdLower.includes('student')) return 1;
  
  return 3; // Default to mid-level
}

function extractCandidateExperience(text: string): number {
  const textLower = text.toLowerCase();
  
  // Look for years of experience patterns
  const yearPatterns = [
    /(\d+)\+?\s*years?/g,
    /(\d+)\+?\s*years?.*experience/g,
    /experience.*(\d+)\+?\s*years?/g
  ];
  
  for (const pattern of yearPatterns) {
    const matches = textLower.match(pattern);
    if (matches) {
      const years = parseInt(matches[0].match(/\d+/)?.[0] || '0');
      if (years >= 8) return 4; // Senior
      if (years >= 4) return 3; // Mid
      if (years >= 1) return 2; // Junior
      return 1; // Entry
    }
  }
  
  // Fallback based on keywords
  if (textLower.includes('senior') || textLower.includes('lead')) return 4;
  if (textLower.includes('mid') || textLower.includes('intermediate')) return 3;
  if (textLower.includes('junior') || textLower.includes('entry')) return 2;
  
  return 2; // Default to junior
}

function extractProjectScale(jobDescription: string): number {
  const jdLower = jobDescription.toLowerCase();
  
  if (jdLower.includes('enterprise') || jdLower.includes('large-scale') || jdLower.includes('global')) return 4;
  if (jdLower.includes('medium') || jdLower.includes('team') || jdLower.includes('department')) return 3;
  if (jdLower.includes('small') || jdLower.includes('startup') || jdLower.includes('individual')) return 2;
  
  return 3; // Default to medium scale
}

function extractCandidateProjectScale(text: string): number {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('enterprise') || textLower.includes('global') || textLower.includes('multi-million')) return 4;
  if (textLower.includes('team') || textLower.includes('department') || textLower.includes('cross-functional')) return 3;
  if (textLower.includes('personal') || textLower.includes('individual') || textLower.includes('small')) return 2;
  
  return 3; // Default to medium scale
}

function calculateTechStackAlignment(text: string, jobDescription: string): number {
  const jdTech = extractTechStack(jobDescription);
  const candidateTech = extractTechStack(text);
  
  const matches = jdTech.filter(tech => candidateTech.includes(tech));
  return matches.length / Math.max(jdTech.length, 1);
}

function extractTechStack(text: string): string[] {
  const techKeywords = [
    'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws', 'docker',
    'kubernetes', 'git', 'html', 'css', 'api', 'rest', 'graphql', 'mongodb',
    'postgresql', 'redis', 'kafka', 'elasticsearch', 'jenkins', 'ci/cd',
    'typescript', 'vue', 'angular', 'next.js', 'express', 'fastapi', 'django',
    'spring', 'terraform', 'ansible', 'gitlab', 'github', 'jira'
  ];
  
  const textLower = text.toLowerCase();
  return techKeywords.filter(tech => textLower.includes(tech));
}

function extractRequiredDegree(jobDescription: string): string {
  const jdLower = jobDescription.toLowerCase();
  
  if (jdLower.includes('computer science') || jdLower.includes('cs')) return 'computer_science';
  if (jdLower.includes('engineering') || jdLower.includes('software engineering')) return 'engineering';
  if (jdLower.includes('mathematics') || jdLower.includes('math')) return 'mathematics';
  if (jdLower.includes('physics')) return 'physics';
  if (jdLower.includes('business') || jdLower.includes('mba')) return 'business';
  
  return 'any';
}

function extractCandidateDegree(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('computer science') || textLower.includes('cs')) return 'computer_science';
  if (textLower.includes('engineering') || textLower.includes('software engineering')) return 'engineering';
  if (textLower.includes('mathematics') || textLower.includes('math')) return 'mathematics';
  if (textLower.includes('physics')) return 'physics';
  if (textLower.includes('business') || textLower.includes('mba')) return 'business';
  
  return 'unknown';
}

function isRelatedDegree(required: string, candidate: string): boolean {
  const relatedDegrees: { [key: string]: string[] } = {
    'computer_science': ['engineering', 'mathematics', 'physics'],
    'engineering': ['computer_science', 'mathematics', 'physics'],
    'mathematics': ['computer_science', 'engineering', 'physics'],
    'physics': ['computer_science', 'engineering', 'mathematics'],
    'business': ['any']
  };
  
  return relatedDegrees[required]?.includes(candidate) || false;
}

function calculateInstitutionRelevance(text: string, jobDescription: string): number {
  // This would ideally connect to a university ranking database
  // For now, return a base score
  return 0.7;
}

function extractIndustryKeywords(jobDescription: string): string[] {
  const industryKeywords = [
    'fintech', 'healthcare', 'e-commerce', 'saas', 'b2b', 'b2c', 'startup',
    'enterprise', 'government', 'non-profit', 'education', 'media',
    'automotive', 'aerospace', 'manufacturing', 'retail', 'logistics'
  ];
  
  const jdLower = jobDescription.toLowerCase();
  return industryKeywords.filter(keyword => jdLower.includes(keyword));
}

function extractCandidateIndustry(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('fintech') || textLower.includes('banking') || textLower.includes('financial')) return 'fintech';
  if (textLower.includes('healthcare') || textLower.includes('medical')) return 'healthcare';
  if (textLower.includes('e-commerce') || textLower.includes('retail')) return 'e-commerce';
  if (textLower.includes('saas') || textLower.includes('software as a service')) return 'saas';
  
  return 'general';
}

function extractCompanySize(jobDescription: string): string {
  const jdLower = jobDescription.toLowerCase();
  
  if (jdLower.includes('fortune 500') || jdLower.includes('enterprise') || jdLower.includes('large')) return 'large';
  if (jdLower.includes('startup') || jdLower.includes('small') || jdLower.includes('< 50')) return 'small';
  if (jdLower.includes('medium') || jdLower.includes('mid-size')) return 'medium';
  
  return 'medium';
}

function extractCandidateCompanySize(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('fortune 500') || textLower.includes('enterprise') || textLower.includes('large')) return 'large';
  if (textLower.includes('startup') || textLower.includes('small') || textLower.includes('< 50')) return 'small';
  if (textLower.includes('medium') || textLower.includes('mid-size')) return 'medium';
  
  return 'medium';
}

function calculateIndustryExperience(text: string, jobDescription: string): number {
  const jdIndustry = extractIndustryKeywords(jobDescription);
  const candidateIndustry = extractCandidateIndustry(text);
  
  if (jdIndustry.length === 0) return 0.5; // No specific industry requirement
  
  const industryMatch = jdIndustry.some(industry => 
    candidateIndustry.includes(industry)
  );
  
  return industryMatch ? 1.0 : 0.0;
}

// Company research and analysis functions
export async function gatherCompanyResearch(companyName: string, jobDescription: string): Promise<any> {
  console.log('🔍 Gathering company research...');
  
  try {
    // This would ideally connect to company databases, LinkedIn, Glassdoor, etc.
    // For now, we'll use AI to analyze the job description and extract insights
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a company research expert. Analyze the job description and extract key insights about the company's:
1. Working methodology (Agile, Waterfall, etc.)
2. Company culture and values
3. Industry focus and market position
4. Technology stack and tools
5. Team structure and collaboration style
6. Growth stage and company size indicators
7. Previous hiring patterns (if mentioned)

Return a JSON object with these insights.`
        },
        {
          role: "user",
          content: `Company: ${companyName}
Job Description: ${jobDescription}

Analyze and provide insights:`
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });
    
    const analysis = response.choices[0].message.content;
    let companyContext = {};
    
    try {
      // Try to parse as JSON, fallback to text analysis
      companyContext = JSON.parse(analysis || '{}');
    } catch (e) {
      // If not valid JSON, extract insights manually
      companyContext = extractCompanyInsights(analysis || '', jobDescription);
    }
    
    return companyContext;
  } catch (error) {
    console.error('Failed to gather company research:', error);
    return extractCompanyInsights('', jobDescription);
  }
}

function extractCompanyInsights(aiAnalysis: string, jobDescription: string): any {
  const jdLower = jobDescription.toLowerCase();
  const analysisLower = aiAnalysis.toLowerCase();
  
  const insights = {
    methodology: extractMethodology(jdLower, analysisLower),
    culture: extractCulture(jdLower, analysisLower),
    industry: extractIndustry(jdLower, analysisLower),
    techStack: extractTechStack(jdLower),
    teamStructure: extractTeamStructure(jdLower, analysisLower),
    companySize: extractCompanySize(jdLower),
    growthStage: extractGrowthStage(jdLower, analysisLower),
    values: extractCompanyValues(jdLower, analysisLower)
  };
  
  return insights;
}

function extractMethodology(jdText: string, analysisText: string): string[] {
  const methodologies = [];
  
  // Agile methodologies
  if (jdText.includes('agile') || jdText.includes('scrum') || jdText.includes('kanban')) {
    methodologies.push('agile');
  }
  
  // DevOps practices
  if (jdText.includes('devops') || jdText.includes('ci/cd') || jdText.includes('continuous')) {
    methodologies.push('devops');
  }
  
  // Lean/Startup methodologies
  if (jdText.includes('lean') || jdText.includes('startup') || jdText.includes('mvp')) {
    methodologies.push('lean');
  }
  
  // Traditional methodologies
  if (jdText.includes('waterfall') || jdText.includes('traditional') || jdText.includes('structured')) {
    methodologies.push('waterfall');
  }
  
  return methodologies.length > 0 ? methodologies : ['agile']; // Default to agile
}

function extractCulture(jdText: string, analysisText: string): string[] {
  const culture = [];
  
  // Remote work culture
  if (jdText.includes('remote') || jdText.includes('distributed') || jdText.includes('work from home')) {
    culture.push('remote-first');
  }
  
  // Collaborative culture
  if (jdText.includes('collaborative') || jdText.includes('team') || jdText.includes('cross-functional')) {
    culture.push('collaborative');
  }
  
  // Fast-paced culture
  if (jdText.includes('fast-paced') || jdText.includes('startup') || jdText.includes('dynamic')) {
    culture.push('fast-paced');
  }
  
  // Innovation-focused
  if (jdText.includes('innovation') || jdText.includes('cutting-edge') || jdText.includes('latest')) {
    culture.push('innovation-focused');
  }
  
  return culture.length > 0 ? culture : ['collaborative'];
}

function extractIndustry(jdText: string, analysisText: string): string {
  if (jdText.includes('fintech') || jdText.includes('banking') || jdText.includes('financial')) return 'fintech';
  if (jdText.includes('healthcare') || jdText.includes('medical')) return 'healthcare';
  if (jdText.includes('e-commerce') || jdText.includes('retail')) return 'e-commerce';
  if (jdText.includes('saas') || jdText.includes('software as a service')) return 'saas';
  if (jdText.includes('ai') || jdText.includes('machine learning') || jdText.includes('artificial intelligence')) return 'ai-ml';
  if (jdText.includes('cybersecurity') || jdText.includes('security')) return 'cybersecurity';
  
  return 'technology';
}

function extractTeamStructure(jdText: string, analysisText: string): string {
  if (jdText.includes('startup') || jdText.includes('small team')) return 'startup';
  if (jdText.includes('enterprise') || jdText.includes('large team')) return 'enterprise';
  if (jdText.includes('agency') || jdText.includes('consulting')) return 'agency';
  
  return 'mid-size';
}

function extractGrowthStage(jdText: string, analysisText: string): string {
  if (jdText.includes('startup') || jdText.includes('early stage') || jdText.includes('seed')) return 'early-stage';
  if (jdText.includes('scale') || jdText.includes('growth') || jdText.includes('series')) return 'growth-stage';
  if (jdText.includes('enterprise') || jdText.includes('established')) return 'established';
  
  return 'growth-stage';
}

function extractCompanyValues(jdText: string, analysisText: string): string[] {
  const values = [];
  
  if (jdText.includes('innovation') || jdText.includes('creativity')) values.push('innovation');
  if (jdText.includes('quality') || jdText.includes('excellence')) values.push('quality');
  if (jdText.includes('collaboration') || jdText.includes('teamwork')) values.push('collaboration');
  if (jdText.includes('customer') || jdText.includes('user')) values.push('customer-focused');
  if (jdText.includes('diversity') || jdText.includes('inclusive')) values.push('diversity');
  if (jdText.includes('learning') || jdText.includes('growth')) values.push('learning');
  
  return values.length > 0 ? values : ['collaboration', 'quality'];
}

// Enhanced impact scoring with company context
function calculateImpactScore(text: string, companyContext?: any): number {
  let score = 0.5; // Base score
  
  // Quantifiable metrics (enhanced)
  const quantifiablePatterns = [
    /\d+%|\d+x|\$\d+|\d+% increase|\d+% improvement/g,
    /\d+ users|\d+ customers|\d+ clients/g,
    /\d+ team members|\d+ people managed/g,
    /\d+ projects|\d+ applications|\d+ systems/g
  ];
  
  let hasQuantifiable = false;
  quantifiablePatterns.forEach(pattern => {
    if (pattern.test(text)) {
      score += 0.3;
      hasQuantifiable = true;
    }
  });
  
  // Action verbs (enhanced with company context)
  const actionVerbs = ['developed', 'implemented', 'led', 'managed', 'created', 'built', 'designed', 'optimized'];
  const strongActionVerbs = ['architected', 'orchestrated', 'spearheaded', 'pioneered', 'transformed', 'revolutionized'];
  
  const hasActionVerb = actionVerbs.some(verb => text.toLowerCase().includes(verb));
  const hasStrongActionVerb = strongActionVerbs.some(verb => text.toLowerCase().includes(verb));
  
  if (hasStrongActionVerb) score += 0.25;
  else if (hasActionVerb) score += 0.2;
  
  // Company-specific impact (if context available)
  if (companyContext?.values) {
    const companyValues = companyContext.values;
    
    if (companyValues.includes('innovation') && text.includes('innovative')) score += 0.1;
    if (companyValues.includes('customer-focused') && text.includes('customer')) score += 0.1;
    if (companyValues.includes('quality') && text.includes('quality')) score += 0.1;
  }
  
  // Industry-specific impact
  if (companyContext?.industry) {
    const industry = companyContext.industry;
    
    if (industry === 'fintech' && text.includes('financial')) score += 0.1;
    if (industry === 'healthcare' && text.includes('health')) score += 0.1;
    if (industry === 'e-commerce' && text.includes('e-commerce')) score += 0.1;
  }
  
  return Math.min(1.0, score);
}

function calculateCoverage(resumeJson: any, jobDescription: string): CoverageBucketJson[] {
  const coverage: CoverageBucketJson[] = [];
  
  // Skills coverage
  if (resumeJson.skills) {
    const skills = Array.isArray(resumeJson.skills) ? resumeJson.skills : 
      Object.values(resumeJson.skills).flat();
    
    const jdSkills = extractSkillsFromJD(jobDescription);
    const coveredSkills = skills.filter((skill: string) => 
      jdSkills.some((jdSkill: string) => 
        skill.toLowerCase().includes(jdSkill.toLowerCase())
      )
    );
    
    // Ensure percentage doesn't exceed 100%
    const percentage = jdSkills.length > 0 ? Math.min(100, (coveredSkills.length / jdSkills.length) * 100) : 100;
    
    coverage.push({
      category: 'Skills',
      covered: Math.min(coveredSkills.length, jdSkills.length), // Cap covered at total
      total: jdSkills.length,
      percentage: percentage
    });
  }
  
  // Experience coverage - calculate based on quality rather than just count
  const experienceCount = resumeJson.experience?.length || 0;
  const minExperienceRequired = 1; // Minimum experience entries expected
  const maxExperienceExpected = 5; // Maximum experience entries typically expected
  
  const experiencePercentage = experienceCount >= minExperienceRequired ? 
    Math.min(100, (experienceCount / maxExperienceExpected) * 100) : 
    (experienceCount / minExperienceRequired) * 100;
  
  coverage.push({
    category: 'Experience',
    covered: experienceCount,
    total: maxExperienceExpected,
    percentage: Math.min(100, Math.max(0, experiencePercentage))
  });
  
  // Projects coverage - calculate based on quality rather than just count
  const projectCount = resumeJson.projects?.length || 0;
  const minProjectsRequired = 1; // Minimum project entries expected
  const maxProjectsExpected = 4; // Maximum project entries typically expected
  
  const projectPercentage = projectCount >= minProjectsRequired ? 
    Math.min(100, (projectCount / maxProjectsExpected) * 100) : 
    (projectCount / minProjectsRequired) * 100;
  
  coverage.push({
    category: 'Projects',
    covered: projectCount,
    total: maxProjectsExpected,
    percentage: Math.min(100, Math.max(0, projectPercentage))
  });
  
  return coverage;
}

function extractSkillsFromJD(jobDescription: string): string[] {
  // Simple skill extraction (can be enhanced)
  const commonSkills = [
    'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws', 'docker',
    'kubernetes', 'git', 'html', 'css', 'api', 'rest', 'graphql', 'mongodb',
    'postgresql', 'redis', 'kafka', 'elasticsearch', 'jenkins', 'ci/cd',
    'agile', 'scrum', 'tdd', 'bdd', 'microservices', 'serverless', 'typescript',
    'vue', 'angular', 'next.js', 'express', 'fastapi', 'django', 'spring',
    'terraform', 'ansible', 'jenkins', 'gitlab', 'github', 'jira', 'confluence'
  ];
  
  const jdLower = jobDescription.toLowerCase();
  return commonSkills.filter(skill => jdLower.includes(skill));
}

function extractKeyRequirements(jobDescription: string): string[] {
  // Extract key requirements and responsibilities
  const requirements: string[] = [];
  const jdLower = jobDescription.toLowerCase();
  
  // Look for common requirement patterns
  const patterns = [
    /experience with\s+([^.,]+)/gi,
    /knowledge of\s+([^.,]+)/gi,
    /familiarity with\s+([^.,]+)/gi,
    /proficiency in\s+([^.,]+)/gi,
    /expertise in\s+([^.,]+)/gi,
    /strong\s+([^.,]+)\s+skills/gi,
    /excellent\s+([^.,]+)\s+abilities/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = jdLower.match(pattern);
    if (matches) {
      requirements.push(...matches.map(match => match.replace(pattern, '$1').trim()));
    }
  });
  
  // Add common requirements
  const commonReqs = [
    'leadership', 'communication', 'problem solving', 'teamwork', 'collaboration',
    'project management', 'agile methodology', 'scrum', 'kanban', 'lean',
    'data analysis', 'analytics', 'reporting', 'documentation', 'testing',
    'quality assurance', 'performance optimization', 'scalability', 'security'
  ];
  
  commonReqs.forEach(req => {
    if (jdLower.includes(req)) {
      requirements.push(req);
    }
  });
  
  return [...new Set(requirements)].slice(0, 10); // Remove duplicates and limit
}

function extractMissingKeywords(jobDescription: string, plan: OptimizationPlanJson): string[] {
  const jdKeywords = extractSkillsFromJD(jobDescription);
  const resumeKeywords = new Set<string>();
  
  // Extract keywords from all bullets
  [...plan.roles, ...plan.projects].forEach((item: RoleJson | ProjectJson) => {
    item.bullets.forEach((bullet: BulletJson) => {
      const words = bullet.text.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach((word: string) => {
        if (word.length > 3) resumeKeywords.add(word);
      });
    });
  });
  
  return jdKeywords.filter(keyword => !resumeKeywords.has(keyword));
}

async function generateSuggestedBullets(experience: any, jobDescription: string, companyContext?: any): Promise<string[]> {
  try {
    const companyContextStr = companyContext ? JSON.stringify(companyContext, null, 2) : 'No specific company context available';
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Generate 3 impactful bullet points for this work experience using the STAR method. Each should be under 220 characters and relevant to the job description. Consider the company's methodology, culture, and industry focus when crafting suggestions.`
        },
        {
          role: "user",
          content: `Position: ${experience.position}
Company: ${experience.company}
Duration: ${experience.duration}
Job Description: ${jobDescription}
Company Context: ${companyContextStr}

Generate 3 bullet points that align with the company's values and methodology:`
        }
      ],
      max_tokens: 300,
      temperature: 0.4
    });
    
    return response.choices[0].message.content
      ?.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0 && line.length <= 220)
      .slice(0, 3) || [];
  } catch (error) {
    console.error('Failed to generate suggested bullets:', error);
    return [
      'Developed and maintained key features using modern technologies',
      'Collaborated with cross-functional teams to deliver high-quality solutions',
      'Improved system performance and user experience through optimization'
    ];
  }
}
