import { db } from '../src/db';
import { features, roleFeatures } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { UserRole } from '../src/types';

const NEW_FEATURES = [
  {
    key: 'patient.search',
    category: 'clinical',
    description: 'Search patient accounts and profiles by phone number with rate-limiting and audit logging',
    roles: { super_admin: true, doctor: true, patient: false, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'patient.create',
    category: 'clinical',
    description: 'Create new patient accounts and dependent profiles with duplicate detection',
    roles: { super_admin: true, doctor: true, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'history.request',
    category: 'clinical',
    description: 'Request in-clinic patient consent via OTP for cross-doctor clinical history',
    roles: { super_admin: true, doctor: true, patient: false, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'history.view',
    category: 'clinical',
    description: 'View full cross-doctor chronological timeline of patient encounters, prescriptions, and lab tests',
    roles: { super_admin: true, doctor: true, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'portal.profiles',
    category: 'patient',
    description: 'Switch between personal and dependent family member profiles in the patient portal',
    roles: { super_admin: true, doctor: false, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'portal.prescriptions',
    category: 'patient',
    description: 'View and download active and historical prescriptions in the patient portal',
    roles: { super_admin: true, doctor: false, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'portal.reports',
    category: 'patient',
    description: 'Upload diagnostic lab reports and toggle sharing with consulting doctors',
    roles: { super_admin: true, doctor: false, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'portal.medicine_schedule',
    category: 'patient',
    description: 'Track daily morning, noon, and night medication doses and log intake status',
    roles: { super_admin: true, doctor: false, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'portal.permissions',
    category: 'patient',
    description: 'Inspect active doctor access grants and revoke consent at any time',
    roles: { super_admin: true, doctor: false, patient: true, student: false, researcher: false, medicine_controller: false },
  },
  {
    key: 'portal.access_log',
    category: 'patient',
    description: 'Review tamper-evident audit logs of which doctors and staff accessed clinical records',
    roles: { super_admin: true, doctor: false, patient: true, student: false, researcher: false, medicine_controller: false },
  },
];

async function seed() {
  console.log('Seeding 10 Phase 5 Patient-Centred Feature Keys & Role Matrix...');

  for (const feat of NEW_FEATURES) {
    // 1. Insert or update feature key
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

    // 2. Configure defaults across all 6 roles
    for (const [role, enabled] of Object.entries(feat.roles)) {
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
          .set({ enabled, updatedAt: new Date() })
          .where(eq(roleFeatures.id, existing.id));
      } else {
        await db.insert(roleFeatures).values({
          role: role as UserRole,
          featureKey: feat.key,
          enabled,
        });
      }
    }
  }

  console.log('✓ Successfully seeded all 10 feature keys and role matrix mappings!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Feature seeding failed:', err);
  process.exit(1);
});
