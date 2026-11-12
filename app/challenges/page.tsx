"use client";

import { useLanguage } from "@/components/LanguageProvider";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowRight, CalendarDays, Check, Gift, MapPin, Sparkles, Trophy } from "lucide-react";

type Progress = { challenge_id:string; progress_count:number; collected_letters:string[]; reward_status:string };

type Challenge = {
  id: string; title: string; challenge_word: string; description: string | null;
  image_url: string | null; reward_title: string | null; reward_description: string | null;
  starts_at: string; ends_at: string; restaurant_id: string;
  restaurant: { name: string; area: string | null; city: string | null; latitude: number | null; longitude: number | null } | null;
};

function distanceKm(a:number,b:number,c:number,d:number){
  const rad=(v:number)=>v*Math.PI/180, x=rad(c-a), y=rad(d-b);
  const h=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function dateLabel(value:string){return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(value));}

export default function ChallengesPage(){
  const { t } = useLanguage();
  const [items,setItems]=useState<Challenge[]>([]);
  const [progress,setProgress]=useState<Record<string,Progress>>({});
  const [selected,setSelected]=useState<string>("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [location,setLocation]=useState<{lat:number;lng:number}|null>(null);
  const [locationMessage,setLocationMessage]=useState("");

  useEffect(()=>{
    let alive=true;
    async function load(){
      if(!supabase){setError("Challenges are not available right now.");setLoading(false);return;}
      const now=new Date().toISOString();
      const {data,error}=await supabase.from("challenges")
        .select("id,title,challenge_word,description,image_url,reward_title,reward_description,starts_at,ends_at,restaurant_id,restaurant:restaurants(name,area,city,latitude,longitude)")
        .eq("status","live").lte("starts_at",now).gte("ends_at",now).order("ends_at",{ascending:true});
      if(!alive)return;
      if(error){setError("Unable to load live challenges. Please try again later.");}
      else{
        const rows=(data||[]) as unknown as Challenge[];
        setItems(rows);
        const savedChallenge = window.localStorage.getItem("thoam-current-challenge");
        setSelected(savedChallenge && rows.some((row) => row.id === savedChallenge) ? savedChallenge : "");
        const {data:{user}}=await supabase.auth.getUser();
        if(user){
          const {data:earned}=await supabase.from("challenge_progress")
            .select("challenge_id,progress_count,collected_letters,reward_status")
            .eq("customer_id",user.id);
          if(alive){const map:Record<string,Progress>={};(earned||[]).forEach((p:Progress)=>{map[p.challenge_id]=p;});setProgress(map);}
        }
      }
      setLoading(false);
    }
    void load();
    if("geolocation" in navigator){
      navigator.geolocation.getCurrentPosition(pos=>{if(alive)setLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});},()=>setLocationMessage("Location access is off. Showing all live challenges."),{timeout:8000,maximumAge:300000});
    }
    return()=>{alive=false;};
  },[]);

  const ordered=useMemo(()=>{
    if(!location)return items;
    return [...items].sort((a,b)=>{
      const da=a.restaurant?.latitude!=null&&a.restaurant.longitude!=null?distanceKm(location.lat,location.lng,a.restaurant.latitude,a.restaurant.longitude):Number.POSITIVE_INFINITY;
      const db=b.restaurant?.latitude!=null&&b.restaurant.longitude!=null?distanceKm(location.lat,location.lng,b.restaurant.latitude,b.restaurant.longitude):Number.POSITIVE_INFINITY;
      return da-db;
    });
  },[items,location]);
  const current=selected ? ordered.find(x=>x.id===selected)||null : null;
  useEffect(()=>{
    if(selected) window.localStorage.setItem("thoam-current-challenge",selected);
  },[selected]);
  const letters=current?.challenge_word.replace(/[^a-z0-9]/gi,"").toUpperCase().split("")||[];
  const currentProgress=current?progress[current.id]:undefined;
  const earnedLetters=currentProgress?.collected_letters||[];
  const progressCount=currentProgress?.progress_count||0;

  return <main className="ch-page">
    <header className="ch-top"><Link href="/" className="ch-brand">Tho’am<span>.</span></Link><span className="ch-top-tag">{t("REWARDS & EXPERIENCES")}</span></header>
    <section className="ch-hero"><div className="ch-kicker"><Trophy size={14}/> {t("THE THO’AM CHALLENGE CLUB")}</div><h1>{t("Order. Collect.")}<br/><span>{t("Win rewards.")}</span></h1><p>{t("Take part in challenges from restaurants around you and collect letters with eligible orders.")}</p><div className="ch-hero-count"><Sparkles size={15}/> {ordered.length} live {ordered.length===1?"challenge":"challenges"} right now</div></section>

    <section className="ch-section">
      <div className="ch-section-head"><div><div className="ch-eyebrow">{t("DISCOVER & JOIN")}</div><h2>{t("Live challenges")}</h2><p>{t("From restaurants near you")}</p></div><span className="ch-live-dot">LIVE</span></div>
      {locationMessage&&<p className="ch-location-note"><MapPin size={14}/>{locationMessage}</p>}
      {loading?<div className="ch-empty">{t("Finding live challenges…")}</div>:error?<div className="ch-empty">{error}</div>:ordered.length===0?<div className="ch-empty"><Trophy size={24}/><strong>{t("No live challenges yet")}</strong><span>{t("Check back soon. New restaurant challenges will appear here.")}</span></div>:
      <div className="ch-list">{ordered.map(ch=>{
        const active=current?.id===ch.id;
        const dist=location&&ch.restaurant?.latitude!=null&&ch.restaurant.longitude!=null?distanceKm(location.lat,location.lng,ch.restaurant.latitude,ch.restaurant.longitude):null;
        return <article key={ch.id} className={active?"ch-live-card chosen":"ch-live-card"}>
          <div className="ch-card-image" style={ch.image_url?{backgroundImage:"linear-gradient(180deg,transparent,rgba(0,0,0,.3)),url("+JSON.stringify(ch.image_url)+")"}:undefined}><span>{ch.restaurant?.name||t("Tho’am Partner")}</span></div>
          <div className="ch-card-body"><div className="ch-card-meta"><span className="ch-live-pill"><i/> {t("Live now")}</span>{dist!==null&&<span><MapPin size={12}/>{dist.toFixed(1)} km</span>}</div><h3>{ch.title}</h3><p>{ch.description||t("Collect letters with eligible orders and unlock a reward.")}</p><div className="ch-card-foot"><span><CalendarDays size={13}/> {t("Until")} {dateLabel(ch.ends_at)}</span><button onClick={()=>setSelected(ch.id)}>{active?t("Selected"):t("View challenge")} <ArrowRight size={14}/></button></div></div>
        </article>;
      })}</div>}
    </section>

    {!current && ordered.length>0 && !loading && <section className="ch-current-empty"><Trophy size={20}/><div><strong>{t("No current challenge selected")}</strong><span>{t("Choose a challenge above to see its personal progress and collected letters here.")}</span></div></section>}
    {current&&<section className="ch-current">
      <div className="ch-current-head"><div><div className="ch-eyebrow light">{t("YOUR PICK")}</div><h2>{t("Current selected challenge")}</h2></div><span className="ch-selected-tag"><Check size={12}/> SELECTED</span></div>
      <div className="ch-current-main">
        <div className="ch-current-image" style={current.image_url?{backgroundImage:"url("+JSON.stringify(current.image_url)+")"}:undefined}><span>{current.restaurant?.name||"Tho’am"}</span></div>
        <div className="ch-current-info"><span className="ch-restaurant-name">{current.restaurant?.name||t("Partner restaurant")}</span><h3>{current.title}</h3><p>{current.description||t("Collect every letter to complete this challenge.")}</p><div className="ch-reward"><Gift size={16}/><div><b>{current.reward_title||t("Challenge reward")}</b><span>{current.reward_description||t("Reward details will be announced by the restaurant.")}</span></div></div></div>
      </div>
      <div className="ch-progress-head"><span>{t("Your progress")}</span><b>{progressCount} / {letters.length}</b></div><div className="ch-progress-track"><span style={{width:(letters.length?Math.min(100,progressCount/letters.length*100):0)+"%"}}/></div>
      <div className="ch-letters-label">{t("COLLECTED LETTERS")}</div><div className="ch-letters">{letters.map((letter,i)=><span key={i} className={i<progressCount?"earned":""}>{i<progressCount?earnedLetters[i]||letter:"·"}</span>)}</div>
      <p className="ch-progress-note">{currentProgress?.reward_status==="ready"?t("Challenge completed! Visit the restaurant to claim your reward."):currentProgress?.reward_status==="redeemed"?t("Your reward has been marked as redeemed."):progressCount>0?t("Your letters are saved automatically from eligible completed and paid delivery orders."):t("Sign in and place eligible delivery orders to start collecting letters. Guest QR orders are not eligible.")}</p>
    </section>}

    <section className="ch-how"><div className="ch-eyebrow">{t("SIMPLE & REWARDING")}</div><h2>{t("How challenges work")}</h2><div className="ch-steps"><div><b>01</b><strong>{t("Choose a challenge")}</strong><span>{t("Pick a live challenge from a nearby restaurant.")}</span></div><div><b>02</b><strong>{t("Place eligible orders")}</strong><span>{t("Collect letters as you order during the challenge.")}</span></div><div><b>03</b><strong>{t("Complete & win")}</strong><span>{t("Finish the name and claim the reward.")}</span></div></div></section>

    <style jsx global>{`
      .ch-page{min-height:100vh;background:#f7f7f5;color:#111;padding:0 0 110px;font-family:inherit}
      .ch-top{height:76px;padding:0 max(22px,calc((100vw - 1120px)/2));display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e9e9e6;background:#fff}
      .ch-brand{font-size:22px;font-weight:950;letter-spacing:-1.3px;color:#111;text-decoration:none}.ch-brand span{color:#888}
      .ch-top-tag{font-size:9px;font-weight:850;letter-spacing:.18em;color:#888}
      .ch-hero{max-width:1120px;margin:0 auto;padding:66px 24px 44px}
      .ch-kicker,.ch-hero-count{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:850;letter-spacing:.13em}
      .ch-kicker{padding:9px 12px;border:1px solid #ddd;border-radius:99px;background:#fff}
      .ch-hero h1{font-size:clamp(42px,7vw,76px);line-height:.98;letter-spacing:-.065em;margin:23px 0 15px;font-weight:950}
      .ch-hero h1 span{color:#888}.ch-hero>p{max-width:510px;color:#686868;font-size:15px;line-height:1.7}
      .ch-hero-count{margin-top:18px;color:#555;letter-spacing:0;font-size:12px}
      .ch-section,.ch-how{max-width:1120px;margin:0 auto;padding:0 24px 50px}
      .ch-section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:20px}
      .ch-eyebrow{font-size:9px;font-weight:900;letter-spacing:.18em;color:#888}
      .ch-section-head h2,.ch-how h2{font-size:28px;letter-spacing:-.045em;margin:7px 0 3px}.ch-section-head p{margin:0;color:#777;font-size:13px}
      .ch-live-dot,.ch-live-pill{display:inline-flex;align-items:center;gap:7px;font-size:9px;font-weight:900;letter-spacing:.12em}
      .ch-live-dot{padding:8px 11px;border-radius:99px;background:#e9f6ec;color:#28633a}
      .ch-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .ch-live-card{overflow:hidden;border:1px solid #e7e7e4;border-radius:14px;background:#fff;transition:border-color .2s,transform .2s}
      .ch-live-card.chosen{border-color:#111;box-shadow:0 12px 35px #0000000c}
      .ch-card-image{height:142px;background:linear-gradient(135deg,#292929,#777);background-size:cover;background-position:center;display:flex;align-items:end;padding:15px}
      .ch-card-image span,.ch-current-image span{padding:7px 10px;border-radius:7px;background:#ffffffed;color:#111;font-size:10px;font-weight:900}
      .ch-card-body{padding:14px}.ch-card-meta{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:10px}
      .ch-card-meta>span:last-child{display:flex;align-items:center;gap:4px}
      .ch-live-pill{color:#23673b;letter-spacing:.04em}.ch-live-pill i{width:6px;height:6px;border-radius:50%;background:#2c9c53}
      .ch-card-body h3{font-size:18px;letter-spacing:-.04em;margin:12px 0 6px}.ch-card-body>p{min-height:34px;color:#777;font-size:12px;line-height:1.6;margin:0}
      .ch-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:17px;padding-top:14px;border-top:1px solid #eee}
      .ch-card-foot>span{display:flex;align-items:center;gap:5px;color:#777;font-size:10px}
      .ch-card-foot button{display:flex;align-items:center;gap:6px;border:0;border-radius:99px;background:#111;color:#fff;padding:10px 13px;font-size:10px;font-weight:800;cursor:pointer}
      .ch-current-empty{max-width:1072px;margin:0 auto 48px;padding:22px 25px;display:flex;align-items:center;gap:14px;border:1px dashed #bdbdb8;border-radius:15px;background:#fff;color:#555}
      .ch-current-empty div{display:flex;flex-direction:column;gap:4px}.ch-current-empty strong{font-size:13px;color:#111}.ch-current-empty span{font-size:11px;color:#777;line-height:1.5}
      .ch-empty{min-height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;border:1px dashed #d5d5d1;border-radius:16px;color:#777;text-align:center;font-size:12px;padding:24px}
      .ch-empty strong{color:#222;font-size:15px}.ch-location-note{display:flex;gap:7px;align-items:center;color:#777;font-size:11px;margin:0 0 12px}
      .ch-current{max-width:1072px;margin:0 auto 55px;padding:28px;border-radius:23px;background:#111;color:#fff;box-shadow:0 22px 55px #00000017}
      .ch-current-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.ch-eyebrow.light{color:#999}.ch-current-head h2{font-size:24px;letter-spacing:-.04em;margin:6px 0}
      .ch-selected-tag{display:flex;align-items:center;gap:5px;padding:7px 10px;border-radius:99px;background:#fff;color:#111;font-size:9px;font-weight:900;letter-spacing:.1em}
      .ch-current-main{display:grid;grid-template-columns:180px 1fr;gap:24px;align-items:center}
      .ch-current-image{height:170px;border-radius:14px;background:linear-gradient(135deg,#333,#666);background-size:cover;background-position:center;display:flex;align-items:end;padding:12px}
      .ch-current-info .ch-restaurant-name{color:#aaa;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em}
      .ch-current-info h3{font-size:29px;letter-spacing:-.05em;margin:7px 0}.ch-current-info>p{color:#bcbcbc;font-size:12px;line-height:1.6;margin:0 0 13px}
      .ch-reward{display:flex;gap:10px;align-items:center;padding:11px 13px;border:1px solid #343434;border-radius:11px;max-width:460px}.ch-reward div{display:flex;flex-direction:column;gap:3px}.ch-reward b{font-size:11px}.ch-reward span{color:#aaa;font-size:10px}
      .ch-progress-head{display:flex;justify-content:space-between;margin:25px 0 9px;font-size:12px}.ch-progress-head b{font-variant-numeric:tabular-nums}
      .ch-progress-track{height:8px;border-radius:99px;background:#414141;overflow:hidden}.ch-progress-track span{display:block;width:0;height:100%;background:#fff}
      .ch-letters-label{margin-top:19px;color:#aaa;font-size:9px;font-weight:900;letter-spacing:.16em}.ch-letters{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
      .ch-letters span{display:grid;place-items:center;width:35px;height:38px;border-radius:8px;background:#414141;color:#aaa;font-size:16px;font-weight:950}.ch-letters span.earned{background:#fff;color:#111}
      .ch-progress-note{margin:13px 0 0;color:#aaa;font-size:10px;line-height:1.5}
      .ch-how{padding-bottom:65px}.ch-how h2{margin-bottom:19px}
      .ch-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .ch-steps>div{padding:19px;border:1px solid #e5e5e1;border-radius:14px;background:#fff;display:flex;flex-direction:column;gap:8px}
      .ch-steps b{color:#999;font-size:10px;letter-spacing:.1em}.ch-steps strong{font-size:13px}.ch-steps span{color:#777;font-size:11px;line-height:1.6}
      @media(max-width:700px){.ch-hero{padding:43px 19px 34px}.ch-section,.ch-how{padding-left:19px;padding-right:19px}.ch-list{grid-template-columns:1fr}.ch-card-image{height:125px}.ch-current-empty{margin:0 15px 42px}.ch-current{margin:0 15px 42px;padding:20px;border-radius:18px}.ch-current-main{grid-template-columns:104px 1fr;gap:14px}.ch-current-image{height:120px}.ch-current-info h3{font-size:20px}.ch-current-info>p{font-size:11px}.ch-current-head h2{font-size:19px}.ch-steps{grid-template-columns:1fr}.ch-hero h1{font-size:49px}}
      @media(prefers-reduced-motion:reduce){.ch-live-card{transition:none}}
    `}</style>
  </main>;
}
