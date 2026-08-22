# Kindred Code

**Same stack. Shared spark.**

Kindred Code finds developers whose public GitHub activity overlaps with yours and explains every match using shared repository context, languages, and topics.

[Try the live app](https://kindred-code-srbmaury.srbmaury.chatgpt.site) · [View the GitHub App](https://github.com/apps/kindred-code-matcher) · Built by [@srbmaury](https://github.com/srbmaury)

## Why Kindred Code?

GitHub makes it easy to find repositories, but surprisingly difficult to discover people who care about the same technologies and projects. Kindred Code turns recent public activity into a small, explainable developer constellation.

- Uses live public GitHub data—no mocked profiles
- Shows exactly why each person matched
- Requires no GitHub token from visitors
- Uses short-lived GitHub App installation tokens on the server
- Caches results with Upstash Redis to reduce latency and API usage
- Includes loading, error, empty, mobile, and X-sharing experiences

## How matching works

For a supplied GitHub username, Kindred Code:

1. Reads the profile's recent public owned and starred repositories.
2. Selects a small group of relevant source repositories.
3. Discovers nearby developers from their public contributor lists.
4. Compares each candidate's recent public repositories, languages, and topics.
5. Returns up to six ranked matches with visible evidence.

### Affinity score

The percentage is an explainable discovery signal—not a probability, skill rating, or claim of personal compatibility.

| Signal | Weight | Meaning |
| --- | ---: | --- |
| Shared repository context | 45% | Repositories that place both developers in the same open-source orbit |
| Language overlap | 35% | Shared languages across recent public repository activity |
| Topic overlap | 20% | Shared GitHub repository topics and technical interests |

Each result card displays the shared signals and a visual score breakdown. Scores are capped at 99% and low-signal candidates are filtered out.

## Architecture

```mermaid
flowchart LR
  Visitor[Visitor] --> App[Vinext app]
  App --> API[Match API]
  API --> Cache[(Upstash Redis)]
  API --> Auth[GitHub App auth]
  Auth --> Token[Short-lived installation token]
  Token --> GitHub[GitHub REST API]
  GitHub --> API
  API --> Visitor
```

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS |
| Full-stack runtime | Vinext on Cloudflare Workers |
| GitHub authentication | GitHub App installation tokens |
| Cache and distributed controls | Upstash Redis REST API |
| Hosting | OpenAI Sites / Cloudflare infrastructure |

## Local development

### Requirements

- Node.js `>=22.13.0`
- A GitHub App installed on your GitHub account
- An Upstash Redis database

### 1. Clone and install

```bash
git clone https://github.com/srbmaury/kindred-code.git
cd kindred-code
npm install
```

### 2. Configure the GitHub App

Create a GitHub App with read-only access to public resources, install it on your account, and generate a private key. You will need:

- App ID
- Installation ID
- PKCS#8 private key

The application generates a signed app JWT on the server, exchanges it for a short-lived installation token, and reuses that token only until shortly before expiry.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```dotenv
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----"

UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

Never commit `.env.local`, private keys, or access tokens. The included `.gitignore` protects common secret-file formats.

### 4. Run the app

```bash
npm run dev
```

Open the local URL printed by Vinext, then search for a public GitHub username.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create and validate the production build |
| `npm start` | Run the production build locally |
| `npm test` | Build and run the rendered HTML test |
| `npm run lint` | Run ESLint |

## Caching and limits

- Match results are cached for **1 hour**.
- Each IP can start **10 searches per hour**.
- GitHub requests pass through a distributed Redis-backed queue.
- The search automatically reduces fan-out when the shared GitHub API budget becomes low.
- Cached responses do not repeat the GitHub discovery work.

The `GET /api/matches` status endpoint reports the active cache, search limit, latest GitHub rate budget, and current fan-out mode without exposing secrets.

## API

### Find matches

```http
POST /api/matches
Content-Type: application/json

{"username":"octocat"}
```

A successful response includes the searched profile, ranked matches, shared signals, score components, and cache metadata.

### Service status

```http
GET /api/matches
```

## Privacy and security

- Only public GitHub profile and repository data is read.
- Visitors are never asked for a personal access token.
- GitHub App credentials stay on the server.
- Installation tokens are short-lived and cached only in server memory.
- IP addresses are hashed before Redis rate-limit keys are created.
- Redis and GitHub credentials are configured as deployment secrets.

## Current limitations

- Results depend on recent public repository activity and available GitHub metadata.
- Private repositories and private contributions are not inspected.
- Sparse profiles may return few or no strong matches.
- The score is heuristic and intended for discovery, not evaluation.
- The first uncached search may take longer because it performs live GitHub fan-out; subsequent cached searches are faster.

## Project structure

```text
app/
  api/matches/route.ts   GitHub discovery, scoring, caching, and limits
  page.tsx               Search and result experience
lib/
  upstash.ts             Upstash REST client and identifier hashing
public/                  Static assets
.openai/hosting.json     Sites project configuration
```

## Contributing

Issues and focused pull requests are welcome. Please run the build and lint checks before submitting a change:

```bash
npm run build
npm run lint
```

If you find a security issue, avoid posting credentials or exploit details in a public issue. Contact the maintainer privately through their GitHub profile instead.
