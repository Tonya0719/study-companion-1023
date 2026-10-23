import type {State, AIRequest} from './types';
const STORAGE='study-companion:pe6204:v1';
let sessionKey='';
export const desktop=!!window.companion;
export async function loadState(){if(window.companion)return window.companion.load();let state=null;try{state=JSON.parse(localStorage.getItem(STORAGE)||'null');}catch{throw new Error('浏览器学习记录无法读取，请保留原始存储并从备份恢复。');}return {state,legacy:null,legacyMarkdown:{},keyConfigured:false};}
export async function saveState(state:State){if(window.companion)await window.companion.save(state);else localStorage.setItem(STORAGE,JSON.stringify(state));}
export async function setKey(key:string){if(!key.trim().startsWith('sk-or-'))throw new Error('请输入有效的 OpenRouter Key（sk-or-…）');if(window.companion)await window.companion.setKey(key.trim());else sessionKey=key.trim();}
export async function deleteKey(){if(window.companion)await window.companion.deleteKey();else sessionKey='';}
export async function hasKey(){return window.companion?window.companion.keyStatus():!!sessionKey;}
export function openExternal(url:string){if(!/^https:\/\/(app\.notion\.com|www\.notion\.so|openrouter\.ai)\//.test(url))return;if(window.companion)void window.companion.openExternal(url);else window.open(url,'_blank','noopener,noreferrer');}
export async function streamAI(req:AIRequest,signal:AbortSignal,onDelta:(s:string)=>void){
  if(window.companion){const bridge=window.companion;await new Promise<void>((resolve,reject)=>{let settled=false;const finish=(error?:Error)=>{if(settled)return;settled=true;off();signal.removeEventListener('abort',abort);error?reject(error):resolve();};const abort=()=>{void bridge.cancel(req.id);finish(new Error('已停止生成'));};const off=bridge.onAI(e=>{if(e.id!==req.id)return;if(e.delta)onDelta(e.delta);if(e.error)finish(new Error(e.error));else if(e.done)finish();});signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}bridge.ai(req).catch(err=>finish(err));});return;}
  if(!sessionKey)throw new Error('请先配置个人 API Key');
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionKey}`},body:JSON.stringify({model:req.model,messages:req.messages,stream:true,max_tokens:1800,temperature:.25})});
  if(!response.ok)throw new Error(`OpenRouter HTTP ${response.status}，请检查模型、余额或网络。`);
  if(!response.body)throw new Error('未收到响应流');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  const consume=(line:string)=>{if(!line.startsWith('data:'))return;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')return;let data;try{data=JSON.parse(raw);}catch{return;}if(data.error)throw new Error('模型供应商返回错误，请重试或更换模型。');const t=data.choices?.[0]?.delta?.content;if(typeof t==='string')onDelta(t);};
  try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,idx));buffer=buffer.slice(idx+1);}}if(buffer.trim())consume(buffer);}finally{reader.releaseLock();}
}
export function downloadJSON(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
