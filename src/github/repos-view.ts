import { Component } from "obsidian";
import type ArcadiaHubPlugin from "../main";
import { GitHubRepo } from "../types";

export class ReposView {
	private plugin: ArcadiaHubPlugin;
	private containerEl: HTMLElement;
	private component: Component;
	private repos: GitHubRepo[] = [];

	constructor(plugin: ArcadiaHubPlugin, containerEl: HTMLElement, component: Component) {
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.component = component;
	}

	async render(): Promise<void> {
		this.containerEl.empty();

		if (!this.plugin.githubAPI.isConfigured()) {
			this.containerEl.createEl("p", {
				text: "GitHub token not configured. Set it in settings.",
				cls: "arcadia-hub-empty-state",
			});
			return;
		}

		this.containerEl.createDiv({ cls: "arcadia-hub-loading", text: "Loading repositories..." });

		try {
			this.repos = await this.plugin.githubAPI.getRepos();
			this.renderRepoList();
		} catch (err) {
			this.containerEl.empty();
			this.containerEl.createEl("p", {
				text: `Error: ${(err as Error).message}`,
				cls: "arcadia-hub-error",
			});
		}
	}

	private renderRepoList(): void {
		this.containerEl.empty();

		if (this.repos.length === 0) {
			this.containerEl.createEl("p", {
				text: "No repositories found.",
				cls: "arcadia-hub-empty-state",
			});
			return;
		}

		const activeRepo = this.plugin.getActiveRepo();

		for (const repo of this.repos) {
			const isActive = repo.fullName === activeRepo;
			const item = this.containerEl.createDiv({
				cls: `arcadia-hub-repo-item ${isActive ? "is-active" : ""}`,
			});

			const header = item.createDiv({ cls: "arcadia-hub-repo-header" });

			header.createEl("span", {
				text: repo.fullName,
				cls: "arcadia-hub-repo-name",
			});

			if (isActive) {
				header.createEl("span", {
					text: "Active",
					cls: "arcadia-hub-repo-active-badge",
				});
			}

			if (repo.description) {
				item.createEl("p", {
					text: repo.description,
					cls: "arcadia-hub-repo-desc",
				});
			}

			const stats = item.createDiv({ cls: "arcadia-hub-repo-stats" });

			stats.createEl("span", {
				text: `★ ${repo.stars}`,
				cls: "arcadia-hub-repo-stars",
			});

			stats.createEl("span", {
				text: `${repo.openIssues} issues`,
				cls: "arcadia-hub-repo-issues",
			});

			stats.createEl("span", {
				text: repo.defaultBranch,
				cls: "arcadia-hub-repo-branch",
			});

			const actions = item.createDiv({ cls: "arcadia-hub-repo-actions" });

			if (!isActive) {
				const setActiveBtn = actions.createEl("button", {
					text: "Set active",
					cls: "arcadia-hub-btn arcadia-hub-btn-small",
				});
				setActiveBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.plugin.setActiveRepo(repo.fullName);
					this.renderRepoList();
				});
			}

			const openLink = actions.createEl("a", {
				text: "Open in GitHub",
				cls: "arcadia-hub-link",
				href: repo.url,
			});
			openLink.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(repo.url, "_blank");
			});
		}
	}
}
