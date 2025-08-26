import crypto from "node:crypto";

export type PlanBlob = {
  plan: OptimizationPlanJson;
  fit: FitMetricsJson;
  createdAt: number;
  originalResumeJson: any; // Keep original for undo/redo
};

export type OptimizationPlanJson = {
  id: string;
  roles: RoleJson[];
  projects: ProjectJson[];
  coverage: CoverageBucketJson[];
};

export type RoleJson = {
  id: string;
  company: string;
  position: string;
  duration: string;
  location: string;
  bullets: BulletJson[];
  jdMatchScore: number;
  impactScore: number;
};

export type BulletJson = {
  id: string;
  text: string;
  jdMatchScore: number;
  impactScore: number;
  suggested: boolean;
};

export type ProjectJson = {
  id: string;
  projectName: string;
  techStack: string;
  bullets: BulletJson[];
  jdMatchScore: number;
};

export type CoverageBucketJson = {
  category: string;
  covered: number;
  total: number;
  percentage: number;
};

export type FitMetricsJson = {
  overallScore: number;
  experienceMatch: number;
  projectMatch: number;
  skillCoverage: number;
  missingKeywords: string[];
};

const PLAN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const plans = new Map<string, PlanBlob>();

export function savePlan(planId: string, blob: PlanBlob) {
  plans.set(planId, blob);
  console.log(`💾 Plan saved: ${planId} (${plans.size} total plans)`);
}

export function getPlan(planId: string): PlanBlob | null {
  const blob = plans.get(planId);
  if (!blob) {
    console.log(`❌ Plan not found: ${planId}`);
    return null;
  }
  
  if (Date.now() - blob.createdAt > PLAN_TTL_MS) {
    plans.delete(planId);
    console.log(`⏰ Plan expired: ${planId}`);
    return null;
  }
  
  console.log(`✅ Plan retrieved: ${planId}`);
  return blob;
}

export function newPlanId(): string {
  return crypto.randomUUID();
}

export function stableId(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12);
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [id, blob] of plans.entries()) {
    if (now - blob.createdAt > PLAN_TTL_MS) {
      plans.delete(id);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired plans (${plans.size} remaining)`);
  }
}, 60 * 60 * 1000); // Clean every hour

// Export for debugging
export function getPlanStats() {
  return {
    totalPlans: plans.size,
    oldestPlan: Math.min(...Array.from(plans.values()).map(p => p.createdAt)),
    newestPlan: Math.max(...Array.from(plans.values()).map(p => p.createdAt))
  };
}
