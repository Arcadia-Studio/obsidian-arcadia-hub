import { App, Modal, Setting } from 'obsidian';
import { validateLicense, LicenseStatus } from './license';

interface PremiumPlugin {
	settings: {
		licenseKey: string;
		licenseStatus: LicenseStatus | null;
		isPro: boolean;
	};
	saveSettings(): Promise<void>;
}

export class PremiumModal extends Modal {
	private plugin: PremiumPlugin;
	private featureName: string;
	private textInputEl: HTMLInputElement | null = null;

	constructor(app: App, plugin: PremiumPlugin, featureName: string) {
		super(app);
		this.plugin = plugin;
		this.featureName = featureName;
	}

	onOpen(): void {
		const { contentEl } = this;
		new Setting(contentEl).setName('Premium feature').setHeading();
		contentEl.createEl('p', {
			text: `"${this.featureName}" is a premium feature.`,
		});
		contentEl.createEl('p', {
			text: 'Purchase a license to unlock all premium features, or enter your existing license key below.',
			cls: 'setting-item-description',
		});

		new Setting(contentEl)
			.setName('License key')
			.setDesc('Enter your license key from Lemon Squeezy')
			.addText(text => {
				this.textInputEl = text.inputEl;
				text
					.setPlaceholder('XXXX-XXXX-XXXX-XXXX')
					.onChange((value) => {
						if (value.trim().length > 10) {
							void validateLicense(value.trim()).then((status) => {
								if (status.valid) {
									this.plugin.settings.licenseKey = value.trim();
									this.plugin.settings.licenseStatus = status;
									this.plugin.settings.isPro = true;
									void this.plugin.saveSettings();
									this.close();
								}
							});
						}
					});
			});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Get premium')
				.setCta()
				.onClick(() => {
					window.open('https://arcadia-studio.lemonsqueezy.com', '_blank');
				})
			)
			.addButton(btn => btn
				.setButtonText('I have a license key')
				.onClick(() => {
					if (this.textInputEl) {
						this.textInputEl.focus();
					}
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
