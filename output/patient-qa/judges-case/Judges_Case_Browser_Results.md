# P-901 judges’ case · Browser verification

**24 November 2026 · Full diagnostic answer failed**

I used Playwright Chromium against an isolated copy of the current DocMate working tree on port 3123. The scratch database held synthetic records. I published the judges’ reference PDF using the repository ingestion CLI, seeded the case through the normal doctor API, and typed the two questions from the [demo script](../../pdf/DocMate_Judges_Demo_Case.md) into Case Conversation. The recorded model for both chat replies was `gpt-4o-mini`. The test copy substituted local fonts after Google Fonts requests timed out. Product code and the main database were unchanged.

| Check | Observed in the app | Result |
| --- | --- | --- |
| P-901 symptoms only | The Bangla reply said the symptoms could be related to diabetes and asked for laboratory results. It identified HbA1c and fasting plasma glucose as missing. | Pass for cautious handling. The UI labels the missing patient results as “not in the library.” |
| P-901 after labs in the same conversation | The doctor entered HbA1c 7.4%, fasting plasma glucose 154 mg/dL, and repeat fasting plasma glucose 151 mg/dL. The assistant replied that the library did not contain the answer and asked a generic examination question. Its stream logged five retrieved excerpts, two dropped claims and zero verified claims. | Fail against the answer key. The event stream does not identify which validation rule rejected each claim. |
| Structured analysis with labs | I saved the same three results in the structured fields of companion case P-902. The live Analyze request returned HTTP 200, `insufficient_evidence`, zero differentials and one generic examination question. Chromium displayed the insufficient-evidence badge. | Fail for automated diagnosis. |
| Ask Library | The first result was page 1 of the new PDF. It included both thresholds and the confirmation criterion. Three additional excerpts came from the earlier demo library. Ask displayed an excerpt list. | Pass for locating the reference. |

I checked the symptom citation and first Ask citation against page 1 using the app’s PDF extractor and normalized whitespace. Both quotes matched. The symptom citation itself describes symptom associations. Its exact quote does not include the separate repeat-testing statement to which the chat attached the same citation.

The expected diagnosis for this fixture is **diabetes mellitus**, with an explicit limit on identifying the subtype. Neither live diagnostic path reached it. The tested build can show the relevant reference and support a clinician-led walkthrough. The software failed the automated diagnosis acceptance criterion for this case. One fixture does not measure general clinical accuracy.

## Evidence

- [Symptoms-only answer](chat/01-symptoms-only.png)
- [Chat response after all laboratory results](chat/02-labs-in-conversation.png)
- [Structured analysis with recorded results](verified/03-structural-analysis.png)
- [Ask Library figure and citation](verified/04-library-ask.png)
- [Chat results](chat/results.json) and [structured analysis and library results](verified/results.json)
