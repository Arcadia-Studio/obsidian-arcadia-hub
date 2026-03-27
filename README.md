# Arcadia Hub

A GitHub integration sidebar for Obsidian: browse repositories, manage issues and pull requests, monitor CI status, and create GitHub issues directly from your notes.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-0.16+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

> Desktop only.

## Features

### Free
- GitHub repository browser with configurable default repo
- Issues viewer with open/closed filtering
- Pull request dashboard showing PR status and metadata
- GitHub Actions and CI status monitoring
- Create a GitHub issue from the current note (title and body pre-filled)
- Auto-refresh on a configurable interval
- Switch active repository without leaving Obsidian

### Premium
- Claude Code bridge for AI-assisted development workflows
- NotebookLM sync to push research notes into NotebookLM projects
- AI Router for routing tasks across multiple AI services from one panel
- Hub dashboard aggregating multiple services (GitHub, CI, AI) in a single view
- Get Premium at [arcadia-studio.lemonsqueezy.com](https://arcadia-studio.lemonsqueezy.com)

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Arcadia Hub"
4. Install and enable the plugin

## Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/Arcadia-Studio/obsidian-arcadia-hub/releases)
2. Extract to your vault's `.obsidian/plugins/arcadia-hub/` folder
3. Reload Obsidian and enable the plugin

## Setup

1. Generate a GitHub Personal Access Token with `repo` scope at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Open Settings > Arcadia Hub and paste your token
3. Set your default repository (format: `owner/repo`)
4. Open the Hub via the ribbon icon (git-branch) or the "Open Hub" command

## Usage

The Hub sidebar has tabs for Issues, Pull Requests, and Actions. Use the "Create Issue from Note" command to open a modal pre-filled with the current note's title and selected text (or full content).

## Premium License

Arcadia Hub uses a freemium model. Core features are free. Premium features require a license key from [Lemon Squeezy](https://arcadia-studio.lemonsqueezy.com).

To activate: Settings > Arcadia Hub > Enter License Key

## About Arcadia Studio

Arcadia Studio builds productivity tools for Obsidian users. [arcadia-studio.lemonsqueezy.com](https://arcadia-studio.lemonsqueezy.com)
