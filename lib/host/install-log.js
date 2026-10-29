import {redact} from './core.js'

/** Keep a bounded redacted tail. Incomplete lines stay private until joined or flushed. */
export class InstallLog {
  constructor(){this.buffers=new Map();this.tail='';this.truncated=false}
  line(text){
    if(text.length>8192){text='[oversized log line omitted]';this.truncated=true}
    const clean=redact(text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,''))
    if(!clean)return
    this.tail+=clean+'\n'
    if(this.tail.length>32768){this.tail=this.tail.slice(-32768);this.truncated=true}
  }
  append({jobId,stream,text,exitCode}){
    const key=String(jobId??'default').slice(0,128)+':'+(stream==='stderr'?'stderr':'stdout')
    if(typeof text==='string'&&text.length){
      const buffer=this.buffers.get(key)??{text:'',dropping:false}
      if(text.length>65536){buffer.text='';buffer.dropping=true;this.truncated=true;this.line('[oversized log chunk omitted]')}
      else{
        const lines=(buffer.text+text).split(/[\r\n]/);buffer.text=lines.pop()
        for(const line of lines){if(buffer.dropping)buffer.dropping=false;else this.line(line)}
        if(buffer.dropping||buffer.text.length>8192){buffer.text='';buffer.dropping=true;this.truncated=true}
      }
      this.buffers.delete(key);this.buffers.set(key,buffer)
      while(this.buffers.size>8){this.buffers.delete(this.buffers.keys().next().value);this.truncated=true}
    }
    if(exitCode!==undefined)this.flush(String(jobId??'default'))
  }
  flush(jobId){
    for(const [key,buffer] of this.buffers){if(jobId!==undefined&&!key.startsWith(String(jobId).slice(0,128)+':'))continue;if(!buffer.dropping)this.line(buffer.text);this.buffers.delete(key)}
  }
}
