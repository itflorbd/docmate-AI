# RAG accuracy benchmark

Generated 2026-11-24T01:37:28.242Z by `pnpm run eval:rag`. Model: gpt-4o-mini. 45 questions with a known answer section in the published library (eval/rag/gold.jsonl).

| Metric | Result |
| :--- | :--- |
| Gold chunk ranked first | 73.3% (33/45) |
| Gold chunk in top 3 | 82.2% (37/45) |
| Gold chunk in the 6 excerpts sent to the model | 100.0% (45/45) |
| Mean reciprocal rank | 0.809 |
| Answered (not abstained) | 97.8% (44/45) |
| Cited the gold section | 100.0% (45/45) |
| Required facts stated in the answer | 100.0% (76/76) |
| Fully correct (answered, gold cited, all facts) | 97.8% (44/45) |

| Language | Questions | Gold in top 3 | Fully correct |
| :--- | :---: | :---: | :---: |
| en | 36 | 86.1% (31/36) | 100.0% (36/36) |
| bn | 5 | 60.0% (3/5) | 80.0% (4/5) |
| banglish | 4 | 75.0% (3/4) | 100.0% (4/4) |

## Per question

| ID | Lang | Question | Gold rank | Status | Cited gold | Facts |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| d1 | en | What are the three clinical phases of dengue? | 1 | answered | yes | 3/3 |
| d2 | en | When does the critical phase of dengue usually occur? | 1 | answered | yes | 2/2 |
| d3 | en | What lab findings often come before the platelet drop in dengue? | 1 | answered | yes | 2/2 |
| d4 | en | What are the warning signs of severe dengue? | 4 | answered | yes | 3/3 |
| d5 | en | What should I do if a dengue patient develops a warning sign? | 4 | answered | yes | 2/2 |
| d6 | en | Can I give ibuprofen for fever in suspected dengue? | 1 | answered | yes | 2/2 |
| d7 | en | What is the maximum daily paracetamol dose in dengue? | 1 | answered | yes | 1/1 |
| d8 | en | Are intramuscular injections safe in dengue? | 1 | answered | yes | 2/2 |
| d9 | en | How much oral fluid should an adult dengue outpatient take per day? | 4 | answered | yes | 2/2 |
| d10 | en | What IV fluid rate is recommended for dengue with warning signs but no shock? | 6 | answered | yes | 2/2 |
| d11 | bn | ডেঙ্গু জ্বরের সতর্কতা চিহ্নগুলো (warning signs) কী কী? | 4 | answered | yes | 2/2 |
| d12 | bn | ডেঙ্গুতে জ্বরের জন্য কোন ওষুধ দেওয়া নিরাপদ? | 4 | answered | yes | 1/1 |
| d13 | banglish | dengue rogike ki ibuprofen deya jabe? | 1 | answered | yes | 1/1 |
| p1 | en | What are the classic symptoms of community-acquired pneumonia? | 1 | answered | yes | 3/3 |
| p2 | en | What examination findings suggest pneumonia? | 1 | answered | yes | 2/2 |
| p3 | en | How do elderly patients with pneumonia present atypically? | 1 | answered | yes | 2/2 |
| p4 | en | What is the CRB-65 score made of? | 1 | answered | yes | 3/3 |
| p5 | en | What does a CRB-65 score of 3 mean? | 1 | answered | yes | 2/2 |
| p6 | en | What is the first-line antibiotic for mild community-acquired pneumonia in a healthy adult? | 1 | answered | yes | 1/1 |
| p7 | en | When should azithromycin be used for pneumonia? | 1 | answered | yes | 1/1 |
| p8 | en | What can I give for pneumonia if the patient has a mild penicillin allergy? | 1 | answered | yes | 1/1 |
| p9 | en | Which antibiotic for pneumonia with penicillin anaphylaxis? | 1 | answered | yes | 1/1 |
| p10 | en | What should I do if pneumonia does not improve after 72 hours of antibiotics? | 2 | answered | yes | 2/2 |
| p11 | bn | নিউমোনিয়ার রোগী কখন জরুরি চিকিৎসা নেবেন? | 1 | answered | yes | 1/1 |
| p12 | banglish | pneumonia rogir severity kivabe bujhbo? | 1 | answered | yes | 1/1 |
| c1 | en | Which chest pain features should trigger a red-flag alert? | 1 | answered | yes | 2/2 |
| c2 | en | How quickly should an ECG be done for acute chest pain? | 1 | answered | yes | 1/1 |
| c3 | en | How is STEMI diagnosed on ECG? | 4 | answered | yes | 2/2 |
| c4 | en | What is the reperfusion time target for STEMI? | 1 | answered | yes | 2/2 |
| c5 | en | How is NSTEMI defined? | 1 | answered | yes | 1/1 |
| c6 | en | What aspirin dose is given in suspected acute coronary syndrome? | 1 | answered | yes | 1/1 |
| c7 | en | When are nitrates contraindicated in chest pain? | 3 | answered | yes | 2/2 |
| c8 | en | How do I tell pericarditis from other chest pain? | 1 | answered | yes | 2/2 |
| c9 | en | What features suggest costochondritis? | 1 | answered | yes | 1/1 |
| c10 | bn | বুকে ব্যথার রোগীর ইসিজি (ECG) কত দ্রুত করা উচিত? | 1 | answered | yes | 1/1 |
| c11 | banglish | STEMI hole ki korbo? | 1 | answered | yes | 1/1 |
| h1 | en | How is hypertension defined in adults? | 1 | answered | yes | 2/2 |
| h2 | en | What is the difference between hypertensive urgency and emergency? | 1 | answered | yes | 2/2 |
| h3 | en | What are the first-line drug classes for hypertension? | 3 | answered | yes | 4/4 |
| h4 | en | When is combination therapy recommended at the start for hypertension? | 3 | answered | yes | 1/1 |
| h5 | en | Can ACE inhibitors be used in pregnancy? | 1 | answered | yes | 1/1 |
| h6 | en | Which beta-blocker is dangerous in asthma? | 1 | answered | yes | 1/1 |
| h7 | en | What is the risk of spironolactone in CKD? | 1 | answered | yes | 1/1 |
| h8 | bn | উচ্চ রক্তচাপের (Hypertension) সংজ্ঞা কী? | 1 | excerpts | yes | 2/2 |
| h9 | banglish | pregnant rogir BP te ki ACE inhibitor deya jabe? | 4 | answered | yes | 1/1 |
