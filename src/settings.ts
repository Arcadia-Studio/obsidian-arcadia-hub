import { App, PluginSettingTab, Setting } from "obsidian";
import type ArcadiaHubPlugin from "./main";

export class ArcadiaHubSettingTab extends PluginSettingTab {
	plugin: ArcadiaHubPlugin;

	constructor(app: App, plugin: ArcadiaHubPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h1", { text: "Arcadia Hub" });

		// --- GitHub Section ---
		containerEl.createEl("h2", { text: "GitHub Integration" });

		new Setting(containerEl)
			.setName("Personal Access Token")
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
		containerEl.createEl("h2", { text: "License" });

		new Setting(containerEl)
			.setName("License key")
			.setDesc("Enter your Arcadia Hub Pro license key to unlock premium modules.")
			.addText((text) =>
				text
					.setPlaceholder("XXXX-XXXX-XXXX-XXXX")
					.setValue(this.plugin.settings.licenseKey)
					.onChange(async (value) => {
						this.plugin.settings.licenseKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		// --- Future Modules ---
		containerEl.createEl("h2", { text: "Additional Modules" });

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
