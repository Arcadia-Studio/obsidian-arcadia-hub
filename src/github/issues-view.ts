import { Notice, MarkdownRenderer, Component } from "obsidian";
import type ArcadiaHubPlugin from "../main";
import { GitHubIssue } from "../types";

export class IssuesView {
	private plugin: ArcadiaHubPlugin;
	private containerEl: HTMLElement;
	private component: Component;
	private issues: GitHubIssue[] = [];
	private expandedIssue: number | null = null;
	private showClosed: boolean;
	private labelFilter = "";
	private currentPage = 1;

	constructor(plugin: ArcadiaHubPlugin, containerEl: HTMLElement, component: Component) {
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.component = component;
		this.showClosed = plugin.settings.showClosedIssues;
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
		const openBtn = stateToggle.createEl("button", {
			text: "Open",
			cls: `arcadia-hub-toggle-btn ${!this.showClosed ? "is-active" : ""}`,
		});
		const closedBtn = stateToggle.createEl("button", {
			text: "Closed",
			cls: `arcadia-hub-toggle-btn ${this.showClosed ? "is-active" : ""}`,
		});

		openBtn.addEventListener("click", () => {
			this.showClosed = false;
			this.currentPage = 1;
			this.loadAndRender();
		});
		closedBtn.addEventListener("click", () => {
			this.showClosed = true;
			this.currentPage = 1;
			this.loadAndRender();
		});

		const labelInput = filterBar.createEl("input", {
			type: "text",
			placeholder: "Filter by label...",
			cls: "arcadia-hub-label-filter",
		});
		labelInput.value = this.labelFilter;
		labelInput.addEventListener("input", () => {
			this.labelFilter = labelInput.value.toLowerCase();
			this.renderIssueList();
		});

		const newIssueBtn = filterBar.createEl("button", {
			text: "+ New Issue",
			cls: "arcadia-hub-btn arcadia-hub-btn-primary",
		});
		newIssueBtn.addEventListener("click", () => {
			this.plugin.openCreateIssueModal();
		});

		// Issues list container
		this.containerEl.createDiv({ cls: "arcadia-hub-issue-list" });

		await this.loadAndRender();
	}

	private async loadAndRender(): Promise<void> {
		const listEl = this.containerEl.querySelector(".arcadia-hub-issue-list");
		if (!listEl) return;

		const repo = this.plugin.getActiveRepo();
		if (!repo) return;

		listEl.empty();
		listEl.createDiv({ cls: "arcadia-hub-loading", text: "Loading issues..." });

		try {
			const state = this.showClosed ? "closed" : "open";
			this.issues = await this.plugin.githubAPI.getIssues(
				repo,
				state,
				this.currentPage,
				this.plugin.settings.issuesPerPage
			);
			this.renderIssueList();
		} catch (err) {
			listEl.empty();
			listEl.createEl("p", {
				text: `Error: ${(err as Error).message}`,
				cls: "arcadia-hub-error",
			});
		}

		// Update toggle button active states
		const toggleBtns = this.containerEl.querySelectorAll(".arcadia-hub-toggle-btn");
		toggleBtns.forEach((btn) => btn.removeClass("is-active"));
		if (!this.showClosed) {
			toggleBtns[0]?.addClass("is-active");
		} else {
			toggleBtns[1]?.addClass("is-active");
		}
	}

	private renderIssueList(): void {
		const listEl = this.containerEl.querySelector(".arcadia-hub-issue-list");
		if (!listEl) return;
		listEl.empty();

		let filtered = this.issues;
		if (this.labelFilter) {
			filtered = filtered.filter((issue) =>
				issue.labels.some((l) =>
					l.name.toLowerCase().includes(this.labelFilter)
				)
			);
		}

		if (filtered.length === 0) {
			listEl.createEl("p", {
				text: this.showClosed ? "No closed issues found." : "No open issues found.",
				cls: "arcadia-hub-empty-state",
			});
			return;
		}

		for (const issue of filtered) {
			const item = listEl.createDiv({ cls: "arcadia-hub-issue-item" });

			const header = item.createDiv({ cls: "arcadia-hub-issue-header" });

			const number = header.createEl("span", {
				text: `#${issue.number}`,
				cls: "arcadia-hub-issue-number",
			});

			const title = header.createEl("span", {
				text: issue.title,
				cls: "arcadia-hub-issue-title",
			});

			// Make header clickable to expand
			header.addEventListener("click", () => {
				if (this.expandedIssue === issue.number) {
					this.expandedIssue = null;
				} else {
					this.expandedIssue = issue.number;
				}
				this.renderIssueList();
			});

			const meta = item.createDiv({ cls: "arcadia-hub-issue-meta" });

			// Labels
			for (const label of issue.labels) {
				const badge = meta.createEl("span", {
					text: label.name,
					cls: "arcadia-hub-label",
				});
				badge.style.backgroundColor = `#${label.color}`;
				// Determine text color based on background brightness
				const brightness = this.getLuminance(label.color);
				badge.style.color = brightness > 128 ? "#000" : "#fff";
			}

			if (issue.assignee) {
				meta.createEl("span", {
					text: `@${issue.assignee}`,
					cls: "arcadia-hub-assignee",
				});
			}

			meta.createEl("span", {
				text: `${issue.commentsCount} comments`,
				cls: "arcadia-hub-comments",
			});

			const date = new Date(issue.updatedAt);
			meta.createEl("span", {
				text: this.formatDate(date),
				cls: "arcadia-hub-date",
			});

			// Expanded body
			if (this.expandedIssue === issue.number) {
				const body = item.createDiv({ cls: "arcadia-hub-issue-body" });
				if (issue.body) {
					MarkdownRenderer.renderMarkdown(
						issue.body,
						body,
						"",
						this.component
					);
				} else {
					body.createEl("em", { text: "No description provided." });
				}

				const actions = item.createDiv({ cls: "arcadia-hub-issue-actions" });
				const openLink = actions.createEl("a", {
					text: "Open in GitHub",
					cls: "arcadia-hub-link",
					href: issue.url,
				});
				openLink.addEventListener("click", (e) => {
					e.preventDefault();
					window.open(issue.url, "_blank");
				});
			}
		}

		// Pagination
		if (this.issues.length >= this.plugin.settings.issuesPerPage) {
			const pagination = listEl.createDiv({ cls: "arcadia-hub-pagination" });
			if (this.currentPage > 1) {
				const prev = pagination.createEl("button", {
					text: "Previous",
					cls: "arcadia-hub-btn",
				});
				prev.addEventListener("click", () => {
					this.currentPage--;
					this.loadAndRender();
				});
			}
			const next = pagination.createEl("button", {
				text: "Next",
				cls: "arcadia-hub-btn",
			});
			next.addEventListener("click", () => {
				this.currentPage++;
				this.loadAndRender();
			});
		}
	}

	private getLuminance(hex: string): number {
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return (r * 299 + g * 587 + b * 114) / 1000;
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
