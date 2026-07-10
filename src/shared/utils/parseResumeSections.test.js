import {
  applyParsedResumeToForm,
  detectSectionType,
  hasPastedCertificationsSection,
  hasPastedEducationSection,
  normalizeCertificationsContent,
  normalizeExperienceBodyToLines,
  normalizeSkillsContent,
  parseCompanyTimelineLine,
  parseCompanyTitleLine,
  compareDegreesExactly,
  parseDegreeTimelineLine,
  parseEducationEntries,
  parseSchoolDegreeLine,
  parseSchoolDegreeTimelineLine,
  parseResumeSections,
  splitExperienceByCompanies,
  splitExperienceIntoJobBlocks,
  validatePastedResumeAgainstProfile,
} from "./parseResumeSections";

const EXAMPLE_RESUME = `
PROFESSIONAL SUMMARY
Staff AI & Machine Learning Engineer with 10+ years of experience in building production-grade GenAI applications and enterprise-scale machine learning systems.

EDUCATION
University of South Florida
Bachelor of Science, Computer Science
Jan 2014 - Dec 2016

SKILLS
INTELLIGENT SYSTEMS & ALGORITHMS: GenAI Pipeline Development, OpenAI, LLaMA, Gemini, Vertex AI, AutoML

APPLICATION ENGINEERING: Python 3.11, SQL, Data Extraction Pipelines

WORK EXPERIENCE
Staff Software Engineer (AI/ML Systems)
Confluent | Nov 2024 - Present

Architecting and deploying end-to-end GenAI applications for global marketing analytics, leveraging Apache Kafka and real-time data streams to process 50K+ marketing events per second with sub-100ms latency.

Designed and implemented production-grade GenAI pipelines using OpenAI GPT-4 and Gemini Pro, integrated with Vertex AI and SageMaker managed services.

Senior Software Engineer (AI/ML)
IBM | Jun 2019 - Oct 2024

Led development of enterprise-scale marketing intelligence platform serving 100+ Fortune 500 clients, architecting GenAI solutions that integrated LLaMA and AutoML with existing data lakes.

Built and deployed advanced statistical models for forecasting and causal inference applications using Scikit-learn and TensorFlow.

AI/Machine Learning Scientist
Amazon | Jan 2017 - May 2019

Developed production-ready machine learning models for customer behavior prediction and recommendation systems, implementing collaborative filtering and deep learning approaches using PyTorch and TensorFlow.

Engineered data pipelines using AWS services including Glue, EMR, and Redshift, processing 2TB+ of customer transaction data daily.

CERTIFICATIONS
Google Professional Machine Learning Engineer

AWS Certified Machine Learning - Specialty

Certified Kubernetes Application Developer (CKAD)
`;

describe("parseResumeSections", () => {
  test("detects alternate section headings", () => {
    expect(detectSectionType("Professional Summary")).toBe("summary");
    expect(detectSectionType("PROFESSIONAL SUMMARY")).toBe("summary");
    expect(detectSectionType("**Technical Skills**")).toBe("skills");
    expect(detectSectionType("Skill")).toBe("skills");
    expect(detectSectionType("Skill Set")).toBe("skills");
    expect(detectSectionType("Skillset")).toBe("skills");
    expect(detectSectionType("Skills Set")).toBe("skills");
    expect(detectSectionType("Technical Skill Set")).toBe("skills");
    expect(detectSectionType("Key Skills")).toBe("skills");
    expect(detectSectionType("Work Experience")).toBe("experience");
    expect(detectSectionType("Professional Certifications")).toBe(
      "certifications"
    );
    expect(detectSectionType("Education")).toBe("ignore");
    expect(detectSectionType("Projects")).toBe("ignore");
  });

  test("parses sections in any order and ignores extra sections", () => {
    const text = `
Professional Summary
Seasoned ML engineer with 10+ years of experience.

Technical Skills
Python, TensorFlow, AWS

Education
MIT, Computer Science

Work Experience
Meta | Staff Engineer
Built graph systems

Certifications
AWS Certified Machine Learning - Specialty
`;

    const parsed = parseResumeSections(text, [{ companyName: "Meta" }]);

    expect(parsed.summary).toContain("Seasoned ML engineer");
    expect(parsed.skills).toContain("Python, TensorFlow");
    expect(parsed.experience).toContain("Built graph systems");
    expect(parsed.certifications).toContain("AWS Certified");
    expect(parsed.foundSections).toEqual(
      expect.arrayContaining([
        "summary",
        "skills",
        "experience",
        "certifications",
      ])
    );
    expect(parsed.experience).not.toContain("MIT");
  });

  test("handles plain sentences with or without blank lines between them", () => {
    const withGaps = normalizeSkillsContent(`
Languages: Python, Java

Cloud: AWS, GCP

Data: Kafka
`);

    expect(withGaps.split("\n")).toHaveLength(3);

    const withoutGaps = normalizeCertificationsContent(`AWS Certified Solutions Architect
Google Professional Data Engineer
Certified Kubernetes Application Developer`);

    expect(withoutGaps.split("\n")).toHaveLength(3);
  });

  test("converts newline-separated sentences into bullet-ready lines", () => {
    const body = `Built streaming pipelines with Kafka
Improved latency by 40%
Led cross-team design reviews`;

    const normalized = normalizeExperienceBodyToLines(body);

    expect(normalized.split("\n")).toHaveLength(3);
    expect(normalized).toContain("Built streaming pipelines with Kafka");
    expect(normalized).not.toMatch(/^-/m);
  });

  test("converts paragraph experience into bullet-ready lines", () => {
    const body = `First accomplishment paragraph without any dash prefix.

Second accomplishment paragraph for the same role.`;

    const normalized = normalizeExperienceBodyToLines(body);

    expect(normalized.split("\n")).toHaveLength(2);
    expect(normalized).toContain("First accomplishment paragraph");
    expect(normalized).toContain("Second accomplishment paragraph");
  });

  test("keeps explicit markdown and dash bullets", () => {
    const body = `- First bullet
* Second bullet
1. Third bullet`;

    const normalized = normalizeExperienceBodyToLines(body);

    expect(normalized.split("\n")).toHaveLength(3);
    expect(normalized).not.toMatch(/^-/m);
  });

  test("detects company timeline lines", () => {
    expect(parseCompanyTimelineLine("Confluent | Nov 2024 - Present")).toEqual({
      company: "Confluent",
      timeline: "Nov 2024 - Present",
    });
  });

  test("splits experience into job blocks without dash bullets", () => {
    const blocks = splitExperienceIntoJobBlocks(`
Staff Software Engineer (AI/ML Systems)
Confluent | Nov 2024 - Present

First role accomplishment paragraph.

Second role accomplishment paragraph.

Senior Software Engineer (AI/ML)
IBM | Jun 2019 - Oct 2024

IBM accomplishment paragraph one.

IBM accomplishment paragraph two.
`);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].company).toBe("Confluent");
    expect(blocks[0].body.split("\n")).toHaveLength(2);
    expect(blocks[1].company).toBe("IBM");
    expect(blocks[1].body.split("\n")).toHaveLength(2);
  });

  test("maps job blocks to profile companies by order when names differ", () => {
    const parsed = parseResumeSections(EXAMPLE_RESUME, [
      { companyName: "Confluent" },
      { companyName: "IBM" },
      { companyName: "Amazon" },
    ]);

    expect(parsed.experienceByCompany.Confluent).toContain(
      "Architecting and deploying end-to-end GenAI applications"
    );
    expect(parsed.experienceByCompany.IBM).toContain(
      "Led development of enterprise-scale marketing intelligence platform"
    );
    expect(parsed.experienceByCompany.Amazon).toContain(
      "Developed production-ready machine learning models"
    );
  });

  test("normalizes certifications from blank-line separated entries", () => {
    const normalized = normalizeCertificationsContent(`
Google Professional Machine Learning Engineer

AWS Certified Machine Learning - Specialty

Certified Kubernetes Application Developer (CKAD)
`);

    expect(normalized.split("\n")).toHaveLength(3);
  });

  test("normalizes skills categories into bullet-ready lines", () => {
    const normalized = normalizeSkillsContent(`
INTELLIGENT SYSTEMS & ALGORITHMS: GenAI Pipeline Development, OpenAI

APPLICATION ENGINEERING: Python 3.11, SQL
`);

    expect(normalized.split("\n")).toHaveLength(2);
    expect(normalized).toContain("INTELLIGENT SYSTEMS & ALGORITHMS:");
  });

  test("applyParsedResumeToForm maps parsed values into form state", () => {
    const parsed = parseResumeSections(
      `
Summary
One-line summary.

Skills
Java, Spring

Experience
Acme Corp | Jan 2020 - Present

Shipped APIs for billing platform.

Certifications
PMP
`,
      [{ companyName: "Acme Corp" }]
    );

    const applied = applyParsedResumeToForm({
      parsed,
      profileCompanies: [{ companyName: "Acme Corp" }],
      currentExperienceInputs: [
        {
          id: 0,
          companyName: "Acme Corp",
          title: "Engineer",
          timeline: "2020-2024",
          location: "Remote",
          details: "",
        },
      ],
    });

    expect(applied.summary).toContain("One-line summary");
    expect(applied.skills).toContain("Java, Spring");
    expect(applied.certification).toContain("PMP");
    expect(applied.experienceInputs[0].details).toContain("Shipped APIs");
  });

  test("splitExperienceByCompanies keeps all content for a single company profile", () => {
    const experienceByCompany = splitExperienceByCompanies(
      "Acme Corp | Jan 2020 - Present\n\nBuilt APIs\n\nLed migrations",
      [{ companyName: "Acme" }]
    );

    expect(experienceByCompany.Acme.split("\n")).toHaveLength(2);
  });

  test("validatePastedResumeAgainstProfile passes when experience titles match profile", () => {
    const profile = {
      experience: [
        {
          companyName: "Confluent",
          title: "Staff Software Engineer (AI/ML Systems)",
          timeline: "Nov 2024 - Present",
        },
        {
          companyName: "IBM",
          title: "Senior Software Engineer (AI/ML)",
          timeline: "Jun 2019 - Oct 2024",
        },
        {
          companyName: "Amazon",
          title: "AI/Machine Learning Scientist",
          timeline: "Jan 2017 - May 2019",
        },
      ],
      education: [
        {
          school: "University of South Florida",
          degree: "Bachelor of Science, Computer Science",
          timeline: "Jan 2014 - Dec 2016",
        },
      ],
      resume_template_has_certifications: false,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: EXAMPLE_RESUME,
      profile,
      templateHasCertifications: false,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches).toHaveLength(0);
  });

  test("parses company title line with timeline on next line", () => {
    const blocks = splitExperienceIntoJobBlocks(
      `
Meta | Staff AI/ML Engineer
Oct 2023 – Present

Built recommendation systems for feed ranking.

Designed large-scale training pipelines on PyTorch.
`,
      [
        {
          companyName: "Meta",
          title: "Staff AI/ML Engineer",
          timeline: "Oct 2023 - Present",
        },
      ]
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].company).toBe("Meta");
    expect(blocks[0].title).toBe("Staff AI/ML Engineer");
    expect(blocks[0].timeline).toMatch(/Oct 2023/i);
    expect(blocks[0].body.split("\n")).toHaveLength(2);
  });

  test("parses company title timeline on one line", () => {
    expect(
      parseCompanyTimelineLine("Meta | Staff AI/ML Engineer | Oct 2023 - Present")
    ).toEqual({
      company: "Meta",
      title: "Staff AI/ML Engineer",
      timeline: "Oct 2023 - Present",
    });
  });

  test("parses title at company format", () => {
    expect(parseCompanyTitleLine("Staff AI/ML Engineer at Meta")).toEqual({
      title: "Staff AI/ML Engineer",
      company: "Meta",
    });
  });

  test("parses school on one line and degree timeline on the next", () => {
    const entries = parseEducationEntries(
      `
Stanford University
Bachelor of Science in Computer Science | Jan 2010 – Dec 2014
`,
      [
        {
          school: "Stanford University",
          degree: "Bachelor of Science in Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
      ]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].school).toBe("Stanford University");
    expect(entries[0].degree).toBe("Bachelor of Science in Computer Science");
    expect(entries[0].timeline).toMatch(/Jan 2010/i);
  });

  test("parses degree timeline line helper", () => {
    expect(
      parseDegreeTimelineLine(
        "Bachelor of Science in Computer Science | Jan 2010 – Dec 2014"
      )
    ).toEqual({
      degree: "Bachelor of Science in Computer Science",
      timeline: "Jan 2010 – Dec 2014",
    });
  });

  test("parses school degree timeline on one line", () => {
    expect(
      parseSchoolDegreeTimelineLine(
        "Stanford University | Bachelor of Science in Computer Science | Jan 2010 - Dec 2014"
      )
    ).toEqual({
      school: "Stanford University",
      degree: "Bachelor of Science in Computer Science",
      timeline: "Jan 2010 - Dec 2014",
    });
  });

  test("parses school degree timeline with comma-separated months", () => {
    expect(
      parseSchoolDegreeTimelineLine(
        "University of South Florida | Bachelor of Science, Computer Science | Jan, 2014 - Dec, 2016"
      )
    ).toEqual({
      school: "University of South Florida",
      degree: "Bachelor of Science, Computer Science",
      timeline: "Jan, 2014 - Dec, 2016",
    });
  });

  test("validates school degree timeline single line against profile", () => {
    const profile = {
      experience: [],
      education: [
        {
          school: "University of South Florida",
          degree: "Bachelor of Science, Computer Science",
          timeline: "Jan 2014 - Dec 2016",
        },
      ],
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
ML engineer.

SKILLS
Python

EDUCATION
University of South Florida | Bachelor of Science, Computer Science | Jan, 2014 - Dec, 2016

WORK EXPERIENCE
Acme | Engineer | Jan 2020 - Present

Built models.

CERTIFICATIONS
AWS Certified Machine Learning - Specialty
`,
      profile: {
        ...profile,
        experience: [
          {
            companyName: "Acme",
            title: "Engineer",
            timeline: "Jan 2020 - Present",
          },
        ],
      },
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches).toHaveLength(0);
  });

  test("parses multiple schools with degree timeline lines and no blank lines", () => {
    const entries = parseEducationEntries(
      `
Stanford University
Bachelor of Science in Computer Science | Jan 2010 – Dec 2014
Massachusetts Institute of Technology
Master of Science, Computer Science | Sep 2016 - May 2018
`,
      [
        {
          school: "Stanford University",
          degree: "Bachelor of Science in Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
        {
          school: "Massachusetts Institute of Technology",
          degree: "Master of Science, Computer Science",
          timeline: "Sep 2016 - May 2018",
        },
      ]
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].school).toBe("Stanford University");
    expect(entries[1].school).toBe("Massachusetts Institute of Technology");
  });

  test("parses school degree line with timeline on the next line", () => {
    const entries = parseEducationEntries(
      `
Stanford University | Bachelor of Science in Computer Science
Jan 2010 – Dec 2014
`,
      [
        {
          school: "Stanford University",
          degree: "Bachelor of Science in Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
      ]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].school).toBe("Stanford University");
    expect(entries[0].degree).toBe("Bachelor of Science in Computer Science");
    expect(entries[0].timeline).toMatch(/Jan 2010/i);
  });

  test("treats comma and in degree formats as equivalent", () => {
    expect(
      compareDegreesExactly(
        "Bachelor of Science, Computer Science",
        "Bachelor of Science in Computer Science"
      )
    ).toBe(true);
    expect(
      compareDegreesExactly(
        "Master of Science, Artificial Intelligence",
        "Master of Science in Artificial Intelligence"
      )
    ).toBe(true);
  });

  test("validates stanford degree timeline when profile uses comma degree format", () => {
    const profile = {
      experience: [],
      education: [
        {
          school: "Stanford University",
          degree: "Bachelor of Science, Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
      ],
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
ML engineer.

SKILLS
Python

EDUCATION
Stanford University
Bachelor of Science in Computer Science | Jan 2010 – Dec 2014

WORK EXPERIENCE
Acme | Engineer | Jan 2020 - Present

Built models.

CERTIFICATIONS
AWS Certified Machine Learning - Specialty
`,
      profile: {
        ...profile,
        experience: [
          {
            companyName: "Acme",
            title: "Engineer",
            timeline: "Jan 2020 - Present",
          },
        ],
      },
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches.join(" ")).not.toMatch(/degree must match/i);
  });

  test("validates school plus degree timeline format against profile", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Engineer",
          timeline: "Oct 2023 - Present",
        },
      ],
      education: [
        {
          school: "Stanford University",
          degree: "Bachelor of Science in Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
      ],
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
ML engineer.

SKILLS
Python

EDUCATION
Stanford University
Bachelor of Science in Computer Science | Jan 2010 – Dec 2014

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built models.

CERTIFICATIONS
AWS Certified Machine Learning - Specialty
`,
      profile,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches).toHaveLength(0);
  });

  test("parses education entries without blank lines between schools", () => {
    const entries = parseEducationEntries(
      `
University of South Florida
Bachelor of Science, Computer Science
Jan 2014 - Dec 2016
Massachusetts Institute of Technology
Master of Science, Computer Science
Sep 2016 - May 2018
`,
      [
        {
          school: "University of South Florida",
          degree: "Bachelor of Science, Computer Science",
          timeline: "Jan 2014 - Dec 2016",
        },
        {
          school: "Massachusetts Institute of Technology",
          degree: "Master of Science, Computer Science",
          timeline: "Sep 2016 - May 2018",
        },
      ]
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].school).toBe("University of South Florida");
    expect(entries[1].school).toBe("Massachusetts Institute of Technology");
  });

  test("parses school and degree on one pipe-separated line", () => {
    expect(
      parseSchoolDegreeLine(
        "University of South Florida | Bachelor of Science, Computer Science"
      )
    ).toEqual({
      school: "University of South Florida",
      degree: "Bachelor of Science, Computer Science",
    });
  });

  test("parses experience headers in alternate order", () => {
    const blocks = splitExperienceIntoJobBlocks(
      `
Confluent
Staff Software Engineer (AI/ML Systems)
Nov 2024 - Present

First accomplishment paragraph for the role.

Second accomplishment paragraph for the role.
`,
      [
        {
          companyName: "Confluent",
          title: "Staff Software Engineer (AI/ML Systems)",
          timeline: "Nov 2024 - Present",
        },
      ]
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].company).toBe("Confluent");
    expect(blocks[0].title).toBe("Staff Software Engineer (AI/ML Systems)");
    expect(blocks[0].timeline).toBe("Nov 2024 - Present");
    expect(blocks[0].body.split("\n")).toHaveLength(2);
  });

  test("parses education headers in alternate order", () => {
    const entries = parseEducationEntries(
      `
Jan 2014 - Dec 2016
Bachelor of Science, Computer Science
University of South Florida
`,
      [
        {
          school: "University of South Florida",
          degree: "Bachelor of Science, Computer Science",
          timeline: "Jan 2014 - Dec 2016",
        },
      ]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].school).toBe("University of South Florida");
    expect(entries[0].degree).toBe("Bachelor of Science, Computer Science");
    expect(entries[0].timeline).toBe("Jan 2014 - Dec 2016");
  });

  test("ignores duplicate experience section headings inside pasted experience", () => {
    const blocks = splitExperienceIntoJobBlocks(
      `
PROFESSIONAL EXPERIENCE
Meta
Staff AI/ML Engineer
Oct 2023 - Present

Built feed ranking models.

PROFESSIONAL EXPERIENCE
Databricks
Senior Machine Learning Engineer
Sep 2019 - Oct 2023

Built lakehouse ML pipelines.
`,
      [
        { companyName: "Meta" },
        { companyName: "Databricks" },
      ]
    );

    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0].company).toBe("Meta");
    expect(blocks[1].company).toBe("Databricks");
  });

  test("parses markdown pipe job headers without counting bullet at-phrases as jobs", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Machine Learning Engineer",
          timeline: "Oct 2023 - Present",
        },
        {
          companyName: "Amazon",
          title: "Senior Machine Learning Engineer",
          timeline: "Feb 2020 - Sep 2023",
        },
        {
          companyName: "Skysoft Inc.",
          title: "Software Engineer (ML)",
          timeline: "Jun 2016 - Jan 2020",
        },
      ],
      education: [],
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
## Professional Summary
Staff AI engineer.

## Skills
Python

## Education
University of Central Florida | Bachelor's Degree in Computer Science | Aug 2012 - May 2016

## Work Experience

**Meta | Staff Machine Learning Engineer | Oct 2023 - Present**

- Architected map reconstruction achieving 99.2% lane boundary accuracy at 30 FPS on embedded hardware.

---

**Amazon | Senior Machine Learning Engineer | Feb 2020 - Sep 2023**

- Designed large-scale ML pipelines for Amazon Robotics.

---

**Skysoft Inc. | Software Engineer (ML) | Jun 2016 - Jan 2020**

- Developed computer vision systems achieving 94.5% accuracy at 30 FPS on embedded hardware.

## Certifications
AWS Certified Machine Learning - Specialty
`,
      profile,
    });

    expect(validation.mismatches.join(" ")).not.toMatch(/experience count must match/i);
    expect(
      splitExperienceIntoJobBlocks(
        parseResumeSections(
          `
## Work Experience
**Meta | Staff Machine Learning Engineer | Oct 2023 - Present**
- Built systems at 30 FPS on embedded hardware.
---
**Amazon | Senior Machine Learning Engineer | Feb 2020 - Sep 2023**
- Designed pipelines.
---
**Skysoft Inc. | Software Engineer (ML) | Jun 2016 - Jan 2020**
- Developed CV at 30 FPS.
`,
          profile.experience
        ).experience,
        profile.experience
      )
    ).toHaveLength(3);
  });

  test("parses plain-text pipe job headers without counting accomplishment at-phrases", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Machine Learning Engineer",
          timeline: "Oct 2023 - Present",
        },
        {
          companyName: "Amazon",
          title: "Senior Machine Learning Engineer",
          timeline: "Feb 2020 - Sep 2023",
        },
        {
          companyName: "Skysoft Inc.",
          title: "Software Engineer (ML)",
          timeline: "Jun 2016 - Jan 2020",
        },
      ],
      education: [],
    };

    const rawText = `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

EDUCATION
University of Central Florida | Bachelor's Degree in Computer Science | Aug 2012 - May 2016

WORK EXPERIENCE

Meta | Staff Machine Learning Engineer | Oct 2023 - Present

Architected map reconstruction achieving 99.2% lane boundary accuracy at 30 FPS on embedded hardware.

Designed pipelines with 92% average utilization at peak processing windows.

Amazon | Senior Machine Learning Engineer | Feb 2020 - Sep 2023

Designed large-scale ML pipelines achieving 96.3% accuracy at 5cm error tolerance.

Skysoft Inc. | Software Engineer (ML) | Jun 2016 - Jan 2020

Developed computer vision systems achieving 94.5% accuracy at 30 FPS on embedded hardware.

Achieving 2cm accuracy at 5-meter range for warehouse inventory mapping.

CERTIFICATIONS
AWS Certified Machine Learning - Specialty
`;

    const validation = validatePastedResumeAgainstProfile({ rawText, profile });

    expect(validation.mismatches.join(" ")).not.toMatch(/experience count must match/i);
    expect(
      splitExperienceIntoJobBlocks(
        parseResumeSections(rawText, profile.experience, []).experience,
        profile.experience
      )
    ).toHaveLength(3);
  });

  test("validatePastedResumeAgainstProfile allows different company or duration when titles match", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Software Engineer (AI/ML Systems)",
          timeline: "Nov 2024 - Present",
        },
      ],
      education: [],
      resume_template_has_certifications: false,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
WORK EXPERIENCE
Staff Software Engineer (AI/ML Systems)
Confluent | Nov 2024 - Present

Built GenAI systems.
`,
      profile,
      templateHasCertifications: false,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches).toHaveLength(0);
  });

  test("validatePastedResumeAgainstProfile fails when titles differ", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Software Engineer (AI/ML Systems)",
          timeline: "Nov 2024 - Present",
        },
      ],
      education: [],
      resume_template_has_certifications: false,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
WORK EXPERIENCE
Senior Software Engineer
Meta | Nov 2024 - Present

Built GenAI systems.
`,
      profile,
      templateHasCertifications: false,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.mismatches.join(" ")).toMatch(/title must match profile exactly/i);
  });

  test("allows pasted resume without education when profile has education", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Engineer",
          timeline: "Oct 2023 - Present",
        },
      ],
      education: [
        {
          school: "Stanford University",
          degree: "Bachelor of Science in Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
      ],
      resume_template_has_certifications: false,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built systems.
`,
      profile,
      templateHasCertifications: false,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches).toHaveLength(0);
  });

  test("ignores education mismatches in pasted resume", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Engineer",
          timeline: "Oct 2023 - Present",
        },
      ],
      education: [
        {
          school: "Stanford University",
          degree: "Bachelor of Science in Computer Science",
          timeline: "Jan 2010 - Dec 2014",
        },
      ],
      resume_template_has_certifications: false,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

EDUCATION
MIT | Bachelor of Science in Computer Science | Jan 2010 - Dec 2014

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built systems.
`,
      profile,
      templateHasCertifications: false,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.mismatches).toHaveLength(0);
  });

  test("does not require certifications section when template has none", () => {
    const parsed = parseResumeSections(
      `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built systems.
`,
      [{ companyName: "Meta" }]
    );

    expect(parsed.foundSections).not.toContain("certifications");
    expect(parsed.warnings.join(" ")).not.toMatch(/certifications section/i);
    expect(hasPastedCertificationsSection(parsed)).toBe(false);
    expect(hasPastedEducationSection(parsed)).toBe(false);
  });

  test("requires certifications when template includes certifications section", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Engineer",
          timeline: "Oct 2023 - Present",
        },
      ],
      education: [],
      resume_template_has_certifications: true,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built systems.
`,
      profile,
      templateHasCertifications: true,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.mismatches.join(" ")).toMatch(/certifications section is required/i);
  });

  test("allows missing certifications when template has no certifications section", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Engineer",
          timeline: "Oct 2023 - Present",
        },
      ],
      education: [],
      resume_template_has_certifications: false,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built systems.
`,
      profile,
      templateHasCertifications: false,
    });

    expect(validation.isValid).toBe(true);
  });

  test("allows save when template and paste both include certifications", () => {
    const profile = {
      experience: [
        {
          companyName: "Meta",
          title: "Staff Engineer",
          timeline: "Oct 2023 - Present",
        },
      ],
      education: [],
      resume_template_has_certifications: true,
    };

    const validation = validatePastedResumeAgainstProfile({
      rawText: `
PROFESSIONAL SUMMARY
Staff AI engineer.

SKILLS
Python

WORK EXPERIENCE
Meta | Staff Engineer | Oct 2023 - Present

Built systems.

CERTIFICATIONS
AWS Certified Machine Learning - Specialty
`,
      profile,
      templateHasCertifications: true,
    });

    expect(validation.isValid).toBe(true);
  });
});
