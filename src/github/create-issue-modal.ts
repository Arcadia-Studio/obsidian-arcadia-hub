import { App, Modal, Notice, Setting } from "obsidian";
import type ArcadiaHubPlugin from "../main";
import { GitHubLabel } from "../types";

export class CreateIssueModal extends Modal {
	private plugin: ArcadiaHubPlugin;
	private titleValue: string;
	private bodyValue: string;
	private selectedLabels: Set<string> = new Set();
	private availableLabels: GitHubLabel[] = [];

	constructor(app: App, plugin: ArcadiaHubPlugin, prefillTitle = "", prefillBody = "") {
		super(app);
		this.plugin = plugin;
		this.titleValue = prefillTitle;
		this.bodyValue = prefillBody;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("arcadia-hub-create-issue-modal");

		new Setting(contentEl).setName("Create GitHub issue").setHeading();

		const repo = this.plugin.getActiveRepo();
		if (!repo) {
			contentEl.createEl("p", {
				text: "No repository configured. Set a default repo in settings.",
				cls: "arcadia-hub-error",
			});
			return;
		}

		contentEl.createEl("p", {
			text: `Repository: ${repo}`,
			cls: "arcadia-hub-modal-repo",
		});

		// Title
		new Setting(contentEl)
			.setName("Title")
			.addText((text) =>
				text
					.setPlaceholder("Issue title (required)")
					.setValue(this.titleValue)
					.onChange((value) => {
						this.titleValue = value;
					})
			);

		// Body
		const bodySetting = new Setting(contentEl).setName("Description");
		const textArea = bodySetting.controlEl.createEl("textarea", {
			cls: "arcadia-hub-issue-body-input",
			attr: { rows: "10", placeholder: "Issue description (Markdown supported)" },
		});
		textArea.value = this.bodyValue;
		textArea.addEventListener("input", () => {
			this.bodyValue = textArea.value;
		});

		// Labels
		const labelsContainer = contentEl.createDiv({ cls: "arcadia-hub-labels-section" });
		new Setting(labelsContainer).setName("Labels").setHeading();

		try {
			this.availableLabels = await this.plugin.githubAPI.getLabels(repo);
			const labelGrid = labelsContainer.createDiv({ cls: "arcadia-hub-label-grid" });

			for (const label of this.availableLabels) {
				const labelChip = labelGrid.createDiv({
					cls: "arcadia-hub-label-chip",
				});
				const checkbox = labelChip.createEl("input", {
					type: "checkbox",
					attr: { id: `label-${label.name}` },
				});
				const labelEl = labelChip.createEl("label", {
					text: label.name,
					attr: { for: `label-${label.name}` },
				});
				labelEl.style.backgroundColor = `#${label.color}`;
				const brightness = this.getLuminance(label.color);
				labelEl.style.color = brightness > 128 ? "#000" : "#fff";

				checkbox.addEventListener("change", () => {
					if (checkbox.checked) {
						this.selectedLabels.add(label.name);
					} else {
						this.selectedLabels.delete(label.name);
					}
				});
			}
		} catch {
			labelsContainer.createEl("p", {
				text: "Could not load labels.",
				cls: "arcadia-hub-muted",
			});
		}

		// Buttons
		const btnContainer = contentEl.createDiv({ cls: "arcadia-hub-modal-buttons" });

		const createBtn = btnContainer.createEl("button", {
			text: "Create issue",
			cls: "arcadia-hub-btn arcadia-hub-btn-primary",
		});
		createBtn.addEventListener("click", () => { void this.createIssue(); });

		const cancelBtn = btnContainer.createEl("button", {
			text: "Cancel",
			cls: "arcadia-hub-btn",
		});
		cancelBtn.addEventListener("click", () => this.close());
	}

	private async createIssue(): Promise<void> {
		if (!this.titleValue.trim()) {
			new Notice("Issue title is required.");
			return;
		}

		const repo = this.plugin.getActiveRepo();
		if (!repo) return;

		try {
			const issue = await this.plugin.githubAPI.createIssue(
				repo,
				this.titleValue.trim(),
				this.bodyValue.trim(),
				Array.from(this.selectedLabels)
			);

			new Notice(`Issue #${issue.number} created successfully.`);
			this.close();

			// Refresh the hub view
			void this.plugin.refreshHubView();
		} catch (err) {
			new Notice(`Failed to create issue: ${(err as Error).message}`);
		}
	}

	private getLuminance(hex: string): number {
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return (r * 299 + g * 587 + b * 114) / 1000;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
