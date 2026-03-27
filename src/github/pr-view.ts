import { Component } from "obsidian";
import type ArcadiaHubPlugin from "../main";
import { GitHubPR } from "../types";

export class PRView {
	private plugin: ArcadiaHubPlugin;
	private containerEl: HTMLElement;
	private component: Component;
	private prs: GitHubPR[] = [];
	private expandedPR: number | null = null;
	private showState: "open" | "closed" | "all" = "open";

	constructor(plugin: ArcadiaHubPlugin, containerEl: HTMLElement, component: Component) {
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.component = component;
	}

	async render(): Promise<void> {
		this.containerEl.empty();

		const repo = this.plugin.getActiveRepo();
		if (!repo) {
			this.containerEl.createEl("p", {
				text: "No repository configured. Set a default repo in settings.",
				cls: "arcadia-hub-empty-state",
			});
			return;
		}

		// Filter bar
		const filterBar = this.containerEl.createDiv({ cls: "arcadia-hub-filter-bar" });
		const stateToggle = filterBar.createDiv({ cls: "arcadia-hub-state-toggle" });

		const states: Array<{ label: string; value: "open" | "closed" | "all" }> = [
			{ label: "Open", value: "open" },
			{ label: "Closed", value: "closed" },
			{ label: "All", value: "all" },
		];

		for (const s of states) {
			const btn = stateToggle.createEl("button", {
				text: s.label,
				cls: `arcadia-hub-toggle-btn ${this.showState === s.value ? "is-active" : ""}`,
			});
			btn.addEventListener("click", () => {
				this.showState = s.value;
				this.loadAndRender();
			});
		}

		this.containerEl.createDiv({ cls: "arcadia-hub-pr-list" });

		await this.loadAndRender();
	}

	private async loadAndRender(): Promise<void> {
		const listEl = this.containerEl.querySelector(".arcadia-hub-pr-list");
		if (!listEl) return;

		const repo = this.plugin.getActiveRepo();
		if (!repo) return;

		listEl.empty();
		listEl.createDiv({ cls: "arcadia-hub-loading", text: "Loading pull requests..." });

		try {
			this.prs = await this.plugin.githubAPI.getPullRequests(repo, this.showState);
			this.renderPRList();
		} catch (err) {
			listEl.empty();
			listEl.createEl("p", {
				text: `Error: ${(err as Error).message}`,
				cls: "arcadia-hub-error",
			});
		}

		// Update toggle states
		const toggleBtns = this.containerEl.querySelectorAll(".arcadia-hub-toggle-btn");
		toggleBtns.forEach((btn) => btn.removeClass("is-active"));
		const states = ["open", "closed", "all"];
		const idx = states.indexOf(this.showState);
		toggleBtns[idx]?.addClass("is-active");
	}

	private renderPRList(): void {
		const listEl = this.containerEl.querySelector(".arcadia-hub-pr-list");
		if (!listEl) return;
		listEl.empty();

		if (this.prs.length === 0) {
			listEl.createEl("p", {
				text: "No pull requests found.",
				cls: "arcadia-hub-empty-state",
			});
			return;
		}

		for (const pr of this.prs) {
			const item = listEl.createDiv({
				cls: `arcadia-hub-pr-item arcadia-hub-pr-${pr.state}`,
			});

			const header = item.createDiv({ cls: "arcadia-hub-pr-header" });

			header.createEl("span", {
				text: `#${pr.number}`,
				cls: "arcadia-hub-pr-number",
			});

			const stateIcon = pr.state === "merged" ? "merged" : pr.state === "closed" ? "closed" : "open";
			header.createEl("span", {
				text: stateIcon,
				cls: `arcadia-hub-pr-state arcadia-hub-pr-state-${pr.state}`,
			});

			header.createEl("span", {
				text: pr.title,
				cls: "arcadia-hub-pr-title",
			});

			header.addEventListener("click", () => {
				if (this.expandedPR === pr.number) {
					this.expandedPR = null;
				} else {
					this.expandedPR = pr.number;
				}
				this.renderPRList();
			});

			const meta = item.createDiv({ cls: "arcadia-hub-pr-meta" });

			meta.createEl("span", {
				text: `by ${pr.author}`,
				cls: "arcadia-hub-pr-author",
			});

			meta.createEl("span", {
				text: `${pr.branch} → ${pr.baseBranch}`,
				cls: "arcadia-hub-pr-branch",
			});

			if (pr.reviewStatus !== "none") {
				meta.createEl("span", {
					text: pr.reviewStatus,
					cls: "arcadia-hub-pr-review",
				});
			}

			const date = new Date(pr.updatedAt);
			meta.createEl("span", {
				text: this.formatDate(date),
				cls: "arcadia-hub-date",
			});

			// Expanded details
			if (this.expandedPR === pr.number) {
				const details = item.createDiv({ cls: "arcadia-hub-pr-details" });

				details.createDiv({
					cls: "arcadia-hub-pr-branch-info",
					text: `Branch: ${pr.branch} → ${pr.baseBranch}`,
				});

				details.createDiv({
					cls: "arcadia-hub-pr-review-info",
					text: `Review: ${pr.reviewStatus}`,
				});

				const actions = item.createDiv({ cls: "arcadia-hub-pr-actions" });
				const openLink = actions.createEl("a", {
					text: "Open in GitHub",
					cls: "arcadia-hub-link",
					href: pr.url,
				});
				openLink.addEventListener("click", (e) => {
					e.preventDefault();
					window.open(pr.url, "_blank");
				});
			}
		}
	}

	private formatDate(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 30) return `${diffDays}d ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
		return `${Math.floor(diffDays / 365)}y ago`;
	}
}
