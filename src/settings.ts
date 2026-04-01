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
			.setDesc("GitHub token with repo scope")
			.addText((text) =>
				text
					.setPlaceholder("Ghp_xxxxxxxxxxxxxxxxxxxx")
					.setValue(this.plugin.settings.githubToken)
					.onChange((value) => {
						this.plugin.settings.githubToken = value.trim();
						void this.plugin.saveSettings();
					})
					.inputEl.type = "password"
			);

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
						if (!key) return;
						btn.setButtonText("Checking...").setDisabled(true);
						void validateLicense(key).then((status) => {
							this.plugin.settings.licenseStatus = status;
							this.plugin.settings.isPro = status.valid;
							void this.plugin.saveSettings();
							btn.setButtonText("Validate").setDisabled(false);
							if (status.valid) {
								licenseStatusEl.textContent = `License status: active${status.customerEmail ? ` (${status.customerEmail})` : ""}`;
								licenseStatusEl.className = "mod-success";
							} else {
								licenseStatusEl.textContent = "License status: invalid or expired. Check your key and try again.";
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
			.setName("Claude code bridge")
			.setDesc("Coming soon: server integration, session history, config editor.")
			.setDisabled(true);

		new Setting(containerEl)
			.setName("NotebookLM sync")
			.setDesc("Coming soon: push notes to NotebookLM, pull audio overviews back into your vault.")
			.setDisabled(true);

		new Setting(containerEl)
			.setName("AI router")
			.setDesc("Coming soon: route content to AI providers from context menu.")
			.setDisabled(true);
	}
}
