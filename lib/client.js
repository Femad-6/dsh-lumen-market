/* DSH classic-script module. No imports, no remote code or global CSS overrides. */
window.__ModuleLoader__.load({
  id:'dsh-lumen-market',
  factory(require){
    const React=require('react'),h=React.createElement
    const NS='lumenMarket',PANEL='lumen-market',API='/api/lumen-market'
    const zh={panel:'流明市场',intro:'发现插件，了解用途，再决定安装。',discover:'发现',installed:'已安装',updates:'可更新',search:'搜索',searchHint:'插件关键词、owner/repo 或 GitHub 仓库链接',all:'全部来源',npm:'npm',github:'GitHub',scope:'全部来源包含 npm 与 GitHub。GitHub 关键词限定 dsh-plugin topic，仓库链接不受此限制。',refresh:'重新检查',loading:'正在加载…',empty:'没有找到符合条件的插件。',noDescription:'作者暂未提供介绍',noDocs:'暂无文档链接',viewDocs:'查看文档',details:'查看详情',close:'关闭详情',homepage:'项目主页',repository:'GitHub / 源码仓库',readme:'README',version:'版本',source:'来源',descriptionSource:'介绍来源',local:'本地链接',registry:'npm 注册表',git:'Git 仓库',alias:'npm 别名',tarball:'压缩包',other:'其它来源',shipped:'随 DSH 提供',bundle:'组合包',unverified:'未验证',compatible:'兼容',incompatible:'不兼容',unknown:'兼容性未知',exempted:'已获当前运行时豁免',malformed:'清单格式有误',clientOnly:'仅客户端，不能作为组合包安装',notPlugin:'未声明 DSH 插件',missingArtifacts:'缺少构建产物',monorepo:'子包仓库，首版仅支持根目录插件',installPreview:'安装预览',upgradePreview:'升级预览',updateAvailable:'有可用更新',confirmInstall:'确认安装',confirmUpgrade:'确认升级',cancel:'取消',preview:'确认操作目标',target:'安装目标',fromVersion:'当前版本',latest:'最新版本',pinned:'固定 commit',gitWarning:'Git 安装可能涉及生命周期脚本；授权由官方安装管线处理。文件查验不保证运行成功。',pipeline:'安装与更新交给 DSH 官方管理器。',restart:'以下插件需要重启 DSH：',pendingBuilds:'待处理构建脚本：',applied:'已应用',restartRequired:'已安装，需重启 DSH',failed:'操作失败',cancelled:'操作已取消',current:'已是最新',outdated:'有新版',ahead:'已装版本更新',blocked:'新版暂不可安装',lookupFailed:'版本查询失败',unknownInstalled:'已安装版本未知',newer:'可更新',onlyCompatible:'仅可安装',previous:'上一页',next:'下一页',page:'页',partial:'部分来源查询失败',failure:'请求失败',busy:'正在执行操作…',noInstall:'当前目标尚不具备安装条件',previewExpired:'预览过期或已使用，请重新预览',profileNotFound:'没有找到有效的 profile',retryAt:'可重试时间',notUpgradeable:'此来源不支持按包名更新',freshPreview:'安装前会重新查验目标',success:'操作完成',coverage:'搜索范围',checkedAt:'检查时间',result:'操作结果',health:'诊断',managementMissing:'官方插件管理服务不可用',peers:'不满足的 peer 范围',previewStale:'目标或已安装状态有变化，请重新预览'}
    const en={panel:'Lumen Market',intro:'Discover plugins. Understand them. Choose what to install.',discover:'Discover',installed:'Installed',updates:'Updates',search:'Search',searchHint:'Keywords, owner/repo, or GitHub repository URL',all:'All sources',npm:'npm',github:'GitHub',scope:'All sources include npm and GitHub. GitHub keywords use the dsh-plugin topic; repository URLs bypass this limit.',refresh:'Check again',loading:'Loading…',empty:'No matching plugins found.',noDescription:'The author has not provided a description',noDocs:'No documentation link',viewDocs:'View documentation',details:'View details',close:'Close details',homepage:'Project homepage',repository:'GitHub / source repository',readme:'README',version:'Version',source:'Source',descriptionSource:'Description source',local:'Local link',registry:'npm registry',git:'Git repository',alias:'npm alias',tarball:'Archive',other:'Other source',shipped:'Shipped with DSH',bundle:'Bundle',unverified:'Unverified',compatible:'Compatible',incompatible:'Incompatible',unknown:'Compatibility unknown',exempted:'Exempted for this runtime',malformed:'Malformed manifest',clientOnly:'Client only; cannot install as a bundle',notPlugin:'No DSH plugin declaration',missingArtifacts:'Missing build artifacts',monorepo:'Subpackage repository; root plugins only in v1',installPreview:'Preview installation',upgradePreview:'Preview upgrade',updateAvailable:'Update available',confirmInstall:'Confirm installation',confirmUpgrade:'Confirm upgrade',cancel:'Cancel',preview:'Confirm operation target',target:'Install target',fromVersion:'Current version',latest:'Latest version',pinned:'Pinned commit',gitWarning:'Git installs may involve lifecycle scripts. The official pipeline owns authorization. File checks do not guarantee runtime success.',pipeline:'Installation and updates use the official DSH manager.',restart:'Restart DSH for: ',pendingBuilds:'Pending build scripts: ',applied:'Applied',restartRequired:'Installed; restart DSH',failed:'Operation failed',cancelled:'Operation cancelled',current:'Up to date',outdated:'Update available',ahead:'Installed version is newer',blocked:'New version cannot be installed yet',lookupFailed:'Version lookup failed',unknownInstalled:'Installed version unknown',newer:'Updates available',onlyCompatible:'Installable only',previous:'Previous',next:'Next',page:'Page',partial:'Some sources failed',failure:'Request failed',busy:'Operation in progress…',noInstall:'This target is not ready to install',previewExpired:'Preview expired or consumed. Request a new preview',profileNotFound:'No valid profile was found',retryAt:'Retry after',notUpgradeable:'This source cannot be updated by package name',freshPreview:'The target is checked again before installation',success:'Operation completed',coverage:'Search coverage',checkedAt:'Checked at',result:'Operation result',health:'Diagnostics',managementMissing:'Official plugin manager unavailable',peers:'Unsatisfied peer ranges',previewStale:'Target or installed state changed. Request a new preview'}
    Object.assign(zh,{unchecked:'尚未检查更新',checkingUpdates:'正在检查更新…',scanLimited:'已达到候选查验上限，请缩小搜索关键词。',incompleteSearch:'来源返回的搜索结果不完整。',checking:'正在重新查验目标…',installing:'正在下载并安装…',applying:'正在应用插件…',cancelling:'正在取消，等待安装进程结束和文件恢复…',cancelOperation:'取消操作',cancelTooLate:'已经进入应用阶段，无法取消；请等待最终结果。',cancelUnavailable:'当前宿主不支持取消安装',operationMissing:'操作已经结束或无法定位',warnings:'安装提示',diagnostics:'安装诊断',failureKind:'失败原因',network:'网络连接失败',timeout:'请求超时',permission:'文件访问权限不足','disk-full':'磁盘空间不足','build-blocked':'构建脚本需要授权','pnpm-missing':'找不到包管理器','not-found':'目标不存在','no-matching-version':'目标版本不存在',integrity:'安装包完整性校验失败',unknown:'兼容性未知',officialRejected:'官方管理器拒绝了安装预览'})
    Object.assign(en,{unchecked:'Updates not checked',checkingUpdates:'Checking updates…',scanLimited:'Candidate inspection limit reached. Use more specific keywords.',incompleteSearch:'This source returned incomplete search results.',checking:'Revalidating the target…',installing:'Downloading and installing…',applying:'Applying the plugin…',cancelling:'Cancelling; waiting for process exit and file restoration…',cancelOperation:'Cancel operation',cancelTooLate:'Application has started. Wait for the final outcome.',cancelUnavailable:'This host cannot cancel installations',operationMissing:'The operation has finished or cannot be located',warnings:'Installation notices',diagnostics:'Installation diagnostics',failureKind:'Failure reason',network:'Network connection failed',timeout:'Request timed out',permission:'File permission denied','disk-full':'Disk is full','build-blocked':'Build scripts require approval','pnpm-missing':'Package manager not found','not-found':'Target not found','no-matching-version':'Target version not found',integrity:'Package integrity check failed',unknown:'Compatibility unknown',officialRejected:'The official manager refused this preview'})
    Object.assign(zh,{closeHealth:'关闭诊断',closeResult:'关闭提示',pageSize:'每页 21 个',cachedResults:'正在显示上次成功查询的缓存结果',cachedAt:'缓存保存时间',refreshing:'正在查询更新，已有结果暂时保留…',cacheWriteFailed:'结果已显示，但本地缓存保存失败；重启后可能无法恢复。',uninstallDiagnostics:'卸载诊断',uninstallWarnings:'卸载提示',uninstall:'卸载',confirmUninstall:'确认卸载',uninstallTitle:'确认卸载插件',uninstallHint:'将通过 DSH 官方管理器从当前配置中卸载此插件。',cannotUninstall:'当前宿主或此插件不支持卸载',removing:'正在卸载插件…',uninstalled:'已卸载',uninstalledRestart:'已卸载，需重启 DSH',removalUnavailable:'当前宿主不支持官方卸载接口',notRemovable:'此插件不允许卸载',stopProfile:'请先停止当前配置，再通过官方插件管理器卸载',bundleInUse:'插件仍在使用中，暂时无法卸载',sortBy:'排序',sortDefault:'默认排序',sortStars:'GitHub 星标最多',sortUpdated:'GitHub 最近更新',sortForks:'GitHub Fork 最多',updatedHint:'按 GitHub 仓库最近更新时间排列。',forksHint:'按 GitHub 仓库 Fork 数从高到低排列。',discoverOnly:'仅显示未安装插件',stars:'GitHub 星标',starsHint:'按 GitHub 仓库星标数从高到低排列。'})
    Object.assign(en,{closeHealth:'Close diagnostics',closeResult:'Dismiss result',pageSize:'21 per page',cachedResults:'Showing the last successful cached results',cachedAt:'Cache saved at',refreshing:'Checking for updates; keeping previous results…',cacheWriteFailed:'Results are available, but saving the local cache failed; they may not survive a restart.',uninstallDiagnostics:'Uninstall diagnostics',uninstallWarnings:'Uninstall notices',uninstall:'Uninstall',confirmUninstall:'Confirm uninstall',uninstallTitle:'Confirm plugin removal',uninstallHint:'The official DSH manager will uninstall this plugin from the current profile.',cannotUninstall:'This host or plugin does not support removal',removing:'Uninstalling plugin…',uninstalled:'Uninstalled',uninstalledRestart:'Uninstalled; restart DSH',removalUnavailable:'This host does not support official removal',notRemovable:'This plugin cannot be removed',stopProfile:'Stop this profile and remove the plugin through the official manager',bundleInUse:'The plugin is still in use and cannot be removed yet',sortBy:'Sort by',sortDefault:'Default order',sortStars:'Most GitHub stars',sortUpdated:'Recently updated on GitHub',sortForks:'Most GitHub forks',updatedHint:'GitHub repositories ordered by most recently updated.',forksHint:'GitHub repositories ordered by forks, highest first.',discoverOnly:'Uninstalled plugins only',stars:'GitHub stars',starsHint:'GitHub repositories ordered by stars, highest first.'})
    function safeLink(value){try{if(typeof value!=='string')return null;const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
    Object.assign(zh,{installNow:'一键安装',cachedInstall:'使用缓存安装',cachedInstallHint:'在线查验暂不可用，使用之前成功查验的固定目标；下载安装包仍需要网络。'})
    Object.assign(en,{installNow:'Install now',cachedInstall:'Installing from cached metadata',cachedInstallHint:'Online checks are unavailable. Using a previously verified fixed target; downloading packages still requires a connection.'})
    Object.assign(zh,{sortWeeklyStars:'GitHub 一周 Star 增长最多',weeklyStars:'近7天',weeklyUnknown:'近7天：未知',weeklyHint:'在总 Star 最多的 50 个候选插件中，按近7天新增 Star 排序；按 GitHub 完整日统计，截止昨日。',weeklyScope:'统计范围：总 Star 排名前列的候选，最多 50 个；成功统计',weeklyPartial:'部分插件的周增量暂不可查询，未知项排在末尾。',weeklyCheckedAt:'周增量统计时间'})
    Object.assign(en,{sortWeeklyStars:'Most new GitHub stars this week',weeklyStars:'Last 7 days',weeklyUnknown:'Last 7 days: unknown',weeklyHint:'Ranks up to 50 candidates with the most total stars by new stars over 7 complete GitHub calendar days, ending yesterday.',weeklyScope:'Coverage: candidates with the most total stars, up to 50; measured',weeklyPartial:'Some weekly counts are unavailable. Unknown counts are placed last.',weeklyCheckedAt:'Weekly counts checked at'})
    Object.assign(zh,{installedSearch:'搜索已安装插件',installedSearchHint:'按插件名称或简介搜索',clearSearch:'清空搜索',installedSearchEmpty:'没有找到匹配的已安装插件。',alreadyInstalled:'插件已安装。当前配置运行时无法覆盖升级，请停止当前配置后通过官方插件管理器升级。'})
    Object.assign(en,{installedSearch:'Search installed plugins',installedSearchHint:'Search by plugin name or description',clearSearch:'Clear search',installedSearchEmpty:'No installed plugins match your search.',alreadyInstalled:'The plugin is already installed. Upgrading an existing dependency is blocked while this profile is running. Stop the profile and upgrade through the official plugin manager.'})
    function createStore(){
      let state={tab:'discover',q:'',source:'all',sort:'default',page:1,status:'idle',data:null,detail:null,detailLoading:false,preview:null,result:null,error:null,busy:false,executing:false,operation:null,cancelStatus:null,updatesChecking:false,pendingRestart:[],onlyCompatible:false,health:null,healthOpen:false,healthLoading:false,healthError:null}
      try{
        window.localStorage?.setItem('lumenMarket.discovery',JSON.stringify({source:state.source,sort:state.sort}))
      }catch{}
      const listeners=new Set(),controllers=new Map(),filters=new Map(),searches=new Map();let listEpoch=0,detailEpoch=0,previewEpoch=0,operationEpoch=0,healthEpoch=0,operationTimer=null,disposed=false
      const set=patch=>{if(disposed)return;state=Object.assign({},state,patch);listeners.forEach(fn=>fn())}
      const invalidatePreview=()=>{previewEpoch++;controllers.get('preview')?.abort();set({preview:null,...(!state.executing?{busy:false}:{})})}
      const changeTab=tab=>{
        if(tab===state.tab)return
        filters.set(state.tab,{onlyCompatible:state.onlyCompatible})
        set({tab,...(filters.get(tab)||{onlyCompatible:false}),data:null,updatesChecking:false})
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
      async function executePreview(preview){
        let refresh=false;set({busy:true,executing:true,operation:null,cancelStatus:null,error:null,installationCache:preview.preview.cachedMetadata??null})
        try{
          const active=request('/'+preview.preview.action,{previewId:preview.previewId,...(preview.preview.upgradeMode==='reinstall'?{reinstallConsent:true}:{})})
          monitor(preview.previewId,++operationEpoch)
          const result=await active
          if(result.ok&&preview.preview.action==='uninstall'&&state.detail?.name===preview.preview.name)store.close()
          set({result,preview:null,pendingRestart:result.pendingRestart||state.pendingRestart,installationCache:result.cachedMetadata??preview.preview.cachedMetadata??null});refresh=true
        }
        catch(error){set({error,preview:null})}
        finally{stopMonitor();set({busy:false,executing:false,operation:null})}
        if(refresh)await store.load(state.tab,true)
      }
      const store={
        get:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
        async search(q=state.q,source=state.source,page=1,force=false,sort=state.sort){
          if(source!=='github')sort='default'
          const key=JSON.stringify([q,source,sort,page])
          const changed=q!==state.q||source!==state.source||sort!==state.sort||page!==state.page
          const previous=!changed&&state.tab==='discover'?state.data:searches.get(key)??null
          invalidatePreview()
          changeTab('discover');controllers.get('updates')?.abort()
          const epoch=++listEpoch;set({q,source,sort,page,status:'loading',updatesChecking:false,error:null,data:previous})
          const params=new URLSearchParams({q,source,page,sort,...(force?{force:'1'}:{})})
          const active=request('/search?'+params,null,'list')
          if(!previous)request('/search-cache?'+new URLSearchParams({q,source,page,sort}),null,'cache').then(data=>{
            if(epoch===listEpoch&&state.status==='loading'&&data.cacheHit)set({data})
          }).catch(()=>{})
          try{
            let data=await active
            if(epoch!==listEpoch)return
            if(data.ok===false&&!data.cacheHit&&state.data)data={...state.data,errors:data.errors||[],stale:true,pendingRestart:data.pendingRestart||state.pendingRestart}
            searches.delete(key);searches.set(key,data)
            while(searches.size>50)searches.delete(searches.keys().next().value)
            set({status:'ready',data,pendingRestart:data.pendingRestart||state.pendingRestart})
          }catch(error){if(epoch===listEpoch)set({status:'error',error,data:state.data?{...state.data,stale:true}:null})}
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
        selectTab(tab){detailEpoch++;controllers.get('detail')?.abort();invalidatePreview();set({detail:null,detailLoading:false,...(tab!==state.tab?{q:'',page:1,source:'all',sort:'default',onlyCompatible:false}:{})});return store.load(tab)},
        resetSearch(){
          listEpoch++;detailEpoch++
          for(const channel of ['list','cache','updates','detail'])controllers.get(channel)?.abort()
          invalidatePreview()
          set({q:'',page:1,source:'all',sort:'default',onlyCompatible:false,status:'idle',data:null,detail:null,detailLoading:false,updatesChecking:false})
        },
        async open(row){
          const epoch=++detailEpoch;invalidatePreview()
          set({detail:row,detailLoading:true,error:null,preview:null})
          const args={source:row.id?.startsWith('installed:')?'installed':row.source,name:row.name}
          if(row.repo)args.repo=row.repo
          if(row.source==='npm'&&row.version)args.version=row.version
          try{const detail=await request('/detail?'+new URLSearchParams(args),null,'detail');if(epoch===detailEpoch)set({detail:Object.assign({},row,detail),detailLoading:false})}
          catch(error){if(epoch===detailEpoch)set({detailLoading:false,error})}
        },
        async checkVersion(row,version){
          if(state.busy)return
          const epoch=++detailEpoch;invalidatePreview()
          set({detail:row,detailLoading:true,error:null})
          try{
            const detail=await request('/detail?'+new URLSearchParams({source:'npm',name:row.name,version:version.trim()}),null,'detail')
            if(epoch===detailEpoch)set({detail:Object.assign({},row,detail),detailLoading:false})
          }catch(error){if(epoch===detailEpoch)set({detailLoading:false,error})}
        },
        close(){detailEpoch++;controllers.get('detail')?.abort();invalidatePreview();set({detail:null,detailLoading:false})},
        install(row){return store.prepare(row,'install',true)},
        async prepare(row,action='install',installNow=false){
          if(state.busy)return
          const epoch=++previewEpoch;set({busy:true,error:null,result:null,preview:null,installationCache:null})
          const body={action,source:action==='uninstall'?'installed':action==='upgrade'?'npm':row.source,name:row.name}
          if(action!=='uninstall'){if(row.repo)body.repo=row.repo;if(row.latest||row.version)body.version=row.latest||row.version}
          try{
            const preview=await request('/inspect',body,'preview')
            if(epoch!==previewEpoch||disposed)return
            if(installNow&&preview.preview.upgradeMode!=='reinstall')await executePreview(preview)
            else set({preview,busy:false,installationCache:preview.preview.cachedMetadata??null})
          }
          catch(error){if(epoch===previewEpoch)set({busy:false,error})}
        },
        dismissPreview(){if(!state.executing)invalidatePreview()},
        async execute(){
          if(state.busy||!state.preview)return
          await executePreview(state.preview)
        },
        async cancel(){
          if(!state.executing||!state.operation?.cancellable||state.cancelStatus==='requested')return
          const operationId=state.operation.operationId,epoch=operationEpoch;set({cancelStatus:'requested'})
          try{const result=await request('/cancel',{operationId});if(epoch===operationEpoch&&state.executing)set({cancelStatus:result.status})}catch(error){if(epoch===operationEpoch&&state.executing)set({error,cancelStatus:null})}
        },
        dismissResult(){if(!state.executing)set({result:null,installationCache:null})},
        filter(patch){set(patch)},
        async health(){
          const epoch=++healthEpoch;set({healthOpen:true,healthLoading:true,healthError:null,health:null})
          try{const health=await request('/health',null,'health');if(epoch===healthEpoch)set({health,healthLoading:false})}
          catch(healthError){if(epoch===healthEpoch)set({healthError,healthLoading:false})}
        },
        closeHealth(){healthEpoch++;controllers.get('health')?.abort();set({healthOpen:false,health:null,healthLoading:false,healthError:null})},
        dispose(){disposed=true;stopMonitor();controllers.forEach(c=>c.abort());controllers.clear();listeners.clear()},
      }
      return store
    }
    const CSS=`
      .lm-page{height:100%;box-sizing:border-box;overflow:auto;color:var(--dsw-alias-label-primary);padding:28px clamp(16px,3vw,44px) 40px;font:inherit}
      .lm-shell{max-width:1200px;margin:auto}.lm-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}.lm-brand{display:flex;align-items:center;gap:12px}.lm-symbol{width:38px;height:38px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 22%,transparent);border-radius:12px;display:grid;place-items:center;color:var(--dsw-alias-state-business-primary)}
      .lm-page h1{font-size:23px;letter-spacing:-.6px;line-height:1.25;margin:0}.lm-subtitle{color:var(--dsw-alias-label-secondary);font-size:13px;margin:5px 0 0}.lm-kicker{font-size:10px;letter-spacing:2px;color:var(--dsw-alias-label-caption);margin-bottom:5px}
      .lm-upgradeGuide{flex-basis:100%;min-width:0;max-width:100%;font-size:12px}.lm-upgradeGuide summary{cursor:pointer;color:var(--dsw-alias-state-business-primary)}
      .lm-tabs{display:flex;gap:24px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);margin-bottom:22px}.lm-tab{font:inherit;background:none;color:var(--dsw-alias-label-secondary);border:0;border-bottom:2px solid transparent;padding:10px 0;cursor:pointer;font-size:14px}.lm-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-state-business-primary)}
      .lm-button{font:inherit;font-size:12px;line-height:20px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent);color:var(--dsw-alias-label-primary);background:transparent;border-radius:7px;padding:5px 12px;cursor:pointer;white-space:nowrap}.lm-button:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);border-color:var(--dsw-alias-state-business-primary)}.lm-button[data-primary=true]{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-on-color,white);border-color:transparent}.lm-button[data-danger=true]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}.lm-button[data-danger=true]:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}.lm-button:disabled{opacity:.5;cursor:default}.lm-page :focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}
      .lm-discovery{margin-bottom:20px}.lm-search{display:grid;gap:12px;margin-bottom:12px}.lm-input{width:100%;min-width:0;box-sizing:border-box}.lm-input,.lm-select{font:inherit;font-size:13px;line-height:22px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);border-radius:7px;padding:8px 12px}.lm-select{padding:8px 12px;min-width:0;width:100%;height:40px;box-sizing:border-box}.lm-search .lm-input{height:42px}.lm-searchControls{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}.lm-field{display:flex;flex-direction:column;gap:6px;width:150px;min-width:0;font-size:11px;color:var(--dsw-alias-label-caption)}.lm-field:nth-child(2){width:220px}.lm-compatible{display:flex;align-items:center;gap:7px;min-height:40px;font-size:12px;white-space:nowrap;color:var(--dsw-alias-label-secondary)}.lm-compatible input{accent-color:var(--dsw-alias-state-business-primary)}.lm-searchControls .lm-button{height:40px;min-width:88px;margin-left:auto}.lm-searchMeta{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.lm-discoverOnly{font-size:11px;line-height:18px;color:var(--dsw-alias-state-business-primary);white-space:nowrap}.lm-searchMeta .lm-hint{flex:1;min-width:min(100%,280px);margin:0}.lm-select option{background-color:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}.lm-hint{font-size:11px;line-height:18px;color:var(--dsw-alias-label-caption);margin:0 0 16px}.lm-filters{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;font-size:12px;color:var(--dsw-alias-label-secondary)}.lm-filters label{display:flex;align-items:center;gap:6px}.lm-filters input{accent-color:var(--dsw-alias-state-business-primary)}
      .lm-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}.lm-layout[data-detail=true]{grid-template-columns:minmax(0,1fr) minmax(280px,380px)}.lm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:12px;align-content:start}.lm-card{border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 13%,transparent);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0}.lm-card[data-selected=true]{border-color:var(--dsw-alias-state-business-primary)}.lm-cardTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.lm-name{font-size:14px;font-weight:600;overflow-wrap:anywhere;margin:0;line-height:22px}.lm-source{font-size:10px;letter-spacing:.4px;color:var(--dsw-alias-label-caption);flex:none}.lm-description{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:20px;margin:0;overflow-wrap:anywhere}.lm-description[data-short=true]{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}.lm-version{font-size:11px;line-height:18px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lm-badges{display:flex;gap:5px;flex-wrap:wrap}.lm-badge{font-size:10px;line-height:17px;border-radius:4px;padding:1px 6px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-secondary)}.lm-badge[data-tone=good]{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent)}.lm-badge[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
      .lm-upgradeAction{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;flex:none}.lm-updateLight{display:inline-flex;align-items:center;justify-content:center;width:24px;height:28px;flex:none;color:#d39a25;filter:drop-shadow(0 0 5px rgb(255 196 55 / 38%))}.lm-updateLight svg{display:block}
      .lm-cardActions{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:4px;flex-wrap:wrap}.lm-link{font-size:12px;color:var(--dsw-alias-state-business-primary);text-decoration:none;overflow-wrap:anywhere}.lm-link:hover{text-decoration:underline}.lm-detail{position:sticky;top:16px;align-self:start;max-height:var(--lm-detail-max-height,calc(100dvh - 160px));overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable;border-left:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);padding-left:24px;min-width:0}.lm-detailHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:18px}.lm-detail h2{margin:0;font-size:17px;line-height:25px;overflow-wrap:anywhere}.lm-detail p{white-space:pre-wrap}.lm-detail dl{font-size:12px;line-height:20px;display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px 12px}.lm-detail dt{color:var(--dsw-alias-label-caption)}.lm-detail dd{margin:0;overflow-wrap:anywhere}.lm-docs{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.lm-detailActions{margin:20px 0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
      .lm-healthHead,.lm-resultHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.lm-health pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font-size:11px;line-height:18px;margin:12px 0 0}
      .lm-notice{padding:12px 14px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 30%,transparent);border-radius:8px;margin:0 0 16px;font-size:12px;line-height:20px;overflow-wrap:anywhere}.lm-notice[data-error=true]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}.lm-empty{padding:48px 20px;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary);grid-column:1/-1}.lm-pagination{display:flex;align-items:center;justify-content:space-between;margin-top:20px;font-size:12px;color:var(--dsw-alias-label-caption)}
      .lm-preview{border:1px solid var(--dsw-alias-state-business-primary);border-radius:10px;padding:18px;margin:0 0 20px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 4%,transparent)}.lm-preview h2{font-size:15px;margin:0 0 12px}.lm-preview strong{overflow-wrap:anywhere}.lm-preview code{font-size:12px;overflow-wrap:anywhere;display:block;margin:8px 0}.lm-previewActions{display:flex;gap:8px;margin-top:14px}.lm-footer{margin-top:30px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);font-size:11px;color:var(--dsw-alias-label-caption);display:flex;justify-content:space-between;gap:12px}
      @media(max-width:780px){.lm-layout[data-detail=true]{grid-template-columns:1fr}.lm-detail{position:static;max-height:none;overflow:visible;overscroll-behavior-y:auto;scrollbar-gutter:auto;border-left:0;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);padding:20px 0 0;grid-row:1}.lm-header{align-items:flex-start}.lm-searchControls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:end;gap:10px}.lm-field,.lm-field:nth-child(2){width:auto}.lm-searchControls .lm-button{width:100%;margin-left:0}.lm-searchMeta{gap:6px}.lm-searchMeta .lm-hint{flex-basis:100%}.lm-tabs{gap:22px}.lm-page{padding-top:20px}}
    `
    const sourceText=(row,t)=>t(row.npmOrigin?'npmArchive':row.source==='npm'?'npm':row.source)
    const hasStars=row=>row.source==='github'&&Number.isSafeInteger(row.stars)&&row.stars>=0
    const validationKey={'client-only':'clientOnly','not-plugin':'notPlugin','missing-artifacts':'missingArtifacts','unknown-installed':'unknownInstalled','lookup-failed':'lookupFailed'}
    function badgeText(row,t){const v=row.verdict||row.validation||'unverified';return t(validationKey[v]||v)}
    function Button({children,primary=false,...props}){return h('button',Object.assign({type:'button',className:'lm-button','data-primary':primary},props),children)}
    function Link({url,children}){const safe=safeLink(url);return safe?h('a',{className:'lm-link',href:safe,target:'_blank',rel:'noopener noreferrer'},children):null}
    function SymbolIcon(){return h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none','aria-hidden':true},h('path',{d:'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3',stroke:'currentColor',strokeWidth:1.5}),h('circle',{cx:12,cy:12,r:4,stroke:'currentColor',strokeWidth:1.5}))}
    function errorText(error,t){
      const known={'reinstall-preparation-failed':'reinstallUnavailable','reinstall-consent-required':'reinstallConsentRequired','reinstall-package-unavailable':'reinstallUnavailable','package-integrity':'reinstallIntegrity','package-too-large':'reinstallUnavailable','recovery-required':'recoveryRequired','reinstall-order-unsupported':'reinstallOrder','upgrade-unavailable':'upgradeUnavailable','already-installed':'alreadyInstalled','preview-expired':'previewExpired','profile-not-found':'profileNotFound','management-required':'managementMissing','preview-stale':'previewStale','source-changed':'previewStale','not-installable':'noInstall','official-inspect-rejected':'officialRejected','cancellation-unavailable':'cancelUnavailable','operation-not-found':'operationMissing','removal-unavailable':'removalUnavailable','not-removable':'notRemovable','stop-profile':'stopProfile','bundle-in-use':'bundleInUse'}
      const code=error.code==='official-inspect-rejected'&&error.problem==='already-installed'?'already-installed':error.code
      let text=known[code]?t(known[code]):`${t('failure')} · ${code||'internal'}`
      if(error.retryAt)text+=` · ${t('retryAt')}: ${new Date(error.retryAt).toLocaleString()}`
      if(error.compatibility?.peers)text+=' · '+JSON.stringify(error.compatibility.peers)
      if(error.rejected)text+=' · '+error.rejected.map(c=>`${c.evidence}: ${c.dir}`).join('; ')
      if(error.diagnostic)text+=' · '+error.diagnostic
      if(error.incompatible)text+=' · '+error.incompatible.map(row=>`${row.name}: ${JSON.stringify(row.peers)}`).join('; ')
      return text
    }
    Object.assign(zh,{upgradeUnavailable:'当前宿主不支持在此页面覆盖升级，请使用升级方法。',upgradeMethod:'升级方法',upgradeRunning:'当前配置运行中，无法覆盖升级。请正常退出 DSH（桌面版需从托盘退出），再通过官方 CLI 升级；完成后重新启动。',upgradeUnknown:'尚未确认当前宿主的覆盖升级能力。请先退出宿主，再通过官方 CLI 升级。',upgradeEnvironment:'使用与当前宿主匹配的 DSH CLI 和相同的 DSH_HOME。自定义配置请核对 Profile 名称。'})
    Object.assign(en,{upgradeUnavailable:'This host cannot replace an installed plugin from this page. See upgrade instructions.',upgradeMethod:'How to upgrade',upgradeRunning:'This profile is running and cannot replace installed packages. Fully quit DSH (including the desktop tray), upgrade with the official CLI, then restart.',upgradeUnknown:'In-place upgrade support has not been confirmed. Quit the host before upgrading with the official CLI.',upgradeEnvironment:'Use the matching DSH CLI and the same DSH_HOME. Check the profile name for custom profiles.'})
    Object.assign(zh,{exactVersion:'指定版本号',checkVersion:'查验指定版本'})
    Object.assign(en,{exactVersion:'Exact version',checkVersion:'Check exact version'})
    Object.assign(zh,{npmArchive:'npm 固定安装包',upgradeNow:'一键升级',confirmReinstall:'确认卸载并升级',reinstallTitle:'卸载旧版并安装新版',reinstallHint:'确认后先校验新版与旧版恢复包、备份配置，再由官方管理器卸载旧版并安装已校验的确切新版（包括刚发布的版本）。依赖仍遵守官方包管理器策略。新版失败会尝试恢复旧版；恢复失败将停止并保留备份。',reinstallConsentRequired:'请先确认卸载旧版并安装指定新版。',reinstallUnavailable:'无法准备可靠的安装或恢复包，已停止升级，旧版保留。',reinstallIntegrity:'安装包校验失败，已停止升级，旧版保留。',reinstallOrder:'无法通过当前官方接口保持此插件的加载顺序，暂不执行自动卸载重装。',recoveryRequired:'上次重装尚未恢复完成，请先处理备份记录再进行插件变更。',recoveredOld:'新版安装失败，已恢复旧版。',recoveredLocal:'旧版使用已验证的本地恢复包，npm 来源记录保留，后续仍可检查更新。',preparing:'正在校验安装包并备份配置…',restoring:'正在恢复旧版…',backupLocation:'备份位置'})
    Object.assign(en,{npmArchive:'Pinned npm archive',upgradeNow:'One-click upgrade',confirmReinstall:'Confirm uninstall and upgrade',reinstallTitle:'Uninstall old version and install new version',reinstallHint:'After confirmation, verify both archives and back up configuration, then use the official manager to uninstall and install the pinned target. Failure attempts to restore the old version; failed recovery stops with backups retained.',reinstallConsentRequired:'Confirm removal and installation of the pinned version first.',reinstallUnavailable:'An installation or recovery archive is unavailable. Upgrade stopped; old version retained.',reinstallIntegrity:'Archive verification failed. Upgrade stopped; old version retained.',reinstallOrder:'The official API cannot preserve this bundle order. Automatic reinstall is unavailable.',recoveryRequired:'An earlier reinstall requires recovery before further plugin changes.',recoveredOld:'The new version failed. The old version has been restored.',recoveredLocal:'The old version uses a verified local recovery archive. Its npm provenance is retained for future update checks.',preparing:'Verifying archives and backing up configuration…',restoring:'Restoring the old version…',backupLocation:'Backup location'})
    function VersionSelector({row,t,store,state}){
      const [version,setVersion]=React.useState(row.latest||'')
      return h('form',{onSubmit:event=>{event.preventDefault();store.checkVersion(row,version)}},h('input',{className:'lm-input','aria-label':t('exactVersion'),value:version,maxLength:80,onInput:event=>setVersion(event.currentTarget.value)}),h(Button,{disabled:state.busy||state.detailLoading,type:'submit'},t('checkVersion')))
    }
    function UpgradeGuide({row,t,store,state}){
      return row.upgradeBlockedReason?h('details',{className:'lm-upgradeGuide'},h('summary',null,t('upgradeMethod')),h('p',{className:'lm-hint'},t(row.upgradeBlockedReason==='reinstall-order-unsupported'?'reinstallOrder':row.upgradeBlockedReason==='not-removable'?'notRemovable':row.upgradeBlockedReason==='profile-running'?'upgradeRunning':'upgradeUnknown')),row.upgradeCommand?h('code',{style:{display:'block',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},row.upgradeCommand):null,h('p',{className:'lm-hint'},t('upgradeEnvironment')),store?h(VersionSelector,{row,t,store,state}):null):null
    }
    function UpgradeAction({row,store,state,t,detail=false}){
      return h(React.Fragment,null,h('span',{className:'lm-upgradeAction'},
        h(Button,{primary:true,disabled:state.busy||(detail&&state.detailLoading),onClick:()=>store.prepare(row,'upgrade')},t(row.upgradeMode==='reinstall'?'upgradeNow':'upgradePreview')),
        h('span',{className:'lm-updateLight',role:'img','aria-label':t('updateAvailable'),title:t('updateAvailable')},
          h('svg',{viewBox:'0 0 24 28',width:20,height:24,'aria-hidden':true,focusable:false,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'},
            h('path',{d:'M8.5 19v-1.6c0-1.3-.9-2.1-1.8-3.1A6.3 6.3 0 0 1 5 10a7 7 0 0 1 14 0 6.3 6.3 0 0 1-1.7 4.3c-.9 1-1.8 1.8-1.8 3.1V19Z',fill:'#ffd66b'}),
            h('path',{d:'M9 22h6M10 25h4M10 18v-5l2 1 2-1v5M12 0v1M2 4l1.5 1M.5 11H2M22 11h1.5M20.5 5 22 4'})))),h('details',{className:'lm-upgradeGuide'},h('summary',null,t('exactVersion')),h(VersionSelector,{row,t,store,state})))
    }
    function canInstall(row){
      return !row.alreadyInstalled&&!row.id?.startsWith('installed:')&&!row.sourceConflict&&['npm','github'].includes(row.source)&&
        (row.installable||(!row.validation||row.validation==='unverified')&&row.compatibility?.verdict!=='incompatible')
    }
    function CachedInstall({info,t}){
      return info?h('div',{className:'lm-notice',role:'status'},h('strong',null,t('cachedInstall')),h('p',{className:'lm-hint'},t('cachedInstallHint')),h('p',{className:'lm-hint'},t('cachedAt')+': '+new Date(info.checkedAt).toLocaleString())):null
    }
    function InstallAction({row,store,state,t,detail=false}){
      return h(Button,{primary:true,disabled:state.busy||(detail&&state.detailLoading),onClick:()=>store.install(row)},t('installNow'))
    }
    function WeeklyStars({row,t}){
      if(!Object.hasOwn(row,'weeklyStars'))return null
      const known=Number.isSafeInteger(row.weeklyStars)&&row.weeklyStars>=0
      return h('span',{className:'lm-badge'},known?t('weeklyStars')+' +'+row.weeklyStars.toLocaleString():t('weeklyUnknown'))
    }
    function Card({row,store,state,t}){
      const docs=Object.values(row.links||{}).find(safeLink)
      return h('article',{className:'lm-card','data-selected':state.detail?.id===row.id},
        h('div',{className:'lm-cardTop'},h('h3',{className:'lm-name'},row.name),h('span',{className:'lm-source'},sourceText(row,t))),
        h('p',{className:'lm-description','data-short':true},row.description||t('noDescription')),
        h('div',{className:'lm-version'},row.installed?`${t('installed')} ${row.installed}${row.latest?' → '+row.latest:''}`:row.version?`${t('version')} ${row.version}`:row.repo||''),
        h('div',{className:'lm-badges'},h('span',{className:'lm-badge','data-tone':row.upgradeable?'good':undefined},badgeText(row,t)),row.compatibility?h('span',{className:'lm-badge','data-tone':row.compatibility.verdict==='compatible'?'good':row.compatibility.verdict==='incompatible'?'error':undefined},t(row.compatibility.verdict)):null,row.alreadyInstalled?h('span',{className:'lm-badge'},t('installed')):null,hasStars(row)?h('span',{className:'lm-badge','aria-label':t('stars')+': '+row.stars},'★ '+row.stars.toLocaleString()):null,h(WeeklyStars,{row,t})),
        h('div',{className:'lm-cardActions'},canInstall(row)?h(InstallAction,{row,store,state,t}):null,h(Button,{onClick:()=>store.open(row)},t('details')),row.id?.startsWith('installed:')?h(Button,{'data-danger':true,disabled:state.busy||!row.removable,title:row.removable?undefined:t('cannotUninstall'),onClick:()=>store.prepare(row,'uninstall')},t('uninstall')):null,docs?h(Link,{url:docs},t('viewDocs')):h('span',{className:'lm-version'},t('noDocs')),row.upgradeable?h(UpgradeAction,{row,store,state,t}):h(UpgradeGuide,{row,t,store,state})))
    }
    function Detail({row,state,store,t,panelRef}){
      const installed=row.alreadyInstalled||row.id?.startsWith('installed:')
      return h('aside',{ref:panelRef,className:'lm-detail','aria-label':t('details'),tabIndex:0},
        h('div',{className:'lm-detailHead'},h('h2',null,row.name),h(Button,{onClick:()=>store.close(),disabled:state.busy},t('close'))),
        state.detailLoading?h('p',{role:'status',className:'lm-hint'},t('loading')):null,
        h(WeeklyStars,{row,t}),
        row.cachedMetadata?h(CachedInstall,{info:row.cachedMetadata,t}):null,
        h('p',{className:'lm-description'},row.description||t('noDescription')),
        h('dl',null,h('dt',null,t('source')),h('dd',null,sourceText(row,t)),h('dt',null,t('descriptionSource')),h('dd',null,row.descriptionSource||'—'),h('dt',null,t('version')),h('dd',null,row.version||row.installed||'—'),hasStars(row)?h(React.Fragment,null,h('dt',null,t('stars')),h('dd',null,row.stars.toLocaleString())):null,row.sha?h(React.Fragment,null,h('dt',null,t('pinned')),h('dd',null,row.sha)):null),
        h('div',{className:'lm-badges'},h('span',{className:'lm-badge'},badgeText(row,t)),row.compatibility?h('span',{className:'lm-badge'},t(row.compatibility.verdict)):null,row.compatibility?.exempted?h('span',{className:'lm-badge'},t('exempted')):null),
        row.compatibility?.peers&&Object.keys(row.compatibility.peers).length?h('p',{className:'lm-hint'},t('peers')+': '+JSON.stringify(row.compatibility.peers)):null,
        h('div',{className:'lm-docs'},...Object.entries(row.links||{}).map(([key,url])=>h(Link,{key,url},t(key)))),
        h('div',{className:'lm-detailActions'},
          installed?h(Button,{'data-danger':true,disabled:state.busy||state.detailLoading||!row.removable,title:row.removable?undefined:t('cannotUninstall'),onClick:()=>store.prepare(row,'uninstall')},t('uninstall')):null,
          canInstall(row)?h(InstallAction,{row,store,state,t,detail:true}):null,
          !installed&&row.installable?h(Button,{disabled:state.busy||state.detailLoading,onClick:()=>store.prepare(row)},t('installPreview')):row.upgradeable?h(UpgradeAction,{row,store,state,t,detail:true}):row.upgradeBlockedReason?h(UpgradeGuide,{row,t,store,state}):!installed&&!state.detailLoading&&!canInstall(row)?h('p',{className:'lm-hint'},t('noInstall')):null,
          !installed?h('p',{className:'lm-hint'},t('freshPreview')):null))
    }
    function Page({store,t}){
      const state=React.useSyncExternalStore(store.subscribe,store.get,store.get)
      const pageRef=React.useRef(null),footerRef=React.useRef(null),detailRef=React.useRef(null),previewRef=React.useRef(null),errorRef=React.useRef(null),resultRef=React.useRef(null)
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
      React.useLayoutEffect(()=>{
        if(!state.preview)return
        previewRef.current?.scrollIntoView?.({block:'center',behavior:'auto'})
        previewRef.current?.focus({preventScroll:true})
      },[state.preview?.previewId])
      React.useLayoutEffect(()=>{
        if(state.error)errorRef.current?.scrollIntoView?.({block:'center',behavior:'auto'})
      },[state.error])
      React.useLayoutEffect(()=>{
        if(state.result)resultRef.current?.scrollIntoView?.({block:'center',behavior:'auto'})
      },[state.result])
      const [draft,setDraft]=React.useState(state.q)
      const [installedQuery,setInstalledQuery]=React.useState('')
      const installedTerm=installedQuery.trim().toLowerCase()
      React.useEffect(()=>{if(store.get().status==='idle')store.load();return()=>store.resetSearch()},[store])
      const rows=(state.data?.rows||[]).filter(row=>(state.tab!=='updates'||(row.updateAvailable??row.upgradeable))&&(state.tab!=='discover'||!row.alreadyInstalled&&!row.id?.startsWith('installed:')&&(!state.onlyCompatible||row.installable))&&(state.tab!=='installed'||!installedTerm||`${row.name??''} ${row.description??''}`.toLowerCase().includes(installedTerm)))
      const preview=state.preview?.preview
      return h('div',{ref:pageRef,className:'lm-page'},h('style',{id:'lumen-market-style'},CSS),h('div',{className:'lm-shell'},
        h('header',{className:'lm-header'},h('div',{className:'lm-brand'},h('div',{className:'lm-symbol'},h(SymbolIcon)),h('div',null,h('div',{className:'lm-kicker'},'LUMEN / PLUGINS'),h('h1',null,t('panel')),h('p',{className:'lm-subtitle'},t('intro')))),h(Button,{onClick:()=>store.load(state.tab,true),disabled:state.status==='loading'},t('refresh'))),
        h('nav',{className:'lm-tabs',role:'tablist','aria-label':t('panel')},...['discover','installed','updates'].map(tab=>h('button',{key:tab,type:'button',className:'lm-tab',role:'tab','aria-selected':state.tab===tab,onClick:()=>{if(tab!==state.tab){setDraft('');setInstalledQuery('')}store.selectTab(tab)}},t(tab)))),
        state.tab==='installed'?h('div',{className:'lm-discovery'},h('div',{className:'lm-searchControls'},h('input',{type:'search',className:'lm-input',style:{flex:1},value:installedQuery,maxLength:200,'aria-label':t('installedSearch'),placeholder:t('installedSearchHint'),onInput:e=>setInstalledQuery(e.currentTarget.value)}),h(Button,{disabled:!installedQuery,onClick:()=>setInstalledQuery('')},t('clearSearch')))):null,
        state.tab==='discover'?h('section',{className:'lm-discovery'},
          h('form',{className:'lm-search',onSubmit:e=>{e.preventDefault();store.search(draft,state.source)}},
            h('input',{className:'lm-input',value:draft,maxLength:200,'aria-label':t('searchHint'),placeholder:t('searchHint'),onInput:e=>setDraft(e.currentTarget.value)}),
            h('div',{className:'lm-searchControls'},
              h('label',{className:'lm-field'},h('span',null,t('source')),h('select',{className:'lm-select',value:state.source,'aria-label':t('source'),onChange:e=>{const source=e.target.value;store.search(draft,source,1,false,source==='github'?state.sort:'default')}},...['all','npm','github'].map(s=>h('option',{key:s,value:s},t(s))))),
              h('label',{className:'lm-field'},h('span',null,t('sortBy')),h('select',{className:'lm-select',value:state.sort,'aria-label':t('sortBy'),onChange:e=>{const sort=e.target.value;store.search(draft,sort!=='default'?'github':state.source,1,false,sort)}},...Object.entries({default:'sortDefault',stars:'sortStars','weekly-stars':'sortWeeklyStars',updated:'sortUpdated',forks:'sortForks'}).map(([value,key])=>h('option',{key:value,value},t(key))))),
              h('label',{className:'lm-compatible'},h('input',{type:'checkbox',checked:state.onlyCompatible,onChange:e=>store.filter({onlyCompatible:e.target.checked})}),t('onlyCompatible')),
              h(Button,{type:'submit',primary:true},t('search')))),
          h('div',{className:'lm-searchMeta'},h('span',{className:'lm-discoverOnly'},t('discoverOnly')),h('p',{className:'lm-hint'},(state.sort==='default'?'':t({stars:'starsHint','weekly-stars':'weeklyHint',updated:'updatedHint',forks:'forksHint'}[state.sort])+' ')+t('scope')))):null,
        state.sort==='weekly-stars'&&state.data?.sources?.github?.weekly?h('div',{className:'lm-notice',role:'status'},t('weeklyScope')+' '+state.data.sources.github.weekly.measured+' / '+state.data.sources.github.weekly.candidates,state.data.sources.github.weekly.checkedAt?h('p',{className:'lm-hint'},t('weeklyCheckedAt')+': '+new Date(state.data.sources.github.weekly.checkedAt).toLocaleString()):null,state.data.sources.github.weekly.failed?h('p',{className:'lm-hint'},t('weeklyPartial')):null):null,
        state.updatesChecking||state.data?.checkedAt?h('div',{className:'lm-filters'},state.updatesChecking?h('span',{role:'status'},t('checkingUpdates')):h('span',null,t('checkedAt')+': '+new Date(state.data.checkedAt).toLocaleTimeString())):null,
        state.data?.stale?h('div',{className:'lm-notice',role:'status'},t('cachedResults'),...Object.entries(state.data.sources||{}).filter(([,info])=>info.cached).map(([source,info])=>h('p',{key:source,className:'lm-hint'},source+' · '+t('cachedAt')+': '+new Date(info.checkedAt).toLocaleString()))):null,
        state.installationCache?h(CachedInstall,{info:state.installationCache,t}):null,
        state.data?.scanLimited?h('div',{className:'lm-notice',role:'status'},t('scanLimited')):null,
        state.data?.cacheWarnings?.length?h('div',{className:'lm-notice',role:'status'},t('cacheWriteFailed')):null,
        ...Object.entries(state.data?.sources||{}).filter(([,source])=>source.scanLimited||source.incomplete).map(([source,info])=>h('div',{key:source,className:'lm-notice',role:'status'},source+' · '+t(info.scanLimited?'scanLimited':'incompleteSearch'))),
        state.pendingRestart.length?h('div',{className:'lm-notice',role:'status'},t('restart')+state.pendingRestart.join(', ')):null,
        state.result?.pendingBuilds?.length?h('div',{className:'lm-notice'},t('pendingBuilds')+state.result.pendingBuilds.join(', ')):null,
        state.result?.warnings?.length?h('div',{className:'lm-notice'},h('strong',null,t(state.result.action==='uninstall'?'uninstallWarnings':'warnings')),h('ul',null,...state.result.warnings.map((warning,i)=>h('li',{key:i},warning)))):null,
        state.result?.packageResult?h('details',{className:'lm-notice'},h('summary',null,t(state.result.action==='uninstall'?'uninstallDiagnostics':'diagnostics')),state.result.packageResult.kind?h('p',null,t('failureKind')+': '+t(state.result.packageResult.kind)):null,h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:200,overflow:'auto'}},state.result.packageResult.output||'')):null,
        state.error?h('div',{ref:errorRef,className:'lm-notice','data-error':true,role:'alert'},errorText(state.error,t)):null,
        ...((state.data?.errors||[]).map((e,i)=>h('div',{key:i,className:'lm-notice','data-error':true},t('partial')+` · ${e.source} · `+errorText(e,t)))),
        state.healthOpen?h('section',{className:'lm-notice lm-health','aria-label':t('health')},
          h('div',{className:'lm-healthHead'},h('strong',null,t('health')),h(Button,{onClick:()=>store.closeHealth()},t('closeHealth'))),
          state.healthLoading?h('p',{role:'status'},t('loading')):null,
          state.healthError?h('p',{role:'alert'},errorText(state.healthError,t)):null,
          state.health?h('pre',null,JSON.stringify(state.health,null,2)):null):null,
        state.result?h('div',{ref:resultRef,className:'lm-notice','data-error':state.result.ok===false,role:'status'},h('div',{className:'lm-resultHead'},h('span',null,t(state.result.action==='uninstall'&&state.result.ok?(state.result.application==='restart-required'?'uninstalledRestart':'uninstalled'):state.result.application==='restart-required'?'restartRequired':state.result.application==='applied'?'applied':state.result.application==='cancelled'?'cancelled':state.result.ok?'success':'failed')),h(Button,{onClick:()=>store.dismissResult(),disabled:state.executing},t('closeResult'))),state.result.error?h('p',null,errorText(state.result.error,t)):null,state.result.recovery?.status==='restored'?h('p',null,t('recoveredOld'),state.result.recovery.localArchive?' '+t('recoveredLocal'):''):null,state.result.backupDir?h('p',{className:'lm-hint'},t('backupLocation')+': '+state.result.backupDir):null):null,
        preview?h('section',{ref:previewRef,tabIndex:-1,className:'lm-preview','aria-label':t('preview')},h('h2',null,t(preview.upgradeMode==='reinstall'?'reinstallTitle':preview.action==='uninstall'?'uninstallTitle':'preview')),h('strong',null,preview.name),preview.action==='uninstall'?h('p',{className:'lm-hint'},t('source')+': '+sourceText(preview,t)):h('code',null,preview.spec),preview.fromVersion?h('p',{className:'lm-hint'},t('fromVersion')+': '+preview.fromVersion):null,h('p',{className:'lm-hint'},t(preview.upgradeMode==='reinstall'?'reinstallHint':preview.action==='uninstall'?'uninstallHint':preview.source==='github'?'gitWarning':'pipeline')),h('div',{className:'lm-previewActions'},h(Button,{primary:preview.action!=='uninstall','data-danger':preview.action==='uninstall'||preview.upgradeMode==='reinstall',disabled:state.busy,onClick:()=>store.execute()},t(preview.upgradeMode==='reinstall'?'confirmReinstall':preview.action==='uninstall'?'confirmUninstall':preview.action==='upgrade'?'confirmUpgrade':'confirmInstall')),h(Button,{disabled:state.busy,onClick:()=>store.dismissPreview()},t('cancel')))):null,
        state.cancelStatus==='too-late'?h('p',{className:'lm-notice',role:'status'},t('cancelTooLate')):null,
        state.busy?h('div',{className:'lm-notice',role:'status'},h('p',null,t(state.cancelStatus==='requested'?'cancelling':state.operation?.phase||'busy')),state.operation?.attempt?h('p',{className:'lm-hint'},`${state.operation.attempt.index}/${state.operation.attempt.total} · ${state.operation.attempt.registry||'npm'}`):null,state.executing&&state.operation?.cancellable?h(Button,{onClick:()=>store.cancel(),disabled:state.cancelStatus==='requested'},t('cancelOperation')):null):null,
        h('div',{className:'lm-layout','data-detail':!!state.detail},h('div',null,h('div',{className:'lm-grid','aria-busy':state.status==='loading'},state.status==='loading'?h('div',{className:rows.length?'lm-hint':'lm-empty',role:'status',style:{gridColumn:'1/-1'}},t(rows.length?'refreshing':'loading')):null,...rows.map(row=>h(Card,{key:row.id||row.name,row,store,state,t})),state.status!=='loading'&&rows.length===0?h('div',{className:'lm-empty'},t(state.tab==='installed'&&installedTerm?'installedSearchEmpty':'empty')):null),state.tab==='discover'?h('div',{className:'lm-pagination'},h(Button,{disabled:state.page<=1||state.status==='loading',onClick:()=>store.search(state.q,state.source,state.page-1)},t('previous')),h('span',null,t('page')+' '+state.page+' · '+t('pageSize')),h(Button,{disabled:!state.data?.hasMore||state.status==='loading',onClick:()=>store.search(state.q,state.source,state.page+1)},t('next'))):null),state.detail?h(Detail,{row:state.detail,state,store,t,panelRef:detailRef}):null),
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
