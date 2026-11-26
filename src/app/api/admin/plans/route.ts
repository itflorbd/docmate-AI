import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export interface PlanTier {
  id: string;
  nameBn: string;
  nameEn: string;
  priceBdt: number;
  interval: 'month' | 'year';
  dailyLimit: number;
  features: string[];
  isPopular?: boolean;
}

export interface PaymentGatewayStub {
  id: 'bkash' | 'nagad' | 'sslcommerz';
  name: string;
  enabled: boolean;
  sandboxMode: boolean;
  merchantNumber: string;
}

const DEFAULT_PLANS: PlanTier[] = [
  {
    id: 'free_trial',
    nameBn: 'ফ্রি ট্রায়াল (১৪ দিন)',
    nameEn: 'Free Trial (14 Days)',
    priceBdt: 0,
    interval: 'month',
    dailyLimit: 10,
    features: ['১০টি কেস/দিন', 'মেডিকেল লাইব্রেরি অ্যাক্সেস', 'ওষুধের তথ্য সার্চ'],
  },
  {
    id: 'solo_doctor',
    nameBn: 'একক চিকিৎসক (Solo Doctor)',
    nameEn: 'Solo Physician Plan',
    priceBdt: 1500,
    interval: 'month',
    dailyLimit: 60,
    features: ['৬০টি কেস/দিন', 'বাংলা প্রেসক্রিপশন প্রিন্ট', 'ড্রাগ ইন্টারঅ্যাকশন চেকার', 'অগ্রাধিকার সাপোর্ট'],
    isPopular: true,
  },
  {
    id: 'clinic_team',
    nameBn: 'ক্লিনিক টিম (Clinic Team)',
    nameEn: 'Clinic & Hospital Team',
    priceBdt: 4500,
    interval: 'month',
    dailyLimit: 300,
    features: ['আনলিমিটেড রোগী কেস', '৫ জন চিকিৎসকের টিম অ্যাক্সেস', 'কাস্টম হাসপাতাল প্যাড ও প্রেসক্রিপশন', '২৪/৭ ফোন সাপোর্ট'],
  },
];

const DEFAULT_GATEWAYS: PaymentGatewayStub[] = [
  {
    id: 'bkash',
    name: 'bKash Merchant Payment (PGW)',
    enabled: true,
    sandboxMode: true,
    merchantNumber: '01700000000',
  },
  {
    id: 'nagad',
    name: 'Nagad Direct Pay',
    enabled: true,
    sandboxMode: true,
    merchantNumber: '01800000000',
  },
  {
    id: 'sslcommerz',
    name: 'SSLCommerz Gateway (Cards & NetBanking)',
    enabled: true,
    sandboxMode: true,
    merchantNumber: 'docmatetest',
  },
];

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [plansSetting, gatewaysSetting] = await Promise.all([
      db.select().from(systemSettings).where(eq(systemSettings.key, 'billing:plans')).limit(1),
      db.select().from(systemSettings).where(eq(systemSettings.key, 'billing:gateways')).limit(1),
    ]);

    const plans = (plansSetting[0]?.value as PlanTier[]) || DEFAULT_PLANS;
    const gateways = (gatewaysSetting[0]?.value as PaymentGatewayStub[]) || DEFAULT_GATEWAYS;

    return NextResponse.json({ plans, gateways });
  } catch (error) {
    console.error('[admin/plans] Failed to fetch plans:', error);
    return NextResponse.json({ error: 'Failed to retrieve plans' }, { status: 500 });
  }
}

const planActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('toggle_gateway'),
    gatewayId: z.enum(['bkash', 'nagad', 'sslcommerz']),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal('update_plan'),
    planId: z.string(),
    priceBdt: z.number().min(0),
    dailyLimit: z.number().min(1),
  }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = planActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    if (data.action === 'toggle_gateway') {
      const [gatewaysSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'billing:gateways'))
        .limit(1);

      const gateways = (gatewaysSetting?.value as PaymentGatewayStub[]) || [...DEFAULT_GATEWAYS];
      const target = gateways.find((g) => g.id === data.gatewayId);
      if (target) {
        target.enabled = data.enabled;
      }

      await db
        .insert(systemSettings)
        .values({
          key: 'billing:gateways',
          value: gateways,
          updatedBy: auth.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: gateways, updatedBy: auth.user.id, updatedAt: new Date() },
        });

      await recordAuditLog({
        userId: auth.user.id,
        event: 'PAYMENT_GATEWAY_TOGGLED',
        payload: {
          gatewayId: data.gatewayId,
          enabled: data.enabled,
        },
      });

      return NextResponse.json({ success: true, gateways });
    }

    if (data.action === 'update_plan') {
      const [plansSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'billing:plans'))
        .limit(1);

      const plans = (plansSetting?.value as PlanTier[]) || [...DEFAULT_PLANS];
      const target = plans.find((p) => p.id === data.planId);
      if (target) {
        target.priceBdt = data.priceBdt;
        target.dailyLimit = data.dailyLimit;
      }

      await db
        .insert(systemSettings)
        .values({
          key: 'billing:plans',
          value: plans,
          updatedBy: auth.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: plans, updatedBy: auth.user.id, updatedAt: new Date() },
        });

      await recordAuditLog({
        userId: auth.user.id,
        event: 'BILLING_PLAN_UPDATED',
        payload: {
          planId: data.planId,
          priceBdt: data.priceBdt,
          dailyLimit: data.dailyLimit,
        },
      });

      return NextResponse.json({ success: true, plans });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[admin/plans] Action failed:', error);
    return NextResponse.json({ error: 'Failed to update billing settings' }, { status: 500 });
  }
}
