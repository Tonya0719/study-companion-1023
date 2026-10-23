import {useState,type ReactNode} from 'react';
import type {Point,Learning,Session} from './types';

type SourceBlock={type:'paragraph'|'bullet'|'subbullet';text:string};
function cleanSlideText(raw:string){
 const lines=raw.replace(/\r/g,'').split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
 const title=lines.shift()||'Slide content',blocks:SourceBlock[]=[];
 for(const line of lines){
  const marker=line.match(/^([•●▪]|[-–—])\s*(.*)$/),type:SourceBlock['type']=marker?(marker[1]==='•'||marker[1]==='●'||marker[1]==='▪'?'bullet':'subbullet'):'paragraph',text=(marker?.[2]||line).trim();
  if(!text)continue;
  const previous=blocks.at(-1),startsNew=/^(\d+[.)]|[A-Z][A-Za-z /&()\-]{2,}:)/.test(text),previousComplete=previous&&/[.!?;:”“”)]$/.test(previous.text);
  if(previous&&previous.type===type&&!startsNew&&!previousComplete){previous.text+=' '+text;}else blocks.push({type,text});
 }
 return {title,blocks};
}
function SlideSource({module,page,text,onOpen}:{module:number;page:number;text:string;onOpen:()=>void}){
 const slide=cleanSlideText(text),hasList=slide.blocks.some(block=>block.type!=='paragraph');
 return <article className="slide-source-card"><div className="slide-source-head"><span>M{module} · p.{page}</span><button className="inline-link" onClick={onOpen}>Open slide ↗</button></div><h3>{slide.title}</h3><div className={hasList?'slide-source-list':'slide-source-copy'}>{slide.blocks.map((block,index)=>block.type==='paragraph'?<p key={index}>{block.text}</p>:<div key={index} className={`slide-source-item ${block.type}`}><i/>{block.text}</div>)}</div></article>;
}

type Props={point:Point;learning?:Learning;all:Record<string,Learning>;points:Point[];session:Session;update:(patch:Partial<Session>)=>void;source:(module:number,page:number)=>void;choose:(point:Point)=>void;help:boolean;ai:(section:string)=>ReactNode};
export default function StudyPanel({point,learning,all,points,session,update,source,choose,help,ai}:Props){
 const [tab,setTab]=useState('concepts'),[kind,setKind]=useState<'single'|'multi'>('multi');
 const quizzes=learning?.quizzes||[],quiz=quizzes.find(q=>q.type===kind)||quizzes[0];
 const answer=quiz?session.quizAnswers?.[quiz.id]:undefined,selected=answer?.selected||[],submitted=!!answer?.submitted;
 const setAnswer=(next:number[],done=false)=>{if(quiz)update({quizAnswers:{...session.quizAnswers,[quiz.id]:{selected:next,submitted:done}}});};
 const correct=quiz?.options.flatMap((o,i)=>o.correct?[i]:[])||[];
 const passed=correct.length===selected.length&&correct.every(i=>selected.includes(i));
 return <div className={`learning-content ${help?'with-chinese':''}`}>
  <nav className="learning-tabs" aria-label="Study views">{[['concepts','Concepts'],['practice','Practice'],['connections','Connections']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  <div className="learning-tab-body">
  {tab==='concepts'&&<section aria-label="Concept explanations">
   {learning?<><div className="english-definition"><p>{learning.explanation}</p></div>
   {help&&<details className="chinese-support" open><summary>中文辅助</summary><div className="authored-text">{point.explain||'此考点暂无额外中文笔记，可切换左侧中文课件。'}</div></details>}
   {learning.terms.length>0&&<div className="concept-cards">{learning.terms.map(t=><article key={t.en}><h3>{t.en}{help&&<small>（{t.zh}）</small>}</h3><p>{t.definition}</p><button className="inline-link" onClick={()=>source(point.module,t.page)}>M{point.module} p.{t.page} ↗</button></article>)}</div>}
   <details className="source-excerpts"><summary><span>Original slide text</span><small>Clean reading view</small></summary><div className="slide-source-stack">{learning.sources.map(s=><SlideSource key={s.page} module={point.module} page={s.page} text={s.text} onOpen={()=>source(point.module,s.page)}/>)}</div><p className="source-format-note">Line breaks are cleaned for reading. Use “Open slide” to verify the original layout.</p></details></>:<><p className="setting-description">Personal imported note · English editorial version unavailable.</p><div className="authored-text">{point.slide_wording||point.explain}</div></>}
   {ai('explain')}
  </section>}
  {tab==='practice'&&<section aria-label="English practice">
   {quiz?<><div className="exam-focus"><b>Exam focus</b><p>{quiz.type==='multi'?quiz.focus:learning?.explanation}</p></div>
   <div className="practice-kind" role="group" aria-label="Question type">{quizzes.some(q=>q.type==='multi')&&<button className={quiz.type==='multi'?'active':''} onClick={()=>setKind('multi')}>Multiple-select</button>}<button className={quiz.type==='single'?'active':''} onClick={()=>setKind('single')}>Single-select</button><small>Mock question</small></div>
   <div className="english-question"><small>{quiz.type==='multi'?'Select all that apply':'Select one answer'}</small><h3>{quiz.question}</h3>
   {quiz.options.map((o,i)=><label key={`${quiz.id}-${i}`} className={`quiz-option ${submitted?(o.correct?'is-correct':selected.includes(i)?'is-wrong':''):''}`}><input type={quiz.type==='multi'?'checkbox':'radio'} name={quiz.id} checked={selected.includes(i)} onChange={()=>setAnswer(quiz.type==='single'?[i]:selected.includes(i)?selected.filter(n=>n!==i):[...selected,i])}/><span>{String.fromCharCode(65+i)}. {o.text}</span></label>)}
   <button className="primary-button check-quiz" disabled={!selected.length} onClick={()=>setAnswer(selected,true)}>Check answer</button></div>
   {submitted&&<div className="quiz-feedback" aria-live="polite"><h3>{passed?'Correct':'Review your answer'}</h3><p>Answer: {correct.map(i=>String.fromCharCode(65+i)).join(', ')}</p>{quiz.options.map((o,i)=><div className="option-evidence" key={i}><b>{String.fromCharCode(65+i)} · {o.correct?'Include':'Exclude'}</b><p>{o.reason}</p><button className="inline-link" onClick={()=>source(o.module,o.page)}>M{o.module} p.{o.page} ↗</button></div>)}{help&&<p className="chinese-support">先判断题干要求的类别，再比较选项。点击页码可核对原文；中文课件可独立切换。</p>}</div>}
   </>:<div className="authored-text">{point.question||'No curated question is available for this imported note.'}</div>}
   <details className="scratchpad"><summary>Your working notes</summary><textarea aria-label="Your working notes" value={session.draft} onChange={e=>update({draft:e.target.value})} rows={3}/></details>{ai('practice')}
  </section>}
  {tab==='connections'&&<section aria-label="Concept connections">{learning?.relations.length?learning.relations.map(r=>{const target=points.find(p=>p.id===r.id);return target&&<article className="knowledge-relation" key={r.id}><span>{r.type}</span><h3><button onClick={()=>choose(target)}>{all[r.id]?.title||target.title} →</button></h3><p>{r.reason}</p><div>{target.pages.map(n=><button className="inline-link" key={n} onClick={()=>source(target.module,n)}>M{target.module} p.{n} ↗</button>)}</div></article>;}):<p className="setting-description">No curated relationship is available for this imported note.</p>}{help&&<p className="chinese-support">关系说明用于区分概念、分类或应用联系；并列概念不代表先后步骤。</p>}</section>}
  </div>
 </div>;
}
