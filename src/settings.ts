import { App, PluginSettingTab, Setting } from "obsidian";
import type ArcadiaHubPlugin from "./main";
import { validateLicense } from "./license";

export class ArcadiaHubSettingTab extends PluginSettingTab {
	plugin: ArcadiaHubPlugin;

	constructor(app: App, plugin: ArcadiaHubPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- GitHub Section ---
		new Setting(containerEl).setName('GitHub integration').setHeading();

		new Setting(containerEl)
			.setName("Personal access token")
			.setDesc("GitHub token with repo scope. Stored locally in this vault's plugin settings.")
			.addText((text) => {
				text
					.setPlaceholder("ghp_xxxxxxxxxxxxxxxxxxxx")
					.setValue(this.plugin.settings.githubToken)
					.onChange((value) => {
						this.plugin.settings.githubToken = value.trim();
						void this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
				text.inputEl.setAttribute("autocomplete", "off");
			});

		new Setting(containerEl)
			.setName("Default repository")
			.setDesc("Format: owner/repo (e.g. octocat/hello-world)")
			.addText((text) =>
				text
					.setPlaceholder("Owner/repo")
					.setValue(this.plugin.settings.defaultRepo)
					.onChange((value) => {
						this.plugin.settings.defaultRepo = value.trim();
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show closed issues")
			.setDesc("Include closed issues in the issues list")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showClosedIssues)
					.onChange((value) => {
						this.plugin.settings.showClosedIssues = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Issues per page")
			.setDesc("Number of issues to load per page (1-100)")
			.addText((text) =>
				text
					.setPlaceholder("25")
					.setValue(String(this.plugin.settings.issuesPerPage))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 100) {
							this.plugin.settings.issuesPerPage = num;
							void this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Auto-refresh interval")
			.setDesc("Minutes between automatic refreshes. Set to 0 for manual refresh only.")
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(String(this.plugin.settings.autoRefreshMinutes))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.autoRefreshMinutes = num;
							void this.plugin.saveSettings();
						}
					})
			);

		// --- License Section ---
		new Setting(containerEl).setName('License').setHeading();

		const licenseStatus = this.plugin.settings.licenseStatus;
		const isPro = this.plugin.settings.isPro && licenseStatus?.valid;
		const statusDesc = isPro
			? `active${licenseStatus?.customerEmail ? ` (${licenseStatus.customerEmail})` : ""}${licenseStatus?.expiresAt ? ` - expires ${licenseStatus.expiresAt}` : ""}`
			: "No active license. Enter your license key and click validate.";

		const licenseStatusEl = containerEl.createEl("p", {
			text: `License status: ${statusDesc}`,
			cls: isPro ? "mod-success" : "mod-warning",
		});

		new Setting(containerEl)
			.setName("License key")
			.setDesc("Enter your premium license key.")
			.addText((text) =>
				text
					.setPlaceholder("Xxxx-xxxx-xxxx-xxxx")
					.setValue(this.plugin.settings.licenseKey)
					.onChange((value) => {
						this.plugin.settings.licenseKey = value.trim();
						void this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Validate")
					.setCta()
					.onClick(() => {
						const key = this.plugin.settings.licenseKey.trim();
						if (!key) {
							licenseStatusEl.setText("License status: enter a license key first.");
							return;
						}
						btn.setButtonText("Checking...").setDisabled(true);
						void validateLicense(key).then((result) => {
							btn.setButtonText("Validate").setDisabled(false);
							if (result.offline) {
								// Do not touch the stored status: a previously validated
								// license keeps working during the offline grace period
								licenseStatusEl.setText(
									"License status: could not reach the license server. Check your connection and try again. A previously validated license keeps working for up to 14 days offline."
								);
								return;
							}
							const status = result.status;
							if (!status) return;
							this.plugin.settings.licenseStatus = status;
							this.plugin.settings.isPro = status.valid;
							void this.plugin.saveSettings();
							if (status.valid) {
								licenseStatusEl.setText(`License status: active${status.customerEmail ? ` (${status.customerEmail})` : ""}`);
								licenseStatusEl.className = "mod-success";
							} else {
								licenseStatusEl.setText("License status: invalid or expired. Check your key and try again.");
								licenseStatusEl.className = "mod-warning";
							}
						});
					})
			);

		new Setting(containerEl)
			.addButton((btn) =>
				btn
					.setButtonText("Get premium")
					.onClick(() => {
						window.open("https://arcadia-studio.lemonsqueezy.com", "_blank");
					})
			);

		// --- Future Modules ---
		new Setting(containerEl).setName('Additional modules').setHeading();

		new Setting(containerEl)
			.setName("Claude Code bridge")
			.setDesc("Coming soon: server integration, session history, config editor.")
			.setDisabled(true);

		new Setting(containerEl)
			.setName("Audio notebook sync")
			.setDesc("Coming soon: push notes to generate audio overviews and pull them back into your vault.")
			.setDisabled(true);

		new Setting(containerEl)
			.setName("AI router")
			.setDesc("Coming soon: route content to AI providers from context menu.")
			.setDisabled(true);
	}
}
