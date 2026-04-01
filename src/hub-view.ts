import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type ArcadiaHubPlugin from "./main";
import { HubTab } from "./types";
import { IssuesView } from "./github/issues-view";
import { PRView } from "./github/pr-view";
import { ReposView } from "./github/repos-view";

export const HUB_VIEW_TYPE = "arcadia-hub-view";

export class HubView extends ItemView {
	plugin: ArcadiaHubPlugin;
	private activeTab: HubTab = "issues";
	private contentArea: HTMLElement | null = null;
	private issuesView: IssuesView | null = null;
	private prView: PRView | null = null;
	private reposView: ReposView | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ArcadiaHubPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return HUB_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Arcadia hub";
	}

	getIcon(): string {
		return "git-branch";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("arcadia-hub-container");

		// Header
		const header = container.createDiv({ cls: "arcadia-hub-header" });

		const titleRow = header.createDiv({ cls: "arcadia-hub-title-row" });

		titleRow.createEl("h3", { text: "Arcadia hub", cls: "arcadia-hub-title" });

		// Connection status
		const statusDot = titleRow.createEl("span", {
			cls: "arcadia-hub-status-dot",
		});
		if (this.plugin.githubAPI.isConfigured()) {
			statusDot.addClass("is-connected");
			statusDot.setAttribute("aria-label", "GitHub connected");
		} else {
			statusDot.addClass("is-disconnected");
			statusDot.setAttribute("aria-label", "GitHub not configured");
		}

		// Refresh button
		const refreshBtn = titleRow.createEl("button", {
			cls: "arcadia-hub-refresh-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener("click", () => { void this.refresh(); });

		// Active repo display
		const repoDisplay = header.createDiv({ cls: "arcadia-hub-active-repo" });
		const activeRepo = this.plugin.getActiveRepo();
		if (activeRepo) {
			repoDisplay.createEl("span", {
				text: activeRepo,
				cls: "arcadia-hub-repo-badge",
			});
		}

		// Tab bar
		const tabBar = container.createDiv({ cls: "arcadia-hub-tab-bar" });
		const tabs: Array<{ label: string; value: HubTab }> = [
			{ label: "Issues", value: "issues" },
			{ label: "Pull requests", value: "prs" },
			{ label: "Repos", value: "repos" },
		];

		for (const tab of tabs) {
			const tabBtn = tabBar.createEl("button", {
				text: tab.label,
				cls: `arcadia-hub-tab ${this.activeTab === tab.value ? "is-active" : ""}`,
			});
			tabBtn.addEventListener("click", () => {
				this.activeTab = tab.value;
				void this.renderActiveTab();
				// Update tab active states
				tabBar.querySelectorAll(".arcadia-hub-tab").forEach((t) =>
					t.removeClass("is-active")
				);
				tabBtn.addClass("is-active");
			});
		}

		// Content area
		this.contentArea = container.createDiv({ cls: "arcadia-hub-content" });

		await this.renderActiveTab();
	}

	private async renderActiveTab(): Promise<void> {
		if (!this.contentArea) return;
		this.contentArea.empty();

		switch (this.activeTab) {
			case "issues":
				this.issuesView = new IssuesView(this.plugin, this.contentArea, this);
				await this.issuesView.render();
				break;
			case "prs":
				this.prView = new PRView(this.plugin, this.contentArea, this);
				await this.prView.render();
				break;
			case "repos":
				this.reposView = new ReposView(this.plugin, this.contentArea, this);
				await this.reposView.render();
				break;
		}
	}

	async refresh(): Promise<void> {
		this.plugin.githubAPI.clearCache();
		await this.renderActiveTab();
	}

	async onClose(): Promise<void> {
		// Cleanup - no async operations needed
		this.issuesView = null;
		this.prView = null;
		this.reposView = null;
		this.contentArea = null;
		await Promise.resolve();
	}
}
