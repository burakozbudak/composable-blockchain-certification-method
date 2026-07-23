"""Template-based cover-letter drafts, one per matched job.

This deliberately stops at "drafted, ready for a human to review and send" -
it does not submit anything. See README for why full auto-submission is out
of scope (most job boards' ToS prohibit automated applications, and a
templated cover letter still needs a human sanity check before it goes out
under someone's name).
"""

from __future__ import annotations

from .profile import Resume

TRACK_PARAGRAPHS = {
    "process_chemical_engineering": (
        "In my most recent roles at Roketsan Missiles, Eti Soda/We Soda and "
        "Cimsa Afyon Cement, I led process design and energy-production "
        "engineering work end-to-end - from characterization tests and "
        "equipment design through production-efficiency and root-cause "
        "analysis - using Agile methods to run multi-disciplinary RD&I teams."
    ),
    "software_frontend": (
        "Alongside my process-engineering background, I am completing a "
        "Master's in Software Engineering and have hands-on experience "
        "building frontend applications with React, Redux, TanStack Query "
        "and Tailwind CSS, tested with Cypress."
    ),
    "software_general": (
        "I bring a Master's-level software engineering foundation "
        "(Python, Java/OOP) combined with real-world project delivery "
        "experience from leading technical teams in industrial settings."
    ),
    "blockchain": (
        "My Master's thesis, a composable blockchain certification "
        "framework in Solidity, gave me direct experience designing smart "
        "contracts, predicate engines and on-chain dispute/settlement "
        "logic - which I'd bring to your smart-contract/Web3 work."
    ),
    "project_management": (
        "As a Lean Six Sigma Green Belt and Kaizen Practitioner, I have run "
        "Agile/Scrum project cycles across RD&I and production-improvement "
        "initiatives, managing scope, schedule (MS Project/WBS) and "
        "cross-functional stakeholders."
    ),
}


def draft_cover_letter(job: dict, top_track: str, resume: Resume | None = None) -> str:
    resume = resume or Resume()
    track_paragraph = TRACK_PARAGRAPHS.get(
        top_track, TRACK_PARAGRAPHS["process_chemical_engineering"]
    )
    company = job.get("company") or "your team"
    title = job.get("title") or "this role"

    return f"""Dear Hiring Manager at {company},

I'm writing to apply for the {title} position. {resume.summary}

{track_paragraph}

I'd welcome the chance to discuss how my background could contribute to {company}. Thank you for your consideration.

Best regards,
{resume.name}
{resume.email} | {resume.linkedin} | {resume.github}
"""
