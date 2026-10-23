export type Point={id:string;module:number;priority:string;pages:number[];page:number|null;title:string;slide_wording?:string;explain?:string;prediction?:string;question?:string;answer?:string;review?:string;source_url?:string;source_type?:string};
export type Module={id:number;title:string;shortTitle:string;pageCount:number;pdf:string;pdfZh?:string;notion:string};
export type Manifest={id:string;title:string;subtitle:string;modules:Module[];notion:string;auditUrl:string};
export type Message={role:'user'|'assistant';content:string};
export type AISession={open:boolean;input:string;messages:Message[]};
export type Session={draft:string;personal:string;answerOpen:boolean;scroll:number;ai:Record<string,AISession>;quizAnswers?:Record<string,{selected:number[];submitted:boolean}>};
export type Quiz={id:string;type:'single'|'multi';question:string;focus:string;options:{text:string;correct:boolean;module:number;page:number;reason:string}[]};
export type Learning={title:string;explanation:string;sources:{page:number;text:string}[];terms:{en:string;zh:string;definition:string;page:number}[];relations:{id:string;type:string;reason:string}[];quizzes:Quiz[]};
export type State={schemaVersion:1;statuses:Record<string,'studied'|'review'>;legacyIds:string[];overrides:Point[];sessions:Record<string,Session>;preferences:{theme:'light'|'dark';fontScale:number;reducedMotion:boolean;split:number};view:{module:number;page:number;pointId:string}};
export type AIRequest={id:string;model:string;messages:{role:string;content:string}[]};
export interface DesktopBridge {load():Promise<{state:unknown;legacy:unknown;legacyMarkdown:Record<string,string>;keyConfigured:boolean}>;save(state:State):Promise<void>;onBeforeClose(cb:()=>Promise<void>):()=>void;keyStatus():Promise<boolean>;setKey(key:string):Promise<void>;deleteKey():Promise<void>;ai(req:AIRequest):Promise<void>;cancel(id:string):Promise<void>;onAI(cb:(event:{id:string;delta?:string;error?:string;done?:boolean})=>void):()=>void;openExternal(url:string):Promise<void>}
declare global {interface Window {companion?:DesktopBridge}}
