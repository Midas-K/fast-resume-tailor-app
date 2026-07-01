import IconButton from "../UI/IconButton";
import { useToast } from "../UI/ToastProvider";
import { API_URL, authHeaders } from "../shared/api/client";
import { cachedJsonGet } from "../shared/api/cache";
import {
  buildNonRemoteConfirmMessage,
  detectJobDescriptionWorkMode,
  shouldConfirmNonRemoteCopy,
} from "../shared/utils/detectJobDescriptionWorkMode";

function PromptGenerator({
  jobDescription = "",
  roleName = "",
  companyName = "",
  selectedProfile = null,
}) {
  const { showConfirm } = useToast();

  const parseJsonField = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  };

  const formatExperienceForPrompt = (experienceValue) => {
     const experienceList = parseJsonField(experienceValue);
   
     if (experienceList.length === 0) {
       return "No work experience added.";
     }
   
     return experienceList
       .map((item) => {
         const title = item.title || "";
         const companyName = item.companyName || "";
         const timeline = item.timeline || "";
   
         return `• ${[title, companyName, timeline]
           .filter((value) => value && value.trim())
           .join(", ")}`;
       })
       .join("\n");
   };
   
   const formatEducationForPrompt = (educationValue) => {
     const educationList = parseJsonField(educationValue);
   
     if (educationList.length === 0) {
       return "No education added.";
     }
   
     return educationList
       .map((item) => {
         const school = item.school || "";
         const degree = item.degree || "";
         const timeline = item.timeline || "";
   
         return `• ${[school, degree, timeline]
           .filter((value) => value && value.trim())
           .join(", ")}`;
       })
       .join("\n");
   };

  const getLatestSelectedProfile = async () => {
    if (!selectedProfile?.id) {
      throw new Error("Please select a profile first.");
    }

    const result = await cachedJsonGet(
      `${API_URL}/api/profiles/${selectedProfile.id}`,
      { headers: authHeaders() },
      15_000
    );

    const latestProfile = result.profile;

    if (!latestProfile) {
      throw new Error("Selected profile was not found. Please select profile again.");
    }

    localStorage.setItem("rta_selected_profile", JSON.stringify(latestProfile));

    return latestProfile;
  };

  const buildSamplePrompt = (profile) => {
          return `
I will paste a Job Description (JD).

1. Creating a Resume
Your task is to create a resume that is fully tailored for this specific role and optimized to achieve the highest possible ATS match score, using ONLY job-relevant information.

✅ Allowed Job Description Sections (use ONLY these or their equivalents):

     • Responsibilities / Role / Role Description / You Will
     • Requirements / Qualifications
     • Preferred Qualifications
     • Top Skills
     • Nice to Have / Bonus to Have
     • Key Activities
     • Key Success Metrics
     • Ideal Background & Expertise
     • Technologies

❌ Disallowed Job Description Content (DO NOT use or reference):

     • Company culture
     • Mission / Vision
     • About the company
     • Employer branding language
     • Values, DEI statements, or storytelling content

If any JD content does not clearly define skills, responsibilities, tools, technologies, or measurable outcomes, ignore it completely.

Interview-Only Evaluation Criteria Exclusion:

     • Some job description requirements describe how candidates will be evaluated in interviews, not resume content.
     • If a JD requirement refers to judgment, decision-making quality, prioritization ability, planning horizons, ambiguity management, ownership mentality, or “making good decisions,” treat it as interview-only evaluation criteria.
     • Do NOT reflect, paraphrase, or restate these requirements anywhere in the resume, including the Summary, Skills, or Experience sections.
     • These traits may only be implicitly demonstrated through concrete actions, delivered systems, deployed models, and measurable outcomes.
     • If a JD requirement cannot be proven through observable work or results, exclude it entirely from resume language.

Evidence-Only Resume Rule

     • Every resume bullet must describe a concrete action taken, system built, model developed, or outcome delivered.
     • Abstract self-assessments are prohibited unless demonstrated through tangible work outputs.

Full name: ${selectedProfile?.name || ""}

My Work Experience:

     ${formatExperienceForPrompt(profile?.experience)}

Education:

     ${formatEducationForPrompt(profile?.education)}

Summary Section 

     • Write a professional summary of 7 sentences.
     • Begin the Professional Summary with the following sentence and expand it as needed to align with the job description: 'Staff AI/ML Engineer with 10 years of experience ...' .

Work Experience Section Match the company name and period 

     • each company: MUST have 6 - 8 bullets.
     • You MUST write a minimum of 6 bullets and a maximum of 8 bullets for EACH company.
     • Under NO circumstances may any company have fewer than 6 bullets or more than 8 bullets.
     • The Work Experience section MUST include a horizontal divider between each company.
     • Ensure the Skills section explicitly lists Enterprise GenAI Platforms, Agentic AI Systems, Secure RAG Architectures, LLMOps, and AI Governance.
     • Use this format when you write title, company name and timeline: [Title] - [Company Name] | [timeline]

Each bullet is more than 250 letters based on skill and company info and has space from left or start.

Skills Section Add as many relevant skills 

     • Go beyond the JD to include additional expertise where appropriate.
     • The Skills section MUST be divided into clearly labeled categories.
     • Each category MUST be bolded and followed by a colon.
     • Skills within each category MUST be listed as comma-separated phrases.
     • The Skills section MUST NOT be written as a single paragraph, bullet list, or two-column layout.
     • The Skills section MUST be optimized for ATS keyword parsing and senior-level hiring manager readability.
     • The Skills section MUST preserve technical specificity and enterprise terminology used in the job description.

Certification Section

     • Make the completed and suitable 3 or 4 certifications based on the job description.

No longer use the "—" em dash anywhere in the resume. Use "-" for ranges like dates.

Resume order is Summary, Education, SKills, Experience, and Certifications.

When referencing experience or time, always use numeric values. Example: 12+, 13, 13+ years of experience.


2. Job Bidding Questions
 • I will paste the list of application or interview questions from the employer.
 • You must generate concise answers:
 • 1-2 sentences only.
 • Max 20 words each.
 • Align directly with the JD and my resume.
 • Emphasize technical expertise, leadership, accomplishments, and JD alignment.

Job Description:
'''
${jobDescription}
'''
   `;
     };
   
     const buildUploadedPrompt = (profile) => {
          return `
      ${profile.admin_prompt}
            
Name: ${profile?.name || ""}
      
Education:
      ${formatEducationForPrompt(profile?.education)}
      
My Work Experience:
      ${formatExperienceForPrompt(profile?.experience)}
      
Job Description:
${jobDescription}
      `;
        };
      
        const buildResumePrompt = async () => {
          const latestProfile = await getLatestSelectedProfile();
      
          if (latestProfile.admin_prompt && latestProfile.admin_prompt.trim()) {
            return buildUploadedPrompt(latestProfile);
          }
      
          return buildSamplePrompt(latestProfile);
        };
      
        const copyPrompt = async () => {
          if (
            !selectedProfile ||
            !roleName.trim() ||
            !companyName.trim() ||
            !jobDescription.trim()
          ) {
            alert(
              "Please select a profile and enter role name, company name, and job description first."
            );
            return;
          }

          const workMode = detectJobDescriptionWorkMode(jobDescription);

          if (shouldConfirmNonRemoteCopy(workMode)) {
            const confirmed = await showConfirm(
              buildNonRemoteConfirmMessage(workMode),
              {
                title: "Not a Remote role",
                confirmLabel: "Continue",
                cancelLabel: "Cancel",
              }
            );

            if (!confirmed) {
              return;
            }
          }
      
          try {
            const prompt = await buildResumePrompt();
      
            try {
              await navigator.clipboard.writeText(prompt);
            } catch (error) {
              const textArea = document.createElement("textarea");
              textArea.value = prompt;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand("copy");
              document.body.removeChild(textArea);
            }
      
            alert("Prompt copied!");
          } catch (error) {
            alert(error.message);
          }
        };
      
        return (
          <IconButton
            icon="copy"
            label="Copy prompt"
            variant="primary"
            onClick={copyPrompt}
          />
        );
      }
      
      export default PromptGenerator;