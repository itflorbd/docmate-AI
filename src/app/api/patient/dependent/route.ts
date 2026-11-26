import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientProfiles, profileHealthSummary } from '@/db/schema';
import { requirePatientScope } from '@/lib/patient-scope';
import { encryptPatientPii } from '@/lib/encryption';

const dependentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  relation: z.enum(['child', 'spouse', 'parent', 'sibling', 'other']),
  age: z.coerce.number().int().min(0).max(130),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.string().max(10).optional(),
});

export async function POST(req: Request) {
  try {
    const scope = await requirePatientScope();
    if (scope instanceof NextResponse) return scope;
    const { user, account } = scope;

    const parsed = dependentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { name, relation, age, gender, bloodGroup } = parsed.data;

    if (!name || !name.trim() || !age || !gender || !relation) {
      return NextResponse.json(
        { error: 'নাম, বয়স, লিঙ্গ ও সম্পর্ক প্রদান আবশ্যক (Name, age, gender, and relation are required)' },
        { status: 400 }
      );
    }


    // Insert new dependent profile
    const [newProfile] = await db
      .insert(patientProfiles)
      .values({
        accountId: account.id,
        relation,
        name: name.trim(),
        nameEncrypted: encryptPatientPii(name.trim()),
        age: Number(age),
        gender,
        sex: gender,
        bloodGroup: bloodGroup || null,
        createdBy: user.id,
        claimed: true,
      })
      .returning();

    // Create initial health summary version 1
    await db.insert(profileHealthSummary).values({
      profileId: newProfile.id,
      version: 1,
      allergies: [],
      chronicConditions: [],
      currentMedicines: [],
      bloodGroup: bloodGroup || null,
      updatedBy: user.id,
      changeReason: 'Profile created by patient in patient portal',
    });

    return NextResponse.json({
      success: true,
      message: 'পরিবারের সদস্যের প্রোফাইল সফলভাবে তৈরি হয়েছে (Family profile added successfully)',
      profile: {
        id: newProfile.id,
        name: newProfile.name,
        relation: newProfile.relation,
        age: newProfile.age,
        gender: newProfile.gender,
        bloodGroup: newProfile.bloodGroup,
        claimed: newProfile.claimed,
      },
    });
  } catch (error) {
    console.error('Add dependent profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
