"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CalendarDays, Gift, Pencil, Plus, RefreshCw, Save, Trophy, Trash2 } from "lucide-react";

type Challenge={id:string;title:string;challenge_word:string;description:string|null;image_url:string|null;starts_at:string;ends_at:string;status:string;reward_title:string|null;reward_description:string|null;restaurant_id:string};
type Progress={id:string;challenge_id:string;customer_id:string;progress_count:number;collected_letters:string[];reward_status:string;completed_at:string|null;redeemed_at:string|null};
type FormState={title:string;challenge_word:string;description:string;image_url:string;starts_at:string;ends_at:string;status:string;reward_title:string;reward_description:string};
const blank:FormState={title:"",challenge_word:"",description:"",image_url:"",starts_at:"",ends_at:"",status:"draft",reward_title:"",reward_description:""};
const localInput=(value:string)=>{const d=new Date(value);const p=(n:number)=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());};

export default function RestaurantChallengesPage(){
 const router=useRouter();
 const [restaurantId,setRestaurantId]=useState("");
 const [rows,setRows]=useState<Challenge[]>([]);
 const [progress,setProgress]=useState<Progress[]>([]);
 const [form,setForm]=useState<FormState>(blank);
 const [editing,setEditing]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const load=useCallback(async()=>{
  if(!supabase){setMessage("Supabase is not configured.");setLoading(false);return;}
  setLoading(true);setMessage("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();if(authError)throw authError;
   if(!user){router.replace("/auth?role=owner&next=/restaurant-admin/challenges");return;}
   const {data:profile,error:profileError}=await supabase.from("profiles").select("role,restaurant_id").eq("id",user.id).maybeSingle();if(profileError)throw profileError;
   if(profile?.role!=="restaurant_owner"||!profile.restaurant_id){setMessage("Only the linked restaurant owner can manage challenges.");setLoading(false);return;}
   setRestaurantId(profile.restaurant_id);
   const [cr,pr]=await Promise.all([
    supabase.from("challenges").select("*").eq("restaurant_id",profile.restaurant_id).order("created_at",{ascending:false}),
    supabase.from("challenge_progress").select("id,challenge_id,customer_id,progress_count,collected_letters,reward_status,completed_at,redeemed_at").order("updated_at",{ascending:false}).limit(100)
   ]);
   if(cr.error)throw cr.error;if(pr.error)throw pr.error;
   setRows((cr.data||[]) as Challenge[]);setProgress((pr.data||[]) as Progress[]);
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to load challenge data.");}
  finally{setLoading(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 function newChallenge(){setEditing(null);setForm({...blank,starts_at:localInput(new Date().toISOString()),ends_at:localInput(new Date(Date.now()+30*86400000).toISOString())});setMessage("");}
 function edit(c:Challenge){setEditing(c.id);setForm({title:c.title,challenge_word:c.challenge_word,description:c.description||"",image_url:c.image_url||"",starts_at:localInput(c.starts_at),ends_at:localInput(c.ends_at),status:c.status,reward_title:c.reward_title||"",reward_description:c.reward_description||""});}
 async function save(e:FormEvent){e.preventDefault();if(!supabase||saving)return;setMessage("");
  if(!form.title.trim()||!form.challenge_word.trim()||!form.starts_at||!form.ends_at){setMessage("Please complete the challenge name, word and dates.");return;}
  if(new Date(form.ends_at)<=new Date(form.starts_at)){setMessage("End date must be after start date.");return;}
  if(form.image_url&&!/^https:\/\//i.test(form.image_url)){setMessage("Image URL must use HTTPS.");return;}
  setSaving(true);
  const payload={title:form.title.trim(),challenge_word:form.challenge_word.toUpperCase().replace(/[^A-Z0-9]/g,""),description:form.description.trim()||null,image_url:form.image_url.trim()||null,starts_at:new Date(form.starts_at).toISOString(),ends_at:new Date(form.ends_at).toISOString(),status:form.status,reward_title:form.reward_title.trim()||null,reward_description:form.reward_description.trim()||null,restaurant_id:restaurantId};
  const result=editing?await supabase.from("challenges").update(payload).eq("id",editing).eq("restaurant_id",restaurantId):await supabase.from("challenges").insert(payload);
  if(result.error)setMessage(result.error.message);else{setForm(blank);setEditing(null);await load();}
  setSaving(false);
 }
 async function remove(c:Challenge){if(!supabase||!confirm("Delete this challenge and its progress? This cannot be undone."))return;const {error}=await supabase.from("challenges").delete().eq("id",c.id).eq("restaurant_id",restaurantId);if(error)setMessage(error.message);else await load();}
 async function redeem(p:Progress){if(!supabase||!confirm("Confirm that this customer has received the challenge reward?"))return;const {error}=await supabase.rpc("redeem_challenge_reward",{p_progress_id:p.id});if(error)setMessage(error.message);else await load();}
 const names=new Map(rows.map(c=>[c.id,c.title]));
 return <main className="rc-page">
  <Link href="/restaurant-admin" className="rc-back"><ArrowLeft size={15}/> Dashboard</Link>
  <header className="rc-head"><div><span className="rc-kicker">RESTAURANT PARTNER · REWARDS</span><h1>Challenges<span>.</span></h1><p>Create a challenge, set its reward and track customer progress.</p></div><button className="rc-primary" onClick={newChallenge}><Plus size={16}/> New challenge</button></header>
  {message&&<div className="rc-message" role="alert">{message}</div>}
  {(editing!==null||form.title!=="")&&<form className="rc-form" onSubmit={save}>
   <div className="rc-form-head"><div><span>{editing?"EDIT CHALLENGE":"CREATE CHALLENGE"}</span><h2>{editing?"Update challenge":"Challenge details"}</h2></div><button type="button" className="rc-cancel" onClick={()=>{setForm(blank);setEditing(null);}}>Cancel</button></div>
   <div className="rc-fields">
    <label>Challenge name<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Complete the restaurant name"/></label>
    <label>Required letters<input required maxLength={32} value={form.challenge_word} onChange={e=>setForm({...form,challenge_word:e.target.value})} placeholder="MANDHI"/><small>Repeated letters are required separately.</small></label>
    <label className="rc-wide">Description<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Explain how customers can participate."/></label>
    <label className="rc-wide">Challenge image URL<input type="url" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://..."/></label>
    <label>Starts at<input type="datetime-local" required value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
    <label>Ends at<input type="datetime-local" required value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label>
    <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="live">Live</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
    <label>Reward title<input value={form.reward_title} onChange={e=>setForm({...form,reward_title:e.target.value})} placeholder="Free meal / discount"/></label>
    <label className="rc-wide">Reward conditions<input value={form.reward_description} onChange={e=>setForm({...form,reward_description:e.target.value})} placeholder="Terms and conditions"/></label>
   </div>
   {form.image_url&&<img className="rc-preview" src={form.image_url} alt="Challenge preview" onError={e=>{e.currentTarget.style.display="none";}}/>}
   <div className="rc-actions"><button type="submit" className="rc-primary" disabled={saving}><Save size={15}/>{saving?"Saving…":"Save challenge"}</button></div>
  </form>}
  <section className="rc-section"><div className="rc-section-head"><div><span className="rc-kicker">YOUR CAMPAIGNS</span><h2>All challenges <small>{rows.length}</small></h2></div><button className="rc-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
   {loading?<div className="rc-empty">Loading…</div>:rows.length===0?<div className="rc-empty"><Trophy size={25}/><b>No challenges yet</b><span>Create your first restaurant challenge.</span></div>:<div className="rc-cards">{rows.map(c=><article className="rc-card" key={c.id}><div className="rc-card-image" style={c.image_url?{backgroundImage:"url("+JSON.stringify(c.image_url)+")"}:undefined}/><div className="rc-card-content"><span className={"rc-status "+c.status}>{c.status}</span><h3>{c.title}</h3><p>{c.challenge_word}</p><small><CalendarDays size={12}/> {new Date(c.starts_at).toLocaleDateString("en-IN")} – {new Date(c.ends_at).toLocaleDateString("en-IN")}</small><div className="rc-card-actions"><button onClick={()=>edit(c)}><Pencil size={14}/> Edit</button><button onClick={()=>void remove(c)}><Trash2 size={14}/> Delete</button></div></div></article>)}</div>}
  </section>
  <section className="rc-section"><div className="rc-section-head"><div><span className="rc-kicker">CUSTOMER REWARDS</span><h2>Progress & redemption</h2></div></div>
   {progress.length===0?<div className="rc-empty"><Gift size={24}/><b>No customer progress yet</b><span>Eligible completed and paid orders will award letters automatically.</span></div>:<div className="rc-progress-list">{progress.filter(p=>names.has(p.challenge_id)).map(p=><article key={p.id} className="rc-progress-row"><div><b>{names.get(p.challenge_id)}</b><span>Customer · {p.customer_id.slice(0,8)}…</span><small>{p.collected_letters.join(" · ")} — {p.progress_count} letters</small></div><span className={"rc-status "+p.reward_status}>{p.reward_status}</span>{p.reward_status==="ready"&&<button className="rc-primary" onClick={()=>void redeem(p)}>Confirm reward given</button>}</article>)}</div>}
  </section>
  <style jsx global>{`
   .rc-page{max-width:1120px;margin:0 auto;padding:28px 22px 90px;color:#151515}.rc-back{display:inline-flex;align-items:center;gap:7px;color:#777;text-decoration:none;font-size:12px;margin-bottom:24px}.rc-head,.rc-section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.rc-kicker{font-size:9px;letter-spacing:.17em;font-weight:900;color:#888}.rc-head h1{font-size:42px;letter-spacing:-.06em;margin:7px 0}.rc-head h1 span{color:#999}.rc-head p{color:#777;font-size:13px;margin:0}.rc-primary,.rc-refresh,.rc-cancel{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:9px;padding:11px 14px;font-size:11px;font-weight:850;cursor:pointer}.rc-primary{background:#111;color:#fff}.rc-primary:disabled{opacity:.5}.rc-refresh,.rc-cancel{background:#eee;color:#222}.rc-message{margin:20px 0;padding:12px;border-radius:9px;background:#fff0ef;color:#8c2929;font-size:12px}.rc-form{margin:26px 0;padding:23px;border:1px solid #e7e7e2;border-radius:16px;background:#fff}.rc-form-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:19px}.rc-form-head span{font-size:9px;letter-spacing:.15em;color:#888;font-weight:900}.rc-form-head h2{font-size:21px;margin:5px 0}.rc-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.rc-fields label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:800}.rc-fields input,.rc-fields textarea,.rc-fields select{width:100%;border:1px solid #ddd;border-radius:8px;padding:11px;background:#fff;color:#111;font:inherit;font-size:12px}.rc-fields small{font-size:10px;color:#888;font-weight:500}.rc-wide{grid-column:1/-1}.rc-preview{display:block;max-width:260px;max-height:150px;object-fit:cover;border-radius:10px;margin-top:15px}.rc-actions{display:flex;justify-content:flex-end;margin-top:18px}.rc-section{margin-top:38px}.rc-section-head{margin-bottom:17px}.rc-section-head h2{font-size:23px;letter-spacing:-.04em;margin:6px 0}.rc-section-head h2 small{font-size:11px;color:#888}.rc-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.rc-card{display:grid;grid-template-columns:125px 1fr;overflow:hidden;border:1px solid #e7e7e2;border-radius:13px;background:#fff}.rc-card-image{background:#ddd center/cover;min-height:160px}.rc-card-content{padding:14px}.rc-status{display:inline-block;padding:5px 8px;border-radius:99px;background:#eee;color:#555;font-size:9px;font-weight:900;text-transform:uppercase}.rc-status.live,.rc-status.ready{background:#e7f5e9;color:#27633b}.rc-status.redeemed{background:#e8edf9;color:#344d83}.rc-card h3{font-size:17px;margin:10px 0 3px}.rc-card p{font-size:12px;color:#777;margin:0 0 9px;letter-spacing:.12em}.rc-card-content>small{display:flex;align-items:center;gap:5px;color:#888;font-size:10px}.rc-card-actions{display:flex;gap:7px;margin-top:14px}.rc-card-actions button{display:flex;align-items:center;gap:5px;border:1px solid #e5e5e5;background:#fff;border-radius:7px;padding:7px 9px;font-size:10px;font-weight:800}.rc-empty{min-height:125px;border:1px dashed #ddd;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#888;font-size:12px;text-align:center;padding:20px}.rc-empty b{color:#222;font-size:14px}.rc-progress-list{display:grid;gap:9px}.rc-progress-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #e7e7e2;border-radius:11px;background:#fff}.rc-progress-row>div{display:grid;gap:4px}.rc-progress-row b{font-size:12px}.rc-progress-row span,.rc-progress-row small{font-size:10px;color:#888}.rc-progress-row .rc-status{color:#555}.rc-progress-row .rc-primary{white-space:nowrap}@media(max-width:700px){.rc-page{padding:22px 15px 70px}.rc-head{align-items:flex-start;flex-direction:column}.rc-head h1{font-size:35px}.rc-fields{grid-template-columns:1fr}.rc-wide{grid-column:auto}.rc-cards{grid-template-columns:1fr}.rc-progress-row{align-items:flex-start;flex-wrap:wrap}.rc-card{grid-template-columns:105px 1fr}.rc-form{padding:16px}}
  `}</style>
 </main>;
}
