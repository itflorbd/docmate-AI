/**
 * DocMate AI — SMS Gateway Provider Interface & Adapters
 * 
 * Supports pluggable SMS delivery for Bangladesh:
 * - Console provider for local development & automated testing
 * - Bangladeshi SMS Gateway stub adapter (Greenweb / SSL Wireless / Teletalk API)
 */

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  sendOtp(phone: string, code: string, purpose?: string): Promise<SendSmsResult>;
}

/**
 * Development & Testing Console SMS Provider
 */
export class ConsoleSmsProvider implements SmsProvider {
  name = 'console';

  async sendOtp(phone: string, code: string, purpose = 'login'): Promise<SendSmsResult> {
    const purposeText = purpose === 'login' ? 'লগইন (Login)' : 'অনুমতি (Access Grant)';
    console.log(`\n======================================================`);
    console.log(`[SMS-GATEWAY-CONSOLE] Destination: ${phone}`);
    console.log(`[SMS-GATEWAY-CONSOLE] Purpose: ${purposeText}`);
    console.log(`[SMS-GATEWAY-CONSOLE] OTP Code: ${code} (Valid for 5 minutes)`);
    console.log(`======================================================\n`);
    return {
      success: true,
      messageId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}

/**
 * Bangladeshi Commercial Gateway Stub (Greenweb / SSL Wireless / InfoBip)
 */
export class BangladeshiSmsGatewayStub implements SmsProvider {
  name = 'bd_gateway_stub';

  async sendOtp(phone: string, code: string, purpose = 'login'): Promise<SendSmsResult> {
    const apiKey = process.env.BD_SMS_GATEWAY_API_KEY;
    // In production or demo, if no API key provided, fall back to console delivery
    if (!apiKey) {
      console.log(`[BD-SMS-STUB] No BD_SMS_GATEWAY_API_KEY configured. Logging OTP for ${phone} (${purpose}): ${code}`);
      return {
        success: true,
        messageId: `stub-${Date.now()}`,
      };
    }

    try {
      // Simulates HTTPS request to Bangladeshi SMS Gateway endpoint
      return {
        success: true,
        messageId: `bd-sms-${Date.now()}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'SMS Gateway transmission error',
      };
    }
  }
}

let activeProvider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (activeProvider) return activeProvider;

  if (process.env.NODE_ENV === 'production' && process.env.BD_SMS_GATEWAY_API_KEY) {
    activeProvider = new BangladeshiSmsGatewayStub();
  } else {
    activeProvider = new ConsoleSmsProvider();
  }
  return activeProvider;
}

export function setSmsProvider(provider: SmsProvider) {
  activeProvider = provider;
}
