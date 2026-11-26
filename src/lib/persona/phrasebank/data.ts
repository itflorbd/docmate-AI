import { PhraseEntry } from './types';

export const PHRASEBANK_DATA: PhraseEntry[] = [
  // ==========================================
  // 1. GREETING (Bangla & English, by Time of Day & Presets)
  // ==========================================
  // Bangla - Morning (05:00 - 11:59)
  {
    id: 'bn-greet-morn-01',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'morning',
    text: 'শুভ সকাল, {doctorTitle}। আজ কীভাবে সাহায্য করতে পারি?',
    status: 'live',
  },
  {
    id: 'bn-greet-morn-02',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'morning',
    text: 'শুভ সকাল। কোনো কেস বা গাইডলাইন দেখতে চান?',
    status: 'live',
  },
  {
    id: 'bn-greet-morn-03',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'morning',
    text: 'শুভ সকাল, {doctorTitle}। প্রস্তুত আছি।',
    status: 'live',
  },
  {
    id: 'bn-greet-morn-04',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'morning',
    text: 'শুভ সকাল। বলুন, কী করব?',
    status: 'live',
  },
  // Bangla - Afternoon (12:00 - 16:59)
  {
    id: 'bn-greet-aft-01',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'afternoon',
    text: 'শুভ অপরাহ্ন, {doctorTitle}। কীভাবে সহায়তা করব?',
    status: 'live',
  },
  {
    id: 'bn-greet-aft-02',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'afternoon',
    text: 'শুভ অপরাহ্ন। রোগীর কোনো নথিতে সাহায্য লাগবে?',
    status: 'live',
  },
  {
    id: 'bn-greet-aft-03',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'afternoon',
    text: 'শুভ অপরাহ্ন, {doctorTitle}। নির্দেশ দিন।',
    status: 'live',
  },
  {
    id: 'bn-greet-aft-04',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'afternoon',
    text: 'শুভ অপরাহ্ন। সহকারী সক্রিয় আছে।',
    status: 'live',
  },
  // Bangla - Evening (17:00 - 21:59)
  {
    id: 'bn-greet-eve-01',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'evening',
    text: 'শুভ সন্ধ্যা, {doctorTitle}। আজকের কেসগুলোতে কীভাবে সাহায্য করতে পারি?',
    status: 'live',
  },
  {
    id: 'bn-greet-eve-02',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'evening',
    text: 'শুভ সন্ধ্যা। লাইব্রেরি বা প্রেসক্রিপশন সংক্রান্ত প্রশ্ন থাকলে বলুন।',
    status: 'live',
  },
  {
    id: 'bn-greet-eve-03',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'evening',
    text: 'শুভ সন্ধ্যা, {doctorTitle}। বলুন।',
    status: 'live',
  },
  {
    id: 'bn-greet-eve-04',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'evening',
    text: 'শুভ সন্ধ্যা। প্রস্তুত আছি।',
    status: 'live',
  },
  // Bangla - Night (22:00 - 04:59 / Neutral)
  {
    id: 'bn-greet-nit-01',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'night',
    text: 'স্বাগতম, {doctorTitle}। রাতে ডিউটিতে কীভাবে সাহায্য করতে পারি?',
    status: 'live',
  },
  {
    id: 'bn-greet-nit-02',
    category: 'greeting',
    locale: 'bn',
    preset: 'friendly',
    timeOfDay: 'night',
    text: 'স্বাগতম। যেকোনো ক্লিনিকাল জিজ্ঞাসায় প্রস্তুত আছি।',
    status: 'live',
  },
  {
    id: 'bn-greet-nit-03',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'night',
    text: 'স্বাগতম, {doctorTitle}। বলুন।',
    status: 'live',
  },
  {
    id: 'bn-greet-nit-04',
    category: 'greeting',
    locale: 'bn',
    preset: 'reserved',
    timeOfDay: 'night',
    text: 'স্বাগতম। সহকারী প্রস্তুত।',
    status: 'live',
  },

  // English - Morning
  {
    id: 'en-greet-morn-01',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'morning',
    text: 'Good morning, {doctorTitle}. How can I assist you today?',
    status: 'live',
  },
  {
    id: 'en-greet-morn-02',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'morning',
    text: 'Good morning. Would you like to review a case or check guidelines?',
    status: 'live',
  },
  {
    id: 'en-greet-morn-03',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'morning',
    text: 'Good morning, {doctorTitle}. Ready for input.',
    status: 'live',
  },
  {
    id: 'en-greet-morn-04',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'morning',
    text: 'Good morning. How can I help?',
    status: 'live',
  },
  // English - Afternoon
  {
    id: 'en-greet-aft-01',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'afternoon',
    text: 'Good afternoon, {doctorTitle}. How may I help you?',
    status: 'live',
  },
  {
    id: 'en-greet-aft-02',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'afternoon',
    text: 'Good afternoon. Ready to assist with clinical inquiries.',
    status: 'live',
  },
  {
    id: 'en-greet-aft-03',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'afternoon',
    text: 'Good afternoon, {doctorTitle}. Ready.',
    status: 'live',
  },
  {
    id: 'en-greet-aft-04',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'afternoon',
    text: 'Good afternoon. Standing by.',
    status: 'live',
  },
  // English - Evening
  {
    id: 'en-greet-eve-01',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'evening',
    text: 'Good evening, {doctorTitle}. How can I assist with your cases?',
    status: 'live',
  },
  {
    id: 'en-greet-eve-02',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'evening',
    text: 'Good evening. Ready for guideline lookups or documentation.',
    status: 'live',
  },
  {
    id: 'en-greet-eve-03',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'evening',
    text: 'Good evening, {doctorTitle}.',
    status: 'live',
  },
  {
    id: 'en-greet-eve-04',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'evening',
    text: 'Good evening. Ready.',
    status: 'live',
  },
  // English - Night
  {
    id: 'en-greet-nit-01',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'night',
    text: 'Welcome, {doctorTitle}. How can I assist on duty tonight?',
    status: 'live',
  },
  {
    id: 'en-greet-nit-02',
    category: 'greeting',
    locale: 'en',
    preset: 'friendly',
    timeOfDay: 'night',
    text: 'Welcome. Standing by for any clinical questions.',
    status: 'live',
  },
  {
    id: 'en-greet-nit-03',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'night',
    text: 'Welcome, {doctorTitle}. Ready.',
    status: 'live',
  },
  {
    id: 'en-greet-nit-04',
    category: 'greeting',
    locale: 'en',
    preset: 'reserved',
    timeOfDay: 'night',
    text: 'Welcome. Ready for input.',
    status: 'live',
  },

  // ==========================================
  // 2. ACKNOWLEDGE (>= 8 variants BN & EN)
  // ==========================================
  // Bangla
  { id: 'bn-ack-01', category: 'acknowledge', locale: 'bn', preset: 'friendly', text: 'জি, বুঝেছি।', status: 'live' },
  { id: 'bn-ack-02', category: 'acknowledge', locale: 'bn', preset: 'friendly', text: 'ঠিক আছে, দেখছি।', status: 'live' },
  { id: 'bn-ack-03', category: 'acknowledge', locale: 'bn', preset: 'friendly', text: 'জি, লিখে নিচ্ছি।', status: 'live' },
  { id: 'bn-ack-04', category: 'acknowledge', locale: 'bn', preset: 'friendly', text: 'নোট রাখা হলো।', status: 'live' },
  { id: 'bn-ack-05', category: 'acknowledge', locale: 'bn', preset: 'reserved', text: 'ঠিক আছে।', status: 'live' },
  { id: 'bn-ack-06', category: 'acknowledge', locale: 'bn', preset: 'reserved', text: 'নোট করা হলো।', status: 'live' },
  { id: 'bn-ack-07', category: 'acknowledge', locale: 'bn', preset: 'reserved', text: 'বুঝেছি।', status: 'live' },
  { id: 'bn-ack-08', category: 'acknowledge', locale: 'bn', preset: 'all', text: 'জি, দেখছি।', status: 'live' },

  // English
  { id: 'en-ack-01', category: 'acknowledge', locale: 'en', preset: 'friendly', text: 'Understood.', status: 'live' },
  { id: 'en-ack-02', category: 'acknowledge', locale: 'en', preset: 'friendly', text: 'Got it, looking into this.', status: 'live' },
  { id: 'en-ack-03', category: 'acknowledge', locale: 'en', preset: 'friendly', text: 'Taking note.', status: 'live' },
  { id: 'en-ack-04', category: 'acknowledge', locale: 'en', preset: 'friendly', text: 'Right away.', status: 'live' },
  { id: 'en-ack-05', category: 'acknowledge', locale: 'en', preset: 'reserved', text: 'Noted.', status: 'live' },
  { id: 'en-ack-06', category: 'acknowledge', locale: 'en', preset: 'reserved', text: 'Recorded.', status: 'live' },
  { id: 'en-ack-07', category: 'acknowledge', locale: 'en', preset: 'reserved', text: 'Understood.', status: 'live' },
  { id: 'en-ack-08', category: 'acknowledge', locale: 'en', preset: 'all', text: 'On it.', status: 'live' },

  // ==========================================
  // 3. THINKING (>= 8 variants BN & EN)
  // ==========================================
  // Bangla
  { id: 'bn-thk-01', category: 'thinking', locale: 'bn', preset: 'friendly', text: 'একটু দেখছি...', status: 'live' },
  { id: 'bn-thk-02', category: 'thinking', locale: 'bn', preset: 'friendly', text: 'লাইব্রেরিতে খুঁজছি...', status: 'live' },
  { id: 'bn-thk-03', category: 'thinking', locale: 'bn', preset: 'friendly', text: 'প্রমাণ মিলিয়ে দেখছি...', status: 'live' },
  { id: 'bn-thk-04', category: 'thinking', locale: 'bn', preset: 'friendly', text: 'একটু সময় দিন, দেখছি...', status: 'live' },
  { id: 'bn-thk-05', category: 'thinking', locale: 'bn', preset: 'reserved', text: 'খোঁজা হচ্ছে...', status: 'live' },
  { id: 'bn-thk-06', category: 'thinking', locale: 'bn', preset: 'reserved', text: 'যাচাই চলছে...', status: 'live' },
  { id: 'bn-thk-07', category: 'thinking', locale: 'bn', preset: 'reserved', text: 'পর্যালোচনা হচ্ছে...', status: 'live' },
  { id: 'bn-thk-08', category: 'thinking', locale: 'bn', preset: 'all', text: 'গাইডলাইন খতিয়ে দেখছি...', status: 'live' },

  // English
  { id: 'en-thk-01', category: 'thinking', locale: 'en', preset: 'friendly', text: 'Checking now...', status: 'live' },
  { id: 'en-thk-02', category: 'thinking', locale: 'en', preset: 'friendly', text: 'Searching the library...', status: 'live' },
  { id: 'en-thk-03', category: 'thinking', locale: 'en', preset: 'friendly', text: 'Verifying evidence...', status: 'live' },
  { id: 'en-thk-04', category: 'thinking', locale: 'en', preset: 'friendly', text: 'One moment, reviewing...', status: 'live' },
  { id: 'en-thk-05', category: 'thinking', locale: 'en', preset: 'reserved', text: 'Searching references...', status: 'live' },
  { id: 'en-thk-06', category: 'thinking', locale: 'en', preset: 'reserved', text: 'Verifying...', status: 'live' },
  { id: 'en-thk-07', category: 'thinking', locale: 'en', preset: 'reserved', text: 'Cross-referencing...', status: 'live' },
  { id: 'en-thk-08', category: 'thinking', locale: 'en', preset: 'all', text: 'Checking guidelines...', status: 'live' },

  // ==========================================
  // 4. UNDERSTOOD (>= 8 variants BN & EN)
  // ==========================================
  // Bangla
  { id: 'bn-und-01', category: 'understood', locale: 'bn', preset: 'friendly', text: 'স্পষ্ট বুঝেছি।', status: 'live' },
  { id: 'bn-und-02', category: 'understood', locale: 'bn', preset: 'friendly', text: 'জি, পরিষ্কার।', status: 'live' },
  { id: 'bn-und-03', category: 'understood', locale: 'bn', preset: 'friendly', text: 'ঠিক আছে, বুঝতে পেরেছি।', status: 'live' },
  { id: 'bn-und-04', category: 'understood', locale: 'bn', preset: 'friendly', text: 'জি, তথ্যটি স্পষ্ট।', status: 'live' },
  { id: 'bn-und-05', category: 'understood', locale: 'bn', preset: 'reserved', text: 'স্পষ্ট।', status: 'live' },
  { id: 'bn-und-06', category: 'understood', locale: 'bn', preset: 'reserved', text: 'বুঝেছি।', status: 'live' },
  { id: 'bn-und-07', category: 'understood', locale: 'bn', preset: 'reserved', text: 'রেকর্ড করা হলো।', status: 'live' },
  { id: 'bn-und-08', category: 'understood', locale: 'bn', preset: 'all', text: 'তথ্য স্পষ্ট হয়েছে।', status: 'live' },

  // English
  { id: 'en-und-01', category: 'understood', locale: 'en', preset: 'friendly', text: 'Understood clearly.', status: 'live' },
  { id: 'en-und-02', category: 'understood', locale: 'en', preset: 'friendly', text: 'Got it, thank you.', status: 'live' },
  { id: 'en-und-03', category: 'understood', locale: 'en', preset: 'friendly', text: 'Clear, Doctor.', status: 'live' },
  { id: 'en-und-04', category: 'understood', locale: 'en', preset: 'friendly', text: 'I have captured that accurately.', status: 'live' },
  { id: 'en-und-05', category: 'understood', locale: 'en', preset: 'reserved', text: 'Understood.', status: 'live' },
  { id: 'en-und-06', category: 'understood', locale: 'en', preset: 'reserved', text: 'Captured.', status: 'live' },
  { id: 'en-und-07', category: 'understood', locale: 'en', preset: 'reserved', text: 'Confirmed.', status: 'live' },
  { id: 'en-und-08', category: 'understood', locale: 'en', preset: 'all', text: 'Clear.', status: 'live' },

  // ==========================================
  // 5. CLARIFY (>= 8 variants BN & EN)
  // ==========================================
  // Bangla
  { id: 'bn-clr-01', category: 'clarify', locale: 'bn', preset: 'friendly', text: 'একটু নিশ্চিত হয়ে নিই। আপনি কি {detail} বলছেন?', status: 'live' },
  { id: 'bn-clr-02', category: 'clarify', locale: 'bn', preset: 'friendly', text: 'একটু পরিষ্কার করবেন কি? আপনি কি {detail} বোঝাচ্ছেন?', status: 'live' },
  { id: 'bn-clr-03', category: 'clarify', locale: 'bn', preset: 'friendly', text: 'সঠিকভাবে বোঝার জন্য: আপনি কি {detail} নির্দেশ করছেন?', status: 'live' },
  { id: 'bn-clr-04', category: 'clarify', locale: 'bn', preset: 'friendly', text: 'আরেকটু নিশ্চিত হতে চাই: {detail}?', status: 'live' },
  { id: 'bn-clr-05', category: 'clarify', locale: 'bn', preset: 'reserved', text: 'নিশ্চিত করুন: {detail} কি না?', status: 'live' },
  { id: 'bn-clr-06', category: 'clarify', locale: 'bn', preset: 'reserved', text: 'স্পষ্ট করুন: {detail}?', status: 'live' },
  { id: 'bn-clr-07', category: 'clarify', locale: 'bn', preset: 'reserved', text: 'যাচাই প্রয়োজন: {detail}?', status: 'live' },
  { id: 'bn-clr-08', category: 'clarify', locale: 'bn', preset: 'all', text: 'একটু মিলিয়ে নিই: {detail} কি?', status: 'live' },

  // English
  { id: 'en-clr-01', category: 'clarify', locale: 'en', preset: 'friendly', text: 'Just to be sure: are you referring to {detail}?', status: 'live' },
  { id: 'en-clr-02', category: 'clarify', locale: 'en', preset: 'friendly', text: 'Could you clarify if you mean {detail}?', status: 'live' },
  { id: 'en-clr-03', category: 'clarify', locale: 'en', preset: 'friendly', text: 'To ensure clinical accuracy: did you mean {detail}?', status: 'live' },
  { id: 'en-clr-04', category: 'clarify', locale: 'en', preset: 'friendly', text: 'Could you specify regarding {detail}?', status: 'live' },
  { id: 'en-clr-05', category: 'clarify', locale: 'en', preset: 'reserved', text: 'Please clarify: {detail}?', status: 'live' },
  { id: 'en-clr-06', category: 'clarify', locale: 'en', preset: 'reserved', text: 'Confirm: {detail}?', status: 'live' },
  { id: 'en-clr-07', category: 'clarify', locale: 'en', preset: 'reserved', text: 'Verification needed: {detail}?', status: 'live' },
  { id: 'en-clr-08', category: 'clarify', locale: 'en', preset: 'all', text: 'To confirm: is this {detail}?', status: 'live' },

  // ==========================================
  // 6. CONFIRM READBACK (>= 8 variants BN & EN)
  // ==========================================
  // Bangla
  { id: 'bn-crb-01', category: 'confirm_readback', locale: 'bn', preset: 'friendly', text: 'আমি শুনলাম: {detail}। ঠিক আছে?', status: 'live' },
  { id: 'bn-crb-02', category: 'confirm_readback', locale: 'bn', preset: 'friendly', text: 'আমি যা লিখেছি: {detail}। ঠিক আছে কি?', status: 'live' },
  { id: 'bn-crb-03', category: 'confirm_readback', locale: 'bn', preset: 'friendly', text: 'শুনতে পেয়েছি: {detail}। নিশ্চিত করবেন কি?', status: 'live' },
  { id: 'bn-crb-04', category: 'confirm_readback', locale: 'bn', preset: 'friendly', text: 'যা নোট করেছি: {detail}। সব ঠিক আছে?', status: 'live' },
  { id: 'bn-crb-05', category: 'confirm_readback', locale: 'bn', preset: 'reserved', text: 'রেকর্ড: {detail}। ঠিক আছে?', status: 'live' },
  { id: 'bn-crb-06', category: 'confirm_readback', locale: 'bn', preset: 'reserved', text: 'নথিভুক্ত: {detail}। নিশ্চিত করুন।', status: 'live' },
  { id: 'bn-crb-07', category: 'confirm_readback', locale: 'bn', preset: 'reserved', text: 'শ্রুত বাক্য: {detail}। ঠিক?', status: 'live' },
  { id: 'bn-crb-08', category: 'confirm_readback', locale: 'bn', preset: 'all', text: 'নথিতে রাখা হলো: {detail}। যাচাই করে নিন।', status: 'live' },

  // English
  { id: 'en-crb-01', category: 'confirm_readback', locale: 'en', preset: 'friendly', text: 'I heard: {detail}. Is this correct?', status: 'live' },
  { id: 'en-crb-02', category: 'confirm_readback', locale: 'en', preset: 'friendly', text: 'Recorded: {detail}. Does that look right?', status: 'live' },
  { id: 'en-crb-03', category: 'confirm_readback', locale: 'en', preset: 'friendly', text: 'I captured: {detail}. Please confirm.', status: 'live' },
  { id: 'en-crb-04', category: 'confirm_readback', locale: 'en', preset: 'friendly', text: 'Here is what was recorded: {detail}. Correct?', status: 'live' },
  { id: 'en-crb-05', category: 'confirm_readback', locale: 'en', preset: 'reserved', text: 'Recorded: {detail}. Confirm?', status: 'live' },
  { id: 'en-crb-06', category: 'confirm_readback', locale: 'en', preset: 'reserved', text: 'Readback: {detail}. Is this accurate?', status: 'live' },
  { id: 'en-crb-07', category: 'confirm_readback', locale: 'en', preset: 'reserved', text: 'Transcribed: {detail}. Correct?', status: 'live' },
  { id: 'en-crb-08', category: 'confirm_readback', locale: 'en', preset: 'all', text: 'Readback: {detail}. Please confirm.', status: 'live' },

  // ==========================================
  // 7. SUCCESS (>= 8 variants BN & EN)
  // ==========================================
  // Bangla
  { id: 'bn-suc-01', category: 'success', locale: 'bn', preset: 'friendly', text: 'হয়ে গেছে।', status: 'live' },
  { id: 'bn-suc-02', category: 'success', locale: 'bn', preset: 'friendly', text: 'সংরক্ষণ করা হয়েছে।', status: 'live' },
  { id: 'bn-suc-03', category: 'success', locale: 'bn', preset: 'friendly', text: 'তথ্য সফলভাবে যোগ করা হলো।', status: 'live' },
  { id: 'bn-suc-04', category: 'success', locale: 'bn', preset: 'friendly', text: 'রেকর্ড নিশ্চিত করা হয়েছে।', status: 'live' },
  { id: 'bn-suc-05', category: 'success', locale: 'bn', preset: 'reserved', text: 'সংরক্ষিত।', status: 'live' },
  { id: 'bn-suc-06', category: 'success', locale: 'bn', preset: 'reserved', text: 'সম্পন্ন।', status: 'live' },
  { id: 'bn-suc-07', category: 'success', locale: 'bn', preset: 'reserved', text: 'হালনাগাদ সম্পন্ন।', status: 'live' },
  { id: 'bn-suc-08', category: 'success', locale: 'bn', preset: 'all', text: 'তথ্য হালনাগাদ করা হয়েছে।', status: 'live' },

  // English
  { id: 'en-suc-01', category: 'success', locale: 'en', preset: 'friendly', text: 'Done.', status: 'live' },
  { id: 'en-suc-02', category: 'success', locale: 'en', preset: 'friendly', text: 'Saved successfully.', status: 'live' },
  { id: 'en-suc-03', category: 'success', locale: 'en', preset: 'friendly', text: 'Updated and saved.', status: 'live' },
  { id: 'en-suc-04', category: 'success', locale: 'en', preset: 'friendly', text: 'Changes recorded.', status: 'live' },
  { id: 'en-suc-05', category: 'success', locale: 'en', preset: 'reserved', text: 'Saved.', status: 'live' },
  { id: 'en-suc-06', category: 'success', locale: 'en', preset: 'reserved', text: 'Completed.', status: 'live' },
  { id: 'en-suc-07', category: 'success', locale: 'en', preset: 'reserved', text: 'Updated.', status: 'live' },
  { id: 'en-suc-08', category: 'success', locale: 'en', preset: 'all', text: 'Record updated.', status: 'live' },

  // ==========================================
  // 8. SMALL ERROR (Audio / Minor Parsing) (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-sme-01', category: 'small_error', locale: 'bn', preset: 'friendly', text: 'দুঃখিত, ঠিক শুনতে পাইনি। আরেকবার বলবেন?', status: 'live' },
  { id: 'bn-sme-02', category: 'small_error', locale: 'bn', preset: 'friendly', text: 'একটু স্পষ্ট শুনতে পাইনি। দয়া করে আরেকবার বলুন।', status: 'live' },
  { id: 'bn-sme-03', category: 'small_error', locale: 'bn', preset: 'friendly', text: 'কথাটি পরিষ্কার আসেনি। আবার একটু বলবেন?', status: 'live' },
  { id: 'bn-sme-04', category: 'small_error', locale: 'bn', preset: 'friendly', text: 'শব্দটি কেটে গেছে। দয়া করে আবার বলুন।', status: 'live' },
  { id: 'bn-sme-05', category: 'small_error', locale: 'bn', preset: 'reserved', text: 'শুনতে পাইনি। আবার বলুন।', status: 'live' },
  { id: 'bn-sme-06', category: 'small_error', locale: 'bn', preset: 'reserved', text: 'স্পষ্ট আসেনি। পুনরায় বলুন।', status: 'live' },
  { id: 'bn-sme-07', category: 'small_error', locale: 'bn', preset: 'reserved', text: 'শব্দ অস্পষ্ট। আবার বলুন।', status: 'live' },
  { id: 'bn-sme-08', category: 'small_error', locale: 'bn', preset: 'all', text: 'ঠিক শুনতে পাইনি, ডাক্তার। আরেকবার বলুন।', status: 'live' },

  // English
  { id: 'en-sme-01', category: 'small_error', locale: 'en', preset: 'friendly', text: "Sorry, I didn't quite catch that. Could you repeat?", status: 'live' },
  { id: 'en-sme-02', category: 'small_error', locale: 'en', preset: 'friendly', text: 'Could you say that again, Doctor?', status: 'live' },
  { id: 'en-sme-03', category: 'small_error', locale: 'en', preset: 'friendly', text: 'I missed that. Please repeat.', status: 'live' },
  { id: 'en-sme-04', category: 'small_error', locale: 'en', preset: 'friendly', text: 'Audio was a bit unclear. Could you say it once more?', status: 'live' },
  { id: 'en-sme-05', category: 'small_error', locale: 'en', preset: 'reserved', text: 'Did not catch that. Please repeat.', status: 'live' },
  { id: 'en-sme-06', category: 'small_error', locale: 'en', preset: 'reserved', text: 'Unclear audio. Please repeat.', status: 'live' },
  { id: 'en-sme-07', category: 'small_error', locale: 'en', preset: 'reserved', text: 'Missed. Please say again.', status: 'live' },
  { id: 'en-sme-08', category: 'small_error', locale: 'en', preset: 'all', text: 'Could you please repeat that?', status: 'live' },

  // ==========================================
  // 9. BIG ERROR (Network / Exception) (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-bge-01', category: 'big_error', locale: 'bn', preset: 'friendly', text: 'একটু সমস্যা হয়েছে। আপনার লেখা সংরক্ষিত আছে, আবার চেষ্টা করুন।', status: 'live' },
  { id: 'bn-bge-02', category: 'big_error', locale: 'bn', preset: 'friendly', text: 'সংযোগ পেতে সমস্যা হচ্ছে। তবে আপনার তথ্য নিরাপদ আছে, কিছুক্ষণ পর চেষ্টা করুন।', status: 'live' },
  { id: 'bn-bge-03', category: 'big_error', locale: 'bn', preset: 'friendly', text: 'সিস্টেমে একটু জটিলতা দেখা দিয়েছে। তথ্য হারায়নি, আবার পাঠানো যাবে।', status: 'live' },
  { id: 'bn-bge-04', category: 'big_error', locale: 'bn', preset: 'friendly', text: 'একটু ত্রুটি হয়েছে। লেখাটি মুছবে না, আবার চেষ্টা করুন।', status: 'live' },
  { id: 'bn-bge-05', category: 'big_error', locale: 'bn', preset: 'reserved', text: 'সার্ভারে সাময়িক সমস্যা। লেখা সংরক্ষিত আছে। আবার চেষ্টা করুন।', status: 'live' },
  { id: 'bn-bge-06', category: 'big_error', locale: 'bn', preset: 'reserved', text: 'সংযোগ ব্যর্থ। খসড়া সংরক্ষিত আছে। পুনরায় চেষ্টা করুন।', status: 'live' },
  { id: 'bn-bge-07', category: 'big_error', locale: 'bn', preset: 'reserved', text: 'অনুরোধ সম্পন্ন হয়নি। খসড়া অক্ষত আছে।', status: 'live' },
  { id: 'bn-bge-08', category: 'big_error', locale: 'bn', preset: 'all', text: 'প্রক্রিয়াটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আরেকবার চেষ্টা করুন।', status: 'live' },

  // English
  { id: 'en-bge-01', category: 'big_error', locale: 'en', preset: 'friendly', text: 'Something went wrong. Your draft is safe; please try again.', status: 'live' },
  { id: 'en-bge-02', category: 'big_error', locale: 'en', preset: 'friendly', text: 'Connection issue. Your notes are preserved; please retry in a moment.', status: 'live' },
  { id: 'en-bge-03', category: 'big_error', locale: 'en', preset: 'friendly', text: 'Encountered a temporary issue. Your draft is intact; please retry.', status: 'live' },
  { id: 'en-bge-04', category: 'big_error', locale: 'en', preset: 'friendly', text: 'A momentary glitch occurred. Nothing was lost; please try again.', status: 'live' },
  { id: 'en-bge-05', category: 'big_error', locale: 'en', preset: 'reserved', text: 'Server error. Draft preserved. Please retry.', status: 'live' },
  { id: 'en-bge-06', category: 'big_error', locale: 'en', preset: 'reserved', text: 'Request failed. Notes saved. Retry when ready.', status: 'live' },
  { id: 'en-bge-07', category: 'big_error', locale: 'en', preset: 'reserved', text: 'Temporary issue. Draft safe. Please retry.', status: 'live' },
  { id: 'en-bge-08', category: 'big_error', locale: 'en', preset: 'all', text: 'Could not complete the action. Your draft is retained.', status: 'live' },

  // ==========================================
  // 10. NO EVIDENCE (Insufficient Evidence) (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-nev-01', category: 'no_evidence', locale: 'bn', preset: 'friendly', text: 'লাইব্রেরিতে এর উত্তর পাইনি, তাই অনুমান করছি না। এখানে আপনার ক্লিনিকাল বিবেচনাই মূল।', status: 'live' },
  { id: 'bn-nev-02', category: 'no_evidence', locale: 'bn', preset: 'friendly', text: 'এই বিষয়টি লাইব্রেরিতে এখনও নেই। অনুমান না করে সেটাই জানিয়ে রাখছি।', status: 'live' },
  { id: 'bn-nev-03', category: 'no_evidence', locale: 'bn', preset: 'friendly', text: 'লাইব্রেরির কোনো অংশে সরাসরি এর উত্তর নেই। আরেকটু তথ্য দিলে বা অন্যভাবে জিজ্ঞেস করলে আবার খুঁজে দেখব।', status: 'live' },
  { id: 'bn-nev-04', category: 'no_evidence', locale: 'bn', preset: 'friendly', text: 'লাইব্রেরিতে খুঁজেছি, কিন্তু এর উত্তর দেয় এমন কোনো অংশ পাইনি। আপনার ক্লিনিকাল বিবেচনার ওপর নির্ভর করুন।', status: 'live' },
  { id: 'bn-nev-05', category: 'no_evidence', locale: 'bn', preset: 'reserved', text: 'লাইব্রেরিতে এ বিষয়ে কিছু নেই।', status: 'live' },
  { id: 'bn-nev-06', category: 'no_evidence', locale: 'bn', preset: 'reserved', text: 'লাইব্রেরির কোনো অংশে এর উত্তর নেই।', status: 'live' },
  { id: 'bn-nev-07', category: 'no_evidence', locale: 'bn', preset: 'reserved', text: 'লাইব্রেরিতে এর যাচাইকৃত উত্তর নেই।', status: 'live' },
  { id: 'bn-nev-08', category: 'no_evidence', locale: 'bn', preset: 'all', text: 'লাইব্রেরিতে এর প্রমাণ পাইনি, তাই অনুমান করছি না। সিদ্ধান্ত আপনার।', status: 'live' },

  // English
  { id: 'en-nev-01', category: 'no_evidence', locale: 'en', preset: 'friendly', text: 'I couldn\'t find this in the library, so I won\'t guess. Your clinical judgement leads here.', status: 'live' },
  { id: 'en-nev-02', category: 'no_evidence', locale: 'en', preset: 'friendly', text: 'The library doesn\'t cover this yet. I\'d rather tell you that than guess.', status: 'live' },
  { id: 'en-nev-03', category: 'no_evidence', locale: 'en', preset: 'friendly', text: 'Nothing in the library answers this directly. If you add a detail or rephrase, I\'ll look again.', status: 'live' },
  { id: 'en-nev-04', category: 'no_evidence', locale: 'en', preset: 'friendly', text: 'I searched the library but found no passage that answers this. Please rely on your clinical judgement.', status: 'live' },
  { id: 'en-nev-05', category: 'no_evidence', locale: 'en', preset: 'reserved', text: 'Not covered by the library.', status: 'live' },
  { id: 'en-nev-06', category: 'no_evidence', locale: 'en', preset: 'reserved', text: 'No library passage answers this.', status: 'live' },
  { id: 'en-nev-07', category: 'no_evidence', locale: 'en', preset: 'reserved', text: 'The library has no verified answer for this.', status: 'live' },
  { id: 'en-nev-08', category: 'no_evidence', locale: 'en', preset: 'all', text: 'I found no library evidence for this, so I won\'t guess. The decision is yours.', status: 'live' },

  // ==========================================
  // 11. ALERT INTRO (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-alt-01', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'একটি জরুরি সতর্কতা:', status: 'live' },
  { id: 'bn-alt-02', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'জরুরি ক্লিনিকাল সতর্কতা:', status: 'live' },
  { id: 'bn-alt-03', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'সতর্কতা: জরুরি রেড ফ্ল্যাগ:', status: 'live' },
  { id: 'bn-alt-04', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'জরুরি সুরক্ষা সংকেত:', status: 'live' },
  { id: 'bn-alt-05', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'গুরুত্বপূর্ণ সতর্কতা:', status: 'live' },
  { id: 'bn-alt-06', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'মনোযোগ দিন: জরুরি সংকেত:', status: 'live' },
  { id: 'bn-alt-07', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'একটি নিরাপত্তা নোটিশ:', status: 'live' },
  { id: 'bn-alt-08', category: 'alert_intro', locale: 'bn', preset: 'all', text: 'জরুরি সুরক্ষা বিবেচনা:', status: 'live' },

  // English
  { id: 'en-alt-01', category: 'alert_intro', locale: 'en', preset: 'all', text: 'A critical safety alert:', status: 'live' },
  { id: 'en-alt-02', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Emergency clinical alert:', status: 'live' },
  { id: 'en-alt-03', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Important safety warning:', status: 'live' },
  { id: 'en-alt-04', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Red-flag safety alert:', status: 'live' },
  { id: 'en-alt-05', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Critical clinical notification:', status: 'live' },
  { id: 'en-alt-06', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Urgent attention required:', status: 'live' },
  { id: 'en-alt-07', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Immediate safety notice:', status: 'live' },
  { id: 'en-alt-08', category: 'alert_intro', locale: 'en', preset: 'all', text: 'Safety alert:', status: 'live' },

  // ==========================================
  // 12. DISAGREE RESPECTED (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-dis-01', category: 'disagree_respected', locale: 'bn', preset: 'friendly', text: 'ঠিক আছে, সিদ্ধান্ত আপনার। চাইলে প্রমাণ দেখিয়ে দিতে পারি।', status: 'live' },
  { id: 'bn-dis-02', category: 'disagree_respected', locale: 'bn', preset: 'friendly', text: 'জি, আপনিই অভিজ্ঞ চিকিৎসক, সিদ্ধান্ত আপনার।', status: 'live' },
  { id: 'bn-dis-03', category: 'disagree_respected', locale: 'bn', preset: 'friendly', text: 'বুঝেছি, আপনার ক্লিনিকাল সিদ্ধান্তই চূড়ান্ত।', status: 'live' },
  { id: 'bn-dis-04', category: 'disagree_respected', locale: 'bn', preset: 'friendly', text: 'সম্মান জানাচ্ছি। আপনার সিদ্ধান্ত মোতাবেক এগোচ্ছি।', status: 'live' },
  { id: 'bn-dis-05', category: 'disagree_respected', locale: 'bn', preset: 'reserved', text: 'ঠিক আছে, সিদ্ধান্ত আপনার।', status: 'live' },
  { id: 'bn-dis-06', category: 'disagree_respected', locale: 'bn', preset: 'reserved', text: 'আপনার রায় মান্য করছি।', status: 'live' },
  { id: 'bn-dis-07', category: 'disagree_respected', locale: 'bn', preset: 'reserved', text: 'আপনার সিদ্ধান্ত বহাল রাখা হলো।', status: 'live' },
  { id: 'bn-dis-08', category: 'disagree_respected', locale: 'bn', preset: 'all', text: 'অবশ্যই, আপনার বিচারবুদ্ধিই মুখ্য।', status: 'live' },

  // English
  { id: 'en-dis-01', category: 'disagree_respected', locale: 'en', preset: 'friendly', text: 'Understood, the decision is yours. I can show the proof if needed.', status: 'live' },
  { id: 'en-dis-02', category: 'disagree_respected', locale: 'en', preset: 'friendly', text: 'Understood, Doctor. Your clinical judgment is final.', status: 'live' },
  { id: 'en-dis-03', category: 'disagree_respected', locale: 'en', preset: 'friendly', text: 'Acknowledged. Proceeding according to your decision.', status: 'live' },
  { id: 'en-dis-04', category: 'disagree_respected', locale: 'en', preset: 'friendly', text: 'Respectfully noted. Your decision takes precedence.', status: 'live' },
  { id: 'en-dis-05', category: 'disagree_respected', locale: 'en', preset: 'reserved', text: 'Understood. Decision noted.', status: 'live' },
  { id: 'en-dis-06', category: 'disagree_respected', locale: 'en', preset: 'reserved', text: 'Your clinical judgment stands.', status: 'live' },
  { id: 'en-dis-07', category: 'disagree_respected', locale: 'en', preset: 'reserved', text: 'Proceeding as directed.', status: 'live' },
  { id: 'en-dis-08', category: 'disagree_respected', locale: 'en', preset: 'all', text: 'Certainly. Respecting your clinical choice.', status: 'live' },

  // ==========================================
  // 13. THANKS REPLY (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-thx-01', category: 'thanks_reply', locale: 'bn', preset: 'friendly', text: 'আপনাকেও ধন্যবাদ।', status: 'live' },
  { id: 'bn-thx-02', category: 'thanks_reply', locale: 'bn', preset: 'friendly', text: 'আপনাকে অনেক ধন্যবাদ, ডাক্তার।', status: 'live' },
  { id: 'bn-thx-03', category: 'thanks_reply', locale: 'bn', preset: 'friendly', text: 'স্বাগতম, ডাক্তার।', status: 'live' },
  { id: 'bn-thx-04', category: 'thanks_reply', locale: 'bn', preset: 'friendly', text: 'সাহায্য করতে পেরে ভালো লাগল।', status: 'live' },
  { id: 'bn-thx-05', category: 'thanks_reply', locale: 'bn', preset: 'reserved', text: 'ধন্যবাদ।', status: 'live' },
  { id: 'bn-thx-06', category: 'thanks_reply', locale: 'bn', preset: 'reserved', text: 'স্বাগতম।', status: 'live' },
  { id: 'bn-thx-07', category: 'thanks_reply', locale: 'bn', preset: 'reserved', text: 'আপনাকেও ধন্যবাদ।', status: 'live' },
  { id: 'bn-thx-08', category: 'thanks_reply', locale: 'bn', preset: 'all', text: 'সবসময় আপনার সেবায় প্রস্তুত।', status: 'live' },

  // English
  { id: 'en-thx-01', category: 'thanks_reply', locale: 'en', preset: 'friendly', text: 'You are welcome.', status: 'live' },
  { id: 'en-thx-02', category: 'thanks_reply', locale: 'en', preset: 'friendly', text: 'Glad to assist, Doctor.', status: 'live' },
  { id: 'en-thx-03', category: 'thanks_reply', locale: 'en', preset: 'friendly', text: 'You are very welcome.', status: 'live' },
  { id: 'en-thx-04', category: 'thanks_reply', locale: 'en', preset: 'friendly', text: 'Happy to help.', status: 'live' },
  { id: 'en-thx-05', category: 'thanks_reply', locale: 'en', preset: 'reserved', text: 'You are welcome.', status: 'live' },
  { id: 'en-thx-06', category: 'thanks_reply', locale: 'en', preset: 'reserved', text: 'Glad to help.', status: 'live' },
  { id: 'en-thx-07', category: 'thanks_reply', locale: 'en', preset: 'reserved', text: 'Anytime, Doctor.', status: 'live' },
  { id: 'en-thx-08', category: 'thanks_reply', locale: 'en', preset: 'all', text: 'Always here to assist.', status: 'live' },

  // ==========================================
  // 14. GOODBYE (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-by-01', category: 'goodbye', locale: 'bn', preset: 'friendly', text: 'ধন্যবাদ, {doctorTitle}। দরকার হলে আবার ডাকবেন।', status: 'live' },
  { id: 'bn-by-02', category: 'goodbye', locale: 'bn', preset: 'friendly', text: 'ভালো থাকবেন, {doctorTitle}। শুভকামনা।', status: 'live' },
  { id: 'bn-by-03', category: 'goodbye', locale: 'bn', preset: 'friendly', text: 'আজকের মতো বিদায়। প্রয়োজনে আবার ডাকুন।', status: 'live' },
  { id: 'bn-by-04', category: 'goodbye', locale: 'bn', preset: 'friendly', text: 'বিদায়, {doctorTitle}। সুস্থ থাকুন, নিরাপদে থাকুন।', status: 'live' },
  { id: 'bn-by-05', category: 'goodbye', locale: 'bn', preset: 'reserved', text: 'বিদায়, {doctorTitle}।', status: 'live' },
  { id: 'bn-by-06', category: 'goodbye', locale: 'bn', preset: 'reserved', text: 'বিদায়। প্রস্তুত থাকব।', status: 'live' },
  { id: 'bn-by-07', category: 'goodbye', locale: 'bn', preset: 'reserved', text: 'আজকের মতো শেষ।', status: 'live' },
  { id: 'bn-by-08', category: 'goodbye', locale: 'bn', preset: 'all', text: 'শুভ বিদায়। যেকোনো সময় পাশে আছি।', status: 'live' },

  // English
  { id: 'en-by-01', category: 'goodbye', locale: 'en', preset: 'friendly', text: 'Thank you, {doctorTitle}. Call on me whenever needed.', status: 'live' },
  { id: 'en-by-02', category: 'goodbye', locale: 'en', preset: 'friendly', text: 'Goodbye, {doctorTitle}. Have a great day.', status: 'live' },
  { id: 'en-by-03', category: 'goodbye', locale: 'en', preset: 'friendly', text: 'Signing off for now. Reach out anytime.', status: 'live' },
  { id: 'en-by-04', category: 'goodbye', locale: 'en', preset: 'friendly', text: 'Take care, {doctorTitle}. Stay safe.', status: 'live' },
  { id: 'en-by-05', category: 'goodbye', locale: 'en', preset: 'reserved', text: 'Goodbye, {doctorTitle}.', status: 'live' },
  { id: 'en-by-06', category: 'goodbye', locale: 'en', preset: 'reserved', text: 'Signing off.', status: 'live' },
  { id: 'en-by-07', category: 'goodbye', locale: 'en', preset: 'reserved', text: 'Session closed.', status: 'live' },
  { id: 'en-by-08', category: 'goodbye', locale: 'en', preset: 'all', text: 'Goodbye for now.', status: 'live' },

  // ==========================================
  // 15. WAITING LONG (> 6s latency) (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-wt-01', category: 'waiting_long', locale: 'bn', preset: 'friendly', text: 'আর একটু সময় লাগছে। অপেক্ষা করুন।', status: 'live' },
  { id: 'bn-wt-02', category: 'waiting_long', locale: 'bn', preset: 'friendly', text: 'লাইব্রেরি ঘেঁটে দেখছি, আরেকটু সময় দিন।', status: 'live' },
  { id: 'bn-wt-03', category: 'waiting_long', locale: 'bn', preset: 'friendly', text: 'তথ্য পর্যালোচনায় একটু সময় লাগছে। অনুগ্রহ করে ধৈর্য ধরুন।', status: 'live' },
  { id: 'bn-wt-04', category: 'waiting_long', locale: 'bn', preset: 'friendly', text: 'আরেকটু সময় নিচ্ছি। শিগগিরই জানাচ্ছি।', status: 'live' },
  { id: 'bn-wt-05', category: 'waiting_long', locale: 'bn', preset: 'reserved', text: 'প্রক্রিয়াকরণ চলছে। অপেক্ষা করুন।', status: 'live' },
  { id: 'bn-wt-06', category: 'waiting_long', locale: 'bn', preset: 'reserved', text: 'অনুসন্ধান চলছে। কয়েক সেকেন্ড সময় দিন।', status: 'live' },
  { id: 'bn-wt-07', category: 'waiting_long', locale: 'bn', preset: 'reserved', text: 'যাচাই প্রক্রিয়াধীন।', status: 'live' },
  { id: 'bn-wt-08', category: 'waiting_long', locale: 'bn', preset: 'all', text: 'গাইডলাইন মেলাতে আরেকটু সময় লাগছে।', status: 'live' },

  // English
  { id: 'en-wt-01', category: 'waiting_long', locale: 'en', preset: 'friendly', text: 'Taking a little longer than usual. Please bear with me.', status: 'live' },
  { id: 'en-wt-02', category: 'waiting_long', locale: 'en', preset: 'friendly', text: 'Still searching the library. One moment.', status: 'live' },
  { id: 'en-wt-03', category: 'waiting_long', locale: 'en', preset: 'friendly', text: 'Reviewing extended references. Thank you for waiting.', status: 'live' },
  { id: 'en-wt-04', category: 'waiting_long', locale: 'en', preset: 'friendly', text: 'Taking a few extra seconds to synthesize the evidence.', status: 'live' },
  { id: 'en-wt-05', category: 'waiting_long', locale: 'en', preset: 'reserved', text: 'Still processing. Please wait.', status: 'live' },
  { id: 'en-wt-06', category: 'waiting_long', locale: 'en', preset: 'reserved', text: 'Searching. One moment.', status: 'live' },
  { id: 'en-wt-07', category: 'waiting_long', locale: 'en', preset: 'reserved', text: 'Verification in progress.', status: 'live' },
  { id: 'en-wt-08', category: 'waiting_long', locale: 'en', preset: 'all', text: 'A few moments more, Doctor.', status: 'live' },

  // ==========================================
  // 16. LIMIT REACHED (>= 8 variants)
  // ==========================================
  // Bangla
  { id: 'bn-lim-01', category: 'limit_reached', locale: 'bn', preset: 'friendly', text: 'দৈনিক ব্যবহারের সীমা পূর্ণ হয়েছে।', status: 'live' },
  { id: 'bn-lim-02', category: 'limit_reached', locale: 'bn', preset: 'friendly', text: 'আজকের মতো অনুরোধের সীমা শেষ। কাল আবার ব্যবহার করতে পারবেন।', status: 'live' },
  { id: 'bn-lim-03', category: 'limit_reached', locale: 'bn', preset: 'friendly', text: 'আপনার দৈনিক কোটা শেষ হয়েছে। কাল নতুন কোটা শুরু হবে।', status: 'live' },
  { id: 'bn-lim-04', category: 'limit_reached', locale: 'bn', preset: 'friendly', text: 'আজকের ব্যবহারের সর্বোচ্চ সীমায় পৌঁছে গেছেন, ডাক্তার।', status: 'live' },
  { id: 'bn-lim-05', category: 'limit_reached', locale: 'bn', preset: 'reserved', text: 'দৈনিক সীমা পূর্ণ।', status: 'live' },
  { id: 'bn-lim-06', category: 'limit_reached', locale: 'bn', preset: 'reserved', text: 'আজকের কোটা শেষ।', status: 'live' },
  { id: 'bn-lim-07', category: 'limit_reached', locale: 'bn', preset: 'reserved', text: 'ব্যবহারের সীমা অতিক্রম করেছে।', status: 'live' },
  { id: 'bn-lim-08', category: 'limit_reached', locale: 'bn', preset: 'all', text: 'আজকের বরাদ্দকৃত কোটা পূর্ণ হয়েছে।', status: 'live' },

  // English
  { id: 'en-lim-01', category: 'limit_reached', locale: 'en', preset: 'friendly', text: 'Daily usage limit has been reached.', status: 'live' },
  { id: 'en-lim-02', category: 'limit_reached', locale: 'en', preset: 'friendly', text: 'Daily quota exhausted for today. It will reset tomorrow.', status: 'live' },
  { id: 'en-lim-03', category: 'limit_reached', locale: 'en', preset: 'friendly', text: 'You have reached your daily allowance for assistant requests.', status: 'live' },
  { id: 'en-lim-04', category: 'limit_reached', locale: 'en', preset: 'friendly', text: 'Usage limit reached for today, Doctor.', status: 'live' },
  { id: 'en-lim-05', category: 'limit_reached', locale: 'en', preset: 'reserved', text: 'Daily limit reached.', status: 'live' },
  { id: 'en-lim-06', category: 'limit_reached', locale: 'en', preset: 'reserved', text: 'Quota exhausted for today.', status: 'live' },
  { id: 'en-lim-07', category: 'limit_reached', locale: 'en', preset: 'reserved', text: 'Daily threshold reached.', status: 'live' },
  { id: 'en-lim-08', category: 'limit_reached', locale: 'en', preset: 'all', text: 'Daily request allocation reached.', status: 'live' },

  // ==========================================
  // 17. FIRST USE WELCOME (~20 sec audio intro) (>= 8 variants)
  // ==========================================
  // Bangla
  {
    id: 'bn-wlc-01',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'friendly',
    text: 'স্বাগতম, {doctorTitle}! আমি ডকমেট—আপনার মেডিকেল লাইব্রেরি সহকারী। অনুমোদিত গাইডলাইন থেকে তথ্য যাচাই এবং দ্রুত নোট নিতে আমি সাহায্য করতে পারি। মনে রাখবেন, চূড়ান্ত সিদ্ধান্ত সবসময় আপনার। অডিও কোথাও সংরক্ষণ হয় না। আজ কীভাবে সাহায্য করতে পারি?',
    status: 'live',
  },
  {
    id: 'bn-wlc-02',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'friendly',
    text: 'স্বাগতম! আমি ডকমেট এআই। যেকোনো চিকিৎসা প্রটোকল, ওষুধ ও ডিফারেনশিয়াল রোগ নির্ণয়ে লাইব্রেরি প্রমাণ দিয়ে আপনাকে সহায়তা করব। এটি শুধুমাত্র সিদ্ধান্ত সহায়তা, সিদ্ধান্ত আপনার। কথা বলে বা লিখে প্রশ্ন করতে পারেন।',
    status: 'live',
  },
  {
    id: 'bn-wlc-03',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'friendly',
    text: 'নমস্কার, {doctorTitle}। আমি ডকমেট। আপনার সময় বাঁচাতে গাইডলাইন রেফারেন্স ও ড্রাফট নোট তৈরিতে সাহায্য করাই আমার কাজ। কোনো অডিও বাইরে পাঠানো হয় না। শুরু করতে পারেন।',
    status: 'live',
  },
  {
    id: 'bn-wlc-04',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'friendly',
    text: 'স্বাগতম, ডাক্তার। আমি ডকমেট সহকারী। অভ্যন্তরীণ বিশ্বস্ত মেডিকেল গাইডলাইনের ওপর ভিত্তি করে কাজ করি। কোনো মনগড়া তথ্য দেই না। সরাসরি বলুন কীভাবে সহায়তা করব।',
    status: 'live',
  },
  {
    id: 'bn-wlc-05',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'reserved',
    text: 'স্বাগতম, {doctorTitle}। আমি ডকমেট—মেডিকেল লাইব্রেরি সহকারী। ড্রাফট ক্লিনিকাল নোট ও গাইডলাইন তথ্য যাচাই করতে প্রস্তুত। চূড়ান্ত কর্তৃত্ব আপনার। শুরু করতে পারেন।',
    status: 'live',
  },
  {
    id: 'bn-wlc-06',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'reserved',
    text: 'স্বাগতম। ডকমেট সহকারী সক্রিয়। বদ্ধ লাইব্রেরি থেকে যাচাইকৃত রেফারেন্স সহায়তা প্রদান করি। গোপনীয়তা সংরক্ষিত। বলুন।',
    status: 'live',
  },
  {
    id: 'bn-wlc-07',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'reserved',
    text: 'স্বাগতম, {doctorTitle}। ডকমেট প্রস্তুত। ক্লিনিকাল সিদ্ধান্ত সহায়তা এবং নথিভুক্তকরণে সহায়তা করব। নির্দেশ দিন।',
    status: 'live',
  },
  {
    id: 'bn-wlc-08',
    category: 'first_use_welcome',
    locale: 'bn',
    preset: 'all',
    text: 'স্বাগতম, {doctorTitle}। আমি ডকমেট। যাচাইকৃত মেডিকেল লাইব্রেরি থেকে সহায়তা করতে প্রস্তুত। অডিও সংরক্ষিত হয় না। শুরু করতে পারেন।',
    status: 'live',
  },

  // English
  {
    id: 'en-wlc-01',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'friendly',
    text: 'Welcome, {doctorTitle}! I am DocMate, your medical library assistant. I can help verify guideline citations, draft observations, and summarize clinical evidence. Remember, the final decision is always yours. Audio is never stored. How can I help today?',
    status: 'live',
  },
  {
    id: 'en-wlc-02',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'friendly',
    text: 'Welcome! I am DocMate AI. I assist by cross-referencing approved medical guidelines and drafting case notes. Clinical decision support only; professional judgement remains yours. Feel free to speak or type.',
    status: 'live',
  },
  {
    id: 'en-wlc-03',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'friendly',
    text: 'Hello, {doctorTitle}. I am DocMate. Designed to save your time by surfacing verified medical evidence and structuring patient findings. Your voice data remains private. Ready when you are.',
    status: 'live',
  },
  {
    id: 'en-wlc-04',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'friendly',
    text: 'Welcome, Doctor. I am DocMate, your clinical decision support partner. Every recommendation cites our closed internal library. You can dictate observations or ask guideline queries directly.',
    status: 'live',
  },
  {
    id: 'en-wlc-05',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'reserved',
    text: 'Welcome, {doctorTitle}. DocMate assistant online. Clinical evidence retrieval and note drafting ready. The final decision is yours. Ready for input.',
    status: 'live',
  },
  {
    id: 'en-wlc-06',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'reserved',
    text: 'Welcome. DocMate clinical assistant active. Verifies guideline evidence from closed internal library. Privacy preserved. Ready.',
    status: 'live',
  },
  {
    id: 'en-wlc-07',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'reserved',
    text: 'Welcome, {doctorTitle}. DocMate initialized. Decision support and documentation assistant ready. Standing by for instructions.',
    status: 'live',
  },
  {
    id: 'en-wlc-08',
    category: 'first_use_welcome',
    locale: 'en',
    preset: 'all',
    text: 'Welcome, {doctorTitle}. I am DocMate. Ready to assist with verified medical guideline references. Audio is never stored. Ready for input.',
    status: 'live',
  },
];
