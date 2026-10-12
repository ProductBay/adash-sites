"use client";
import Image from "next/image";
import { useActionState, useState } from "react";
import { sectionLabels, sectionSchema, type SiteSection } from "@adash/site-templates";
import { saveHomepageSection, upgradeHomepageDraft, type ContentActionState } from "./builder-actions";

type Media = { id: string; filename: string; alt: string; available: boolean };
type Field = { key: string; label: string; kind?: "text" | "copy" | "image" | "link"; options?: string[] };
const common: Field[] = [{key:"eyebrow",label:"Short introduction"},{key:"heading",label:"Heading"},{key:"body",label:"Supporting copy",kind:"copy"}];
const link: Field = {key:"cta",label:"Button",kind:"link"};
const image: Field = {key:"image",label:"Image",kind:"image"};
const fields: Partial<Record<SiteSection["type"], Field[]>> = {
  hero: [{key:"eyebrow",label:"Short introduction"},{key:"headline",label:"Headline"},{key:"copy",label:"Supporting copy",kind:"copy"},image,{...link,key:"primaryCta",label:"Primary button"},{...link,key:"secondaryCta",label:"Secondary button"}],
  brandStory: [...common,image,{key:"imageSide",label:"Image position",options:["left","right"]},link],
  ingredientShowcase: [...common,{key:"layout",label:"Layout",options:["cards","editorial"]}],
  promoBanner:[...common,link],socialGallery:[...common,link],footer:[{key:"tagline",label:"Closing line",kind:"copy"}]
};
const arrays: Partial<Record<SiteSection["type"], {key:string;label:string;max:number;fields:Field[];blank:unknown}[]>> = {
  hero:[{key:"badges",label:"Badges",max:4,fields:[],blank:""}],
  trustStrip:[{key:"items",label:"Highlight statements",max:6,fields:[],blank:""}],
  brandStory:[{key:"highlights",label:"Values and highlights",max:4,fields:[{key:"value",label:"Value"},{key:"label",label:"Label"}],blank:{value:"",label:""}}],
  featureGrid:[{key:"items",label:"Strengths (3–8)",max:8,fields:[{key:"symbol",label:"Symbol (up to 4 characters)"},{key:"heading",label:"Heading"},{key:"body",label:"Short description",kind:"copy"}],blank:{symbol:"",heading:"",body:""}}],
  ingredientShowcase:[{key:"items",label:"Ingredients and flavours",max:8,fields:[{key:"name",label:"Name"},{key:"description",label:"Description",kind:"copy"},image,{key:"origin",label:"Origin (optional)"},{key:"benefit",label:"Benefit (optional)"},{key:"badge",label:"Badge (optional)"}],blank:{name:"",description:""}}],
  testimonials:[{key:"quotes",label:"Customer comments",max:8,fields:[{key:"quote",label:"Quote",kind:"copy"},{key:"name",label:"Display name"},{key:"detail",label:"Detail (optional)"}],blank:{quote:"",name:""}}],
  socialGallery:[{key:"images",label:"Gallery images",max:8,fields:[{key:"self",label:"Gallery image",kind:"image"}],blank:{}}],
  footer:[{key:"links",label:"Navigation links",max:8,fields:[{key:"self",label:"Link",kind:"link"}],blank:{label:"",href:""}}]
};
const initial: ContentActionState = {};
function PreviewImage({src,alt}:{src:string;alt:string}) {
  const [failed,setFailed]=useState(false);
  return failed ? <p role="status">Image unavailable — upload again</p> : <Image src={src} alt={alt} width={200} height={140} unoptimized onError={()=>setFailed(true)} style={{objectFit:"contain",maxWidth:"100%",height:"auto"}} />;
}
function Input({field,value,change,media}:{field:Field;value:unknown;change:(value:unknown)=>void;media:Media[]}) {
  if(field.kind==="image") {
    const item=value as {src?:string;alt?:string}|undefined;
    const available=item?.src && (!item.src.startsWith("/media/") || media.some(asset=>asset.available && `/media/${asset.id}`===item.src));
    return <div><label>{field.label}<select value={item?.src ?? ""} onChange={event=>{const asset=media.find(asset=>`/media/${asset.id}`===event.target.value);change(asset?{src:`/media/${asset.id}`,alt:asset.alt||asset.filename}:undefined);}}><option value="">None</option>{item?.src && !media.some(asset=>`/media/${asset.id}`===item.src)&&<option value={item.src}>Current image</option>}{media.map(asset=><option key={asset.id} value={`/media/${asset.id}`} disabled={!asset.available}>{asset.filename}{!asset.available?" — unavailable":""}</option>)}</select></label>{available&&item?.src?<PreviewImage key={item.src} src={item.src} alt={item.alt||"Selected image"}/>:item?.src?<p role="status">Image unavailable — upload again</p>:null}{item?.src&&<label>Image description<input value={item.alt??""} onChange={event=>change({...item,alt:event.target.value})}/></label>}</div>;
  }
  if(field.kind==="link") {
    const item=value as {label?:string;href?:string}|undefined;
    return <fieldset><legend>{field.label}</legend><label>Button or link text<input value={item?.label??""} onChange={event=>change({label:event.target.value,href:item?.href??""})}/></label><label>Destination<input value={item?.href??""} placeholder="#contact or https://example.com" onChange={event=>change({label:item?.label??"",href:event.target.value})}/></label><small>Use a section anchor or a complete HTTPS address. Leave both fields blank to remove.</small></fieldset>;
  }
  return <label>{field.label}{field.options?<select value={String(value??field.options[0])} onChange={event=>change(event.target.value)}>{field.options.map(option=><option key={option}>{option}</option>)}</select>:field.kind==="copy"?<textarea value={String(value??"")} onChange={event=>change(event.target.value)}/>:<input value={String(value??"")} onChange={event=>change(event.target.value)}/>}</label>;
}
function SectionEditor({section,version,media,status}:{section:SiteSection;version:string;media:Media[];status:string}) {
  const [draft,setDraft]=useState<Record<string,unknown>>(section as unknown as Record<string,unknown>);
  const [state,action,pending]=useActionState(saveHomepageSection,initial);
  const [validation,setValidation]=useState("");
  const change=(key:string,value:unknown)=>setDraft(previous=>({...previous,[key]:value}));
  const configuredFields=fields[section.type]??(["trustStrip"].includes(section.type)?[]:common);
  function normalize(value:unknown):unknown {
    if(Array.isArray(value))return value.map(normalize).filter(item=>item!==undefined);
    if(value&&typeof value==="object") {
      const record=value as Record<string,unknown>;
      if("href" in record && !record.href && !record.label)return undefined;
      return Object.fromEntries(Object.entries(record).map(([key,item])=>[key,normalize(item)]).filter(([,item])=>item!==undefined));
    }
    return value;
  }
  return <details className="panel homepage-section"><summary><strong>{sectionLabels[section.type]}</strong><span>{section.enabled?"Active":"Hidden"}</span><span>{status}</span><span>Edit</span></summary><form action={action} onSubmit={event=>{const result=sectionSchema.safeParse(normalize(draft));if(!result.success){event.preventDefault();setValidation(result.error.issues.map(issue=>`${issue.path.filter(part=>part!=="type").join(" / ")}: ${issue.message}`).join(". "));}else setValidation("");}}>
    <input type="hidden" name="version" value={version}/><input type="hidden" name="section" value={JSON.stringify(normalize(draft))}/>
    <p className="field-help">Use your own factual information. Empty optional sections stay hidden. Save creates a private draft.</p>
    <label className="check"><input type="checkbox" checked={Boolean(draft.enabled)} disabled={section.type==="hero"} onChange={event=>change("enabled",event.target.checked)}/>Show this section</label>
    {configuredFields.map(field=><Input key={field.key} field={field} value={draft[field.key]} change={value=>change(field.key,value)} media={media}/>)}
    {(["featuredProducts","productGrid","locations","whatsappCta"] as string[]).includes(section.type)&&<p className="notice">{section.type==="locations"?"Locations come from your saved active locations.":section.type==="whatsappCta"?"Your business WhatsApp number and plan determine availability.":"Products come from your active product records. Mark products as featured in Products."}</p>}
    {arrays[section.type]?.map(group=>{const items=(draft[group.key]??[]) as unknown[];return <fieldset key={group.key}><legend>{group.label}</legend>{items.map((item,index)=><div className="panel" key={index}>{group.fields.length?group.fields.map(field=><Input key={field.key} field={field} value={field.key==="self"?item:(item as Record<string,unknown>)[field.key]} change={value=>change(group.key,items.map((entry,i)=>i!==index?entry:field.key==="self"?value:{...(entry as object),[field.key]:value}))} media={media}/>):<label>{group.label} {index+1}<input value={String(item)} onChange={event=>change(group.key,items.map((entry,i)=>i===index?event.target.value:entry))}/></label>}<div className="homepage-item-controls"><button type="button" className="secondary" disabled={index===0} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];change(group.key,next);}}>Move up</button><button type="button" className="secondary" disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];change(group.key,next);}}>Move down</button><button type="button" className="secondary" onClick={()=>change(group.key,items.filter((_,i)=>i!==index))}>Remove</button></div></div>)}<button type="button" className="secondary" disabled={items.length>=group.max} onClick={()=>change(group.key,[...items,structuredClone(group.blank)])}>Add item</button><small>Up to {group.max} items.</small></fieldset>;})}
    {(validation||state.error)&&<p className="notice" role="alert">{validation||state.error}</p>}{state.success&&<p className="notice" role="status">{state.success}</p>}<button disabled={pending}>{pending?"Saving...":"Save draft"}</button>
  </form></details>;
}
export function HomepageBuilder({sections,version,media,statuses,missing}:{sections:SiteSection[];version:string;media:Media[];statuses:Record<string,string>;missing:boolean}) {
  const [state,action,pending]=useActionState(upgradeHomepageDraft,initial);
  return <><h2>Homepage sections</h2>{missing&&<form action={action} className="panel"><p>Add the remaining template sections to your draft while preserving existing content.</p><button disabled={pending}>{pending?"Adding...":"Add missing homepage sections"}</button>{state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form>}<div className="homepage-sections">{sections.map(section=><SectionEditor key={`${section.id}-${version}`} section={section} version={version} media={media} status={statuses[section.id]??"Needs content"}/>)}</div></>;
}
