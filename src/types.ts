import type { LicenseStatus } from './license';

export interface ArcadiaHubSettings {
	githubToken: string;
	defaultRepo: string;
	showClosedIssues: boolean;
	issuesPerPage: number;
	autoRefreshMinutes: number;
	licenseKey: string;
	licenseStatus: LicenseStatus | null;
	isPro: boolean;
}

export const DEFAULT_SETTINGS: ArcadiaHubSettings = {
	githubToken: "",
	defaultRepo: "",
	showClosedIssues: false,
	issuesPerPage: 25,
	autoRefreshMinutes: 0,
	licenseKey: "",
	licenseStatus: null,
	isPro: false,
};

export interface GitHubRepo {
	owner: string;
	name: string;
	fullName: string;
	description: string;
	stars: number;
	openIssues: number;
	defaultBranch: string;
	url: string;
}

export interface GitHubLabel {
	name: string;
	color: string;
}

export interface GitHubIssue {
	number: number;
	title: string;
	body: string;
	state: "open" | "closed";
	labels: GitHubLabel[];
	assignee?: string;
	createdAt: string;
	updatedAt: string;
	commentsCount: number;
	url: string;
}

export interface GitHubPR {
	number: number;
	title: string;
	state: "open" | "closed" | "merged";
	author: string;
	branch: string;
	baseBranch: string;
	createdAt: string;
	updatedAt: string;
	reviewStatus: string;
	url: string;
}

export type HubTab = "issues" | "prs" | "repos";

export interface CacheEntry<T> {
	data: T;
	timestamp: number;
}
