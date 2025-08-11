import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      :undefined
});

export const truncate = (s: string, n = 400) =>
	s.length > n ? s.slice(0, n) + '…(truncated)' : s;
      
      export function summarizeResume(data: any) {
	const exp = Array.isArray(data?.experience) ? data.experience.length : 0;
	const proj = Array.isArray(data?.projects) ? data.projects.length : 0;
	return { experienceCount: exp, projectsCount: proj };
      }