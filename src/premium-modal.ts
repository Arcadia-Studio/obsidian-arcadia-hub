import { App, Modal, Notice, Setting } from 'obsidian';
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

		let licenseKey = this.plugin.settings.licenseKey;

		new Setting(contentEl)
			.setName('License key')
			.setDesc('Enter your license key')
			.addText(text => {
				this.textInputEl = text.inputEl;
				text
					.setPlaceholder('Xxxx-xxxx-xxxx-xxxx')
					.setValue(licenseKey)
					.onChange((value) => {
						licenseKey = value.trim();
					});
			});

		const feedbackEl = contentEl.createEl('p', {
			cls: 'setting-item-description',
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
				.setButtonText('Activate')
				.onClick(() => {
					if (!licenseKey) {
						feedbackEl.setText('Enter a license key first.');
						this.textInputEl?.focus();
						return;
					}
					btn.setButtonText('Checking...').setDisabled(true);
					void validateLicense(licenseKey).then(async (result) => {
						btn.setButtonText('Activate').setDisabled(false);
						if (result.offline) {
							feedbackEl.setText('Could not reach the license server. Check your connection and try again.');
							return;
						}
						if (result.status?.valid) {
							this.plugin.settings.licenseKey = licenseKey;
							this.plugin.settings.licenseStatus = result.status;
							this.plugin.settings.isPro = true;
							await this.plugin.saveSettings();
							new Notice('Premium features activated.');
							this.close();
						} else {
							feedbackEl.setText('License key is invalid or expired. Check your key and try again.');
						}
					});
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
