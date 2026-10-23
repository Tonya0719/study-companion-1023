import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronLeft,ChevronRight,Maximize,Minus,Plus,Search,ScanLine,LoaderCircle,FileText,RotateCcw} from 'lucide-react';
import {TextLayer} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {getPDF} from './pdf';
import type {Module,Point} from './types';
import 'pdfjs-dist/web/pdf_viewer.css';
type Props={module:Module;page:number;onPage:(n:number)=>void;related:Point[];onPoint:(p:Point)=>void;back:(()=>void)|null;language:'en'|'zh';onLanguage:(language:'en'|'zh')=>void;hasZh:boolean};
export default function PdfViewer({module,page,onPage,related,onPoint,back,language,onLanguage,hasZh}:Props){
  const area=useRef<HTMLDivElement>(null),holder=useRef<HTMLDivElement>(null),serial=useRef(0);
  const [size,setSize]=useState({width:700,height:650}),[mode,setMode]=useState<'width'|'page'|'custom'>('page'),[zoom,setZoom]=useState(1),[actual,setActual]=useState(100),[input,setInput]=useState(String(page)),[busy,setBusy]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[matches,setMatches]=useState(0),[showSearch,setShowSearch]=useState(false),[rendered,setRendered]=useState(0);
  useEffect(()=>{setInput(String(page));area.current?.scrollTo(0,0);},[page,module.id]);
  useEffect(()=>{const el=area.current;if(!el)return;let timer:ReturnType<typeof setTimeout>;const observer=new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>setSize({width:el.clientWidth,height:el.clientHeight}),100);});observer.observe(el);return()=>{observer.disconnect();clearTimeout(timer);};},[]);
  useEffect(()=>{
    const id=++serial.current;let cancelled=false;let renderTask:{cancel():void}|undefined,textLayer:TextLayer|undefined;
    setBusy(true);setError('');
    const timer=setTimeout(()=>{void(async()=>{try{
      const doc=await getPDF(module,language);const p=await doc.getPage(page);if(cancelled)return;
      const natural=p.getViewport({scale:1}),availableW=Math.max(180,size.width-72),availableH=Math.max(180,size.height-150);
      const scale=mode==='width'?availableW/natural.width:mode==='page'?Math.min(availableW/natural.width,availableH/natural.height):zoom;
      const viewport=p.getViewport({scale:Math.min(5,Math.max(.2,scale))});
      const dpr=Math.min(window.devicePixelRatio||1,Math.sqrt(12_000_000/(viewport.width*viewport.height)));
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*dpr);canvas.height=Math.ceil(viewport.height*dpr);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
      const rt=p.render({canvas,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:undefined});renderTask=rt;await rt.promise;if(cancelled||id!==serial.current)return;
      const layer=document.createElement('div');layer.className='textLayer';layer.style.setProperty('--total-scale-factor',String(viewport.scale));layer.style.setProperty('--scale-factor',String(viewport.scale));
      textLayer=new TextLayer({textContentSource:await p.getTextContent(),container:layer,viewport});await textLayer.render();if(cancelled||id!==serial.current)return;
      const frame=holder.current;if(!frame)return;frame.style.width=`${viewport.width}px`;frame.style.height=`${viewport.height}px`;frame.replaceChildren(canvas,layer);frame.dataset.page=`M${module.id}-${page}`;frame.dataset.language=language;
      setActual(Math.round(viewport.scale*100));setRendered(n=>n+1);setBusy(false);
    }catch(err){if(cancelled)return;setError(err instanceof Error?err.message:'课件加载失败');setBusy(false);}})();},90);
    return()=>{cancelled=true;clearTimeout(timer);renderTask?.cancel();if(typeof textLayer?.cancel==='function')textLayer.cancel();};
  },[module.id,page,language,size.width,size.height,mode,zoom]);
  useEffect(()=>{let found=0;holder.current?.querySelectorAll('.textLayer span').forEach(span=>{const match=!!query.trim()&&!!span.textContent?.toLowerCase().includes(query.toLowerCase());span.classList.toggle('pdf-match',match);if(match)found++;});setMatches(found);},[query,rendered]);
  useEffect(()=>{const el=area.current;if(!el)return;const wheel=(e:WheelEvent)=>{if(e.ctrlKey){e.preventDefault();setMode('custom');setZoom(z=>Math.min(5,Math.max(.25,(mode==='custom'?z:actual/100)*(e.deltaY<0?1.1:.9))));}};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[actual,mode]);
  const scale=(factor:number)=>{setZoom(Math.min(5,Math.max(.25,actual/100*factor)));setMode('custom');};
  const jump=()=>{const n=Number(input);if(Number.isInteger(n)&&n>=1&&n<=module.pageCount){onPage(n);setError('');}else{setInput(String(page));setError(`请输入 1–${module.pageCount} 的物理页码`);}};
  return <section className="pdf-pane" aria-label="原始课件阅读器">
    <div className="pdf-heading"><div className="pdf-file"><FileText size={18}/><span>M{module.id}{language==='zh'?' · 中文':' · Original'}</span></div><div className="pdf-actions">{hasZh&&<div className="pdf-language" role="group" aria-label="PDF language"><button aria-pressed={language==='en'} onClick={()=>onLanguage('en')}>English</button><button aria-pressed={language==='zh'} onClick={()=>onLanguage('zh')}>中文译文</button></div>}<button className="icon-button" aria-label="搜索本页文字" title="搜索本页文字" onClick={()=>setShowSearch(!showSearch)}><Search size={17}/></button>{back&&<button className="text-button" onClick={back}><RotateCcw size={14}/> 返回</button>}</div></div>
    {showSearch&&<div className="pdf-find"><Search size={15}/><input autoFocus aria-label="本页搜索" placeholder="搜索本页文字…" value={query} onChange={e=>setQuery(e.target.value)}/><span>{matches} 处</span><button onClick={()=>{setShowSearch(false);setQuery('');}}>关闭</button></div>}
    <div ref={area} className="pdf-scroll" data-testid="pdf-scroll"><div className="pdf-document-wrap"><div className="pdf-chapter-label">MODULE {String(module.id).padStart(2,'0')} <span>／</span> {module.shortTitle}</div><div className={`pdf-sheet ${busy?'is-rendering':''}`} ref={holder}/><div className="pdf-page-caption">M{module.id} · {language==='en'?'Original':'中文译文'} · {page} / {module.pageCount}</div></div></div>
    {busy&&<div className="render-indicator" role="status"><LoaderCircle className="spin" size={15}/>正在清晰呈现课件</div>}
    {error&&<div className="pdf-error" role="alert">{error}<button onClick={()=>setSize({...size})}>重试</button></div>}
    <div className="pdf-bottom"><div className="pdf-related">{related.length?<><span>本页考点</span>{related.slice(0,2).map(p=><button key={p.id} onClick={()=>onPoint(p)} title={p.title}>{p.title}<ArrowRight size={12}/></button>)}</>:<span>自由阅读 · 翻页不会切换当前笔记</span>}</div>
    <div className="pdf-toolbar"><button className="icon-button" aria-label="上一页" disabled={page<=1} onClick={()=>onPage(page-1)}><ChevronLeft size={19}/></button><form onSubmit={e=>{e.preventDefault();jump();}}><input aria-label="PDF页码" value={input} onChange={e=>setInput(e.target.value)} onBlur={jump}/><span>/ {module.pageCount}</span></form><button className="icon-button" aria-label="下一页" disabled={page>=module.pageCount} onClick={()=>onPage(page+1)}><ChevronRight size={19}/></button><i/><button className="icon-button" aria-label="缩小课件" onClick={()=>scale(.85)}><Minus size={17}/></button><span className="zoom-value">{actual}%</span><button className="icon-button" aria-label="放大课件" onClick={()=>scale(1.18)}><Plus size={17}/></button><i/><button className={`icon-button ${mode==='width'?'selected':''}`} aria-label="适合宽度" title="适合宽度" onClick={()=>setMode('width')}><ScanLine size={17}/></button><button className={`icon-button ${mode==='page'?'selected':''}`} aria-label="适合页面" title="适合页面" onClick={()=>setMode('page')}><Maximize size={17}/></button></div></div>
  </section>;
}
