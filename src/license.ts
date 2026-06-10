// Lemon Squeezy license validation for Arcadia Hub
// Validates license keys against the Lemon Squeezy public licensing API

import { requestUrl } from 'obsidian';

export interface LicenseStatus {
	valid: boolean;
	instanceId?: string;
	customerEmail?: string;
	expiresAt?: string;
	lastChecked: number;
}

export interface LicenseValidationResult {
	/** Validation outcome, or null when the server could not be reached. */
	status: LicenseStatus | null;
	/** True when the check failed for network reasons rather than an invalid key. */
	offline: boolean;
}

/** Revalidate a cached license at most once per day. */
export const LICENSE_CACHE_DURATION = 24 * 60 * 60 * 1000;

/** Keep premium features active for up to 14 days when the license server is unreachable. */
export const OFFLINE_GRACE_PERIOD = 14 * 24 * 60 * 60 * 1000;

interface LemonSqueezyValidateResponse {
	valid?: boolean;
	instance?: { id?: string } | null;
	meta?: { customer_email?: string } | null;
	license_key?: { expires_at?: string | null } | null;
}

export async function validateLicense(licenseKey: string, instanceName = 'obsidian'): Promise<LicenseValidationResult> {
	let data: LemonSqueezyValidateResponse | null = null;
	try {
		const response = await requestUrl({
			url: 'https://api.lemonsqueezy.com/v1/licenses/validate',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({ license_key: licenseKey, instance_name: instanceName }),
			throw: false,
		});

		// Server outages and throttling do not mean the key is invalid; treat them
		// as offline so a cached license is never revoked by a server problem.
		if (response.status === 429 || response.status >= 500) {
			return { status: null, offline: true };
		}

		try {
			data = response.json as LemonSqueezyValidateResponse;
		} catch {
			data = null;
		}
	} catch {
		// Network failure: the caller decides how to handle the offline state.
		return { status: null, offline: true };
	}

	if (data && data.valid) {
		return {
			status: {
				valid: true,
				instanceId: data.instance?.id,
				customerEmail: data.meta?.customer_email,
				expiresAt: data.license_key?.expires_at ?? undefined,
				lastChecked: Date.now(),
			},
			offline: false,
		};
	}
	return { status: { valid: false, lastChecked: Date.now() }, offline: false };
}

export function isCacheValid(status: LicenseStatus): boolean {
	return Date.now() - status.lastChecked < LICENSE_CACHE_DURATION;
}

export function isWithinOfflineGrace(status: LicenseStatus): boolean {
	return status.valid && Date.now() - status.lastChecked < OFFLINE_GRACE_PERIOD;
}
