import {useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion} from 'motion/react';
import {ArrowUp,ChevronDown,ChevronUp,LoaderCircle,Sparkles,Square,X} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {AISession,Module,Point} from './types';
import {buildMessages} from '../shared/core.mjs';
import {hasKey,streamAI,openExternal} from './platform';
import {sourceText} from './pdf';
type Props={point:Point;module:Module;section:string;session:AISession;update:(s:AISession)=>void;configure:()=>void;model:string;draft?:string;onPage:(n:number)=>void;selectedText?:string};
export default function InlineAI({point,module,section,session,update,configure,model,draft,onPage,selectedText}:Props){
  const [busy,setBusy]=useState(false),[partial,setPartial]=useState(''),[error,setError]=useState(''),[lastPrompt,setLastPrompt]=useState('');
  const controller=useRef<AbortController|null>(null),starting=useRef(false),latest=useRef(session);latest.current=session;
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{if(selectedText)update({...latest.current,open:true,input:`请解释这段内容：\n${selectedText}`});},[selectedText]);
  const run=async(prompt:string)=>{
    if(busy||starting.current||controller.current||!prompt.trim())return;
    if(!model.trim()){setError('请在设置中填写模型标识。');return;}
    starting.current=true;let configured=false;
    try{configured=await hasKey();}catch{setError('读取个人 Key 状态失败，请重新打开设置。');starting.current=false;return;}
    if(!configured){update({...latest.current,open:true,input:prompt});configure();starting.current=false;return;}
    setLastPrompt(prompt);setError('');setPartial('');setBusy(true);
    const abort=new AbortController();controller.current=abort;starting.current=false;const timer=setTimeout(()=>abort.abort(),90000);
    const history=[...latest.current.messages];update({...latest.current,open:true,input:'',messages:[...history,{role:'user',content:prompt}]});
    let output='';
    try{
      const source=await sourceText(module,point.pages);if(abort.signal.aborted)throw new Error('已停止生成');
      const actualPrompt=section==='practice'&&prompt==='检查我的答案。'?`请检查我对当前笔记题目的作答：\n${draft||'尚未输入作答，请先要求我提供答案。'}`:prompt;
      const messages=buildMessages({point,section,prompt:actualPrompt,source,history});
      await streamAI({id:crypto.randomUUID(),model,messages},abort.signal,delta=>{output+=delta;setPartial(output);});
      if(!output.trim())throw new Error('模型未返回文字，请重试或更换模型。');
      update({...latest.current,messages:[...history,{role:'user',content:prompt},{role:'assistant',content:output}]});
    }catch(err){if(output)update({...latest.current,messages:[...history,{role:'user',content:prompt},{role:'assistant',content:output+'\n\n*（输出中断）*'}]});else update({...latest.current,messages:history,input:prompt});setError(abort.signal.aborted?'生成已停止，可重试。':err instanceof Error?err.message:'AI 暂时不可用');}finally{clearTimeout(timer);controller.current=null;setBusy(false);setPartial('');}
  };
  const chips=section==='practice'?[['Hint','Give me a hint without revealing the answer.'],['再出一题','请用中文出一道关于这个考点的选择题，暂时不显示答案。']]:[['Explain further','Explain this topic further, citing the supplied module and page labels.'],['举个例子','请用中文举一个简单的例子来说明这个概念，区分例子与课件原文。'],['中文解释','请用中文帮助我理解当前考点，保留英文术语，并引用提供的页码。']];
  return <div className={`inline-ai ${session.open?'expanded':''}`}>
    <button className="ai-entry" onClick={()=>update({...session,open:!session.open})} aria-expanded={session.open}><Sparkles size={15}/><span>{section==='practice'?'Need a hint or another question?':'Need further explanation?'}</span>{session.open?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>
    <AnimatePresence initial={false}>{session.open&&<motion.div className="ai-panel" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:.2}}>
      <div className="ai-panel-head"><span><Sparkles size={13}/> AI study assistant</span><span>AI-generated</span></div>
      <div className="ai-context">发送当前考点与{point.pages.length>3?'前 3 个关联来源页':'关联来源页'}文字至 OpenRouter / 所选模型。{point.pages.slice(0,3).map(n=><button key={n} onClick={()=>onPage(n)}>M{module.id} p.{n}</button>)}</div>
      <div className="ai-chips">{chips.map(([label,prompt])=><button key={label} disabled={busy} onClick={()=>void run(prompt)}>{label}</button>)}</div>
      <div className="ai-conversation" aria-live="polite">{session.messages.map((m,i)=><div className={`ai-message ${m.role}`} key={i}>{m.role==='user'?<p>{m.content}</p>:<div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=><button className="inline-link" onClick={()=>href&&openExternal(href)}>{children}</button>}}>{m.content}</ReactMarkdown></div>}</div>)}{busy&&<div className="ai-message assistant"><div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{partial||'正在阅读关联资料…'}</ReactMarkdown></div><LoaderCircle size={14} className="spin"/></div>}</div>
      {error&&<div role="alert" className="inline-error">{error}<button disabled={busy} onClick={()=>void run(lastPrompt)}>重试</button></div>}
      <form className="ai-composer" onSubmit={e=>{e.preventDefault();void run(session.input);}}><textarea aria-label={`${section} AI追问`} placeholder="Ask about this topic…" rows={2} value={session.input} onChange={e=>update({...session,input:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void run(session.input);}}}/>{busy?<button key="stop" type="button" className="ai-send" aria-label="停止生成" onClick={e=>{e.preventDefault();e.stopPropagation();controller.current?.abort();}}><Square size={14}/></button>:<button key="send" type="submit" className="ai-send" aria-label="发送追问" disabled={!session.input.trim()}><ArrowUp size={17}/></button>}</form>
      <div className="ai-footnote"><span>可选 · 请对照原始课件核验</span>{session.messages.length>0&&!busy&&<button onClick={()=>update({...session,messages:[]})}><X size={11}/> 清空此处对话</button>}</div>
    </motion.div>}</AnimatePresence>
  </div>;
}
