"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { CalendarDays, ImagePlus, Pencil, Plus, RefreshCw, Save, Trash2, Trophy, X } from "lucide-react";

type Restaurant={id:string;name:string;area:string|null;city:string|null};
type Challenge={id:string;title:string;challenge_word:string;description:string|null;image_url:string|null;restaurant_id:string;starts_at:string;ends_at:string;status:string;reward_title:string|null;reward_description:string|null};
type FormState={title:string;challenge_word:string;description:string;image_url:string;restaurant_id:string;starts_at:string;ends_at:string;status:string;reward_title:string;reward_description:string};
const empty:FormState={title:"",challenge_word:"",description:"",image_url:"",restaurant_id:"",starts_at:"",ends_at:"",status:"draft",reward_title:"",reward_description:""};
function toLocal(value:string){if(!value)return "";const d=new Date(value);const p=(n:number)=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}

export default function AdminChallengesPage(){
 const router=useRouter();
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[msg,setMsg]=useState(""),[rows,setRows]=useState<Challenge[]>([]),[restaurants,setRestaurants]=useState<Restaurant[]>([]),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<FormState>(empty);
 async function load(){
  if(!supabase){setMsg("Supabase is not configured.");setLoading(false);return;}
  setMsg("");
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/auth?next=/thoam-admin/challenges");return;}
  const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profileError||profile?.role!=="admin"){setMsg("Admin access required.");setLoading(false);return;}
  const [cr,rr]=await Promise.all([
   supabase.from("challenges").select("*").order("created_at",{ascending:false}),
   supabase.from("restaurants").select("id,name,area,city").order("name")
  ]);
  if(cr.error||rr.error){setMsg(cr.error?.message||rr.error?.message||"Unable to load data.");}
  else{setRows((cr.data||[]) as Challenge[]);setRestaurants((rr.data||[]) as Restaurant[]);}
  setLoading(false);
 }
 useEffect(()=>{void load();},[]);
 function startNew(){setEditing(null);setForm({...empty,starts_at:toLocal(new Date().toISOString()),ends_at:toLocal(new Date(Date.now()+7*86400000).toISOString())});setMsg("");}
 function edit(row:Challenge){setEditing(row.id);setForm({title:row.title,challenge_word:row.challenge_word,description:row.description||"",image_url:row.image_url||"",restaurant_id:row.restaurant_id,starts_at:toLocal(row.starts_at),ends_at:toLocal(row.ends_at),status:row.status,reward_title:row.reward_title||"",reward_description:row.reward_description||""});setMsg("");}
 async function save(e:FormEvent){
  e.preventDefault();if(!supabase)return;setMsg("");
  if(!form.title.trim()||!form.challenge_word.trim()||!form.restaurant_id||!form.starts_at||!form.ends_at){setMsg("Name, challenge word, restaurant and both dates are required.");return;}
  if(new Date(form.ends_at)<=new Date(form.starts_at)){setMsg("End date must be after start date.");return;}
  if(form.image_url&&!/^https:\/\//i.test(form.image_url)){setMsg("Image URL must start with https://");return;}
  setSaving(true);
  const payload={title:form.title.trim(),challenge_word:form.challenge_word.trim().toUpperCase().replace(/\s+/g,""),description:form.description.trim()||null,image_url:form.image_url.trim()||null,restaurant_id:form.restaurant_id,starts_at:new Date(form.starts_at).toISOString(),ends_at:new Date(form.ends_at).toISOString(),status:form.status,reward_title:form.reward_title.trim()||null,reward_description:form.reward_description.trim()||null};
  const result=editing?await supabase.from("challenges").update(payload).eq("id",editing):await supabase.from("challenges").insert(payload);
  if(result.error)setMsg(result.error.message);else{setForm(empty);setEditing(null);await load();}
  setSaving(false);
 }
 async function remove(row:Challenge){
  if(!supabase||!confirm("Delete this challenge permanently?"))return;
  const {error}=await supabase.from("challenges").delete().eq("id",row.id);
  if(error)setMsg(error.message);else await load();
 }
 const restaurantName=(id:string)=>restaurants.find(r=>r.id===id)?.name||"Restaurant";
 return <><header className="site-header"><Link className="wordmark" href="/">Tho<span>’</span>am<span className="wordmark-dot">.</span></Link><span className="status">SUPER ADMIN</span></header><AdminSidebar/><main className="container admin-container tch-admin">
  <div className="tch-head"><div><div className="tch-eyebrow">PLATFORM MANAGEMENT</div><h1>Challenges</h1><p>Create, schedule and manage restaurant challenges.</p></div><button className="tch-primary" onClick={startNew}><Plus size={16}/> Add challenge</button></div>
  {msg&&<div className="tch-message">{msg}</div>}
  {editing!==null||form.title!==""?<form className="tch-form" onSubmit={save}><div className="tch-form-head"><div><span>{editing?"EDIT CHALLENGE":"NEW CHALLENGE"}</span><h2>{editing?"Update challenge":"Create a challenge"}</h2></div><button type="button" className="tch-icon-btn" onClick={()=>{setEditing(null);setForm(empty);}}><X size={18}/></button></div>
   <div className="tch-grid">
    <label>Challenge name<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Complete the name — MANDHI"/></label>
    <label>Restaurant<select required value={form.restaurant_id} onChange={e=>setForm({...form,restaurant_id:e.target.value})}><option value="">Choose restaurant</option>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}{r.area?" · "+r.area:""}</option>)}</select></label>
    <label>Challenge word / letters<input required maxLength={32} value={form.challenge_word} onChange={e=>setForm({...form,challenge_word:e.target.value})} placeholder="MANDHI"/></label>
    <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="live">Live</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
    <label className="wide">Description<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Explain how customers can take part."/></label>
    <label className="wide">Challenge image URL<input value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://..."/><small>Use a publicly accessible HTTPS image URL. The image itself is hosted externally.</small></label>
    <label>Starts at<input type="datetime-local" required value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
    <label>Ends at<input type="datetime-local" required value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label>
    <label>Reward title<input value={form.reward_title} onChange={e=>setForm({...form,reward_title:e.target.value})} placeholder="Free mandi / 20% off"/></label>
    <label>Reward details<input value={form.reward_description} onChange={e=>setForm({...form,reward_description:e.target.value})} placeholder="Reward terms and conditions"/></label>
   </div>
   {form.image_url&&<div className="tch-preview" style={{backgroundImage:"url("+JSON.stringify(form.image_url)+")"}}/>}
   <div className="tch-form-actions"><button type="button" className="tch-secondary" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel</button><button className="tch-primary" disabled={saving}><Save size={15}/>{saving?"Saving…":"Save challenge"}</button></div>
  </form>:null}
  <section className="tch-list-head"><div><div className="tch-eyebrow">CHALLENGE LIBRARY</div><h2>All challenges <span>{rows.length}</span></h2></div><button className="tch-secondary" onClick={()=>{setLoading(true);void load();}}><RefreshCw size={14}/> Refresh</button></section>
  {loading?<div className="tch-empty">Loading challenges…</div>:rows.length===0?<div className="tch-empty"><Trophy size={24}/><b>No challenges created</b><span>Create your first challenge to publish it on the customer page.</span></div>:<div className="tch-table-wrap"><table className="tch-table"><thead><tr><th>Challenge</th><th>Restaurant</th><th>Schedule</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.title}</b><small>{row.challenge_word}</small></td><td>{restaurantName(row.restaurant_id)}</td><td>{new Date(row.starts_at).toLocaleDateString("en-IN")} – {new Date(row.ends_at).toLocaleDateString("en-IN")}</td><td><span className={"tch-status "+row.status}>{row.status}</span></td><td><div className="tch-actions"><button onClick={()=>edit(row)} aria-label="Edit challenge"><Pencil size={14}/></button><button onClick={()=>void remove(row)} aria-label="Delete challenge"><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>}
 </main>
 <style jsx global>{`
 .tch-admin{padding-top:38px;padding-bottom:80px}.tch-head,.tch-list-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.tch-eyebrow{font-size:9px;letter-spacing:.17em;font-weight:900;color:#888}.tch-head h1{font-size:38px;letter-spacing:-.06em;margin:7px 0}.tch-head p{color:#777;font-size:13px;margin:0}.tch-primary,.tch-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:9px;padding:12px 15px;font-size:11px;font-weight:800;cursor:pointer}.tch-primary{background:#111;color:#fff}.tch-primary:disabled{opacity:.5}.tch-secondary{background:#f0f0ed;color:#222}.tch-message{margin:18px 0;padding:12px 14px;background:#fff1f0;color:#9a2929;border-radius:9px;font-size:12px}.tch-form{margin:26px 0;padding:22px;border:1px solid #e5e5e1;border-radius:15px;background:#fff}.tch-form-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.tch-form-head span{font-size:9px;font-weight:900;letter-spacing:.15em;color:#888}.tch-form-head h2{font-size:21px;margin:5px 0}.tch-icon-btn{border:0;background:#f1f1ef;border-radius:8px;width:34px;height:34px}.tch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.tch-grid label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:800;color:#333}.tch-grid input,.tch-grid select,.tch-grid textarea{width:100%;border:1px solid #deded9;border-radius:8px;padding:11px 12px;background:#fff;color:#111;font:inherit;font-size:12px;outline:none}.tch-grid input:focus,.tch-grid select:focus,.tch-grid textarea:focus{border-color:#111}.tch-grid small{font-size:10px;color:#888;font-weight:500}.tch-grid .wide{grid-column:1/-1}.tch-preview{height:150px;margin-top:16px;border-radius:10px;background:#ddd center/cover no-repeat}.tch-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}.tch-list-head{margin:35px 0 16px}.tch-list-head h2{font-size:22px;margin:6px 0}.tch-list-head h2 span{font-size:11px;color:#888}.tch-table-wrap{overflow:auto;border:1px solid #e6e6e2;border-radius:12px;background:#fff}.tch-table{width:100%;border-collapse:collapse;min-width:680px;font-size:11px}.tch-table th,.tch-table td{text-align:left;padding:14px;border-bottom:1px solid #eee}.tch-table th{font-size:9px;letter-spacing:.1em;color:#888}.tch-table td small{display:block;margin-top:4px;color:#888}.tch-status{display:inline-block;padding:5px 8px;border-radius:99px;background:#eee;font-size:9px;font-weight:900;text-transform:uppercase}.tch-status.live{background:#e8f5eb;color:#28663b}.tch-status.paused{background:#fff3dd;color:#8a5a10}.tch-actions{display:flex;gap:6px}.tch-actions button{display:grid;place-items:center;width:30px;height:30px;border:1px solid #e6e6e2;border-radius:7px;background:#fff}.tch-empty{min-height:150px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;border:1px dashed #ddd;border-radius:12px;color:#888;font-size:12px}.tch-empty b{color:#222;font-size:15px}@media(max-width:760px){.tch-admin{padding-top:25px}.tch-head{align-items:flex-start;flex-direction:column}.tch-grid{grid-template-columns:1fr}.tch-grid .wide{grid-column:auto}.tch-form{padding:16px}.tch-list-head{align-items:flex-end}.tch-head h1{font-size:32px}}
 `}</style></>;
}
