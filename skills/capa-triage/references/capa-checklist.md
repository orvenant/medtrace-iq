# FDA 21 CFR 820.100 & ISO 13485 CAPA Triage Checklist

## Severity Classification (ISO 14971 QMS Aligned)
- **Critical:** Highest-tier safety control gap, unreviewed Class I FDA enforcement parallel, or missing safety-critical firmware verification protocol. Requires immediate Release Hold.
- **High:** High-priority quality defect, Class II FDA enforcement parallel, missing Design Verification & Validation (V&V), or unverified change impacting an active SOP.
- **Medium:** Documentation drift, unconfirmed SOP owner, minor traceability link omission, or Class III enforcement parallel.
- **Low:** Administrative QMS improvement or preventive engineering workflow enhancement.

## Mandatory Audit Content for Every CAPA
1. **Nonconformance / Trigger Signal** (Jira key, FDA enforcement number, or internal audit finding)
2. **Immediate Containment Action** (Release hold, lot quarantine, or feature flag gate)
3. **Root Cause Investigation** (5-Whys / Fault Tree engineering analysis scope)
4. **Corrective & Preventive Plan** (Design/SOP update + verification protocol)
5. **Verification of Effectiveness (VoE)** acceptance criteria before CAPA closure
