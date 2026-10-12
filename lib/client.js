/* DSH classic-script module. No imports, no remote code or global CSS overrides. */
window.__ModuleLoader__.load({
  id:'dsh-lumen-market',
  factory(require){
    const React=require('react'),h=React.createElement
    const NS='lumenMarket',PANEL='lumen-market',API='/api/lumen-market'
    const zh={panel:'流明市场',intro:'发现插件，了解用途，再决定安装。',discover:'发现',installed:'已安装',updates:'可更新',search:'搜索',searchHint:'插件关键词、owner/repo 或 GitHub 仓库链接',all:'全部来源',npm:'npm',github:'GitHub',scope:'全部来源包含本地已安装插件与 npm；GitHub 关键词限定 dsh-plugin topic，仓库链接不受此限制。',refresh:'重新检查',loading:'正在加载…',empty:'没有找到符合条件的插件。',noDescription:'作者暂未提供介绍',noDocs:'暂无文档链接',viewDocs:'查看文档',details:'查看详情',close:'关闭详情',homepage:'项目主页',repository:'GitHub / 源码仓库',readme:'README',version:'版本',source:'来源',descriptionSource:'介绍来源',local:'本地链接',registry:'npm 注册表',git:'Git 仓库',alias:'npm 别名',tarball:'压缩包',other:'其它来源',shipped:'随 DSH 提供',bundle:'组合包',unverified:'未验证',compatible:'兼容',incompatible:'不兼容',unknown:'兼容性未知',exempted:'已获当前运行时豁免',malformed:'清单格式有误',clientOnly:'仅客户端，不能作为组合包安装',notPlugin:'未声明 DSH 插件',missingArtifacts:'缺少构建产物',monorepo:'子包仓库，首版仅支持根目录插件',installPreview:'安装预览',upgradePreview:'升级预览',confirmInstall:'确认安装',confirmUpgrade:'确认升级',cancel:'取消',preview:'确认操作目标',target:'安装目标',fromVersion:'当前版本',latest:'最新版本',pinned:'固定 commit',gitWarning:'Git 安装可能涉及生命周期脚本；授权由官方安装管线处理。文件查验不保证运行成功。',pipeline:'安装与更新交给 DSH 官方管理器。',restart:'以下插件需要重启 DSH：',pendingBuilds:'待处理构建脚本：',applied:'已应用',restartRequired:'已安装，需重启 DSH',failed:'操作失败',cancelled:'操作已取消',current:'已是最新',outdated:'有新版',ahead:'已装版本更新',blocked:'新版暂不可安装',lookupFailed:'版本查询失败',unknownInstalled:'已安装版本未知',newer:'可更新',onlyCompatible:'仅可安装',installState:'安装状态',stateAll:'全部状态',stateNew:'未安装',stateInstalled:'已安装',previous:'上一页',next:'下一页',page:'页',partial:'部分来源查询失败',failure:'请求失败',busy:'正在执行操作…',noInstall:'当前目标尚不具备安装条件',previewExpired:'预览过期或已使用，请重新预览',profileNotFound:'没有找到有效的 profile',retryAt:'可重试时间',notUpgradeable:'此来源不支持按包名更新',freshPreview:'安装前会重新查验目标',success:'操作完成',coverage:'搜索范围',checkedAt:'检查时间',result:'操作结果',health:'诊断',managementMissing:'官方插件管理服务不可用',peers:'不满足的 peer 范围',previewStale:'目标或已安装状态有变化，请重新预览'}
    const en={panel:'Lumen Market',intro:'Discover plugins. Understand them. Choose what to install.',discover:'Discover',installed:'Installed',updates:'Updates',search:'Search',searchHint:'Keywords, owner/repo, or GitHub repository URL',all:'All sources',npm:'npm',github:'GitHub',scope:'All sources includes installed plugins and npm. GitHub keywords use the dsh-plugin topic; repository URLs bypass this limit.',refresh:'Check again',loading:'Loading…',empty:'No matching plugins found.',noDescription:'The author has not provided a description',noDocs:'No documentation link',viewDocs:'View documentation',details:'View details',close:'Close details',homepage:'Project homepage',repository:'GitHub / source repository',readme:'README',version:'Version',source:'Source',descriptionSource:'Description source',local:'Local link',registry:'npm registry',git:'Git repository',alias:'npm alias',tarball:'Archive',other:'Other source',shipped:'Shipped with DSH',bundle:'Bundle',unverified:'Unverified',compatible:'Compatible',incompatible:'Incompatible',unknown:'Compatibility unknown',exempted:'Exempted for this runtime',malformed:'Malformed manifest',clientOnly:'Client only; cannot install as a bundle',notPlugin:'No DSH plugin declaration',missingArtifacts:'Missing build artifacts',monorepo:'Subpackage repository; root plugins only in v1',installPreview:'Preview installation',upgradePreview:'Preview upgrade',confirmInstall:'Confirm installation',confirmUpgrade:'Confirm upgrade',cancel:'Cancel',preview:'Confirm operation target',target:'Install target',fromVersion:'Current version',latest:'Latest version',pinned:'Pinned commit',gitWarning:'Git installs may involve lifecycle scripts. The official pipeline owns authorization. File checks do not guarantee runtime success.',pipeline:'Installation and updates use the official DSH manager.',restart:'Restart DSH for: ',pendingBuilds:'Pending build scripts: ',applied:'Applied',restartRequired:'Installed; restart DSH',failed:'Operation failed',cancelled:'Operation cancelled',current:'Up to date',outdated:'Update available',ahead:'Installed version is newer',blocked:'New version cannot be installed yet',lookupFailed:'Version lookup failed',unknownInstalled:'Installed version unknown',newer:'Updates available',onlyCompatible:'Installable only',installState:'Installation status',stateAll:'Any state',stateNew:'Not installed',stateInstalled:'Installed',previous:'Previous',next:'Next',page:'Page',partial:'Some sources failed',failure:'Request failed',busy:'Operation in progress…',noInstall:'This target is not ready to install',previewExpired:'Preview expired or consumed. Request a new preview',profileNotFound:'No valid profile was found',retryAt:'Retry after',notUpgradeable:'This source cannot be updated by package name',freshPreview:'The target is checked again before installation',success:'Operation completed',coverage:'Search coverage',checkedAt:'Checked at',result:'Operation result',health:'Diagnostics',managementMissing:'Official plugin manager unavailable',peers:'Unsatisfied peer ranges',previewStale:'Target or installed state changed. Request a new preview'}
    Object.assign(zh,{unchecked:'尚未检查更新',checkingUpdates:'正在检查更新…',scanLimited:'已达到候选查验上限，请缩小搜索关键词。',incompleteSearch:'来源返回的搜索结果不完整。',checking:'正在重新查验目标…',installing:'正在下载并安装…',applying:'正在应用插件…',cancelling:'正在取消，等待安装进程结束和文件恢复…',cancelOperation:'取消操作',cancelTooLate:'已经进入应用阶段，无法取消；请等待最终结果。',cancelUnavailable:'当前宿主不支持取消安装',operationMissing:'操作已经结束或无法定位',warnings:'安装提示',diagnostics:'安装诊断',failureKind:'失败原因',network:'网络连接失败',timeout:'请求超时',permission:'文件访问权限不足','disk-full':'磁盘空间不足','build-blocked':'构建脚本需要授权','pnpm-missing':'找不到包管理器','not-found':'目标不存在','no-matching-version':'目标版本不存在',integrity:'安装包完整性校验失败',unknown:'兼容性未知',officialRejected:'官方管理器拒绝了安装预览'})
    Object.assign(en,{unchecked:'Updates not checked',checkingUpdates:'Checking updates…',scanLimited:'Candidate inspection limit reached. Use more specific keywords.',incompleteSearch:'This source returned incomplete search results.',checking:'Revalidating the target…',installing:'Downloading and installing…',applying:'Applying the plugin…',cancelling:'Cancelling; waiting for process exit and file restoration…',cancelOperation:'Cancel operation',cancelTooLate:'Application has started. Wait for the final outcome.',cancelUnavailable:'This host cannot cancel installations',operationMissing:'The operation has finished or cannot be located',warnings:'Installation notices',diagnostics:'Installation diagnostics',failureKind:'Failure reason',network:'Network connection failed',timeout:'Request timed out',permission:'File permission denied','disk-full':'Disk is full','build-blocked':'Build scripts require approval','pnpm-missing':'Package manager not found','not-found':'Target not found','no-matching-version':'Target version not found',integrity:'Package integrity check failed',unknown:'Compatibility unknown',officialRejected:'The official manager refused this preview'})
    Object.assign(zh,{sortBy:'排序',sortDefault:'默认排序',sortStars:'GitHub 星标最多',stars:'GitHub 星标',starsHint:'按 GitHub 仓库星标数从高到低排列。'})
    Object.assign(en,{sortBy:'Sort by',sortDefault:'Default order',sortStars:'Most GitHub stars',stars:'GitHub stars',starsHint:'GitHub repositories ordered by stars, highest first.'})
    function safeLink(value){try{if(typeof value!=='string')return null;const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
    function createStore(){
      let state={tab:'discover',q:'',source:'all',sort:'updated',page:1,status:'idle',data:null,detail:null,detailLoading:false,preview:null,result:null,error:null,busy:false,executing:false,operation:null,cancelStatus:null,updatesChecking:false,pendingRestart:[],onlyCompatible:false,installState:'all'}
      const listeners=new Set(),controllers=new Map(),filters=new Map();let listEpoch=0,detailEpoch=0,previewEpoch=0,operationEpoch=0,operationTimer=null,disposed=false
      const set=patch=>{if(disposed)return;state=Object.assign({},state,patch);listeners.forEach(fn=>fn())}
      const invalidatePreview=()=>{previewEpoch++;controllers.get('preview')?.abort();set({preview:null,...(!state.executing?{busy:false}:{})})}
      const changeTab=tab=>{
        if(tab===state.tab)return
        filters.set(state.tab,{onlyCompatible:state.onlyCompatible,installState:state.installState})
        set({tab,...(filters.get(tab)||{onlyCompatible:false,installState:'all'}),data:null,updatesChecking:false})
      }
      async function request(path,body,channel){
        if(disposed)throw {code:'disposed'}
        if(channel)controllers.get(channel)?.abort()
        const controller=new AbortController(),key=channel||Symbol('request');controllers.set(key,controller)
        try{
          const response=await window.fetch(API+path,{method:body?'POST':'GET',headers:{'x-dsh-lumen-market':'1','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal})
          const data=await response.json();if(!response.ok)throw data
          return data
        }catch(e){if(e?.code)throw e;throw {code:e?.name==='AbortError'?'aborted':'network'}}
        finally{if(controllers.get(key)===controller)controllers.delete(key)}
      }
      const stopMonitor=()=>{operationEpoch++;clearTimeout(operationTimer);operationTimer=null;controllers.get('operation')?.abort()}
      async function monitor(previewId,epoch){
        if(disposed||epoch!==operationEpoch||!state.executing)return
        try{const data=await request('/operation?'+new URLSearchParams({previewId}),null,'operation');if(epoch===operationEpoch)set({operation:data.operation??null})}catch{}
        if(!disposed&&epoch===operationEpoch&&state.executing&&!state.operation?.done)operationTimer=setTimeout(()=>monitor(previewId,epoch),500)
      }
      const store={
        get:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
        async search(q=state.q,source=state.source,page=1,force=false,sort=state.sort){
          if(source!=='github')sort='updated'
          const changed=q!==state.q||source!==state.source||sort!==state.sort||page!==state.page
          invalidatePreview()
          changeTab('discover');controllers.get('updates')?.abort()
          const epoch=++listEpoch;set({q,source,sort,page,status:'loading',updatesChecking:false,error:null,...(changed?{data:null}:{})})
          try{const data=await request('/search?'+new URLSearchParams({q,source,page,sort,...(force?{force:'1'}:{})}),null,'list');if(epoch===listEpoch)set({status:'ready',data,pendingRestart:data.pendingRestart||state.pendingRestart})}
          catch(error){if(epoch===listEpoch)set({status:'error',error})}
        },
        async load(tab=state.tab,force=false){
          if(tab==='discover')return store.search(state.q,state.source,state.page,force)
          changeTab(tab);controllers.get('updates')?.abort()
          const epoch=++listEpoch;set({status:'loading',updatesChecking:false,error:null})
          try{
            const data=await request(tab==='updates'?'/updates'+(force?'?force=1':''):'/installed',null,'list')
            if(epoch!==listEpoch)return
            set({status:'ready',data,pendingRestart:data.pendingRestart||state.pendingRestart})
            if(tab==='installed'){
              set({updatesChecking:true})
              request('/updates'+(force?'?force=1':''),null,'updates').then(data=>{
                if(epoch===listEpoch)set({data,updatesChecking:false,pendingRestart:data.pendingRestart||state.pendingRestart})
              }).catch(error=>{if(epoch===listEpoch)set({updatesChecking:false,error})})
            }
          }
          catch(error){if(epoch===listEpoch)set({status:'error',error})}
        },
        selectTab(tab){detailEpoch++;controllers.get('detail')?.abort();invalidatePreview();set({detail:null,detailLoading:false});return store.load(tab)},
        async open(row){
          const epoch=++detailEpoch;invalidatePreview()
          set({detail:row,detailLoading:true,error:null,preview:null})
          const args={source:row.id?.startsWith('installed:')?'installed':row.source,name:row.name}
          if(row.repo)args.repo=row.repo
          if(row.source==='npm'&&row.version)args.version=row.version
          try{const detail=await request('/detail?'+new URLSearchParams(args),null,'detail');if(epoch===detailEpoch)set({detail:Object.assign({},row,detail),detailLoading:false})}
          catch(error){if(epoch===detailEpoch)set({detailLoading:false,error})}
        },
        close(){detailEpoch++;controllers.get('detail')?.abort();invalidatePreview();set({detail:null,detailLoading:false})},
        async prepare(row,action='install'){
          if(state.busy)return
          const epoch=++previewEpoch;set({busy:true,error:null,result:null,preview:null})
          const body={action,source:action==='upgrade'?'npm':row.source,name:row.name}
          if(row.repo)body.repo=row.repo
          if(row.latest||row.version)body.version=row.latest||row.version
          try{const preview=await request('/inspect',body,'preview');if(epoch===previewEpoch)set({preview,busy:false})}
          catch(error){if(epoch===previewEpoch)set({busy:false,error})}
        },
        dismissPreview(){if(!state.executing)invalidatePreview()},
        async execute(){
          if(state.busy||!state.preview)return
          const preview=state.preview;let refresh=false;set({busy:true,executing:true,operation:null,cancelStatus:null,error:null})
          try{
            const active=request('/'+preview.preview.action,{previewId:preview.previewId})
            monitor(preview.previewId,++operationEpoch)
            const result=await active;set({result,preview:null,pendingRestart:result.pendingRestart||state.pendingRestart});refresh=true
          }
          catch(error){set({error,preview:null})}
          finally{stopMonitor();set({busy:false,executing:false,operation:null})}
          if(refresh)await store.load(state.tab,true)
        },
        async cancel(){
          if(!state.executing||!state.operation?.cancellable||state.cancelStatus==='requested')return
          const operationId=state.operation.operationId,epoch=operationEpoch;set({cancelStatus:'requested'})
          try{const result=await request('/cancel',{operationId});if(epoch===operationEpoch&&state.executing)set({cancelStatus:result.status})}catch(error){if(epoch===operationEpoch&&state.executing)set({error,cancelStatus:null})}
        },
        filter(patch){set(patch)},
        async health(){try{set({error:null,result:{health:await request('/health')}})}catch(error){set({error})}},
        dispose(){disposed=true;stopMonitor();controllers.forEach(c=>c.abort());controllers.clear();listeners.clear()},
      }
      return store
    }
    const CSS=`
      .lm-page{height:100%;box-sizing:border-box;overflow:auto;color:var(--dsw-alias-label-primary);padding:28px clamp(16px,3vw,44px) 40px;font:inherit}
      .lm-shell{max-width:1200px;margin:auto}.lm-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}.lm-brand{display:flex;align-items:center;gap:12px}.lm-symbol{width:38px;height:38px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 22%,transparent);border-radius:12px;display:grid;place-items:center;color:var(--dsw-alias-state-business-primary)}
      .lm-page h1{font-size:23px;letter-spacing:-.6px;line-height:1.25;margin:0}.lm-subtitle{color:var(--dsw-alias-label-secondary);font-size:13px;margin:5px 0 0}.lm-kicker{font-size:10px;letter-spacing:2px;color:var(--dsw-alias-label-caption);margin-bottom:5px}
      .lm-tabs{display:flex;gap:24px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);margin-bottom:22px}.lm-tab{font:inherit;background:none;color:var(--dsw-alias-label-secondary);border:0;border-bottom:2px solid transparent;padding:10px 0;cursor:pointer;font-size:14px}.lm-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-state-business-primary)}
      .lm-button{font:inherit;font-size:12px;line-height:20px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent);color:var(--dsw-alias-label-primary);background:transparent;border-radius:7px;padding:5px 12px;cursor:pointer;white-space:nowrap}.lm-button:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);border-color:var(--dsw-alias-state-business-primary)}.lm-button[data-primary=true]{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-on-color,white);border-color:transparent}.lm-button:disabled{opacity:.5;cursor:default}.lm-page :focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}
      .lm-search{display:flex;gap:8px;margin-bottom:10px}.lm-input{flex:1;min-width:100px}.lm-input,.lm-select{font:inherit;font-size:13px;line-height:22px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);border-radius:7px;padding:8px 12px}.lm-select{padding:5px 8px;max-width:180px}.lm-select option{background-color:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}.lm-hint{font-size:11px;line-height:18px;color:var(--dsw-alias-label-caption);margin:0 0 16px}.lm-filters{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;font-size:12px;color:var(--dsw-alias-label-secondary)}.lm-filters label{display:flex;align-items:center;gap:6px}.lm-filters input{accent-color:var(--dsw-alias-state-business-primary)}
      .lm-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}.lm-layout[data-detail=true]{grid-template-columns:minmax(0,1fr) minmax(280px,380px)}.lm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:12px;align-content:start}.lm-card{border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 13%,transparent);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0}.lm-card[data-selected=true]{border-color:var(--dsw-alias-state-business-primary)}.lm-cardTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.lm-name{font-size:14px;font-weight:600;overflow-wrap:anywhere;margin:0;line-height:22px}.lm-source{font-size:10px;letter-spacing:.4px;color:var(--dsw-alias-label-caption);flex:none}.lm-description{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:20px;margin:0;overflow-wrap:anywhere}.lm-description[data-short=true]{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}.lm-version{font-size:11px;line-height:18px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lm-badges{display:flex;gap:5px;flex-wrap:wrap}.lm-badge{font-size:10px;line-height:17px;border-radius:4px;padding:1px 6px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-secondary)}.lm-badge[data-tone=good]{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent)}.lm-badge[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
      .lm-cardActions{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:4px;flex-wrap:wrap}.lm-link{font-size:12px;color:var(--dsw-alias-state-business-primary);text-decoration:none;overflow-wrap:anywhere}.lm-link:hover{text-decoration:underline}.lm-detail{position:sticky;top:16px;align-self:start;max-height:var(--lm-detail-max-height,calc(100dvh - 160px));overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable;border-left:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);padding-left:24px;min-width:0}.lm-detailHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:18px}.lm-detail h2{margin:0;font-size:17px;line-height:25px;overflow-wrap:anywhere}.lm-detail p{white-space:pre-wrap}.lm-detail dl{font-size:12px;line-height:20px;display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px 12px}.lm-detail dt{color:var(--dsw-alias-label-caption)}.lm-detail dd{margin:0;overflow-wrap:anywhere}.lm-docs{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.lm-detailActions{margin:20px 0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
      .lm-notice{padding:12px 14px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 30%,transparent);border-radius:8px;margin:0 0 16px;font-size:12px;line-height:20px;overflow-wrap:anywhere}.lm-notice[data-error=true]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}.lm-empty{padding:48px 20px;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary);grid-column:1/-1}.lm-pagination{display:flex;align-items:center;justify-content:space-between;margin-top:20px;font-size:12px;color:var(--dsw-alias-label-caption)}
      .lm-preview{border:1px solid var(--dsw-alias-state-business-primary);border-radius:10px;padding:18px;margin:0 0 20px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 4%,transparent)}.lm-preview h2{font-size:15px;margin:0 0 12px}.lm-preview code{font-size:12px;overflow-wrap:anywhere;display:block;margin:8px 0}.lm-previewActions{display:flex;gap:8px;margin-top:14px}.lm-footer{margin-top:30px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);font-size:11px;color:var(--dsw-alias-label-caption);display:flex;justify-content:space-between;gap:12px}
      @media(max-width:780px){.lm-layout[data-detail=true]{grid-template-columns:1fr}.lm-detail{position:static;max-height:none;overflow:visible;overscroll-behavior-y:auto;scrollbar-gutter:auto;border-left:0;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);padding:20px 0 0;grid-row:1}.lm-header{align-items:flex-start}.lm-search{flex-wrap:wrap}.lm-search .lm-input{flex-basis:100%}.lm-tabs{gap:22px}.lm-page{padding-top:20px}}
    `
    const sourceText=(row,t)=>t(row.source==='npm'?'npm':row.source)
    const hasStars=row=>row.source==='github'&&Number.isSafeInteger(row.stars)&&row.stars>=0
    const validationKey={'client-only':'clientOnly','not-plugin':'notPlugin','missing-artifacts':'missingArtifacts','unknown-installed':'unknownInstalled','lookup-failed':'lookupFailed'}
    function badgeText(row,t){const v=row.verdict||row.validation||'unverified';return t(validationKey[v]||v)}
    function Button({children,primary=false,...props}){return h('button',Object.assign({type:'button',className:'lm-button','data-primary':primary},props),children)}
    function Link({url,children}){const safe=safeLink(url);return safe?h('a',{className:'lm-link',href:safe,target:'_blank',rel:'noopener noreferrer'},children):null}
    function SymbolIcon(){return h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none','aria-hidden':true},h('path',{d:'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3',stroke:'currentColor',strokeWidth:1.5}),h('circle',{cx:12,cy:12,r:4,stroke:'currentColor',strokeWidth:1.5}))}
    function errorText(error,t){
      const known={'preview-expired':'previewExpired','profile-not-found':'profileNotFound','management-required':'managementMissing','preview-stale':'previewStale','source-changed':'previewStale','not-installable':'noInstall','official-inspect-rejected':'officialRejected','cancellation-unavailable':'cancelUnavailable','operation-not-found':'operationMissing'}
      let text=known[error.code]?t(known[error.code]):`${t('failure')} · ${error.code||'internal'}`
      if(error.retryAt)text+=` · ${t('retryAt')}: ${new Date(error.retryAt).toLocaleString()}`
      if(error.compatibility?.peers)text+=' · '+JSON.stringify(error.compatibility.peers)
      if(error.rejected)text+=' · '+error.rejected.map(c=>`${c.evidence}: ${c.dir}`).join('; ')
      if(error.diagnostic)text+=' · '+error.diagnostic
      if(error.incompatible)text+=' · '+error.incompatible.map(row=>`${row.name}: ${JSON.stringify(row.peers)}`).join('; ')
      return text
    }
    function Card({row,store,state,t}){
      const docs=Object.values(row.links||{}).find(safeLink)
      return h('article',{className:'lm-card','data-selected':state.detail?.id===row.id},
        h('div',{className:'lm-cardTop'},h('h3',{className:'lm-name'},row.name),h('span',{className:'lm-source'},sourceText(row,t))),
        h('p',{className:'lm-description','data-short':true},row.description||t('noDescription')),
        h('div',{className:'lm-version'},row.installed?`${t('installed')} ${row.installed}${row.latest?' → '+row.latest:''}`:row.version?`${t('version')} ${row.version}`:row.repo||''),
        h('div',{className:'lm-badges'},h('span',{className:'lm-badge','data-tone':row.upgradeable?'good':undefined},badgeText(row,t)),row.compatibility?h('span',{className:'lm-badge','data-tone':row.compatibility.verdict==='compatible'?'good':row.compatibility.verdict==='incompatible'?'error':undefined},t(row.compatibility.verdict)):null,row.alreadyInstalled?h('span',{className:'lm-badge'},t('installed')):null,hasStars(row)?h('span',{className:'lm-badge','aria-label':t('stars')+': '+row.stars},'★ '+row.stars.toLocaleString()):null),
        h('div',{className:'lm-cardActions'},h(Button,{onClick:()=>store.open(row)},t('details')),docs?h(Link,{url:docs},t('viewDocs')):h('span',{className:'lm-version'},t('noDocs')),row.upgradeable?h(Button,{primary:true,disabled:state.busy,onClick:()=>store.prepare(row,'upgrade')},t('upgradePreview')):null))
    }
    function Detail({row,state,store,t,panelRef}){
      return h('aside',{ref:panelRef,className:'lm-detail','aria-label':t('details'),tabIndex:0},
        h('div',{className:'lm-detailHead'},h('h2',null,row.name),h(Button,{onClick:()=>store.close(),disabled:state.busy},t('close'))),
        state.detailLoading?h('p',{role:'status',className:'lm-hint'},t('loading')):null,
        h('p',{className:'lm-description'},row.description||t('noDescription')),
        h('dl',null,h('dt',null,t('source')),h('dd',null,sourceText(row,t)),h('dt',null,t('descriptionSource')),h('dd',null,row.descriptionSource||'—'),h('dt',null,t('version')),h('dd',null,row.version||row.installed||'—'),hasStars(row)?h(React.Fragment,null,h('dt',null,t('stars')),h('dd',null,row.stars.toLocaleString())):null,row.sha?h(React.Fragment,null,h('dt',null,t('pinned')),h('dd',null,row.sha)):null),
        h('div',{className:'lm-badges'},h('span',{className:'lm-badge'},badgeText(row,t)),row.compatibility?h('span',{className:'lm-badge'},t(row.compatibility.verdict)):null,row.compatibility?.exempted?h('span',{className:'lm-badge'},t('exempted')):null),
        row.compatibility?.peers&&Object.keys(row.compatibility.peers).length?h('p',{className:'lm-hint'},t('peers')+': '+JSON.stringify(row.compatibility.peers)):null,
        h('div',{className:'lm-docs'},...Object.entries(row.links||{}).map(([key,url])=>h(Link,{key,url},t(key)))),
        h('div',{className:'lm-detailActions'},row.installable&&!row.alreadyInstalled&&!row.id?.startsWith('installed:')?h(Button,{primary:true,disabled:state.busy||state.detailLoading,onClick:()=>store.prepare(row)},t('installPreview')):row.upgradeable?h(Button,{primary:true,disabled:state.busy||state.detailLoading,onClick:()=>store.prepare(row,'upgrade')},t('upgradePreview')):h('p',{className:'lm-hint'},row.source==='local'||row.source==='git'||row.source==='alias'||row.source==='tarball'?t('notUpgradeable'):row.alreadyInstalled?t('installed'):t('noInstall')),h('p',{className:'lm-hint'},t('freshPreview'))))
    }
    function Page({store,t}){
      const state=React.useSyncExternalStore(store.subscribe,store.get,store.get)
      const pageRef=React.useRef(null),footerRef=React.useRef(null),detailRef=React.useRef(null)
      React.useLayoutEffect(()=>{
        const page=pageRef.current,footer=footerRef.current,view=page?.ownerDocument.defaultView
        if(!page||!footer||!view)return
        const resize=()=>{
          if(page.clientHeight<=0)return
          const bottom=footer.getBoundingClientRect().height+(parseFloat(view.getComputedStyle(footer).marginTop)||0)+(parseFloat(view.getComputedStyle(page).paddingBottom)||0)
          page.style.setProperty('--lm-detail-max-height',Math.max(0,page.clientHeight-bottom-16)+'px')
        }
        resize()
        const observer=view.ResizeObserver?new view.ResizeObserver(resize):null
        observer?.observe(page);observer?.observe(footer);view.addEventListener('resize',resize)
        return()=>{observer?.disconnect();view.removeEventListener('resize',resize)}
      },[])
      React.useLayoutEffect(()=>{
        const detail=detailRef.current,page=pageRef.current
        if(!detail||!page)return
        detail.scrollTop=0
        if(page.ownerDocument.defaultView?.matchMedia?.('(max-width:780px)')?.matches){
          page.scrollTo({top:page.scrollTop+detail.getBoundingClientRect().top-page.getBoundingClientRect().top-20,behavior:'auto'})
        }
      },[state.detail?.id??state.detail?.name])
      const [draft,setDraft]=React.useState(state.q)
      React.useEffect(()=>{if(store.get().status==='idle')store.search()},[store])
      const rows=(state.data?.rows||[]).filter(row=>(state.tab!=='updates'||row.upgradeable)&&(state.tab!=='discover'||(!state.onlyCompatible||row.installable||row.upgradeable)&&(state.installState==='all'||(state.installState==='installed'?row.alreadyInstalled||row.id?.startsWith('installed:'):!row.alreadyInstalled&&!row.id?.startsWith('installed:')))))
      const preview=state.preview?.preview
      return h('div',{ref:pageRef,className:'lm-page'},h('style',{id:'lumen-market-style'},CSS),h('div',{className:'lm-shell'},
        h('header',{className:'lm-header'},h('div',{className:'lm-brand'},h('div',{className:'lm-symbol'},h(SymbolIcon)),h('div',null,h('div',{className:'lm-kicker'},'LUMEN / PLUGINS'),h('h1',null,t('panel')),h('p',{className:'lm-subtitle'},t('intro')))),h(Button,{onClick:()=>store.load(state.tab,true),disabled:state.status==='loading'},t('refresh'))),
        h('nav',{className:'lm-tabs',role:'tablist','aria-label':t('panel')},...['discover','installed','updates'].map(tab=>h('button',{key:tab,type:'button',className:'lm-tab',role:'tab','aria-selected':state.tab===tab,onClick:()=>store.selectTab(tab)},t(tab)))),
        state.tab==='discover'?h(React.Fragment,null,h('form',{className:'lm-search',onSubmit:e=>{e.preventDefault();store.search(draft,state.source)}},h('input',{className:'lm-input',value:draft,maxLength:200,'aria-label':t('searchHint'),placeholder:t('searchHint'),onChange:e=>setDraft(e.target.value)}),h('select',{className:'lm-select',value:state.source,'aria-label':t('source'),onChange:e=>{const source=e.target.value;store.search(draft,source,1,false,source==='github'?state.sort:'updated')}},...['all','npm','github'].map(s=>h('option',{key:s,value:s},t(s)))),h('select',{className:'lm-select',value:state.sort,'aria-label':t('sortBy'),onChange:e=>{const sort=e.target.value;store.search(draft,sort==='stars'?'github':state.source,1,false,sort)}},h('option',{value:'updated'},t('sortDefault')),h('option',{value:'stars'},t('sortStars'))),h(Button,{type:'submit',primary:true},t('search'))),h('p',{className:'lm-hint'},state.sort==='stars'?t('starsHint')+' '+t('scope'):t('scope'))):null,
        h('div',{className:'lm-filters'},state.tab==='discover'?h(React.Fragment,null,h('label',null,h('input',{type:'checkbox',checked:state.onlyCompatible,onChange:e=>store.filter({onlyCompatible:e.target.checked})}),t('onlyCompatible')),h('label',null,t('installState'),h('select',{className:'lm-select',value:state.installState,onChange:e=>store.filter({installState:e.target.value})},h('option',{value:'all'},t('stateAll')),h('option',{value:'new'},t('stateNew')),h('option',{value:'installed'},t('stateInstalled'))))):null,state.updatesChecking?h('span',{role:'status'},t('checkingUpdates')):state.data?.checkedAt?h('span',null,t('checkedAt')+': '+new Date(state.data.checkedAt).toLocaleTimeString()):null),
        ...Object.entries(state.data?.sources||{}).filter(([,source])=>source.scanLimited||source.incomplete).map(([source,info])=>h('div',{key:source,className:'lm-notice',role:'status'},source+' · '+t(info.scanLimited?'scanLimited':'incompleteSearch'))),
        state.pendingRestart.length?h('div',{className:'lm-notice',role:'status'},t('restart')+state.pendingRestart.join(', ')):null,
        state.result?.pendingBuilds?.length?h('div',{className:'lm-notice'},t('pendingBuilds')+state.result.pendingBuilds.join(', ')):null,
        state.result?.warnings?.length?h('div',{className:'lm-notice'},h('strong',null,t('warnings')),h('ul',null,...state.result.warnings.map((warning,i)=>h('li',{key:i},warning)))):null,
        state.result?.packageResult?h('details',{className:'lm-notice'},h('summary',null,t('diagnostics')),state.result.packageResult.kind?h('p',null,t('failureKind')+': '+t(state.result.packageResult.kind)):null,h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:200,overflow:'auto'}},state.result.packageResult.output||'')):null,
        state.error?h('div',{className:'lm-notice','data-error':true,role:'alert'},errorText(state.error,t)):null,
        ...((state.data?.errors||[]).map((e,i)=>h('div',{key:i,className:'lm-notice','data-error':true},t('partial')+` · ${e.source} · `+errorText(e,t)))),
        state.result?h('div',{className:'lm-notice','data-error':state.result.ok===false,role:'status'},state.result.health?JSON.stringify(state.result.health):t(state.result.application==='restart-required'?'restartRequired':state.result.application==='applied'?'applied':state.result.application==='cancelled'?'cancelled':state.result.ok?'success':'failed'),state.result.error?h('p',null,errorText(state.result.error,t)):null):null,
        preview?h('section',{className:'lm-preview','aria-label':t('preview')},h('h2',null,t('preview')),h('strong',null,preview.name),h('code',null,preview.spec),preview.fromVersion?h('p',{className:'lm-hint'},t('fromVersion')+': '+preview.fromVersion):null,h('p',{className:'lm-hint'},preview.source==='github'?t('gitWarning'):t('pipeline')),h('div',{className:'lm-previewActions'},h(Button,{primary:true,disabled:state.busy,onClick:()=>store.execute()},t(preview.action==='upgrade'?'confirmUpgrade':'confirmInstall')),h(Button,{disabled:state.busy,onClick:()=>store.dismissPreview()},t('cancel')))):null,
        state.cancelStatus==='too-late'?h('p',{className:'lm-notice',role:'status'},t('cancelTooLate')):null,
        state.busy?h('div',{className:'lm-notice',role:'status'},h('p',null,t(state.cancelStatus==='requested'?'cancelling':state.operation?.phase||'busy')),state.operation?.attempt?h('p',{className:'lm-hint'},`${state.operation.attempt.index}/${state.operation.attempt.total} · ${state.operation.attempt.registry||'npm'}`):null,state.executing&&state.operation?.cancellable?h(Button,{onClick:()=>store.cancel(),disabled:state.cancelStatus==='requested'},t('cancelOperation')):null):null,
        h('div',{className:'lm-layout','data-detail':!!state.detail},h('div',null,h('div',{className:'lm-grid','aria-busy':state.status==='loading'},state.status==='loading'?h('div',{className:'lm-empty',role:'status'},t('loading')):null,...rows.map(row=>h(Card,{key:row.id||row.name,row,store,state,t})),state.status!=='loading'&&rows.length===0?h('div',{className:'lm-empty'},t('empty')):null),state.tab==='discover'?h('div',{className:'lm-pagination'},h(Button,{disabled:state.page<=1||state.status==='loading',onClick:()=>store.search(state.q,state.source,state.page-1)},t('previous')),h('span',null,t('page')+' '+state.page),h(Button,{disabled:!state.data?.hasMore||state.status==='loading',onClick:()=>store.search(state.q,state.source,state.page+1)},t('next'))):null),state.detail?h(Detail,{row:state.detail,state,store,t,panelRef:detailRef}):null),
        h('footer',{ref:footerRef,className:'lm-footer'},h('span',null,t('pipeline')),h(Button,{onClick:()=>store.health()},t('health')))))
    }
    function apply(ctx){
      ctx.effect(()=>ctx.locale.register(NS,{zh,en}),'lumen-market: dictionaries')
      const t=ctx.locale.bind(NS),store=createStore()
      ctx.effect(()=>()=>store.dispose(),'lumen-market: store')
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:PANEL,locale:NS},()=>h(Page,{store,t})))
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:PANEL,order:31,label:()=>t('panel'),locale:NS},SymbolIcon))
    }
    return {inject:['slots','locale'],apply,createStore,safeLink}
  },
})
