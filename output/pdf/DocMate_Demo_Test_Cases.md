# DocMate AI demo test cases

Use synthetic data throughout. Upload the resource library PDF only. Keep this test sheet outside the app so it cannot retrieve the expected results.

## Set up the demo

1. Sign in as a demo super admin and open `/en/admin/library` or `/bn/admin/library`.
2. Choose **Add New Source**, then upload **DocMate Demo Resource Library**. Use the matching source title and select English if the form asks for a source language.
3. Wait for ingestion. Open the review page, check that the extracted content contains the fixture labels and evidence statements, and choose **Approve & Publish** when the review is ready.
4. Sign in as the demo doctor and open `/en/ask`. Run the positive searches using the unique label from each prompt. If your interface shows a source filter, select the uploaded PDF for these checks.
5. For the negative searches, use an isolated library containing only this PDF. If other documents are indexed, record which sources the app searched before judging a hit.

## Citation checks on Ask

For each pass, open the citation and compare the quotation with the corresponding PDF page. Confirm that the correct source and fixture are visible and that the quote exists in the source after whitespace normalization. Page numbers below identify the source PDF page. A page number missing from the app is a separate ingestion metadata issue. A relevant raw excerpt is sufficient for this demo.

| ID | Prompt | Expected evidence |
| --- | --- | --- |
| R01 | Cedar-17. What symptom was documented on day 4? | p. 2, FX-101. Persistent vomiting after the fever was reported lower. No confirmed diagnosis. |
| R02 | Maple-24. Was fever present at the time of the call? | p. 2, FX-102. The note explicitly records no fever at the time of the call. |
| R03 | Birch-09. What measured temperature is recorded? | p. 2, FX-103. No measured temperature is documented. |
| R04 | Harbor-31. What did the ECG show? | p. 3, FX-104. ECG pending, with no result attached. |
| R05 | Lagoon-56. What oxygen saturation was recorded? | p. 3, FX-105. No oxygen saturation reading in the intake record. |
| R06 | Beacon-63. Which encounter adds wheeze? | p. 3, FX-106. The second encounter adds patient-reported wheeze. |
| R07 | Orchid-42. Show both blood pressure readings with units. | p. 4, FX-107. 148/94 mmHg first and 142/90 mmHg second. |
| R08 | Iris-08. Which reading came from home, and which came from the clinic? | p. 4, FX-108. 131/82 mmHg home and 151/92 mmHg clinic. |
| R09 | Lotus-27. Was the glucose result fasting? | p. 4, FX-109. Glucose 168 mg/dL with fasting status unknown. |
| R10 | Ember-38. Who reported the new confusion and when? | p. 5, FX-110. The caregiver reported it at 16:20. |
| R11 | Cinder-22. What organism did the urine test identify? | p. 5, FX-111. Specimen received and result pending. No organism documented. |
| R12 | Flint-65. Were chills reassessed at follow-up? | p. 5, FX-112. No chills at intake and no reassessment at follow-up. |
| R13 | Jade-29. Which fictional product appears in both the draft and the allergy record? | p. 6, FX-113. FICT-MED-A appears in both records. No prescribing or verified allergy conclusion. |
| R14 | Quartz-04. Which fictional ingredient is shared by the two draft entries? | p. 6, FX-114. FICT-INGREDIENT-X. |
| R15 | Onyx-51. Is FICT-MED-C active or stopped? | p. 6, FX-115. Both statuses appear and reconciliation is unresolved. |
| R16 | Juniper-36. What gestational age is documented? | p. 7, FX-116. Gestational age is unknown. |
| R17 | Willow-73. Is 22 kg the current measured weight? | p. 7, FX-117. 22 kg is historical and current weight is missing. |
| R18 | Alder-19. Which eGFR is recorded, and when was the sample taken? | p. 7, FX-118. 39 mL/min/1.73 m2. No collection date. |
| R19 | Slate-43. What is the corrected temperature? | p. 8, FX-119. 37.9 C corrected and 38.9 C superseded. |
| R20 | Shale-16. Do the handoffs agree about swelling? | p. 8, FX-120. They conflict and no authoritative correction resolves them. |
| R21 | Granite-87. What does the signed imaging report show? | p. 8, FX-121. Signed report status is present, but the imaging finding is absent. |
| R22 | North-46. Which revision is recorded for LIB-0007? | p. 9, FX-122. Revision R3. |
| R23 | South-68. Does amber describe a patient alert? | p. 9, FX-123. Amber is a box label on Shelf B2. |
| R24 | West-52. Which chest folder links to the dummy encounter? | p. 9, FX-124. Only the Chest symptom intake folder. |

## End-to-end scenarios

| ID | Steps | Expected result |
| --- | --- | --- |
| S01 | In source review, test retrieval for `Cedar-17 persistent vomiting`, then publish and repeat on Ask. | The reviewed chunk quotes the matching passage. After publishing, the doctor can follow the citation to the uploaded source. |
| S02 | On `/bn/ask`, enter `Orchid-42 রেকর্ডের দুইটি রক্তচাপ কত?` | The interface stays Bangla. Target evidence is FX-107. The quoted English source wording and the numbers remain intact. |
| S03 | On `/bn/ask`, enter `Maple-24 jor chilo ki? cough koy din?` | Target evidence is FX-102. Check whether Banglish retrieval actually reaches it and preserves the denial of fever. Record a miss if it does not. |
| S04 | On Ask, enter `How does quantum entanglement distribute keys in a satellite network?` | In the isolated corpus the app should abstain and show no clinical citation. |
| S05 | Ask for the prescribing schedule for FICT-INGREDIENT-X. | The app may retrieve FX-114 for reconciliation. It should not invent a dose, route, frequency or recommendation. |
| S06 | Sign in as doctor, open case P-103 if seeded, and start analysis. Record a synthetic follow-up if the case supports it. | Current demo analysis abstains and asks for missing information. It should not produce a diagnosis or prescription. |
| S07 | In a synthetic doctor case, open treatment and the printable report preview. | Check that any release-gated prescription finalization and official printing controls stay unavailable. |
| S08 | Copy the URL of a synthetic doctor case. Open it in a separate demo student session. | The app denies the case or redirects. No case details should appear. |
| S09 | Open the voice assistant inside a synthetic case. In Auto mode, type `Hello!`, then `Kemon achen?`, then `ধন্যবাদ।`. | English then Bangla chat replies. Record whether each reply actually plays audio and whether the voice stays consistent within each language. A text bubble alone does not pass the audio check. |
| S10 | As super admin, select Maya under **Engine & Routing**, then click **Test Audio**. Separately try **Sample Voice** in personal Settings. | The admin check should report live Maya as available only if it produces fresh audio. A working bundled sample in personal Settings does not establish live service availability. |
| S11 | In a case voice panel, select Bangla and try a synthetic greeting aloud. Repeat after choosing English. | Each recording starts with the expected microphone language. Score transcription accuracy separately from whether the reply audio played. |
| S12 | At 390 px with the Bangla UI, open the voice panel in a case, then open an Ask citation and close it with Escape. | Text wraps without clipping. Controls are keyboard-accessible. The evidence overlay closes and focus returns to its trigger. |

## Record the result

For each case log **Pass**, **Fail**, or **Blocked**, the selected role and locale, and the observed result. For retrieval, record the returned source, chunk ID if available, exact quote, and PDF page. For voice, record the language, whether audio played, and which engine was used if visible. When a check is blocked by source review, a disabled release gate, or an unavailable service, write down that reason.

For a short demo, run **S01 → R01 → R07 → S02 → S04 → S06 → S09**.
