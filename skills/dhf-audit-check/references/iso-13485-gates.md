# ISO 13485 / FDA 21 CFR 820.30 Design History File (DHF) Gate Rubric

MedTrace IQ calculates a deterministic **Ship-Confidence Score (0–100)** from 5 equally critical regulatory pillars:

1. **Design Control Completeness (25 pts):** Clear specification description, risk classification, and subsystem identification.
2. **Verification & Validation Evidence (25 pts):** Linked test/verification checklist confirmation and Teamwork Graph development artifacts (PRs/deployments/comments).
3. **SOP & Organizational Context (20 pts):** Verified SOP/Confluence documentation link and Teamwork Graph team/owner coverage.
4. **Live FDA Recall Clearance (20 pts):** Live openFDA enforcement check with zero unmitigated Class I or Class II recall parallels (an unmitigated Class I parallel forces a hard cap and Regulatory Hold).
5. **Formal QA Regulatory Sign-Off (10 pts):** Immutable sign-off decision recorded in the MedTrace Audit Ledger (`Approved` grants full points; `Hold` overrides to blocked).
