// Lemon Squeezy license validation for Arcadia Hub
// Validates license keys against the Lemon Squeezy API

export interface LicenseStatus {
	valid: boolean;
	instanceId?: string;
	customerEmail?: string;
	expiresAt?: string;
	lastChecked: number;
}

export const LICENSE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function validateLicense(licenseKey: string, instanceName = 'obsidian'): Promise<LicenseStatus> {
	try {
		const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({ license_key: licenseKey, instance_name: instanceName }),
		});
		const data = await response.json();
		if (data.valid) {
			return {
				valid: true,
				instanceId: data.instance?.id,
				customerEmail: data.meta?.customer_email,
				expiresAt: data.license_key?.expires_at,
				lastChecked: Date.now(),
			};
		}
		return { valid: false, lastChecked: Date.now() };
	} catch {
		return { valid: false, lastChecked: Date.now() };
	}
}

export function isCacheValid(status: LicenseStatus): boolean {
	return Date.now() - status.lastChecked < LICENSE_CACHE_DURATION;
}
