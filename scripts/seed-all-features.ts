import { db } from '../src/db';
import { features, roleFeatures } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { FeatureKey, UserRole } from '../src/types';

interface FeatureDefinition {
  key: FeatureKey;
  description: string;
  category: string;
  roles: Record<UserRole, { enabled: boolean; dailyLimit?: number | null }>;
}

export const ALL_FEATURES: FeatureDefinition[] = [
  // 1. Clinical & Practice Features
  {
    key: 'patients.manage',
    description: 'Create, update, and manage patient profiles and visits',
    category: 'clinical',
    roles: {
      super_admin: { enabled: false }, // Break-glass only
      doctor: { enabled: true },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'ai.analyze',
    description: 'AI-assisted differential diagnosis and missing evidence questions',
    category: 'clinical',
    roles: {
      super_admin: { enabled: false },
      doctor: { enabled: true, dailyLimit: 100 },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'ai.treatment',
    description: 'AI-guided clinical treatment and guideline-backed medicine recommendations',
    category: 'clinical',
    roles: {
      super_admin: { enabled: false },
      doctor: { enabled: true, dailyLimit: 100 },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'prescription.create',
    description: 'Generate, finalize, print, and export patient prescriptions',
    category: 'clinical',
    roles: {
      super_admin: { enabled: false },
      doctor: { enabled: true },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'patient.search',
    description: 'Search patient accounts and profiles by phone number with rate-limiting and audit logging',
    category: 'clinical',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'patient.create',
    description: 'Create new patient accounts and dependent profiles with duplicate detection',
    category: 'clinical',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'history.request',
    description: 'Request in-clinic patient consent via OTP for cross-doctor clinical history',
    category: 'clinical',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'history.view',
    description: 'View full cross-doctor chronological timeline of patient encounters, prescriptions, and lab tests',
    category: 'clinical',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },

  // 2. Library & Guideline Features
  {
    key: 'library.ask',
    description: 'Ask questions and receive cited answers over the medical library',
    category: 'library',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true, dailyLimit: 200 },
      student: { enabled: true, dailyLimit: 100 },
      researcher: { enabled: true, dailyLimit: 300 },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'library.browse',
    description: 'Browse textbooks, clinical guidelines, and research papers',
    category: 'library',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'library.manage',
    description: 'Add, review, approve, publish, and retire medical sources',
    category: 'library',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },

  // 3. Medicine & Formulary Features
  {
    key: 'medicine.search',
    description: 'Search generic drugs and Bangladeshi brand formulations',
    category: 'medicine',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'medicine.interactions',
    description: 'Multi-drug interaction and contraindication screening',
    category: 'medicine',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'medicine.manage',
    description: 'Manage medicine catalog, brands, dose rules, and DGDA status',
    category: 'medicine',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'medicine.notices',
    description: 'Publish and receive regulatory drug safety notices and recalls',
    category: 'medicine',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: true }, // own prescribed drugs
      medicine_controller: { enabled: true },
    },
  },

  // 4. Academic & Research Features
  {
    key: 'study.tools',
    description: 'Practice virtual clinical cases, flashcards, chapter quizzes, notes',
    category: 'study',
    roles: {
      super_admin: { enabled: false },
      doctor: { enabled: false },
      student: { enabled: true },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'research.tools',
    description: 'Compare guideline evidence, manage collections, export citations',
    category: 'research',
    roles: {
      super_admin: { enabled: false },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: true },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },

  // 5. Patient Portal Features
  {
    key: 'patient.portal',
    description: 'Patient self-service portal: view shared prescriptions, schedule, upload reports',
    category: 'patient',
    roles: {
      super_admin: { enabled: false },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'portal.profiles',
    description: 'Switch between personal and dependent family member profiles in the patient portal',
    category: 'patient',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'portal.prescriptions',
    description: 'View and download active and historical prescriptions in the patient portal',
    category: 'patient',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'portal.reports',
    description: 'Upload diagnostic lab reports and toggle sharing with consulting doctors',
    category: 'patient',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'portal.medicine_schedule',
    description: 'Track daily morning, noon, and night medication doses and log intake status',
    category: 'patient',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'portal.permissions',
    description: 'Inspect active doctor access grants and revoke consent at any time',
    category: 'patient',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'portal.access_log',
    description: 'Review tamper-evident audit logs of which doctors and staff accessed clinical records',
    category: 'patient',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: true },
      medicine_controller: { enabled: false },
    },
  },

  // 6. Feedback Features
  {
    key: 'feedback.send',
    description: 'Submit feedback and report clinical errors or data gaps',
    category: 'feedback',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true },
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: true },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'feedback.review',
    description: 'Review submitted clinical and drug feedback',
    category: 'feedback',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },

  // 7. Administration & Governance
  {
    key: 'users.manage',
    description: 'Manage users, approvals, verifications, suspensions, sessions',
    category: 'admin',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'access.manage',
    description: 'Configure role features, user overrides, and access matrices',
    category: 'admin',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'plans.billing',
    description: 'Manage subscription plans, manual activations, payment gateways',
    category: 'admin',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true }, // view only
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'ai.settings',
    description: 'Configure AI models, chunk parameters, prompt versions, kill switches',
    category: 'admin',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: true }, // view only
      student: { enabled: true },
      researcher: { enabled: true },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
  {
    key: 'audit.read',
    description: 'Inspect tamper-evident cryptographic audit logs',
    category: 'admin',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: true },
    },
  },
  {
    key: 'system.manage',
    description: 'System health, backups, announcements, and maintenance mode',
    category: 'admin',
    roles: {
      super_admin: { enabled: true },
      doctor: { enabled: false },
      student: { enabled: false },
      researcher: { enabled: false },
      patient: { enabled: false },
      medicine_controller: { enabled: false },
    },
  },
];

export async function seedAllFeatures() {
  console.log(`Seeding all ${ALL_FEATURES.length} feature keys and full role matrix...`);

  for (const feat of ALL_FEATURES) {
    // 1. Upsert Feature Key
    await db
      .insert(features)
      .values({
        key: feat.key,
        category: feat.category,
        description: feat.description,
      })
      .onConflictDoUpdate({
        target: features.key,
        set: {
          category: feat.category,
          description: feat.description,
        },
      });

    // 2. Upsert Role Feature Matrix
    for (const [role, config] of Object.entries(feat.roles)) {
      const [existing] = await db
        .select()
        .from(roleFeatures)
        .where(
          and(
            eq(roleFeatures.role, role),
            eq(roleFeatures.featureKey, feat.key)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(roleFeatures)
          .set({
            enabled: config.enabled,
            dailyLimit: config.dailyLimit ?? null,
            updatedAt: new Date(),
          })
          .where(eq(roleFeatures.id, existing.id));
      } else {
        await db.insert(roleFeatures).values({
          role: role as UserRole,
          featureKey: feat.key,
          enabled: config.enabled,
          dailyLimit: config.dailyLimit ?? null,
        });
      }
    }
  }

  console.log(`✓ Successfully configured all ${ALL_FEATURES.length} features across all 6 roles (${ALL_FEATURES.length * 6} role-feature rows)!`);
}

// Allow direct execution
if (process.argv[1]?.endsWith('seed-all-features.ts')) {
  seedAllFeatures()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error seeding features:', err);
      process.exit(1);
    });
}
