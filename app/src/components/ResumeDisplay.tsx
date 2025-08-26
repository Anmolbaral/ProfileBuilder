import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ResumeData {
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
  };
  education?: Array<{
    institution?: string;
    degree?: string;
    year?: string;
    gpa?: string;
  }>;
  experience?: Array<{
    company?: string;
    position?: string;
    duration?: string;
    location?: string;
    impactBullets?: string[];
  }>;
  projects?: Array<{
    projectName?: string;
    techStack?: string;
    impactBullets?: string[];
  }>;
  skills?: any;
  honorsAndAwards?: string[];
}

interface ResumeDisplayProps {
  resumeData: ResumeData;
}

export const ResumeDisplay: React.FC<ResumeDisplayProps> = ({ resumeData }) => {
  if (!resumeData || Object.keys(resumeData).length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">No resume data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contact Information */}
      {resumeData.contactInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resumeData.contactInfo.name && (
                <p className="text-xl font-bold">{resumeData.contactInfo.name}</p>
              )}
              {resumeData.contactInfo.email && (
                <p className="text-gray-600">{resumeData.contactInfo.email}</p>
              )}
              {resumeData.contactInfo.phone && (
                <p className="text-gray-600">{resumeData.contactInfo.phone}</p>
              )}
              <div className="flex gap-4 mt-2">
                {resumeData.contactInfo.linkedin && (
                  <a 
                    href={resumeData.contactInfo.linkedin} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    LinkedIn
                  </a>
                )}
                {resumeData.contactInfo.github && (
                  <a 
                    href={resumeData.contactInfo.github} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GitHub
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {resumeData.education && resumeData.education.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Education</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resumeData.education.map((edu, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <p className="font-semibold">{edu.institution}</p>
                  <p className="text-gray-600">{edu.degree}</p>
                  <div className="flex gap-4 text-sm text-gray-500">
                    {edu.year && <span>{edu.year}</span>}
                    {edu.gpa && <span>GPA: {edu.gpa}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Experience */}
      {resumeData.experience && resumeData.experience.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Work Experience</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {resumeData.experience.map((exp, index) => (
                <div key={index} className="border-l-4 border-green-500 pl-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{exp.position}</p>
                      <p className="text-gray-600">{exp.company}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{exp.duration}</p>
                      {exp.location && <p>{exp.location}</p>}
                    </div>
                  </div>
                  {exp.impactBullets && exp.impactBullets.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      {exp.impactBullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="text-gray-700">{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {resumeData.projects && resumeData.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resumeData.projects.map((project, index) => (
                <div key={index} className="border-l-4 border-purple-500 pl-4">
                  <p className="font-semibold">{project.projectName}</p>
                  {project.techStack && (
                    <p className="text-sm text-gray-600 mb-2">Tech: {project.techStack}</p>
                  )}
                  {project.impactBullets && project.impactBullets.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      {project.impactBullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="text-gray-700">{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      {resumeData.skills && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(resumeData.skills) ? (
              <div className="flex flex-wrap gap-2">
                {resumeData.skills.map((skill, index) => (
                  <span 
                    key={index} 
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : typeof resumeData.skills === 'object' ? (
              <div className="space-y-4">
                {Object.entries(resumeData.skills).map(([category, skills]) => (
                  <div key={category}>
                    <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(skills) && skills.map((skill: string, index: number) => (
                        <span 
                          key={index} 
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">{String(resumeData.skills)}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Honors & Awards */}
      {resumeData.honorsAndAwards && resumeData.honorsAndAwards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Honors & Awards</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {resumeData.honorsAndAwards.map((award, index) => (
                <li key={index} className="text-gray-700">{award}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
