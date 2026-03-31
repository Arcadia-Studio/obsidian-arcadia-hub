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

		new Setting(containerEl).setName('Arcadia Hub').setHeading();

		// --- GitHub Section ---
		new Setting(containerEl).setName('GitHub integration').setHeading();

		new Setting(containerEl)
			.setName("Personal access token")
			.setDesc("GitHub PAT with repo scope. Generate at GitHub > Settings > Developer settings > Personal access tokens.")
			.addText((text) =>
				text
					.setPlaceholder("ghp_xxxxxxxxxxxxxxxxxxxx")
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value.trim();
						await this.plugin.saveSettings();
					})
					.inputEl.type = "password"
			);

		new Setting(containerEl)
			.setName("Default repository")
			.setDesc("Format: owner/repo (e.g. octocat/hello-world)")
			.addText((text) =>
				text
					.setPlaceholder("owner/repo")
					.setValue(this.plugin.settings.defaultRepo)
					.onChange(async (value) => {
						this.plugin.settings.defaultRepo = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show closed issues")
			.setDesc("Include closed issues in the issues list")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showClosedIssues)
					.onChange(async (value) => {
						this.plugin.settings.showClosedIssues = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Issues per page")
			.setDesc("Number of issues to load per page (1-100)")
			.addText((text) =>
				text
					.setPlaceholder("25")
					.setValue(String(this.plugin.settings.issuesPerPage))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 100) {
							this.plugin.settings.issuesPerPage = num;
							await this.plugin.saveSettings();
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
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.autoRefreshMinutes = num;
							await this.plugin.saveSettings();
						}
					})
			);

		// --- License Section ---
		new Setting(containerEl).setName('License').setHeading();

		const licenseStatus = this.plugin.settings.licenseStatus;
		const isPro = this.plugin.settings.isPro && licenseStatus?.valid;
		const statusDesc = isPro
			? `Active${licenseStatus?.customerEmail ? ` (${licenseStatus.customerEmail})` : ""}${licenseStatus?.expiresAt ? ` - expires ${licenseStatus.expiresAt}` : ""}`
			: "No active license. Enter your license key and click Validate.";

		const licenseStatusEl = containerEl.createEl("p", {
			text: `License status: ${statusDesc}`,
			cls: isPro ? "mod-success" : "mod-warning",
		});

		new Setting(containerEl)
			.setName("License key")
			.setDesc("Enter your Arcadia Hub Premium license key from Lemon Squeezy.")
			.addText((text) =>
				text
					.setPlaceholder("XXXX-XXXX-XXXX-XXXX")
					.setValue(this.plugin.settings.licenseKey)
					.onChange(async (value) => {
						this.plugin.settings.licenseKey = value.trim();
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Validate")
					.setCta()
					.onClick(async () => {
						const key = this.plugin.settings.licenseKey.trim();
						if (!key) return;
						btn.setButtonText("Checking...").setDisabled(true);
						const status = await validateLicense(key);
						this.plugin.settings.licenseStatus = status;
						this.plugin.settings.isPro = status.valid;
						await this.plugin.saveSettings();
						btn.setButtonText("Validate").setDisabled(false);
						if (status.valid) {
							licenseStatusEl.textContent = `License status: Active${status.customerEmail ? ` (${status.customerEmail})` : ""}`;
							licenseStatusEl.className = "mod-success";
						} else {
							licenseStatusEl.textContent = "License status: Invalid or expired. Check your key and try again.";
							licenseStatusEl.className = "mod-warning";
						}
					})
			);

		new Setting(containerEl)
			.addButton((btn) =>
				btn
					.setButtonText("Get Arcadia Hub Premium")
					.onClick(() => {
						window.open("https://arcadia-studio.lemonsqueezy.com", "_blank");
					})
			);

		// --- Future Modules ---
		new Setting(containerEl).setName('Additional modules').setHeading();

		new Setting(containerEl)
			.setName("Claude Code Bridge")
			.setDesc("Coming Soon: MCP server integration, session history, CLAUDE.md editor.")
			.setDisabled(true);

		new Setting(containerEl)
			.setName("NotebookLM Sync")
			.setDesc("Coming Soon: Push notes to NotebookLM, pull audio overviews back into your vault.")
			.setDisabled(true);

		new Setting(containerEl)
			.setName("AI Router")
			.setDesc("Coming Soon: Route content to Claude, NotebookLM, or local LLMs from context menu.")
			.setDisabled(true);
	}
}
