"""Burak Ozbudak's resume, structured for matching.

Kept as a plain Python module (not a PDF parser) because the source resume
is a two-page PDF that changes rarely; when it does change, edit this file
and `resume_profile.json` stays a generated mirror of it (see
`export_json()` below).
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict


@dataclass
class Resume:
    name: str = "Burak Ozbudak"
    email: str = "burakozbudak1@gmail.com"
    location: str = "Ankara, Turkey"
    headline: str = "Chemical Engineer & Software Engineer"
    linkedin: str = "linkedin.com/in/burakozbudak"
    github: str = "https://github.com/burakozbudak"

    summary: str = (
        "Solution-oriented Chemical Engineer with a strong background in "
        "industrial process design, energy production, and production "
        "efficiency, currently pursuing a Master's in Software Engineering "
        "to bridge physical operations and digital system optimization. "
        "Experience leading multi-disciplinary teams and managing the "
        "full lifecycle of technical projects with Agile methodologies."
    )

    experience: list = field(default_factory=lambda: [
        {
            "company": "Roketsan Missiles Inc.",
            "title": "Process Design Engineer",
            "location": "Ankara, Turkey",
            "start": "2023-08", "end": "2024-02",
            "highlights": [
                "Lead process design engineer for polymer-bonded explosives (PBX) projects",
                "Designed specialized equipment/apparatus to optimize production efficiency and quality",
                "Implemented Agile methodologies in multi-disciplinary RD&I teams",
            ],
        },
        {
            "company": "Eti Soda / We Soda",
            "title": "Energy Production Engineer",
            "location": "Ankara, Turkey",
            "start": "2022-09", "end": "2023-08",
            "highlights": [
                "Managed energy production units: turbines, boilers, auxiliary facilities",
                "Authored production evaluation reports and KPI plans",
                "Supervised fault elimination and maintenance projects",
            ],
        },
        {
            "company": "Cimsa Afyon Cement",
            "title": "Process Development Engineer",
            "location": "Afyon, Turkey",
            "start": "2022-05", "end": "2022-09",
            "highlights": [
                "Monitored CCR variables, root-cause analysis for cement production",
                "Production planning projections and energy/fuel data reports",
                "Coordinated maintenance schedules to minimize energy costs",
            ],
        },
    ])

    education: list = field(default_factory=lambda: [
        {
            "school": "Hacettepe University",
            "degree": "M.Sc. Software Engineering",
            "status": "Ongoing (started Feb 2025), GPA 3.57/4.00, Honor Student",
            "projects": [
                "Composable Blockchain Certification System (Solidity, Smart Contracts, CBAM)",
                "ABSA Oil Supply Chain Optimization (Python, Mathematical Optimization, CPLEX)",
                "Promptum - Integrated Process Modeling & Management (SPMP, WBS, Project Planning)",
            ],
        },
        {
            "school": "Hacettepe University",
            "degree": "B.Sc. Chemical Engineering",
            "status": "2016-2021, GPA 3.10/4.00, Honor Student",
            "projects": [
                "2nd Place, 2021 Project Design Competition",
                "3rd Place, Innovative Entrepreneurs Award",
            ],
        },
    ])

    tools: list = field(default_factory=lambda: [
        "MATLAB", "Simulink", "ChemCAD", "MS Project", "SAP", "Microsoft Office",
    ])
    software_skills: list = field(default_factory=lambda: [
        "JavaScript", "HTML", "CSS", "React", "Tailwind CSS", "Redux",
        "TanStack Query", "Cypress", "Python", "Java", "Solidity", "Smart Contracts",
    ])
    management_skills: list = field(default_factory=lambda: [
        "Lean Six Sigma Green Belt", "Kaizen Practitioner", "Agile", "Scrum",
    ])
    languages: list = field(default_factory=lambda: ["English (B2-C1)", "Turkish (native)"])

    def export_json(self) -> dict:
        return asdict(self)


# --- Matching taxonomy -----------------------------------------------------
# Each track maps to keywords pulled straight from the resume. `weight` is a
# relative importance multiplier used when a job's text hits multiple tracks
# (his profile genuinely spans all four, so no single track is authoritative).

SKILL_TRACKS = {
    "software_frontend": {
        "weight": 1.0,
        "keywords": [
            "javascript", "typescript", "react", "react.js", "reactjs", "redux",
            "tailwind", "html", "css", "frontend", "front-end", "front end",
            "tanstack", "react query", "cypress", "web developer", "ui developer",
            "spa", "single page application",
        ],
    },
    "software_general": {
        "weight": 0.9,
        "keywords": [
            "python", "java ", "java,", "java)", "oop", "object-oriented",
            "software engineer", "software developer", "backend", "back-end",
            "full stack", "fullstack", "rest api", "node.js", "nodejs",
        ],
    },
    "blockchain": {
        "weight": 1.1,
        "keywords": [
            "blockchain", "solidity", "smart contract", "web3", "ethereum",
            "hardhat", "evm", "defi", "dapp", "crypto",
        ],
    },
    "process_chemical_engineering": {
        "weight": 1.0,
        "keywords": [
            "process engineer", "process design", "chemical engineer",
            "chemical engineering", "energy production", "production efficiency",
            "matlab", "simulink", "chemcad", "process development",
            "plant operations", "manufacturing engineer", "cement",
            "explosives", "propellant", "polymer", "root cause analysis",
            "rd&i", "r&d engineer", "process optimization", "energy engineer",
            "turbine", "boiler", "petrochemical", "refinery", "oil and gas",
            "supply chain optimization",
        ],
    },
    "project_management": {
        "weight": 0.7,
        "keywords": [
            "agile", "scrum", "lean six sigma", "kaizen", "project management",
            "ms project", "wbs", "project manager", "product owner",
        ],
    },
}

# Location tokens used to classify a job posting's location string.
TURKEY_TOKENS = [
    "turkey", "türkiye", "turkiye", "ankara", "istanbul", "izmir", "bursa",
    "kocaeli", "afyon", "antalya", "kayseri", "gebze", "adana",
]
REMOTE_TOKENS = [
    "remote", "worldwide", "anywhere", "distributed", "work from home",
    "wfh", "global",
]
# If these show up we flag (not exclude) since eligibility may be restricted.
RESTRICTIVE_TOKENS = [
    "us citizens only", "must be authorized to work in the us",
    "no visa sponsorship", "eu citizens only", "must reside in the eu",
    "security clearance required",
]
