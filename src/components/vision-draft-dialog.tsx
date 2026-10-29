"use client";
import {useEffect,useMemo,useState} from "react";
import {Modal} from "./ui";
import {useLibrary} from "./library-provider";

type Draft={version:1;createdAt:number;note:string;tags:string[]};
const KEY="nest:vision:draft:v1";
function readDraft():Draft|null{
  try{
    const raw=sessionStorage.getItem(KEY);
    if(!raw||raw.length>8000)return null;
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=="object")return null;
    const row=value as Record<string,unknown>;
    if(row.version!==1||typeof row.createdAt!=="number"||!Number.isFinite(row.createdAt)||Math.abs(Date.now()-row.createdAt)>15*60*1000)return null;
    if(typeof row.note!=="string"||row.note.length>2000||!Array.isArray(row.tags)||row.tags.length>20)return null;
    if(!row.tags.every(tag=>typeof tag==="string"&&tag.length<=80&&/^[-a-z0-9. ]+$/.test(tag)))return null;
    return {version:1,createdAt:row.createdAt,note:row.note.slice(0,1400),tags:row.tags};
  }catch{return null;}
}
export function VisionDraftDialog(){
  const {library,ready,settings,update,toast}=useLibrary();
  const [draft,setDraft]=useState<Draft|null>(null);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState("");
  const [note,setNote]=useState("");
  const [tags,setTags]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!ready||!settings.onboarded||!new URLSearchParams(location.search).has("visionDraft"))return;
    const data=readDraft();
    if(data){setDraft(data);setNote(data.note);setTags(data.tags.join(", "));}
    else{sessionStorage.removeItem(KEY);history.replaceState(null,"",location.pathname);toast("Visual draft expired or was not available. No bookmarks were changed.");}
  },[ready,settings.onboarded,toast]);
  const existing=useMemo(()=>library.bookmarks.filter(b=>!b.deletedAt&&!b.demo),[library.bookmarks]);
  const found=useMemo(()=>existing.filter(b=>(b.title+" "+b.url).toLowerCase().includes(search.toLowerCase())).slice(0,40),[existing,search]);
  const bookmark=existing.find(b=>b.id===selected);
  const dismiss=()=>{sessionStorage.removeItem(KEY);history.replaceState(null,"",location.pathname);setDraft(null);};
  const save=()=>{
    if(!bookmark){setError("Choose an existing bookmark first.");return;}
    const cleanTags=[...new Set(tags.toLowerCase().split(",").map(s=>s.trim()).filter(s=>s.length>0&&s.length<=80&&/^[-a-z0-9. ]+$/.test(s)))].slice(0,12);
    const reviewedNote=note.trim().slice(0,1400);
    if(!cleanTags.length&&!reviewedNote){setError("Add a note or at least one valid tag.");return;}
    const combinedNote=[bookmark.note||"",reviewedNote].filter(Boolean).filter((item,index,array)=>array.indexOf(item)===index).join("\n\n").slice(0,5000);
    const uniqueTags=[...new Map([...bookmark.tags,...cleanTags].map(tag=>[tag.toLowerCase(),tag])).values()].slice(0,30);
    update(bookmark.id,{note:combinedNote,tags:uniqueTags});
    dismiss();toast("Reviewed visual note and tags saved to your bookmark.");
  };
  if(!draft)return null;
  return <Modal title="Add visual notes to a bookmark" subtitle="Choose a saved bookmark, review everything, then save. The screenshot stays on your device." onClose={dismiss}>
    <label className="field-label" htmlFor="vision-bookmark-search">Find your saved bookmark</label>
    <input id="vision-bookmark-search" value={search} onChange={e=>{setSearch(e.target.value);setSelected("");}} maxLength={150} placeholder="Search by name or URL" />
    <label className="field-label" htmlFor="vision-bookmark-select">Destination bookmark</label>
    <select id="vision-bookmark-select" value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Choose a bookmark…</option>
      {found.map(b=><option value={b.id} key={b.id}>{b.title.slice(0,85)} · {new URL(b.url).hostname}</option>)}
    </select>
    <p className="small muted">{existing.length? "Only your saved, non-sample bookmarks are eligible. Search to narrow the list." : "Add a personal bookmark in Nest before applying this draft."}</p>
    {bookmark&&<p className="small muted">Existing notes and tags are preserved. Your reviewed values will be appended, not replace them.</p>}
    <label className="field-label" htmlFor="vision-note-review">Reviewed note</label>
    <textarea id="vision-note-review" rows={4} maxLength={1400} value={note} onChange={e=>setNote(e.target.value)} />
    <label className="field-label" htmlFor="vision-tags-review">Reviewed tags (comma separated)</label>
    <input id="vision-tags-review" maxLength={800} value={tags} onChange={e=>setTags(e.target.value)} />
    {error&&<p className="error" role="alert">{error}</p>}
    <footer className="modal-footer">
      <button type="button" className="text-button" onClick={dismiss}>Discard draft</button>
      <button type="button" className="button primary" disabled={!bookmark} onClick={save}>Save to selected bookmark</button>
    </footer>
  </Modal>;
}
