import { Notice, Plugin, WorkspaceLeaf, MarkdownView } from "obsidian";
import { ArcadiaHubSettings, DEFAULT_SETTINGS, HubTab } from "./types";
import { ArcadiaHubSettingTab } from "./settings";
import { GitHubAPI } from "./github/github-api";
import { HubView, HUB_VIEW_TYPE } from "./hub-view";
import { CreateIssueModal } from "./github/create-issue-modal";
import { validateLicense, isCacheValid, isWithinOfflineGrace } from "./license";

export default class ArcadiaHubPlugin extends Plugin {
	settings: ArcadiaHubSettings = DEFAULT_SETTINGS;
	githubAPI: GitHubAPI = new GitHubAPI("");
	private activeRepo = "";
	private refreshInterval: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize GitHub API
		this.githubAPI = new GitHubAPI(this.settings.githubToken);
		this.activeRepo = this.settings.defaultRepo;

		// Register the hub sidebar view
		this.registerView(HUB_VIEW_TYPE, (leaf) => new HubView(leaf, this));

		// Add settings tab
		this.addSettingTab(new ArcadiaHubSettingTab(this.app, this));

		// Add ribbon icon
		this.addRibbonIcon("git-branch", "Open Arcadia Hub", () => {
			void this.activateView();
		});

		// Register commands
		this.addCommand({
			id: "open-hub",
			name: "Open hub",
			callback: () => { void this.activateView(); },
		});

		this.addCommand({
			id: "view-github-issues",
			name: "View GitHub issues",
			callback: () => { void this.activateView("issues"); },
		});

		this.addCommand({
			id: "view-pull-requests",
			name: "View pull requests",
			callback: () => { void this.activateView("prs"); },
		});

		this.addCommand({
			id: "create-issue-from-note",
			name: "Create issue from note",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				if (checking) return true;

				const file = view.file;
				const title = file?.basename || "";
				const editor = view.editor;
				const body = editor.getSelection() || editor.getValue();
				this.openCreateIssueModal(title, body);
				return true;
			},
		});

		// Setup auto-refresh
		this.setupAutoRefresh();

		// Revalidate the license in the background once the workspace is ready
		this.app.workspace.onLayoutReady(() => {
			void this.refreshLicenseState();
		});
	}

	onunload(): void {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
		}
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ArcadiaHubSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update GitHub API token if changed
		this.githubAPI.setToken(this.settings.githubToken);

		// Update active repo if default changed and no override
		if (!this.activeRepo || this.activeRepo === "") {
			this.activeRepo = this.settings.defaultRepo;
		}

		// Reconfigure auto-refresh
		this.setupAutoRefresh();
	}

	getActiveRepo(): string {
		return this.activeRepo || this.settings.defaultRepo;
	}

	setActiveRepo(repo: string): void {
		this.activeRepo = repo;
		void this.refreshHubView();
	}

	openCreateIssueModal(title = "", body = ""): void {
		new CreateIssueModal(this.app, this, title, body).open();
	}

	async refreshHubView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(HUB_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof HubView) {
				await leaf.view.refresh();
			}
		}
	}

	private async activateView(tab?: HubTab): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(HUB_VIEW_TYPE);
		let leaf: WorkspaceLeaf;

		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			const rightLeaf = this.app.workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({
				type: HUB_VIEW_TYPE,
				active: true,
			});
		}

		await this.app.workspace.revealLeaf(leaf);

		if (tab && leaf.view instanceof HubView) {
			await leaf.view.setTab(tab);
		}
	}

	/**
	 * Revalidates the stored license key in the background.
	 * Fails soft when the license server is unreachable: a previously
	 * validated license keeps working for the offline grace period.
	 */
	private async refreshLicenseState(): Promise<void> {
		const key = this.settings.licenseKey.trim();
		if (!key) return;

		const cached = this.settings.licenseStatus;
		if (cached && cached.valid && isCacheValid(cached)) return;

		const result = await validateLicense(key);

		if (result.offline) {
			// Keep premium active within the grace period; pause it after that,
			// but keep the key and cached status so the next successful check restores it.
			if (this.settings.isPro && cached && cached.valid && !isWithinOfflineGrace(cached)) {
				this.settings.isPro = false;
				await this.saveData(this.settings);
				new Notice(
					"Arcadia Hub: the license server has been unreachable for over 14 days. Premium features are paused until the license can be revalidated."
				);
			}
			return;
		}

		if (!result.status) return;
		const wasPro = this.settings.isPro;
		this.settings.licenseStatus = result.status;
		this.settings.isPro = result.status.valid;
		await this.saveData(this.settings);
		if (wasPro && !result.status.valid) {
			new Notice(
				"Arcadia Hub: your license is no longer valid. Premium features are disabled."
			);
		}
	}

	private setupAutoRefresh(): void {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}

		const minutes = this.settings.autoRefreshMinutes;
		if (minutes > 0) {
			this.refreshInterval = window.setInterval(
				() => { void this.refreshHubView(); },
				minutes * 60 * 1000
			);
			this.registerInterval(this.refreshInterval);
		}
	}
}
