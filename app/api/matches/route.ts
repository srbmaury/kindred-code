import { hasRedis, hashIdentifier, redis } from "../../../lib/upstash";
type Repo = { name: string; full_name: string; language: string | null; topics?: string[] };
type User = { login: string; avatar_url: string; html_url: string; name: string | null; bio: string | null; location: string | null };
type Budget = { limit: number; remaining: number; reset: number; checkedAt: number };
const CACHE_SECONDS = 3600, SEARCHES_PER_HOUR = 10, QUEUE_DELAY_MS = 750;
const memoryCache = new Map<string, { expiresAt: number; data: unknown }>();
const memoryRate = new Map<string, { window: number; count: number }>();
let installationToken: { value: string; expiresAt: number } | undefined;
let latestBudget: Budget | undefined;
let localQueue = Promise.resolve();
function encode(value: string | Uint8Array) { const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value; let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function createAppJwt() {
  const appId = process.env.GITHUB_APP_ID, pem = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !pem) throw new Error("GitHub App credentials are not configured.");
  const der = Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000), unsigned = `${encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${encode(new Uint8Array(signature))}`;
}
async function getInstallationToken() {
  if (installationToken && installationToken.expiresAt > Date.now() + 60000) return installationToken.value;
  const id = process.env.GITHUB_APP_INSTALLATION_ID; if (!id) throw new Error("GitHub App installation is not configured.");
  const response = await fetch(`https://api.github.com/app/installations/${id}/access_tokens`, { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${await createAppJwt()}`, "User-Agent": "Kindred-Code-Matcher", "X-GitHub-Api-Version": "2022-11-28" } });
  if (!response.ok) throw new Error(`GitHub App authentication failed (${response.status}).`);
  const data = await response.json() as { token: string; expires_at: string }; installationToken = { value: data.token, expiresAt: new Date(data.expires_at).getTime() }; return data.token;
}
async function waitForGitHubSlot() {
  if (hasRedis) {
    const script = "local last=tonumber(redis.call('GET',KEYS[1]) or '0');local now=tonumber(ARGV[2]);local scheduled=math.max(now,last);redis.call('SET',KEYS[1],scheduled+tonumber(ARGV[1]),'PX',60000);return scheduled-now";
    const wait = await redis<number>("EVAL", script, 1, "kindred:github:next-slot", QUEUE_DELAY_MS, Date.now()); if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait)); return;
  }
  const previous = localQueue; let release = () => {}; localQueue = new Promise<void>(resolve => { release = resolve; }); await previous; await new Promise(resolve => setTimeout(resolve, QUEUE_DELAY_MS)); release();
}
async function github<T>(path: string): Promise<T> {
  await waitForGitHubSlot();
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${await getInstallationToken()}`, "User-Agent": "Kindred-Code-Matcher", "X-GitHub-Api-Version": "2022-11-28" } });
  const limit = Number(response.headers.get("x-ratelimit-limit")), remaining = Number(response.headers.get("x-ratelimit-remaining")), reset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(remaining)) latestBudget = { limit, remaining, reset, checkedAt: Date.now() };
  if (!response.ok) { if (response.status === 404) throw new Error("That GitHub user was not found."); if (response.status === 403 || response.status === 429) throw new Error("GitHub's API limit was reached. Try again later."); throw new Error("GitHub could not complete the search right now."); }
  return response.json();
}
const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter(Boolean) as string[])];
async function getCached(key: string) { if (hasRedis) { const value = await redis<string | null>("GET", key); return value ? JSON.parse(value) : null; } const value = memoryCache.get(key); return value && value.expiresAt > Date.now() ? value.data : null; }
async function setCached(key: string, data: unknown) { if (hasRedis) return redis("SETEX", key, CACHE_SECONDS, JSON.stringify(data)); memoryCache.set(key, { data, expiresAt: Date.now() + CACHE_SECONDS * 1000 }); }
async function enforceRateLimit(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local", id = await hashIdentifier(ip), window = Math.floor(Date.now() / 3600000), key = `kindred:rate:${id}:${window}`;
  if (hasRedis) { const count = await redis<number>("INCR", key); if (count === 1) await redis("EXPIRE", key, 3700); return count; }
  const current = memoryRate.get(id), count = current?.window === window ? current.count + 1 : 1; memoryRate.set(id, { window, count }); return count;
}
async function readSharedBudget() { if (!hasRedis) return latestBudget; const value = await redis<string | null>("GET", "kindred:github:budget"); return value ? JSON.parse(value) as Budget : latestBudget; }
async function saveSharedBudget() { if (hasRedis && latestBudget) await redis("SETEX", "kindred:github:budget", 7200, JSON.stringify(latestBudget)); }
function fanoutFor(budget?: Budget) { if (budget && budget.remaining <= 500) return { sourceCount: 2, candidateCount: 2, mode: "conservation" }; if (budget && budget.remaining <= 1500) return { sourceCount: 4, candidateCount: 4, mode: "reduced" }; return { sourceCount: 7, candidateCount: 8, mode: "full" }; }
export async function GET() { const budget = await readSharedBudget().catch(() => latestBudget); return Response.json({ cache: hasRedis ? "upstash" : "memory", searchesPerIpPerHour: SEARCHES_PER_HOUR, github: budget || null, fanout: fanoutFor(budget) }); }
export async function POST(request: Request) {
  try {
    const count = await enforceRateLimit(request); if (count > SEARCHES_PER_HOUR) return Response.json({ error: "Search limit reached. Try again next hour." }, { status: 429, headers: { "Retry-After": "3600" } });
    const body = await request.json() as { username?: string }, handle = (body.username || "").trim().replace(/^@/, "");
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(handle)) return Response.json({ error: "Enter a valid GitHub username." }, { status: 400 });
    const cacheKey = `kindred:matches:v3:${handle.toLowerCase()}`, cached = await getCached(cacheKey); if (cached) return Response.json(cached, { headers: { "X-Kindred-Cache": "HIT" } });
    const plan = fanoutFor(await readSharedBudget().catch(() => latestBudget));
    const [profile, starred, owned] = await Promise.all([github<User>(`/users/${handle}`), github<Repo[]>(`/users/${handle}/starred?per_page=20`), github<Repo[]>(`/users/${handle}/repos?sort=updated&per_page=20`)]);
    const sources = [...starred.slice(0, Math.max(1, plan.sourceCount - 2)), ...owned.slice(0, Math.min(2, plan.sourceCount))].slice(0, plan.sourceCount), myLanguages = unique([...starred, ...owned].map(repo => repo.language)), myTopics = unique([...starred, ...owned].flatMap(repo => repo.topics || []));
    const contributorLists: { login: string }[][] = []; for (const repo of sources) contributorLists.push(await github<{ login: string }[]>(`/repos/${repo.full_name}/contributors?per_page=5`).catch(() => []));
    const sharedReposByLogin = new Map<string,string[]>(); contributorLists.forEach((people,index) => people.forEach(person => { const key=person.login.toLowerCase(); if(key===handle.toLowerCase())return; sharedReposByLogin.set(key,unique([...(sharedReposByLogin.get(key)||[]),sources[index].full_name])); }));
    const logins = unique(contributorLists.flat().map(person => person.login)).filter(login => login.toLowerCase() !== handle.toLowerCase()).slice(0, plan.candidateCount), matches = [];
    for (const login of logins) {
      const [person, repos] = await Promise.all([github<User>(`/users/${login}`), github<Repo[]>(`/users/${login}/repos?sort=updated&per_page=20`)]);
      const languages = unique(repos.map(repo => repo.language)), topics = unique(repos.flatMap(repo => repo.topics || [])), sharedLanguages = myLanguages.filter(item => languages.includes(item)), sharedTopics = myTopics.filter(item => topics.includes(item)), sharedRepos=sharedReposByLogin.get(login.toLowerCase())||[];
      const languageRatio=sharedLanguages.length/Math.max(1,Math.min(myLanguages.length,languages.length,5)), topicRatio=sharedTopics.length/Math.max(1,Math.min(myTopics.length,topics.length,5)), repoRatio=Math.min(1,sharedRepos.length/2);
      const scoreBreakdown={repositories:Math.round(45*repoRatio),languages:Math.round(35*Math.min(1,languageRatio)),topics:Math.round(20*Math.min(1,topicRatio))};
      const score=Math.max(1,Math.min(99,scoreBreakdown.repositories+scoreBreakdown.languages+scoreBreakdown.topics));
      matches.push({ login: person.login, name: person.name, avatar_url: person.avatar_url, html_url: person.html_url, bio: person.bio, location: person.location, sharedLanguages, sharedTopics, sharedRepos, scoreBreakdown, score });
    }
    const data = { profileName: profile.name || `@${profile.login}`, profileLogin:profile.login, matches: matches.filter(match=>match.score>=20).sort((a, b) => b.score - a.score).slice(0, 6), meta: { fanout: plan.mode, cachedForSeconds: CACHE_SECONDS, scoreWeights:{repositories:45,languages:35,topics:20} } };
    await Promise.all([setCached(cacheKey, data), saveSharedBudget()]);
    return Response.json(data, { headers: { "X-Kindred-Cache": "MISS", "X-GitHub-RateLimit-Remaining": String(latestBudget?.remaining ?? "unknown") } });
  } catch (error) { const message = error instanceof Error ? error.message : "Something went wrong."; return Response.json({ error: message }, { status: message.includes("not found") ? 404 : 500 }); }
}
