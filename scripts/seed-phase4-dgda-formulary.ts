import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

interface MedicineSeed {
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  form: string;
  strength: string;
  pack_size: string;
  price_bdt: number;
  dgda_reg_num: string;
  status?: string;
}

const TOP_BANGLADESHI_MEDICINES: MedicineSeed[] = [
  // --- Paracetamol & Analgesics ---
  { brand_name: 'Napa', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg', pack_size: '50x10', price_bdt: 1.20, dgda_reg_num: 'DAR-024-001' },
  { brand_name: 'Napa Extra', generic_name: 'Paracetamol + Caffeine', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg + 65 mg', pack_size: '20x10', price_bdt: 2.50, dgda_reg_num: 'DAR-024-002' },
  { brand_name: 'Napa Rapid', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg', pack_size: '20x10', price_bdt: 1.50, dgda_reg_num: 'DAR-024-003' },
  { brand_name: 'Napa Extend', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '665 mg', pack_size: '10x10', price_bdt: 2.00, dgda_reg_num: 'DAR-024-004' },
  { brand_name: 'Napa Syrup', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Syrup', strength: '120 mg / 5 ml', pack_size: '60 ml', price_bdt: 35.00, dgda_reg_num: 'DAR-024-005' },
  { brand_name: 'Ace', generic_name: 'Paracetamol', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg', pack_size: '50x10', price_bdt: 1.20, dgda_reg_num: 'DAR-012-001' },
  { brand_name: 'Ace Plus', generic_name: 'Paracetamol + Caffeine', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg + 65 mg', pack_size: '20x10', price_bdt: 2.50, dgda_reg_num: 'DAR-012-002' },
  { brand_name: 'Ace Power', generic_name: 'Paracetamol', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '665 mg', pack_size: '10x10', price_bdt: 2.00, dgda_reg_num: 'DAR-012-003' },
  { brand_name: 'Ace Suspension', generic_name: 'Paracetamol', manufacturer: 'Square Pharmaceuticals PLC', form: 'Suspension', strength: '120 mg / 5 ml', pack_size: '60 ml', price_bdt: 35.00, dgda_reg_num: 'DAR-012-004' },
  { brand_name: 'Fast', generic_name: 'Paracetamol', manufacturer: 'The ACME Laboratories Ltd.', form: 'Tab', strength: '500 mg', pack_size: '50x10', price_bdt: 1.20, dgda_reg_num: 'DAR-008-001' },
  { brand_name: 'Reset', generic_name: 'Paracetamol', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg', pack_size: '30x10', price_bdt: 1.20, dgda_reg_num: 'DAR-035-001' },
  { brand_name: 'Xcel', generic_name: 'Paracetamol', manufacturer: 'Renata Limited', form: 'Tab', strength: '500 mg', pack_size: '20x10', price_bdt: 1.20, dgda_reg_num: 'DAR-018-001' },
  { brand_name: 'Pyrofen', generic_name: 'Paracetamol', manufacturer: 'Opsonin Pharma Ltd.', form: 'Tab', strength: '500 mg', pack_size: '30x10', price_bdt: 1.20, dgda_reg_num: 'DAR-028-001' },

  // --- PPIs & Gastrointestinal ---
  { brand_name: 'Seclo 20', generic_name: 'Omeprazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '20 mg', pack_size: '10x10', price_bdt: 6.00, dgda_reg_num: 'DAR-012-010' },
  { brand_name: 'Seclo 40', generic_name: 'Omeprazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '40 mg', pack_size: '5x10', price_bdt: 10.00, dgda_reg_num: 'DAR-012-011' },
  { brand_name: 'Losectil 20', generic_name: 'Omeprazole', manufacturer: 'Eskayef Pharmaceuticals Ltd.', form: 'Cap', strength: '20 mg', pack_size: '10x10', price_bdt: 6.00, dgda_reg_num: 'DAR-042-010' },
  { brand_name: 'Losectil 40', generic_name: 'Omeprazole', manufacturer: 'Eskayef Pharmaceuticals Ltd.', form: 'Cap', strength: '40 mg', pack_size: '5x10', price_bdt: 10.00, dgda_reg_num: 'DAR-042-011' },
  { brand_name: 'Proceptin 20', generic_name: 'Omeprazole', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Cap', strength: '20 mg', pack_size: '10x10', price_bdt: 6.00, dgda_reg_num: 'DAR-024-010' },
  { brand_name: 'Maxpro 20', generic_name: 'Esomeprazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '20 mg', pack_size: '10x10', price_bdt: 7.00, dgda_reg_num: 'DAR-012-012' },
  { brand_name: 'Maxpro 40', generic_name: 'Esomeprazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '40 mg', pack_size: '5x10', price_bdt: 11.00, dgda_reg_num: 'DAR-012-013' },
  { brand_name: 'Maxima 20', generic_name: 'Esomeprazole', manufacturer: 'Renata Limited', form: 'Cap', strength: '20 mg', pack_size: '10x10', price_bdt: 7.00, dgda_reg_num: 'DAR-018-012' },
  { brand_name: 'Nexum 20', generic_name: 'Esomeprazole', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Cap', strength: '20 mg', pack_size: '10x10', price_bdt: 7.00, dgda_reg_num: 'DAR-035-012' },
  { brand_name: 'Pantonix 20', generic_name: 'Pantoprazole', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '20 mg', pack_size: '10x10', price_bdt: 7.00, dgda_reg_num: 'DAR-035-014' },
  { brand_name: 'Pantonix 40', generic_name: 'Pantoprazole', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '40 mg', pack_size: '5x10', price_bdt: 11.00, dgda_reg_num: 'DAR-035-015' },
  { brand_name: 'Trupan 20', generic_name: 'Pantoprazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '20 mg', pack_size: '10x10', price_bdt: 7.00, dgda_reg_num: 'DAR-012-014' },
  { brand_name: 'Finix 20', generic_name: 'Rabeprazole', manufacturer: 'Opsonin Pharma Ltd.', form: 'Tab', strength: '20 mg', pack_size: '10x10', price_bdt: 8.00, dgda_reg_num: 'DAR-028-014' },
  { brand_name: 'Rabe 20', generic_name: 'Rabeprazole', manufacturer: 'Aristopharma Ltd.', form: 'Tab', strength: '20 mg', pack_size: '10x10', price_bdt: 8.00, dgda_reg_num: 'DAR-050-014' },
  { brand_name: 'Motigut', generic_name: 'Domperidone', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '10 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-012-020' },
  { brand_name: 'Progut', generic_name: 'Domperidone', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-024-020' },
  { brand_name: 'Domin', generic_name: 'Domperidone', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-035-020' },
  { brand_name: 'Emistat 8', generic_name: 'Ondansetron', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '8 mg', pack_size: '3x10', price_bdt: 8.00, dgda_reg_num: 'DAR-012-022' },
  { brand_name: 'Ofran 8', generic_name: 'Ondansetron', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '8 mg', pack_size: '3x10', price_bdt: 8.00, dgda_reg_num: 'DAR-035-022' },
  { brand_name: 'Meva', generic_name: 'Mebeverine HCl', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '135 mg', pack_size: '5x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-025' },
  { brand_name: 'Butapan', generic_name: 'Hyoscine Butylbromide', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '10 mg', pack_size: '10x10', price_bdt: 4.50, dgda_reg_num: 'DAR-012-028' },

  // --- Antibiotics & Antimicrobials ---
  { brand_name: 'Moxacil 500', generic_name: 'Amoxicillin', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '500 mg', pack_size: '10x10', price_bdt: 8.00, dgda_reg_num: 'DAR-012-030' },
  { brand_name: 'Tycil 500', generic_name: 'Amoxicillin', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Cap', strength: '500 mg', pack_size: '10x10', price_bdt: 8.00, dgda_reg_num: 'DAR-024-030' },
  { brand_name: 'G-Amoxicillin', generic_name: 'Amoxicillin', manufacturer: 'Gonoshasthaya Pharmaceuticals Ltd.', form: 'Cap', strength: '500 mg', pack_size: '10x10', price_bdt: 6.50, dgda_reg_num: 'DAR-099-030' },
  { brand_name: 'Moxaclav 625', generic_name: 'Amoxicillin + Clavulanic Acid', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg + 125 mg', pack_size: '2x10', price_bdt: 35.00, dgda_reg_num: 'DAR-012-032' },
  { brand_name: 'Zimax 500', generic_name: 'Azithromycin', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg', pack_size: '3x10', price_bdt: 35.00, dgda_reg_num: 'DAR-012-035' },
  { brand_name: 'Azithrocin 500', generic_name: 'Azithromycin', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg', pack_size: '3x10', price_bdt: 35.00, dgda_reg_num: 'DAR-024-035' },
  { brand_name: 'Rozith 500', generic_name: 'Azithromycin', manufacturer: 'ACI Limited', form: 'Tab', strength: '500 mg', pack_size: '3x10', price_bdt: 35.00, dgda_reg_num: 'DAR-060-035' },
  { brand_name: 'Cef-3 200', generic_name: 'Cefixime', manufacturer: 'Eskayef Pharmaceuticals Ltd.', form: 'Cap', strength: '200 mg', pack_size: '2x7', price_bdt: 40.00, dgda_reg_num: 'DAR-042-038' },
  { brand_name: 'Fixolin 200', generic_name: 'Cefixime', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Cap', strength: '200 mg', pack_size: '2x7', price_bdt: 40.00, dgda_reg_num: 'DAR-035-038' },
  { brand_name: 'Denvar 200', generic_name: 'Cefixime', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '200 mg', pack_size: '2x7', price_bdt: 40.00, dgda_reg_num: 'DAR-012-038' },
  { brand_name: 'Ciprocin 500', generic_name: 'Ciprofloxacin', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg', pack_size: '5x10', price_bdt: 14.00, dgda_reg_num: 'DAR-012-040' },
  { brand_name: 'Neofloxin 500', generic_name: 'Ciprofloxacin', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg', pack_size: '5x10', price_bdt: 14.00, dgda_reg_num: 'DAR-024-040' },
  { brand_name: 'Furocef 500', generic_name: 'Cefuroxime Axetil', manufacturer: 'Renata Limited', form: 'Tab', strength: '500 mg', pack_size: '2x7', price_bdt: 50.00, dgda_reg_num: 'DAR-018-042' },
  { brand_name: 'Kilbac 500', generic_name: 'Cefuroxime Axetil', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '500 mg', pack_size: '2x7', price_bdt: 50.00, dgda_reg_num: 'DAR-035-042' },
  { brand_name: 'Filmet 400', generic_name: 'Metronidazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '400 mg', pack_size: '10x10', price_bdt: 2.00, dgda_reg_num: 'DAR-012-045' },
  { brand_name: 'Amodis 400', generic_name: 'Metronidazole', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '400 mg', pack_size: '10x10', price_bdt: 2.00, dgda_reg_num: 'DAR-024-045' },
  { brand_name: 'Flugal 150', generic_name: 'Fluconazole', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: '150 mg', pack_size: '2x10', price_bdt: 25.00, dgda_reg_num: 'DAR-012-048' },

  // --- Antihistamines, Respiratory & Allergy ---
  { brand_name: 'Alatrol', generic_name: 'Cetirizine Dihydrochloride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '10 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-012-050' },
  { brand_name: 'Cetriz', generic_name: 'Cetirizine Dihydrochloride', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-035-050' },
  { brand_name: 'Fexo 120', generic_name: 'Fexofenadine Hydrochloride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '120 mg', pack_size: '5x10', price_bdt: 9.00, dgda_reg_num: 'DAR-012-052' },
  { brand_name: 'Fexo 180', generic_name: 'Fexofenadine Hydrochloride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '180 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-053' },
  { brand_name: 'Fenadin 120', generic_name: 'Fexofenadine Hydrochloride', manufacturer: 'Renata Limited', form: 'Tab', strength: '120 mg', pack_size: '5x10', price_bdt: 9.00, dgda_reg_num: 'DAR-018-052' },
  { brand_name: 'Monas 10', generic_name: 'Montelukast Sodium', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '3x10', price_bdt: 16.00, dgda_reg_num: 'DAR-035-055' },
  { brand_name: 'Montene 10', generic_name: 'Montelukast Sodium', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '10 mg', pack_size: '3x10', price_bdt: 16.00, dgda_reg_num: 'DAR-012-055' },
  { brand_name: 'Odmon 10', generic_name: 'Montelukast Sodium', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '3x10', price_bdt: 16.00, dgda_reg_num: 'DAR-024-055' },
  { brand_name: 'Tofen', generic_name: 'Ketotifen Fumarate', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '1 mg', pack_size: '10x10', price_bdt: 3.00, dgda_reg_num: 'DAR-024-058' },
  { brand_name: 'Asmasol Inhaler', generic_name: 'Salbutamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Inhaler', strength: '100 mcg / puff', pack_size: '200 puffs', price_bdt: 180.00, dgda_reg_num: 'DAR-024-060' },
  { brand_name: 'Bexitrol-F 100', generic_name: 'Salmeterol + Fluticasone', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Inhaler', strength: '25 mcg + 100 mcg', pack_size: '120 puffs', price_bdt: 380.00, dgda_reg_num: 'DAR-024-062' },
  { brand_name: 'Mirakof', generic_name: 'Butamirate Citrate', manufacturer: 'Eskayef Pharmaceuticals Ltd.', form: 'Syrup', strength: '7.5 mg / 5 ml', pack_size: '100 ml', price_bdt: 85.00, dgda_reg_num: 'DAR-042-065' },

  // --- Cardiovascular & Antihypertensives ---
  { brand_name: 'Osartil 50', generic_name: 'Losartan Potassium', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '50 mg', pack_size: '3x10', price_bdt: 8.00, dgda_reg_num: 'DAR-035-070' },
  { brand_name: 'Angilock 50', generic_name: 'Losartan Potassium', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '50 mg', pack_size: '3x10', price_bdt: 8.00, dgda_reg_num: 'DAR-012-070' },
  { brand_name: 'Camlosart 5/20', generic_name: 'Amlodipine + Olmesartan', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '5 mg + 20 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-072' },
  { brand_name: 'Bizoran 5/20', generic_name: 'Amlodipine + Olmesartan', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '5 mg + 20 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-073' },
  { brand_name: 'Cardipin 5', generic_name: 'Amlodipine Besilate', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '5 mg', pack_size: '3x10', price_bdt: 5.00, dgda_reg_num: 'DAR-012-074' },
  { brand_name: 'Amdocal 5', generic_name: 'Amlodipine Besilate', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '5 mg', pack_size: '3x10', price_bdt: 5.00, dgda_reg_num: 'DAR-024-074' },
  { brand_name: 'Bisocor 2.5', generic_name: 'Bisoprolol Fumarate', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '2.5 mg', pack_size: '3x10', price_bdt: 6.00, dgda_reg_num: 'DAR-012-076' },
  { brand_name: 'Bisocor 5', generic_name: 'Bisoprolol Fumarate', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '5 mg', pack_size: '3x10', price_bdt: 10.00, dgda_reg_num: 'DAR-012-077' },
  { brand_name: 'Ateno 50', generic_name: 'Atenolol', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '50 mg', pack_size: '5x10', price_bdt: 2.50, dgda_reg_num: 'DAR-024-078' },
  { brand_name: 'Anclog 75', generic_name: 'Clopidogrel', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '75 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-080' },
  { brand_name: 'Plagrin 75', generic_name: 'Clopidogrel', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '75 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-035-080' },
  { brand_name: 'Lipicon 10', generic_name: 'Atorvastatin Calcium', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '10 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-082' },
  { brand_name: 'Atova 10', generic_name: 'Atorvastatin Calcium', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '3x10', price_bdt: 12.00, dgda_reg_num: 'DAR-024-082' },
  { brand_name: 'Rosuva 10', generic_name: 'Rosuvastatin Calcium', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '10 mg', pack_size: '3x10', price_bdt: 18.00, dgda_reg_num: 'DAR-012-084' },

  // --- Antidiabetics ---
  { brand_name: 'Comet 500', generic_name: 'Metformin Hydrochloride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg', pack_size: '10x10', price_bdt: 4.50, dgda_reg_num: 'DAR-012-090' },
  { brand_name: 'Comet 850', generic_name: 'Metformin Hydrochloride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '850 mg', pack_size: '5x10', price_bdt: 6.50, dgda_reg_num: 'DAR-012-091' },
  { brand_name: 'Daoryl 2', generic_name: 'Glimepiride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '2 mg', pack_size: '3x10', price_bdt: 8.00, dgda_reg_num: 'DAR-012-092' },
  { brand_name: 'Glicron 80', generic_name: 'Gliclazide', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: '80 mg', pack_size: '5x10', price_bdt: 6.00, dgda_reg_num: 'DAR-024-094' },
  { brand_name: 'Linatab 5', generic_name: 'Linagliptin', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '5 mg', pack_size: '3x10', price_bdt: 18.00, dgda_reg_num: 'DAR-012-096' },
  { brand_name: 'Glysup 5', generic_name: 'Linagliptin', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '5 mg', pack_size: '3x10', price_bdt: 18.00, dgda_reg_num: 'DAR-035-096' },
  { brand_name: 'Emparol 10', generic_name: 'Empagliflozin', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '2x10', price_bdt: 30.00, dgda_reg_num: 'DAR-035-098' },

  // --- NSAIDs & Pain Management ---
  { brand_name: 'Rolac 10', generic_name: 'Ketorolac Tromethamine', manufacturer: 'Renata Limited', form: 'Tab', strength: '10 mg', pack_size: '2x10', price_bdt: 12.00, dgda_reg_num: 'DAR-018-100' },
  { brand_name: 'Torax 10', generic_name: 'Ketorolac Tromethamine', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Tab', strength: '10 mg', pack_size: '2x10', price_bdt: 12.00, dgda_reg_num: 'DAR-035-100' },
  { brand_name: 'Anaflex 50', generic_name: 'Diclofenac Sodium', manufacturer: 'ACI Limited', form: 'Tab', strength: '50 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-060-102' },
  { brand_name: 'Clofenac 50', generic_name: 'Diclofenac Sodium', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '50 mg', pack_size: '10x10', price_bdt: 3.50, dgda_reg_num: 'DAR-012-102' },
  { brand_name: 'Napryn 500', generic_name: 'Naproxen Sodium', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg', pack_size: '5x10', price_bdt: 12.00, dgda_reg_num: 'DAR-012-104' },
  { brand_name: 'Flexi 100', generic_name: 'Aceclofenac', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '100 mg', pack_size: '10x10', price_bdt: 5.00, dgda_reg_num: 'DAR-012-106' },
  { brand_name: 'Myolax 50', generic_name: 'Tolperisone Hydrochloride', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '50 mg', pack_size: '5x10', price_bdt: 6.00, dgda_reg_num: 'DAR-012-108' },

  // --- Vitamins, Minerals & Supplements ---
  { brand_name: 'Filwel Gold', generic_name: 'Multivitamin and Multimineral', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: 'Adult Formulation', pack_size: '30s', price_bdt: 270.00, dgda_reg_num: 'DAR-012-110' },
  { brand_name: 'Bextram Gold', generic_name: 'Multivitamin and Multimineral', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Tab', strength: 'Adult Formulation', pack_size: '30s', price_bdt: 270.00, dgda_reg_num: 'DAR-024-110' },
  { brand_name: 'Coral-D', generic_name: 'Calcium Carbonate + Vitamin D3', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg + 200 IU', pack_size: '30s', price_bdt: 240.00, dgda_reg_num: 'DAR-012-112' },
  { brand_name: 'Calbo-D', generic_name: 'Calcium Carbonate + Vitamin D3', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '500 mg + 200 IU', pack_size: '30s', price_bdt: 210.00, dgda_reg_num: 'DAR-012-113' },
  { brand_name: 'D-Rise 20000', generic_name: 'Cholecalciferol (Vitamin D3)', manufacturer: 'Incepta Pharmaceuticals Ltd.', form: 'Cap', strength: '20,000 IU', pack_size: '1x10', price_bdt: 40.00, dgda_reg_num: 'DAR-035-115' },
  { brand_name: 'Folison', generic_name: 'Folic Acid', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '5 mg', pack_size: '10x10', price_bdt: 0.50, dgda_reg_num: 'DAR-012-116' },
  { brand_name: 'Ferozi', generic_name: 'Iron Polymaltose + Folic Acid + Zinc', manufacturer: 'Square Pharmaceuticals PLC', form: 'Cap', strength: 'Combo', pack_size: '30s', price_bdt: 180.00, dgda_reg_num: 'DAR-012-118' },

  // --- Pending Review Sample Brands (for Two-Person Review testing) ---
  { brand_name: 'BexiCough', generic_name: 'Dextromethorphan + Guaifenesin', manufacturer: 'Beximco Pharmaceuticals Ltd.', form: 'Syrup', strength: '10 mg + 100 mg / 5 ml', pack_size: '100 ml', price_bdt: 95.00, dgda_reg_num: 'DAR-024-PEND-1', status: 'pending' },
  { brand_name: 'CardioMax', generic_name: 'Telmisartan + Hydrochlorothiazide', manufacturer: 'Square Pharmaceuticals PLC', form: 'Tab', strength: '40 mg + 12.5 mg', pack_size: '3x10', price_bdt: 15.00, dgda_reg_num: 'DAR-012-PEND-2', status: 'partially_approved' },
];

async function seedPhase4() {
  const client = await pool.connect();
  try {
    console.log('--- Seeding Phase 4 DGDA Formulary Medicines & Safety Notices ---');

    // 1. Clean existing medicine brands table
    await client.query("DELETE FROM medicine_brands");
    await client.query("DELETE FROM medicine_notices");

    // 2. Insert all medicine records
    let insertedCount = 0;
    for (const med of TOP_BANGLADESHI_MEDICINES) {
      await client.query(
        `INSERT INTO medicine_brands 
         (brand_name, generic_name, manufacturer, form, strength, pack_size, price_bdt, dgda_reg_num, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          med.brand_name,
          med.generic_name,
          med.manufacturer,
          med.form,
          med.strength,
          med.pack_size,
          med.price_bdt,
          med.dgda_reg_num,
          med.status || 'approved',
        ]
      );
      insertedCount++;
    }
    console.log(`✓ Inserted ${insertedCount} DGDA-registered medicine brands.`);

    // 3. Seed Safety Notices
    const controllerRes = await client.query("SELECT id FROM users WHERE role='medicine_controller' LIMIT 1");
    const controllerId = controllerRes.rows.length > 0 ? controllerRes.rows[0].id : null;

    await client.query(
      `INSERT INTO medicine_notices (title, severity, body, affected_batches, published_by)
       VALUES 
       ($1, $2, $3, $4, $5),
       ($6, $7, $8, $9, $10)`,
      [
        'জরুরি নোটিশ: Ranitidine জাতীয় ওষুধের প্রত্যাহার ও নিষেধাজ্ঞা বলবৎ',
        'critical_recall',
        'ডিজিডিএ (DGDA) নির্দেশিকা মোতাবেক এনডিএমএ (NDMA) অমেধ্যতার ঝুঁকি থাকায় সকল ধরনের রেনিটিডিন উৎপাদন, বিক্রয় ও প্রেসক্রিপশন সম্পূর্ণ নিষিদ্ধ। সকল নিবন্ধিত চিকিৎসক ও ফার্মেসিকে দ্রুত অবশিষ্ট স্টক প্রত্যাহারের নির্দেশ দেওয়া হচ্ছে।',
        JSON.stringify(['RN-2023-BATCH-A', 'RN-2023-BATCH-B']),
        controllerId,
        'সতর্কবার্তা: শিশুদের কাশির সিরাপে ডাইইথিলিন গ্লাইকল (DEG) ভেজাল রোধে মান নিয়ন্ত্রণ',
        'warning',
        'বিশ্ব স্বাস্থ্য সংস্থার সতর্কবার্তা অনুযায়ী প্যারাসিটামল ও কাশির সিরাপে ব্যবহৃত প্রোপিলিন গ্লাইকলের ল্যাবরেটরি বিশুদ্ধতা সনদ যাচাই ব্যতীত কোনো ব্যাচ বিপণন করা যাবে না। সন্দেহজনক নমুনা অবিলম্বে ডিজিডিএ ল্যাবে প্রেরণের নির্দেশ দেওয়া হলো।',
        JSON.stringify(['BATCH-INSPECT-2026']),
        controllerId,
      ]
    );
    console.log('✓ Seeded 2 DGDA Safety Notices.');

  } catch (err) {
    console.error('Error seeding Phase 4:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedPhase4().catch(err => {
  console.error(err);
  process.exit(1);
});
