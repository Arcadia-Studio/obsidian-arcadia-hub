import { Plugin, WorkspaceLeaf, MarkdownView } from "obsidian";
import { ArcadiaHubSettings, DEFAULT_SETTINGS } from "./types";
import { ArcadiaHubSettingTab } from "./settings";
import { GitHubAPI } from "./github/github-api";
import { HubView, HUB_VIEW_TYPE } from "./hub-view";
import { CreateIssueModal } from "./github/create-issue-modal";

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
			this.activateView();
		});

		// Register commands
		this.addCommand({
			id: "open-hub",
			name: "Open Hub",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "view-github-issues",
			name: "View GitHub Issues",
			callback: () => this.activateView("issues"),
		});

		this.addCommand({
			id: "view-pull-requests",
			name: "View Pull Requests",
			callback: () => this.activateView("prs"),
		});

		this.addCommand({
			id: "create-issue-from-note",
			name: "Create Issue from Note",
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
	}

	async onunload(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		this.refreshHubView();
	}

	openCreateIssueModal(title = "", body = ""): void {
		new CreateIssueModal(this.app, this, title, body).open();
	}

	async refreshHubView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(HUB_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as HubView;
			if (view && view.refresh) {
				await view.refresh();
			}
		}
	}

	private async activateView(tab?: string): Promise<void> {
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

		this.app.workspace.revealLeaf(leaf);
	}

	private setupAutoRefresh(): void {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}

		const minutes = this.settings.autoRefreshMinutes;
		if (minutes > 0) {
			this.refreshInterval = window.setInterval(
				() => this.refreshHubView(),
				minutes * 60 * 1000
			);
			this.registerInterval(this.refreshInterval);
		}
	}
}
