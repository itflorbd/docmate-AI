import { seedDemoUsers } from './demo-users';
import { seedAllFeatures } from './seed-all-features';
import { pool as authPool } from '../src/db';
import { requireAuthSecret } from '../src/lib/session';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export const DRUGS_SEED = [
  {
    generic_name: 'Amoxicillin',
    drug_class: 'Aminopenicillin Antibiotic',
    indications: ['Community-Acquired Pneumonia', 'Acute Otitis Media', 'Streptococcal Pharyngitis', 'Sinusitis'],
    dose_rules: {
      standard_adult: '500 mg to 1000 mg orally every 8 hours',
      route: 'oral',
      frequency: 'Every 8 hours (TDS)',
      duration_days: 7,
      max_daily_dose: '3000 mg',
      pediatric: '40 to 90 mg/kg/day in 2 to 3 divided doses',
      notes: 'Take with or without food. Complete the full course of therapy.',
    },
    contraindications: {
      conditions: ['Infectious mononucleosis (rash risk)'],
      allergies: ['Penicillin', 'Amoxicillin', 'Ampicillin', 'Beta-lactams'],
      age_min: 0,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'reduce_dose',
      adjusted_dose: '500 mg every 12 hours (if eGFR 10-30); 500 mg every 24 hours (if eGFR < 10)',
      note: 'Extend dosing interval in severe renal impairment.',
    },
  },
  {
    generic_name: 'Azithromycin',
    drug_class: 'Macrolide Antibiotic',
    indications: ['Atypical Pneumonia', 'Acute Bacterial Exacerbation of COPD', 'Chlamydia Trachomatis', 'Pertussis'],
    dose_rules: {
      standard_adult: '500 mg orally on Day 1, followed by 250 mg once daily on Days 2 to 5',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 5,
      max_daily_dose: '500 mg',
      pediatric: '10 mg/kg on Day 1, then 5 mg/kg daily',
      notes: 'Take at least 1 hour before or 2 hours after meals.',
    },
    contraindications: {
      conditions: ['Known prolonged QT interval', 'Hepatic dysfunction'],
      allergies: ['Azithromycin', 'Erythromycin', 'Clarithromycin', 'Macrolides'],
      age_min: 0.5,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 10,
      action: 'reduce_dose',
      adjusted_dose: 'Use caution in eGFR < 10 mL/min',
      note: 'Primarily eliminated via biliary route; no major dose adjustment for moderate renal impairment.',
    },
  },
  {
    generic_name: 'Cefuroxime',
    drug_class: 'Second-Generation Cephalosporin',
    indications: ['Pneumonia', 'Urinary Tract Infection', 'Lyme Disease', 'Acute Bronchitis'],
    dose_rules: {
      standard_adult: '500 mg orally twice daily',
      route: 'oral',
      frequency: 'Every 12 hours (BD)',
      duration_days: 7,
      max_daily_dose: '1000 mg',
      pediatric: '20 to 30 mg/kg/day divided BD',
      notes: 'Take with food to enhance absorption.',
    },
    contraindications: {
      conditions: [],
      allergies: ['Cefuroxime', 'Cephalosporins', 'Severe Immediate Penicillin Anaphylaxis'],
      age_min: 0.25,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 20,
      action: 'reduce_dose',
      adjusted_dose: '250 mg to 500 mg once every 24 hours',
      note: 'Renal excretion; extend dosing interval when eGFR < 20 mL/min.',
    },
  },
  {
    generic_name: 'Doxycycline',
    drug_class: 'Tetracycline Antibiotic',
    indications: ['Atypical Pneumonia', 'Scrub Typhus', 'Malaria Prophylaxis', 'Chlamydia', 'Acne Vulgaris'],
    dose_rules: {
      standard_adult: '100 mg orally twice daily on Day 1, then 100 mg once or twice daily',
      route: 'oral',
      frequency: 'Every 12 hours (BD)',
      duration_days: 7,
      max_daily_dose: '200 mg',
      pediatric: 'Avoid in children < 8 years (tooth staining)',
      notes: 'Take with full glass of water and stay upright for 30 minutes to prevent pill esophagitis.',
    },
    contraindications: {
      conditions: ['Children under 8 years', 'Severe hepatic failure'],
      allergies: ['Doxycycline', 'Tetracycline'],
      age_min: 8,
    },
    pregnancy_category: 'D',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No major reduction required; excreted by gastrointestinal tract',
      note: 'Safest tetracycline in renal failure.',
    },
  },
  {
    generic_name: 'Levofloxacin',
    drug_class: 'Respiratory Fluoroquinolone',
    indications: ['Severe Community-Acquired Pneumonia', 'Pyelonephritis', 'Complicated Sinusitis'],
    dose_rules: {
      standard_adult: '500 mg orally or IV once daily',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 7,
      max_daily_dose: '750 mg',
      pediatric: 'Contraindicated in pediatric patients due to arthropathy risk',
      notes: 'Hydrate well. Avoid co-administration with antacids containing magnesium or aluminum.',
    },
    contraindications: {
      conditions: ['Myasthenia gravis', 'History of tendon rupture', 'Prolonged QT'],
      allergies: ['Levofloxacin', 'Ciprofloxacin', 'Fluoroquinolones'],
      age_min: 18,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 50,
      action: 'reduce_dose',
      adjusted_dose: '500 mg initial, then 250 mg every 24h (eGFR 20-49); 250 mg every 48h (eGFR < 20)',
      note: 'Dose must be reduced in moderate to severe renal impairment.',
    },
  },
  {
    generic_name: 'Paracetamol',
    drug_class: 'Analgesic & Antipyretic',
    indications: ['Fever', 'Mild to Moderate Pain', 'Dengue Fever Headache', 'Osteoarthritis'],
    dose_rules: {
      standard_adult: '500 mg to 1000 mg orally every 4 to 6 hours as needed',
      route: 'oral',
      frequency: 'Every 6 hours PRN',
      duration_days: 5,
      max_daily_dose: '3000 mg in 24 hours (4000 mg absolute limit)',
      pediatric: '10 to 15 mg/kg every 4 to 6 hours (max 60 mg/kg/day)',
      notes: 'Sole safe antipyretic in suspected or confirmed dengue fever. Do not exceed max dose.',
    },
    contraindications: {
      conditions: ['Severe acute hepatic impairment', 'Acute liver failure'],
      allergies: ['Paracetamol', 'Acetaminophen'],
      age_min: 0,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 10,
      action: 'extend_interval',
      adjusted_dose: 'Extend dosing interval to every 6 to 8 hours',
      note: 'Safe in renal impairment; watch total volume and liver function.',
    },
  },
  {
    generic_name: 'Aspirin',
    drug_class: 'Antiplatelet & Salicylate',
    indications: ['Acute Coronary Syndrome', 'Myocardial Infarction', 'Secondary Prevention of Stroke'],
    dose_rules: {
      standard_adult: '300 mg chewed immediately (loading dose for ACS), then 75 mg to 100 mg once daily',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 30,
      max_daily_dose: '300 mg',
      pediatric: 'Strictly contraindicated in children under 16 (Reye syndrome risk)',
      notes: 'Chew and swallow loading dose without water for rapid antiplatelet action.',
    },
    contraindications: {
      conditions: ['Dengue fever', 'Active peptic ulcer disease', 'Hemophilia', 'Children < 16 years'],
      allergies: ['Aspirin', 'Salicylates', 'NSAID-induced asthma'],
      age_min: 16,
    },
    pregnancy_category: 'D',
    renal_adjustment: {
      egfr_threshold: 10,
      action: 'avoid',
      adjusted_dose: 'Avoid in severe renal impairment (eGFR < 10 mL/min)',
      note: 'Risk of fluid retention and deterioration of renal hemodynamics.',
    },
  },
  {
    generic_name: 'Clopidogrel',
    drug_class: 'P2Y12 Antiplatelet Agent',
    indications: ['Acute Coronary Syndrome', 'Percutaneous Coronary Intervention', 'Recent Ischemic Stroke'],
    dose_rules: {
      standard_adult: '300 mg to 600 mg loading dose, then 75 mg orally once daily',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 365,
      max_daily_dose: '75 mg (maintenance)',
      pediatric: 'Safety not established in pediatric population',
      notes: 'Used in dual antiplatelet therapy (DAPT) with Aspirin following ACS or stent placement.',
    },
    contraindications: {
      conditions: ['Active pathological bleeding (peptic ulcer or intracranial hemorrhage)'],
      allergies: ['Clopidogrel'],
      age_min: 18,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'Use caution in severe renal impairment',
      note: 'No formal dose reduction established; observe closely for hemorrhagic events.',
    },
  },
  {
    generic_name: 'Nitroglycerin',
    drug_class: 'Nitrate Vasodilator',
    indications: ['Acute Angina Pectoris', 'Acute Coronary Syndrome', 'Hypertensive Pulmonary Edema'],
    dose_rules: {
      standard_adult: '0.5 mg sublingually every 5 minutes up to 3 doses as needed for chest pain',
      route: 'sublingual',
      frequency: 'Every 5 min PRN (max 3 doses)',
      duration_days: 1,
      max_daily_dose: '1.5 mg in 15 minutes',
      pediatric: 'Not indicated for children',
      notes: 'Patient must sit down before administration to avoid orthostatic syncope. Monitor BP.',
    },
    contraindications: {
      conditions: ['Systolic BP < 90 mmHg', 'Right ventricular myocardial infarction', 'Severe aortic stenosis'],
      allergies: ['Nitroglycerin', 'Organic nitrates'],
      age_min: 18,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose reduction required',
      note: 'Rapid hepatic and vascular metabolism.',
    },
  },
  {
    generic_name: 'Amlodipine',
    drug_class: 'Dihydropyridine Calcium Channel Blocker',
    indications: ['Essential Hypertension', 'Chronic Stable Angina', 'Vasospastic Angina'],
    dose_rules: {
      standard_adult: '5 mg orally once daily, titrated to 10 mg once daily if needed',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 90,
      max_daily_dose: '10 mg',
      pediatric: '2.5 mg to 5 mg once daily (children ≥ 6 years)',
      notes: 'May cause peripheral ankle edema. Does not adversely affect cardiac conduction.',
    },
    contraindications: {
      conditions: ['Severe hypotension', 'Cardiogenic shock', 'High-grade aortic stenosis'],
      allergies: ['Amlodipine', 'Dihydropyridines'],
      age_min: 6,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose reduction necessary',
      note: 'Extensively metabolized by the liver; highly protein bound.',
    },
  },
  {
    generic_name: 'Enalapril',
    drug_class: 'Angiotensin-Converting Enzyme (ACE) Inhibitor',
    indications: ['Essential Hypertension', 'Heart Failure with Reduced Ejection Fraction', 'Diabetic Nephropathy'],
    dose_rules: {
      standard_adult: '5 mg to 20 mg orally once or twice daily',
      route: 'oral',
      frequency: 'Once or twice daily',
      duration_days: 90,
      max_daily_dose: '40 mg',
      pediatric: '0.08 mg/kg/day up to 5 mg daily',
      notes: 'Check serum potassium and creatinine within 1 to 2 weeks of initiation.',
    },
    contraindications: {
      conditions: ['Pregnancy (all trimesters)', 'Bilateral renal artery stenosis', 'History of ACEi angioedema'],
      allergies: ['Enalapril', 'Ramipril', 'Lisinopril', 'ACE inhibitors'],
      age_min: 1,
    },
    pregnancy_category: 'D',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'reduce_dose',
      adjusted_dose: 'Initial dose 2.5 mg once daily; titrate cautiously based on serum potassium',
      note: 'Significant risk of hyperkalemia and acute kidney injury if over-dosed.',
    },
  },
  {
    generic_name: 'Losartan',
    drug_class: 'Angiotensin Receptor Blocker (ARB)',
    indications: ['Hypertension', 'Diabetic Nephropathy', 'Stroke Reduction in Hypertensive LVH'],
    dose_rules: {
      standard_adult: '50 mg orally once daily, titrated to 100 mg once daily',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 90,
      max_daily_dose: '100 mg',
      pediatric: '0.7 mg/kg once daily up to 50 mg',
      notes: 'Preferred alternative to ACE inhibitors in patients who develop dry bradykinin cough.',
    },
    contraindications: {
      conditions: ['Pregnancy', 'Bilateral renal artery stenosis', 'Severe hepatic impairment'],
      allergies: ['Losartan', 'Angiotensin receptor blockers'],
      age_min: 6,
    },
    pregnancy_category: 'D',
    renal_adjustment: {
      egfr_threshold: 20,
      action: 'reduce_dose',
      adjusted_dose: 'Initial dose 25 mg once daily; monitor potassium closely',
      note: 'Risk of hyperkalemia in severe renal failure.',
    },
  },
  {
    generic_name: 'Hydrochlorothiazide',
    drug_class: 'Thiazide Diuretic',
    indications: ['Essential Hypertension', 'Edema due to Heart Failure or Hepatic Cirrhosis'],
    dose_rules: {
      standard_adult: '12.5 mg to 25 mg orally once daily in the morning',
      route: 'oral',
      frequency: 'Once daily in the morning (OD)',
      duration_days: 90,
      max_daily_dose: '50 mg',
      pediatric: '1 to 2 mg/kg/day in 1 to 2 divided doses',
      notes: 'Take in the morning to avoid nocturnal diuresis. Monitor electrolytes for hypokalemia.',
    },
    contraindications: {
      conditions: ['Anuria', 'Refractory hypokalemia', 'Severe hyponatremia', 'Gout (relative)'],
      allergies: ['Hydrochlorothiazide', 'Sulfonamides'],
      age_min: 0.5,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'avoid',
      adjusted_dose: 'Ineffective when eGFR < 30 mL/min; switch to loop diuretic (Furosemide)',
      note: 'Loses efficacy in moderate to severe chronic kidney disease.',
    },
  },
  {
    generic_name: 'Atorvastatin',
    drug_class: 'HMG-CoA Reductase Inhibitor (Statin)',
    indications: ['Hypercholesterolemia', 'Secondary Prevention in Atherosclerotic CVD', 'Post-ACS Triage'],
    dose_rules: {
      standard_adult: '20 mg to 80 mg orally once daily at bedtime',
      route: 'oral',
      frequency: 'Once daily at bedtime (OD)',
      duration_days: 90,
      max_daily_dose: '80 mg',
      pediatric: '10 mg once daily in familial hypercholesterolemia (≥ 10 years)',
      notes: 'High-intensity statin therapy (80 mg) recommended immediately following ACS.',
    },
    contraindications: {
      conditions: ['Active liver disease', 'Unexplained persistent transaminase elevations', 'Pregnancy'],
      allergies: ['Atorvastatin', 'Statins'],
      age_min: 10,
    },
    pregnancy_category: 'X',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose adjustment required for renal impairment',
      note: 'Minimal renal excretion.',
    },
  },
  {
    generic_name: 'Metoprolol',
    drug_class: 'Cardioselective Beta-1 Adrenergic Blocker',
    indications: ['Post-Myocardial Infarction', 'Stable Chronic Angina', 'Heart Failure with Reduced EF'],
    dose_rules: {
      standard_adult: '25 mg to 100 mg orally once or twice daily',
      route: 'oral',
      frequency: 'Once or twice daily',
      duration_days: 90,
      max_daily_dose: '200 mg',
      pediatric: 'Safety not established',
      notes: 'Take with or immediately after meals. Do not abruptly discontinue.',
    },
    contraindications: {
      conditions: ['Severe bradycardia (< 50 bpm)', 'Second or third-degree AV block', 'Cardiogenic shock', 'Decompensated acute heart failure'],
      allergies: ['Metoprolol', 'Beta-blockers'],
      age_min: 18,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose adjustment needed',
      note: 'Hepatic metabolism via CYP2D6.',
    },
  },
  {
    generic_name: 'Propranolol',
    drug_class: 'Non-Selective Beta-Adrenergic Blocker',
    indications: ['Migraine Prophylaxis', 'Thyrotoxicosis Symptom Control', 'Essential Tremor', 'Portal Hypertension'],
    dose_rules: {
      standard_adult: '40 mg orally two to three times daily',
      route: 'oral',
      frequency: 'Every 8 to 12 hours',
      duration_days: 30,
      max_daily_dose: '240 mg',
      pediatric: '1 mg/kg/day divided 2 to 3 times daily',
      notes: 'Blocks beta-2 receptors in airways and peripheral vessels.',
    },
    contraindications: {
      conditions: ['Bronchial asthma', 'Severe chronic obstructive pulmonary disease (COPD)', 'Sinus bradycardia'],
      allergies: ['Propranolol'],
      age_min: 1,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'Titrate slowly in severe renal dysfunction',
      note: 'Lipophilic agent metabolized extensively in the liver.',
    },
  },
  {
    generic_name: 'Spironolactone',
    drug_class: 'Aldosterone Antagonist & Potassium-Sparing Diuretic',
    indications: ['Heart Failure with Reduced EF', 'Primary Hyperaldosteronism', 'Resistant Hypertension', 'Ascites in Cirrhosis'],
    dose_rules: {
      standard_adult: '25 mg to 50 mg orally once daily',
      route: 'oral',
      frequency: 'Once daily (OD)',
      duration_days: 90,
      max_daily_dose: '100 mg',
      pediatric: '1 to 3 mg/kg/day in 1 to 2 divided doses',
      notes: 'Check serum potassium prior to starting and at 1 and 4 weeks.',
    },
    contraindications: {
      conditions: ['Serum potassium > 5.0 mEq/L', 'eGFR < 30 mL/min/1.73m²', 'Addison disease'],
      allergies: ['Spironolactone'],
      age_min: 1,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'avoid',
      adjusted_dose: 'Strictly avoid if eGFR < 30 mL/min due to fatal hyperkalemia risk',
      note: 'Contraindicated in severe renal impairment.',
    },
  },
  {
    generic_name: 'Omeprazole',
    drug_class: 'Proton Pump Inhibitor (PPI)',
    indications: ['Gastroesophageal Reflux Disease (GERD)', 'Peptic Ulcer Disease', 'Gastroprotection with NSAIDs'],
    dose_rules: {
      standard_adult: '20 mg to 40 mg orally once daily 30 minutes before breakfast',
      route: 'oral',
      frequency: 'Once daily before meals (OD)',
      duration_days: 14,
      max_daily_dose: '80 mg',
      pediatric: '1 mg/kg once daily',
      notes: 'Swallow whole with liquid. Do not chew or crush.',
    },
    contraindications: {
      conditions: [],
      allergies: ['Omeprazole', 'Esomeprazole', 'Proton pump inhibitors'],
      age_min: 1,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose adjustment required',
      note: 'Hepatically metabolized via CYP2C19.',
    },
  },
  {
    generic_name: 'Salbutamol',
    drug_class: 'Short-Acting Beta-2 Agonist (SABA)',
    indications: ['Acute Bronchospasm', 'Asthma Exacerbation', 'Exercise-Induced Bronchoconstriction'],
    dose_rules: {
      standard_adult: '100 to 200 mcg (1 to 2 puffs) via metered-dose inhaler every 4 to 6 hours as needed',
      route: 'inhalation',
      frequency: 'Every 4 to 6 hours PRN',
      duration_days: 7,
      max_daily_dose: '800 mcg (8 puffs) in 24 hours',
      pediatric: '100 mcg (1 puff) up to 4 times daily',
      notes: 'Use a spacer device for optimal pulmonary drug deposition.',
    },
    contraindications: {
      conditions: ['Severe tachyarrhythmias'],
      allergies: ['Salbutamol', 'Albuterol'],
      age_min: 0,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose adjustment required',
      note: 'Acts locally on bronchial smooth muscle.',
    },
  },
  {
    generic_name: 'Ibuprofen',
    drug_class: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    indications: ['Musculoskeletal Pain', 'Costochondritis', 'Osteoarthritis', 'Tension Headache'],
    dose_rules: {
      standard_adult: '400 mg orally every 6 to 8 hours with meals as needed',
      route: 'oral',
      frequency: 'Every 8 hours PRN',
      duration_days: 5,
      max_daily_dose: '1200 mg (OTC) to 2400 mg (prescribed)',
      pediatric: '5 to 10 mg/kg every 6 to 8 hours (children ≥ 6 months)',
      notes: 'Always take with food to minimize gastric irritation. Never use in suspected dengue.',
    },
    contraindications: {
      conditions: ['Dengue fever (critical risk of hemorrhage)', 'Active peptic ulcer', 'Heart failure NYHA III-IV', 'Third trimester pregnancy'],
      allergies: ['Ibuprofen', 'Aspirin', 'NSAIDs'],
      age_min: 0.5,
    },
    pregnancy_category: 'D',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'avoid',
      adjusted_dose: 'Avoid in eGFR < 30 mL/min; may cause acute tubular necrosis',
      note: 'Blunts renal prostaglandins leading to acute kidney injury.',
    },
  },
  {
    generic_name: 'Warfarin',
    drug_class: 'Vitamin K Antagonist Anticoagulant',
    indications: ['Atrial Fibrillation Stroke Prevention', 'Deep Vein Thrombosis', 'Mechanical Heart Valves'],
    dose_rules: {
      standard_adult: '2.5 mg to 5 mg orally once daily, titrated to target INR 2.0 to 3.0',
      route: 'oral',
      frequency: 'Once daily in evening (OD)',
      duration_days: 90,
      max_daily_dose: '10 mg',
      pediatric: 'Specialized pediatric titration only',
      notes: 'Take at the same time each evening. Monitor INR regularly.',
    },
    contraindications: {
      conditions: ['Active major bleeding', 'Severe thrombocytopenia (< 50,000)', 'Pregnancy (teratogenic)'],
      allergies: ['Warfarin'],
      age_min: 18,
    },
    pregnancy_category: 'X',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'Dose based strictly on INR; increased bleeding risk in uremia',
      note: 'Hepatically metabolized; protein binding altered in renal failure.',
    },
  },
  {
    generic_name: 'Sildenafil',
    drug_class: 'Phosphodiesterase Type 5 (PDE-5) Inhibitor',
    indications: ['Pulmonary Arterial Hypertension', 'Erectile Dysfunction'],
    dose_rules: {
      standard_adult: '20 mg orally three times daily (for PAH) or 50 mg as needed',
      route: 'oral',
      frequency: 'Every 8 hours (TDS) or PRN',
      duration_days: 30,
      max_daily_dose: '100 mg',
      pediatric: 'Safety not established',
      notes: 'Co-administration with nitrates causes catastrophic life-threatening hypotension.',
    },
    contraindications: {
      conditions: ['Concurrent nitrate therapy (fatal hypotension)', 'Recent stroke or myocardial infarction within 6 months'],
      allergies: ['Sildenafil', 'Tadalafil', 'PDE-5 inhibitors'],
      age_min: 18,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'reduce_dose',
      adjusted_dose: 'Start with 25 mg in severe renal impairment',
      note: 'Decreased clearance in eGFR < 30 mL/min.',
    },
  },
  {
    generic_name: 'Ciprofloxacin',
    drug_class: 'Fluoroquinolone Antibiotic',
    indications: ['Complicated Urinary Tract Infection', 'Infectious Diarrhea', 'Typhoid Fever'],
    dose_rules: {
      standard_adult: '500 mg orally twice daily',
      route: 'oral',
      frequency: 'Every 12 hours (BD)',
      duration_days: 7,
      max_daily_dose: '1000 mg',
      pediatric: 'Generally avoided in pediatric patients due to cartilage damage risk',
      notes: 'Take with plenty of fluids. Do not take with milk or antacids.',
    },
    contraindications: {
      conditions: ['Myasthenia gravis', 'History of quinolone-associated tendonitis'],
      allergies: ['Ciprofloxacin', 'Fluoroquinolones'],
      age_min: 18,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'reduce_dose',
      adjusted_dose: '250 mg to 500 mg once every 18 to 24 hours',
      note: 'Renal clearance decreased; dosage reduction required in kidney disease.',
    },
  },
  {
    generic_name: 'Metformin',
    drug_class: 'Biguanide Antidiabetic',
    indications: ['Type 2 Diabetes Mellitus', 'Polycystic Ovary Syndrome (PCOS)'],
    dose_rules: {
      standard_adult: '500 mg to 1000 mg orally twice daily with meals',
      route: 'oral',
      frequency: 'Twice daily with meals (BD)',
      duration_days: 90,
      max_daily_dose: '2000 mg',
      pediatric: '500 mg BD (children ≥ 10 years)',
      notes: 'Take with food to reduce GI upset. Must hold before contrast CT scans.',
    },
    contraindications: {
      conditions: ['eGFR < 30 mL/min/1.73m² (lactic acidosis risk)', 'Acute decompensated heart failure', 'Severe hepatic impairment'],
      allergies: ['Metformin'],
      age_min: 10,
    },
    pregnancy_category: 'B',
    renal_adjustment: {
      egfr_threshold: 30,
      action: 'avoid',
      adjusted_dose: 'Max 1000 mg/day if eGFR 30-44; strictly avoid if eGFR < 30 mL/min',
      note: 'High risk of fatal lactic acidosis in renal failure.',
    },
  },
  {
    generic_name: 'Prednisolone',
    drug_class: 'Systemic Corticosteroid',
    indications: ['Acute Asthma Exacerbation', 'COPD Exacerbation', 'Severe Allergic Reactions', 'Rheumatoid Arthritis'],
    dose_rules: {
      standard_adult: '30 mg to 40 mg orally once daily in the morning for 5 days',
      route: 'oral',
      frequency: 'Once daily in morning (OD)',
      duration_days: 5,
      max_daily_dose: '60 mg',
      pediatric: '1 to 2 mg/kg/day up to 40 mg',
      notes: 'Short courses (≤ 5 days) do not require tapering. Take with breakfast.',
    },
    contraindications: {
      conditions: ['Untreated systemic fungal infection', 'Active herpes simplex keratitis'],
      allergies: ['Prednisolone', 'Corticosteroids'],
      age_min: 0,
    },
    pregnancy_category: 'C',
    renal_adjustment: {
      egfr_threshold: 15,
      action: 'reduce_dose',
      adjusted_dose: 'No dose adjustment required',
      note: 'Hepatically metabolized.',
    },
  },
];

export const DRUG_INTERACTIONS_SEED = [
  {
    drug_a: 'Nitroglycerin',
    drug_b: 'Sildenafil',
    severity: 'critical' as const,
    note: 'Life-threatening catastrophic hypotension and cardiovascular collapse due to synergistic cyclic-GMP elevation.',
  },
  {
    drug_a: 'Aspirin',
    drug_b: 'Ibuprofen',
    severity: 'critical' as const,
    note: 'Severe gastrointestinal ulceration and hemorrhage risk; Ibuprofen competitively blocks irreversible Aspirin antiplatelet cardioprotection.',
  },
  {
    drug_a: 'Enalapril',
    drug_b: 'Spironolactone',
    severity: 'critical' as const,
    note: 'Severe hyperkalemia risk leading to cardiac arrhythmias and cardiac arrest, especially in impaired renal function.',
  },
  {
    drug_a: 'Losartan',
    drug_b: 'Spironolactone',
    severity: 'critical' as const,
    note: 'Severe synergistic hyperkalemia and renal hemodynamic deterioration.',
  },
  {
    drug_a: 'Warfarin',
    drug_b: 'Aspirin',
    severity: 'critical' as const,
    note: 'Substantially amplified risk of major and intracranial hemorrhage due to combined anticoagulant and antiplatelet mechanisms.',
  },
  {
    drug_a: 'Warfarin',
    drug_b: 'Ibuprofen',
    severity: 'critical' as const,
    note: 'Extreme risk of gastrointestinal bleeding; NSAIDs cause platelet dysfunction and gastric mucosal erosion.',
  },
  {
    drug_a: 'Warfarin',
    drug_b: 'Ciprofloxacin',
    severity: 'warning' as const,
    note: 'Ciprofloxacin inhibits CYP1A2 and alters gut flora, causing unpredictable, dramatic INR prolongation and bleeding.',
  },
  {
    drug_a: 'Clopidogrel',
    drug_b: 'Omeprazole',
    severity: 'warning' as const,
    note: 'Omeprazole inhibits CYP2C19, decreasing conversion of Clopidogrel to its active metabolite and reducing antiplatelet protection.',
  },
  {
    drug_a: 'Paracetamol',
    drug_b: 'Warfarin',
    severity: 'warning' as const,
    note: 'Prolonged high-dose Paracetamol (> 2g/day for > 3 days) may potentiate the hypoprothrombinemic effect of Warfarin.',
  },
  {
    drug_a: 'Amlodipine',
    drug_b: 'Clopidogrel',
    severity: 'info' as const,
    note: 'Minor CYP competition; generally safe to co-administer with routine cardiovascular clinical monitoring.',
  },
  {
    drug_a: 'Metformin',
    drug_b: 'Hydrochlorothiazide',
    severity: 'info' as const,
    note: 'Thiazides may increase blood glucose levels; monitor glycemic control.',
  },
];

export const SYNTHETIC_CASES_SEED = [
  {
    patient_code: 'P-101',
    status: 'analyzed',
    structured_input: {
      age: 45,
      gender: 'male',
      weight_kg: 68,
      chief_complaint: 'High fever, shaking chills, and cough with rust-colored sputum for 4 days',
      symptoms: ['Fever', 'Productive cough', 'Rust-colored sputum', 'Right pleuritic chest pain', 'Dyspnea on exertion'],
      history_of_present_illness: 'Patient was previously well until 4 days ago when he developed acute high fever, rigors, and worsening cough. Chest pain is sharp, located over the right lower hemithorax, and worsens on deep inspiration.',
      past_medical_history: ['None', 'Non-smoker'],
      current_medicines: [],
      allergies: [],
      vitals: {
        blood_pressure_systolic: 122,
        blood_pressure_diastolic: 78,
        heart_rate: 96,
        respiratory_rate: 22,
        temperature_celsius: 38.9,
        spo2_percent: 95,
      },
      lab_values: [
        { name: 'WBC', value: 14200, unit: '/μL', reference_range: '4000-11000' },
        { name: 'Neutrophils', value: 84, unit: '%', reference_range: '40-70' },
        { name: 'CRP', value: 78, unit: 'mg/L', reference_range: '< 5' },
      ],
      clinical_notes: 'Physical exam reveals bronchial breathing and coarse inspiratory crackles over the right lower lung zone. CRB-65 score is 0 (mild CAP).',
    },
  },
  {
    patient_code: 'P-102',
    status: 'red_flag',
    structured_input: {
      age: 58,
      gender: 'male',
      weight_kg: 82,
      chief_complaint: 'Severe substernal crushing chest pain radiating to left arm and jaw with diaphoresis for 2 hours',
      symptoms: ['Substernal chest pain', 'Radiation to left arm and jaw', 'Diaphoresis', 'Dyspnea', 'Nausea'],
      history_of_present_illness: 'Patient experienced sudden onset of severe pressure-like central chest pain while resting 2 hours ago. Pain does not change with position or respiration. Associated with cold sweating and mild nausea.',
      past_medical_history: ['Hypertension (10 years)', 'Active cigarette smoker (25 pack-years)'],
      current_medicines: ['Amlodipine 5mg OD'],
      allergies: ['Penicillin (anaphylaxis)'],
      vitals: {
        blood_pressure_systolic: 165,
        blood_pressure_diastolic: 98,
        heart_rate: 104,
        respiratory_rate: 24,
        temperature_celsius: 37.0,
        spo2_percent: 93,
      },
      lab_values: [],
      clinical_notes: 'Acute coronary syndrome presentation. High priority emergency triage. STAT 12-lead ECG and high-sensitivity troponin required immediately.',
    },
  },
  {
    patient_code: 'P-103',
    status: 'insufficient_evidence',
    structured_input: {
      age: 32,
      gender: 'female',
      weight_kg: 54,
      chief_complaint: 'Feeling generally unwell, mild headache, and fatigue for 2 days',
      symptoms: ['Malaise', 'Fatigue', 'Mild headache'],
      history_of_present_illness: 'Patient reports vague generalized fatigue and mild frontal headache since yesterday. No fever measured at home. No cough or gastrointestinal symptoms.',
      past_medical_history: [],
      current_medicines: [],
      allergies: [],
      vitals: {},
      lab_values: [],
      clinical_notes: 'Clinical parameters insufficient to establish a reliable differential diagnosis. Requires temperature measurement, vital signs, physical exam, and systematic review of systems.',
    },
  },
];

export async function runSeed() {
  console.log('--- Starting DocMate AI Database Seeding ---');

  if (process.env.DOCMATE_DEMO_MODE !== 'true') throw new Error('Enable DOCMATE_DEMO_MODE for synthetic demo seeding.');
  requireAuthSecret();
  const doctorId = await seedDemoUsers();

  // 1. Seed Drugs
  console.log(`Seeding ${DRUGS_SEED.length} structured drugs...`);
  for (const drug of DRUGS_SEED) {
    await pool.query(
      `INSERT INTO drugs (
        generic_name, drug_class, indications, dose_rules,
        contraindications, pregnancy_category, renal_adjustment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (generic_name) DO UPDATE SET
        drug_class = EXCLUDED.drug_class,
        indications = EXCLUDED.indications,
        dose_rules = EXCLUDED.dose_rules,
        contraindications = EXCLUDED.contraindications,
        pregnancy_category = EXCLUDED.pregnancy_category,
        renal_adjustment = EXCLUDED.renal_adjustment`,
      [
        drug.generic_name,
        drug.drug_class,
        JSON.stringify(drug.indications),
        JSON.stringify(drug.dose_rules),
        JSON.stringify(drug.contraindications),
        drug.pregnancy_category,
        drug.renal_adjustment ? JSON.stringify(drug.renal_adjustment) : null,
      ]
    );
  }

  // 2. Seed Drug Interactions
  console.log(`Seeding ${DRUG_INTERACTIONS_SEED.length} pairwise drug interactions...`);
  for (const inter of DRUG_INTERACTIONS_SEED) {
    await pool.query(
      `INSERT INTO drug_interactions (drug_a, drug_b, severity, note)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (SELECT 1 FROM drug_interactions WHERE drug_a = $1 AND drug_b = $2)`,
      [inter.drug_a, inter.drug_b, inter.severity, inter.note]
    );
  }

  // 3. Seed Synthetic Patient Cases
  console.log(`Seeding 3 synthetic patient cases (P-101, P-102, P-103)...`);
  for (const c of SYNTHETIC_CASES_SEED) {
    const existing = await pool.query(
      `SELECT id FROM cases WHERE patient_code = $1 LIMIT 1`,
      [c.patient_code]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO cases (patient_code, status, structured_input, doctor_id)
         VALUES ($1, $2, $3, $4)`,
        [c.patient_code, c.status, JSON.stringify(c.structured_input), doctorId]
      );
    } else {
      await pool.query(
        'UPDATE cases SET doctor_id = $1 WHERE id = $2 AND doctor_id IS NULL AND structured_input = $3::jsonb',
        [doctorId, existing.rows[0].id, JSON.stringify(c.structured_input)],
      );
    }
  }

  // 4. Seed all 32 RBAC Feature Keys and Role Matrix
  await seedAllFeatures();

  console.log('Database seeding finished successfully.');
}

if (require.main === module) {
  runSeed()
    .catch(() => {
      console.error('Seed failed. Check the demo flag, authentication secret and database schema.');
      process.exitCode = 1;
    })
    .finally(() => Promise.all([pool.end(), authPool.end()]));
}
