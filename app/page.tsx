"use client";

import { FormEvent, useMemo, useState } from "react";

type User = { login:string; avatar_url:string; html_url:string; name:string|null; bio:string|null; location:string|null };
type Match = User & { score:number; sharedLanguages:string[]; sharedTopics:string[] };

const demo: Match[] = [
  { login:"torvalds", name:"Linus Torvalds", avatar_url:"https://github.com/torvalds.png", html_url:"https://github.com/torvalds", bio:"Creator of Linux and Git", location:"Portland, OR", score:89, sharedLanguages:["C","Shell"], sharedTopics:["linux","systems"] },
  { login:"sindresorhus", name:"Sindre Sorhus", avatar_url:"https://github.com/sindresorhus.png", html_url:"https://github.com/sindresorhus", bio:"Full-time open-sourcerer", location:null, score:82, sharedLanguages:["TypeScript","JavaScript"], sharedTopics:["cli","developer-tools"] },
  { login:"kentcdodds", name:"Kent C. Dodds", avatar_url:"https://github.com/kentcdodds.png", html_url:"https://github.com/kentcdodds", bio:"Helping people make the world better through quality software", location:"Utah, USA", score:76, sharedLanguages:["TypeScript"], sharedTopics:["react","testing"] },
];

export default function Home() {
  const [username,setUsername] = useState("");
  const [matches,setMatches] = useState<Match[]>(demo);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [searchedFor,setSearchedFor] = useState("demo profile");
  const average = useMemo(() => Math.round(matches.reduce((sum,m) => sum+m.score,0)/Math.max(matches.length,1)),[matches]);

  async function findPeople(event:FormEvent) {
    event.preventDefault();
    const handle = username.trim().replace(/^@/,"");
    if (!handle) return;
    setLoading(true); setError("");
    try {
      const response=await fetch("/api/matches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:handle})});
      const data=await response.json() as {profileName?:string;matches?:Match[];error?:string};
      if(!response.ok)throw new Error(data.error||"The search could not be completed.");
      setMatches(data.matches||[]);setSearchedFor(data.profileName||`@${handle}`);
      if(!data.matches?.length)setError("No strong matches appeared from this profile's recent public activity.");
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  return <main>
    <nav><a className="brand" href="#top"><span>KC</span> Kindred Code</a><a className="nav-link" href="#how">How it works</a></nav>
    <section className="hero" id="top">
      <div className="eyebrow"><i/> Find your people in open source</div>
      <h1>Same stack.<br/><em>Shared spark.</em></h1>
      <p className="lede">Discover developers whose public GitHub activity overlaps with yours—from languages and topics to the projects you care about.</p>
      <form onSubmit={findPeople}>
        <label htmlFor="username">GitHub username</label>
        <div className="search-row"><div className="input-wrap"><span>@</span><input id="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="your-username" autoComplete="off"/></div><button disabled={loading}>{loading?"Connecting…":"Find my people"}<span>↗</span></button></div>
        {error&&<p className="error" role="alert">{error}</p>}
      </form>
    </section>
    <section className="results" aria-live="polite">
      <div className="results-head"><div><p className="kicker">CURRENT CONSTELLATION</p><h2>People aligned with <span>{searchedFor}</span></h2></div><div className="stat"><strong>{matches.length}</strong><span>matches<br/>{average}% avg. affinity</span></div></div>
      <div className="grid">{matches.map((m,i)=><article key={m.login}>
        <div className="card-top"><img src={m.avatar_url} alt=""/><div><h3>{m.name||m.login}</h3><a href={m.html_url} target="_blank" rel="noreferrer">@{m.login}</a></div><div className="score"><strong>{m.score}</strong><span>% match</span></div></div>
        <p className="bio">{m.bio||"Building things in public on GitHub."}</p><div className="signals">{m.sharedLanguages.slice(0,2).map(x=><span key={x}>⌁ {x}</span>)}{m.sharedTopics.slice(0,2).map(x=><span key={x}># {x}</span>)}{!m.sharedLanguages.length&&!m.sharedTopics.length&&<span>✦ Shared repositories</span>}</div>
        <div className="card-foot"><span>{m.location||"Somewhere on GitHub"}</span><a href={m.html_url} target="_blank" rel="noreferrer">View profile ↗</a></div><span className="rank">0{i+1}</span>
      </article>)}</div>
    </section>
    <section className="how" id="how"><p className="kicker">SIGNALS, NOT SURVEILLANCE</p><h2>Built from public work.</h2><div><p><strong>01</strong>We read public starred and owned repositories.</p><p><strong>02</strong>We find nearby contributors, then compare languages and topics.</p><p><strong>03</strong>You get explainable matches—not a mysterious black box.</p></div></section>
    <footer><span>Kindred Code</span><p>A playful prototype by <a href="https://github.com/srbmaury" target="_blank" rel="noreferrer">@srbmaury ↗</a></p></footer>
  </main>;
}
