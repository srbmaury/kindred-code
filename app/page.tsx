"use client";

import { FormEvent, useMemo, useState } from "react";

type User = { login:string; avatar_url:string; html_url:string; name:string|null; bio:string|null; location:string|null };
type Match = User & { score:number; sharedLanguages:string[]; sharedTopics:string[]; sharedRepos:string[]; scoreBreakdown:{ repositories:number; languages:number; topics:number } };
const sourceUrl = "https://github.com/srbmaury/kindred-code";
const liveUrl = "https://kindred-code-srbmaury.srbmaury.chatgpt.site";

export default function Home() {
  const [username,setUsername] = useState("");
  const [matches,setMatches] = useState<Match[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [hasSearched,setHasSearched] = useState(false);
  const [searchedFor,setSearchedFor] = useState("");
  const average = useMemo(() => matches.length ? Math.round(matches.reduce((sum,m) => sum+m.score,0)/matches.length) : 0,[matches]);

  async function findPeople(event:FormEvent) {
    event.preventDefault();
    const handle = username.trim().replace(/^@/,"");
    if (!handle) { setError("Enter a GitHub username to map your constellation."); return; }
    setLoading(true); setError(""); setHasSearched(true); setMatches([]); setSearchedFor(`@${handle}`);
    try {
      const response=await fetch("/api/matches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:handle})});
      const data=await response.json() as {profileName?:string;profileLogin?:string;matches?:Match[];error?:string};
      if(!response.ok)throw new Error(data.error||"The search could not be completed.");
      setMatches(data.matches||[]);setSearchedFor(data.profileLogin?`@${data.profileLogin}`:(data.profileName||`@${handle}`));
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  function shareConstellation() {
    const text=`I found ${matches.length} developers in my open-source constellation with Kindred Code. Same stack. Shared spark. ✦`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(liveUrl)}`,"_blank","noopener,noreferrer");
  }

  return <main>
    <nav><a className="brand" href="#top"><span>KC</span> Kindred Code</a><div className="nav-actions"><a className="nav-link" href="#how">How it works</a><a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer" aria-label="View source on GitHub">GitHub ↗</a></div></nav>
    <section className="hero" id="top">
      <div className="eyebrow"><i/> Find your people in open source</div>
      <h1>Same stack.<br/><em>Shared spark.</em></h1>
      <p className="lede">Discover developers whose public GitHub activity overlaps with yours—from languages and topics to the repositories that brought you together.</p>
      <form onSubmit={findPeople}>
        <label htmlFor="username">GitHub username</label>
        <div className="search-row"><div className="input-wrap"><span>@</span><input id="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="your-username" autoComplete="off" aria-describedby="search-note"/></div><button disabled={loading}>{loading?"Mapping…":"Find my people"}<span aria-hidden="true">↗</span></button></div>
        <p id="search-note" className="search-note"><span/> Live public GitHub data · Results refresh hourly</p>
        {error&&<p className="error" role="alert"><strong>Couldn’t map that constellation.</strong>{error}</p>}
      </form>
    </section>
    <section className="results" aria-live="polite" aria-busy={loading}>
      <div className="results-head"><div><p className="kicker">CURRENT CONSTELLATION</p><h2>{hasSearched?<>People aligned with <span>{searchedFor}</span></>:<>Your people will <span>appear here.</span></>}</h2></div>{matches.length>0&&<div className="result-actions"><div className="stat"><strong>{matches.length}</strong><span>matches<br/>{average}% avg. affinity</span></div><button className="share-button" onClick={shareConstellation}>Share my constellation <span>𝕏</span></button></div>}</div>
      {loading ? <div className="grid skeleton-grid" aria-label="Finding developer matches">{[0,1,2].map(i=><div className="skeleton-card" key={i}><i/><b/><b/><p/><p/><small/></div>)}</div>
      : matches.length>0 ? <div className="grid">{matches.map((m,i)=><article key={m.login} className="match-card">
        <div className="card-top"><img src={m.avatar_url} alt={`${m.name||m.login}'s GitHub avatar`}/><div className="identity"><h3>{m.name||m.login}</h3><a href={m.html_url} target="_blank" rel="noreferrer">@{m.login}</a></div><div className="score" title="Weighted from shared repository context, languages, and topics"><strong>{m.score}</strong><span>% affinity</span></div></div>
        <p className="bio">{m.bio||"Public GitHub contributor"}</p>
        <div className="why"><p>Why you matched</p>{m.sharedRepos.length>0&&<div><span className="reason-label">Repos</span><span className="reason-copy">{m.sharedRepos.slice(0,2).join(" · ")}</span></div>}{m.sharedLanguages.length>0&&<div><span className="reason-label">Stack</span><span className="reason-copy">{m.sharedLanguages.slice(0,3).join(" · ")}</span></div>}{m.sharedTopics.length>0&&<div><span className="reason-label">Topics</span><span className="reason-copy">{m.sharedTopics.slice(0,3).join(" · ")}</span></div>}</div>
        <div className="score-detail" aria-label={`Score breakdown: ${m.scoreBreakdown.repositories} repository, ${m.scoreBreakdown.languages} language, ${m.scoreBreakdown.topics} topic points`}><span style={{width:`${m.scoreBreakdown.repositories}%`}}/><span style={{width:`${m.scoreBreakdown.languages}%`}}/><span style={{width:`${m.scoreBreakdown.topics}%`}}/></div>
        <div className="card-foot"><span>{m.location||"Location not listed"}</span><a href={m.html_url} target="_blank" rel="noreferrer">View profile ↗</a></div><span className="rank">{String(i+1).padStart(2,"0")}</span>
      </article>)}</div>
      : hasSearched && !error ? <div className="empty-state"><span>✦</span><h3>No strong overlap yet.</h3><p>This profile’s recent public activity didn’t surface enough shared signals. Profiles with starred repositories, topics, and recent contributions work best.</p><button onClick={()=>{setHasSearched(false);setUsername("");}}>Try another username</button></div>
      : !hasSearched ? <div className="ready-state"><div><span>01</span><p>Enter any public GitHub username.</p></div><div><span>02</span><p>We inspect recent public repositories and contribution context.</p></div><div><span>03</span><p>You get ranked matches with visible reasons—not a black box.</p></div></div> : null}
    </section>
    <section className="how" id="how"><p className="kicker">SIGNALS, NOT SURVEILLANCE</p><h2>Built from public work.</h2><div><p><strong>45%</strong>Shared repository context—projects you both orbit.</p><p><strong>35%</strong>Language overlap across recent owned and starred work.</p><p><strong>20%</strong>Shared repository topics and technical interests.</p></div><p className="method-note">Affinity is a transparent discovery signal, not a judgment of skill or compatibility. Only public GitHub data is used.</p></section>
    <footer><span>Kindred Code</span><p><a href={sourceUrl} target="_blank" rel="noreferrer">Open source on GitHub ↗</a> · Built by <a href="https://github.com/srbmaury" target="_blank" rel="noreferrer">@srbmaury</a></p></footer>
  </main>;
}
