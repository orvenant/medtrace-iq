# FDA Device Enforcement Classifications (21 CFR Part 7 Reference)

| Class | Enforcement Tier Summary | MedTrace IQ Release Gate Rule |
| :--- | :--- | :--- |
| **Class I** | Highest priority FDA enforcement classification requiring urgent quality engineering review. | Mandatory **Regulatory Hold** until formal ISO 14971 risk documentation and CAPA verification are logged by QA. |
| **Class II** | Moderate priority FDA enforcement classification indicating potential reversible product performance issues. | **Conditional Review**: Verify design controls, update FMEA/SOP documentation, and obtain QA sign-off before release. |
| **Class III** | Low priority FDA enforcement classification (typically minor labeling, documentation, or packaging variance). | **Monitor & Log**: Record applicability rationale in the Design History File (DHF). |

## Key Signal Fields from openFDA
- `recall_number`: Official FDA enforcement identifier (e.g. `Z-0123-2026`).
- `classification`: `Class I`, `Class II`, or `Class III`.
- `status`: `Ongoing`, `Completed`, or `Terminated`.
- `reason_for_recall`: Reported technical failure mode to compare against the Jira issue's engineering verification plan.
