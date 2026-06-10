import { requestUrl, RequestUrlParam, RequestUrlResponse, Notice } from "obsidian";
import {
	GitHubRepo,
	GitHubIssue,
	GitHubPR,
	GitHubLabel,
	CacheEntry,
} from "../types";

const GITHUB_API = "https://api.github.com";
const CACHE_TTL_MS = 60_000; // 60 seconds
const RATE_LIMIT_NOTICE_COOLDOWN_MS = 5 * 60_000; // notify at most every 5 minutes

export class GitHubAPI {
	private token: string;
	private cache: Map<string, CacheEntry<unknown>> = new Map();
	private rateLimitRemaining = -1;
	private lastRateLimitNotice = 0;

	constructor(token: string) {
		this.token = token;
	}

	setToken(token: string): void {
		this.token = token;
		this.clearCache();
	}

	isConfigured(): boolean {
		return this.token.length > 0;
	}

	clearCache(): void {
		this.cache.clear();
	}

	private getCached<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;
		if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
			this.cache.delete(key);
			return null;
		}
		return entry.data as T;
	}

	private setCache<T>(key: string, data: T): void {
		this.cache.set(key, { data, timestamp: Date.now() });
	}

	private async request<T>(
		path: string,
		method = "GET",
		body?: unknown
	): Promise<T> {
		if (!this.token) {
			throw new Error(
				"GitHub token not configured. Add a personal access token in the plugin settings."
			);
		}

		const params: RequestUrlParam = {
			url: `${GITHUB_API}${path}`,
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
			},
			throw: false,
		};

		if (body) {
			params.body = JSON.stringify(body);
		}

		let response: RequestUrlResponse;
		try {
			response = await requestUrl(params);
		} catch {
			throw new Error("Could not reach GitHub. Check your internet connection.");
		}

		// Track rate limit and warn before it runs out (throttled to avoid spam)
		const remaining = this.getHeader(response, "x-ratelimit-remaining");
		if (remaining !== undefined) {
			const parsed = parseInt(remaining, 10);
			if (!Number.isNaN(parsed)) {
				this.rateLimitRemaining = parsed;
				const now = Date.now();
				if (
					parsed < 10 &&
					response.status < 400 &&
					now - this.lastRateLimitNotice > RATE_LIMIT_NOTICE_COOLDOWN_MS
				) {
					this.lastRateLimitNotice = now;
					new Notice(
						`GitHub API rate limit low (${parsed} requests remaining).`
					);
				}
			}
		}

		if (response.status === 401) {
			throw new Error(
				"GitHub authentication failed. Check your personal access token in settings."
			);
		}
		if (response.status === 403 || response.status === 429) {
			if (this.rateLimitRemaining === 0) {
				throw new Error(
					`GitHub rate limit exceeded. ${this.rateLimitResetMessage(response)}`
				);
			}
			throw new Error(
				"GitHub denied the request. Your token may be missing the repo scope."
			);
		}
		if (response.status === 404) {
			throw new Error("GitHub resource not found. Check the repository name.");
		}
		if (response.status >= 400) {
			throw new Error(
				`GitHub API error (HTTP ${response.status}): ${this.extractApiMessage(response)}`
			);
		}

		return response.json as T;
	}

	private getHeader(response: RequestUrlResponse, name: string): string | undefined {
		if (response.headers[name] !== undefined) return response.headers[name];
		// Header casing is not guaranteed; fall back to a case-insensitive match
		for (const key of Object.keys(response.headers)) {
			if (key.toLowerCase() === name) return response.headers[key];
		}
		return undefined;
	}

	private rateLimitResetMessage(response: RequestUrlResponse): string {
		const reset = this.getHeader(response, "x-ratelimit-reset");
		const resetEpoch = reset !== undefined ? parseInt(reset, 10) : NaN;
		if (!Number.isNaN(resetEpoch)) {
			const minutes = Math.max(
				1,
				Math.ceil((resetEpoch * 1000 - Date.now()) / 60_000)
			);
			return `Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
		}
		return "Try again later.";
	}

	private extractApiMessage(response: RequestUrlResponse): string {
		try {
			const data = response.json as { message?: string } | null;
			if (data && typeof data.message === "string") return data.message;
		} catch {
			// Response body was not JSON
		}
		return "Unknown error";
	}

	private parseRepo(repo: string): { owner: string; name: string } {
		const parts = repo.trim().split("/");
		if (parts.length !== 2 || !parts[0] || !parts[1]) {
			throw new Error(
				`Invalid repository format "${repo}". Expected owner/repo.`
			);
		}
		return { owner: parts[0], name: parts[1] };
	}

	async getRepos(): Promise<GitHubRepo[]> {
		const cacheKey = "repos";
		const cached = this.getCached<GitHubRepo[]>(cacheKey);
		if (cached) return cached;

		interface RawRepo {
			full_name: string;
			description: string | null;
			stargazers_count: number;
			open_issues_count: number;
			default_branch: string;
			html_url: string;
			owner: { login: string };
			name: string;
		}

		const raw = await this.request<RawRepo[]>(
			"/user/repos?per_page=100&sort=updated"
		);

		const repos: GitHubRepo[] = raw.map((r) => ({
			owner: r.owner.login,
			name: r.name,
			fullName: r.full_name,
			description: r.description || "",
			stars: r.stargazers_count,
			openIssues: r.open_issues_count,
			defaultBranch: r.default_branch,
			url: r.html_url,
		}));

		this.setCache(cacheKey, repos);
		return repos;
	}

	async getRepoInfo(repo: string): Promise<GitHubRepo> {
		const { owner, name } = this.parseRepo(repo);
		const cacheKey = `repo:${repo}`;
		const cached = this.getCached<GitHubRepo>(cacheKey);
		if (cached) return cached;

		interface RawRepo {
			full_name: string;
			description: string | null;
			stargazers_count: number;
			open_issues_count: number;
			default_branch: string;
			html_url: string;
			owner: { login: string };
			name: string;
		}

		const r = await this.request<RawRepo>(`/repos/${owner}/${name}`);
		const result: GitHubRepo = {
			owner: r.owner.login,
			name: r.name,
			fullName: r.full_name,
			description: r.description || "",
			stars: r.stargazers_count,
			openIssues: r.open_issues_count,
			defaultBranch: r.default_branch,
			url: r.html_url,
		};

		this.setCache(cacheKey, result);
		return result;
	}

	async getIssues(
		repo: string,
		state: "open" | "closed" | "all" = "open",
		page = 1,
		perPage = 25
	): Promise<GitHubIssue[]> {
		const { owner, name } = this.parseRepo(repo);
		const cacheKey = `issues:${repo}:${state}:${page}:${perPage}`;
		const cached = this.getCached<GitHubIssue[]>(cacheKey);
		if (cached) return cached;

		interface RawIssue {
			number: number;
			title: string;
			body: string | null;
			state: string;
			labels: { name: string; color: string }[];
			assignee?: { login: string } | null;
			created_at: string;
			updated_at: string;
			comments: number;
			html_url: string;
			pull_request?: unknown;
		}

		const raw = await this.request<RawIssue[]>(
			`/repos/${owner}/${name}/issues?state=${state}&page=${page}&per_page=${perPage}&sort=updated`
		);

		// GitHub API returns PRs mixed in with issues; filter them out
		const issues: GitHubIssue[] = raw
			.filter((i) => !i.pull_request)
			.map((i) => ({
				number: i.number,
				title: i.title,
				body: i.body || "",
				state: i.state as "open" | "closed",
				labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
				assignee: i.assignee?.login,
				createdAt: i.created_at,
				updatedAt: i.updated_at,
				commentsCount: i.comments,
				url: i.html_url,
			}));

		this.setCache(cacheKey, issues);
		return issues;
	}

	async getIssue(repo: string, issueNumber: number): Promise<GitHubIssue> {
		const { owner, name } = this.parseRepo(repo);
		const cacheKey = `issue:${repo}:${issueNumber}`;
		const cached = this.getCached<GitHubIssue>(cacheKey);
		if (cached) return cached;

		interface RawIssue {
			number: number;
			title: string;
			body: string | null;
			state: string;
			labels: { name: string; color: string }[];
			assignee?: { login: string } | null;
			created_at: string;
			updated_at: string;
			comments: number;
			html_url: string;
		}

		const i = await this.request<RawIssue>(
			`/repos/${owner}/${name}/issues/${issueNumber}`
		);

		const issue: GitHubIssue = {
			number: i.number,
			title: i.title,
			body: i.body || "",
			state: i.state as "open" | "closed",
			labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
			assignee: i.assignee?.login,
			createdAt: i.created_at,
			updatedAt: i.updated_at,
			commentsCount: i.comments,
			url: i.html_url,
		};

		this.setCache(cacheKey, issue);
		return issue;
	}

	async createIssue(
		repo: string,
		title: string,
		body: string,
		labels: string[] = []
	): Promise<GitHubIssue> {
		const { owner, name } = this.parseRepo(repo);

		interface RawIssue {
			number: number;
			title: string;
			body: string | null;
			state: string;
			labels: { name: string; color: string }[];
			assignee?: { login: string } | null;
			created_at: string;
			updated_at: string;
			comments: number;
			html_url: string;
		}

		const i = await this.request<RawIssue>(
			`/repos/${owner}/${name}/issues`,
			"POST",
			{ title, body, labels }
		);

		// Invalidate issues cache
		for (const key of this.cache.keys()) {
			if (key.startsWith(`issues:${repo}`)) {
				this.cache.delete(key);
			}
		}

		return {
			number: i.number,
			title: i.title,
			body: i.body || "",
			state: i.state as "open" | "closed",
			labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
			assignee: i.assignee?.login,
			createdAt: i.created_at,
			updatedAt: i.updated_at,
			commentsCount: i.comments,
			url: i.html_url,
		};
	}

	async getLabels(repo: string): Promise<GitHubLabel[]> {
		const { owner, name } = this.parseRepo(repo);
		const cacheKey = `labels:${repo}`;
		const cached = this.getCached<GitHubLabel[]>(cacheKey);
		if (cached) return cached;

		interface RawLabel {
			name: string;
			color: string;
		}

		const raw = await this.request<RawLabel[]>(
			`/repos/${owner}/${name}/labels?per_page=100`
		);

		const labels: GitHubLabel[] = raw.map((l) => ({
			name: l.name,
			color: l.color,
		}));

		this.setCache(cacheKey, labels);
		return labels;
	}

	async getPullRequests(
		repo: string,
		state: "open" | "closed" | "all" = "open"
	): Promise<GitHubPR[]> {
		const { owner, name } = this.parseRepo(repo);
		const cacheKey = `prs:${repo}:${state}`;
		const cached = this.getCached<GitHubPR[]>(cacheKey);
		if (cached) return cached;

		interface RawPR {
			number: number;
			title: string;
			state: string;
			merged_at: string | null;
			user: { login: string };
			head: { ref: string };
			base: { ref: string };
			created_at: string;
			updated_at: string;
			html_url: string;
			draft: boolean;
			requested_reviewers: { login: string }[];
		}

		const raw = await this.request<RawPR[]>(
			`/repos/${owner}/${name}/pulls?state=${state}&per_page=50&sort=updated`
		);

		const prs: GitHubPR[] = raw.map((p) => {
			let prState: "open" | "closed" | "merged";
			if (p.merged_at) {
				prState = "merged";
			} else {
				prState = p.state as "open" | "closed";
			}

			let reviewStatus = "none";
			if (p.draft) {
				reviewStatus = "draft";
			} else if (p.requested_reviewers.length > 0) {
				reviewStatus = "review requested";
			}

			return {
				number: p.number,
				title: p.title,
				state: prState,
				author: p.user.login,
				branch: p.head.ref,
				baseBranch: p.base.ref,
				createdAt: p.created_at,
				updatedAt: p.updated_at,
				reviewStatus,
				url: p.html_url,
			};
		});

		this.setCache(cacheKey, prs);
		return prs;
	}

	async getPR(repo: string, prNumber: number): Promise<GitHubPR> {
		const { owner, name } = this.parseRepo(repo);
		const cacheKey = `pr:${repo}:${prNumber}`;
		const cached = this.getCached<GitHubPR>(cacheKey);
		if (cached) return cached;

		interface RawPR {
			number: number;
			title: string;
			state: string;
			merged_at: string | null;
			user: { login: string };
			head: { ref: string };
			base: { ref: string };
			created_at: string;
			updated_at: string;
			html_url: string;
			draft: boolean;
			requested_reviewers: { login: string }[];
		}

		const p = await this.request<RawPR>(
			`/repos/${owner}/${name}/pulls/${prNumber}`
		);

		let prState: "open" | "closed" | "merged";
		if (p.merged_at) {
			prState = "merged";
		} else {
			prState = p.state as "open" | "closed";
		}

		let reviewStatus = "none";
		if (p.draft) {
			reviewStatus = "draft";
		} else if (p.requested_reviewers.length > 0) {
			reviewStatus = "review requested";
		}

		const pr: GitHubPR = {
			number: p.number,
			title: p.title,
			state: prState,
			author: p.user.login,
			branch: p.head.ref,
			baseBranch: p.base.ref,
			createdAt: p.created_at,
			updatedAt: p.updated_at,
			reviewStatus,
			url: p.html_url,
		};

		this.setCache(cacheKey, pr);
		return pr;
	}

	getRateLimitRemaining(): number {
		return this.rateLimitRemaining;
	}
}
