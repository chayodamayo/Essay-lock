const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PEN='<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
const IC={lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',logout:'<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',play:'<path d="M6 4l14 8-14 8z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',check:'<path d="M20 6L9 17l-5-5"/>',rewind:'<path d="M11 19L2 12l9-7zM22 19l-9-7 9-7z"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'};
const ic=(n,t)=>'<svg class="ic" viewBox="0 0 24 24">'+IC[n]+'</svg>'+(t?'<span>'+t+'</span>':'');const hero=n=>'<div class="hero">'+ic(n)+'</div>';
const root=$('#root');let me=null,active=false,RP=[],prev='';
const api=async(p,b)=>{try{const r=await fetch('/api/'+p,{method:b?'POST':'GET',headers:b?{'content-type':'application/json','x-requested-with':'essaylock'}:{'x-requested-with':'essaylock'},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(r.status===401&&p!=='login'&&me){me=null;view()}return{ok:r.ok,d}}catch(e){return{ok:false,d:{error:'Network error'}}}};
const bar=()=>`<div class="top"><div class="logo"><i>${PEN}</i>EssayLock</div><div class="row"><span class="mu sm">${esc(me.name)}</span><button class="g" id="lo">${ic('logout','Log out')}</button></div></div>`;
const hookBar=()=>{$('#lo').onclick=async()=>{if(active)stopEssay();await api('logout',{});me=null;view()}};
async function boot(){const r=await api('me');me=r.ok?r.d:null;view()}
function view(){if(!me)return vLogin();if(me.role==='teacher')return vTeacher();if(!me.joined)return vJoin();if(!me.open)return vWait();vEssay()}

// ---------- login / join / wait ----------
function vLogin(){let mode='in';
 root.innerHTML=`<div class="center"><div class="card narrow"><div class="logo" style="justify-content:center"><i>${PEN}</i>EssayLock</div><div class="row" style="justify-content:center;margin:14px 0"><button class="g" id="mi">Log in</button><button class="g" id="mup">Sign up</button></div><input id="un" placeholder="Username" autocomplete="username" style="margin-bottom:10px"><input id="pw" type="password" placeholder="Password" autocomplete="current-password" style="margin-bottom:10px"><div id="sg" style="display:none"><select id="ro"><option value="student">I’m a student</option><option value="teacher">I’m a teacher</option></select><input id="cd" placeholder="Class code" autocomplete="off" style="margin:10px 0"></div><div class="err" id="err"></div><button id="go" style="width:100%">Log in</button></div></div>`;
 const set=m=>{mode=m;$('#sg').style.display=m==='up'?'block':'none';$('#go').textContent=m==='in'?'Log in':'Create account';$('#mi').style.opacity=m==='in'?1:.55;$('#mup').style.opacity=m==='up'?1:.55;$('#err').textContent=''};
 $('#mi').onclick=()=>set('in');$('#mup').onclick=()=>set('up');$('#ro').onchange=()=>{$('#cd').placeholder=$('#ro').value==='teacher'?'Teacher code':'Class code'};
 const go=async()=>{const b={username:$('#un').value,password:$('#pw').value};let p='login';if(mode==='up'){p='signup';b.role=$('#ro').value;b.code=$('#cd').value}const r=await api(p,b);if(r.ok)boot();else $('#err').textContent=r.d.error||'Something went wrong'};
 $('#go').onclick=go;$('#pw').onkeydown=e=>{if(e.key==='Enter')go()};set('in')}
function vJoin(){root.innerHTML=bar()+`<div class="center"><div class="card narrow">${hero('users')}<h2>Join your class</h2><p class="mu">Enter the class code your teacher gave you.</p><input id="cc" placeholder="CLASS CODE" style="text-transform:uppercase;text-align:center;letter-spacing:.2em;margin:10px 0"><div class="err" id="err"></div><button id="jn" style="width:100%">Join class</button></div></div>`;hookBar();$('#jn').onclick=async()=>{const r=await api('join',{code:$('#cc').value});if(r.ok)boot();else $('#err').textContent=r.d.error||'Could not join'}}
function vWait(){root.innerHTML=bar()+`<div class="center"><div class="card narrow">${hero('clock')}<h2>Waiting for your teacher</h2><p class="mu">You’re in the class. Your teacher needs to activate it before you can start. This page updates by itself.</p><span class="pill warn">Class not active</span></div></div>`;hookBar()}

// ---------- student essay ----------
const tooSmall=()=>innerWidth<screen.width*0.95||innerHeight<screen.height*0.9;
const log=(type,detail)=>{if(active)api('event',{type,detail:detail||''})};
const flush=()=>{if(RP.length)api('replay',{ops:RP.splice(0,400)})};setInterval(flush,3000);
function diff(a,b){let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;let j=0;while(j<a.length-i&&j<b.length-i&&a[a.length-1-j]===b[b.length-1-j])j++;return[i,a.length-i-j,b.slice(i,b.length-j)]}
function syncLock(){const ta=$('#essay');if(!ta)return;const ok=active&&document.fullscreenElement&&document.hasFocus()&&!tooSmall();ta.disabled=!ok;const s=$('#st'),b=$('#fsb');if(b)b.style.display=active&&!ok?'inline-block':'none';if(s){s.className='pill '+(!active?'':ok?'ok':'warn');s.innerHTML=!active?ic('clock','Not started'):ok?ic('shield','Session active'):ic('lock','Locked: return to the exam window')}}
function vEssay(){
 const k='ep_'+me.email;let d='';try{d=localStorage.getItem(k)||''}catch(e){}
 root.innerHTML=bar()+`<div class="top"><div><h2>Essay</h2><span class="mu sm">Your work saves on this Chromebook as you type.</span></div><div class="row"><span id="st" class="pill"></span><span id="wc" class="pill"></span></div></div><div class="card"><textarea id="essay" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="Start writing here…"></textarea><div class="row" style="margin-top:14px"><button id="start">${active?ic('stop','Finish essay'):ic('play','Start essay (fullscreen)')}</button><button id="fsb" class="g" style="display:none">${ic('expand','Return to fullscreen')}</button><span class="mu sm">Pasting is disabled. Leaving fullscreen locks typing and is reported to your teacher.</span></div></div>`;
 hookBar();const ta=$('#essay');ta.value=d;prev=d;
 const wc=()=>{$('#wc').textContent=(ta.value.trim().match(/\S+/g)||[]).length+' words'};wc();
 const stop=(e,t,x)=>{e.preventDefault();log(t,x)};
 ta.onpaste=e=>stop(e,'Paste blocked',(e.clipboardData.getData('text')||'').length+' characters');ta.oncopy=e=>stop(e,'Copy blocked');ta.oncut=e=>stop(e,'Cut blocked');ta.ondrop=e=>stop(e,'Drop blocked');ta.oncontextmenu=e=>e.preventDefault();ta.ondragstart=e=>e.preventDefault();
 ta.onbeforeinput=e=>{if(/Paste|Drop|Replacement|Yank|Transpose/.test(e.inputType||'')){e.preventDefault();log('Blocked input',e.inputType)}};
 ta.onkeydown=e=>{if(((e.ctrlKey||e.metaKey)&&/^[cvxa]$/i.test(e.key))||(e.shiftKey&&e.key==='Insert'))stop(e,'Shortcut blocked',e.key)};
 ta.oninput=()=>{const g=ta.value.length-prev.length;if(g>12){ta.value=prev;log('Large insert blocked',g+' chars at once');return}const df=diff(prev,ta.value);RP.push([Date.now(),df[0],df[1],df[2]]);prev=ta.value;try{localStorage.setItem(k,prev)}catch(e){}wc()};
 $('#start').onclick=()=>active?stopEssay():startEssay();$('#fsb').onclick=()=>document.documentElement.requestFullscreen().catch(()=>{});syncLock();
}
async function startEssay(){try{await document.documentElement.requestFullscreen()}catch(e){}try{await navigator.keyboard.lock(['Escape','Tab','MetaLeft','MetaRight','AltLeft','AltRight'])}catch(e){}active=true;log('Essay started');vEssay()}
function stopEssay(){flush();log('Essay finished');active=false;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});if(me&&me.role==='student'&&me.open)vEssay()}
document.addEventListener('fullscreenchange',()=>{if(active&&!document.fullscreenElement)log('Exited fullscreen');syncLock()});
addEventListener('blur',()=>{log('Left window or tab');setTimeout(syncLock,50)});addEventListener('focus',()=>{log('Returned to window');syncLock()});
addEventListener('resize',()=>{if(active&&document.fullscreenElement&&tooSmall())log('Window resized (split screen or devtools?)');syncLock()});

// ---------- teacher ----------
async function vTeacher(){
 const r=await api('class');if(!r.ok){root.innerHTML=bar()+`<div class="card">${esc(r.d.error||'Could not load class')}</div>`;return hookBar()}
 const c=r.d,fmt=t=>t?new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'never';
 root.innerHTML=bar()+`<div class="card row" style="justify-content:space-between"><div><span class="mu sm">Your class code</span><div class="code">${esc(c.code)}</div><span class="mu sm">Students enter this when they sign up.</span><div style="margin-top:8px"><button class="g" id="cp">${ic('copy','Copy code')}</button></div></div><div style="text-align:right"><span class="pill ${c.active?'ok':''}">${c.active?'Class active':'Class not active'}</span><div style="margin-top:10px"><button id="act" class="${c.active?'d':''}">${c.active?ic('stop','Deactivate class'):ic('play','Activate class')}</button></div></div></div>
 <div class="card tw"><h3 class="row">${ic('users')}Students (${c.roster.length})</h3>${c.roster.length?`<table><tr><th>Student</th><th>Flags</th><th>Last sign-in</th><th>Access</th><th></th></tr>${c.roster.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td><span class="pill ${s.flags?'bad':'ok'}">${ic(s.flags?'alert':'shield')}${s.flags}</span></td><td class="mu">${fmt(s.last)}</td><td><button class="${s.allow?'':'g'}" data-al="${esc(s.email)}" data-v="${s.allow?0:1}">${s.allow?ic('check','Allowed anytime'):'Allow anytime'}</button></td><td><button class="g" data-rp="${esc(s.email)}">${ic('rewind','Replay')}</button> <button class="g" data-lg="${esc(s.email)}">${ic('list','Log')}</button> <button class="g" data-rs="${esc(s.email)}">${ic('key','Reset')}</button> <button class="d" data-rm="${esc(s.email)}">${ic('trash')}</button></td></tr>`).join('')}</table>`:'<p class="mu">No students yet. Give them your class code.</p>'}</div>`;
 hookBar();$('#cp').onclick=()=>navigator.clipboard.writeText(c.code).then(()=>{$('#cp').lastChild.textContent='Copied'}).catch(()=>{});document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{if(confirm('Remove this student from your class?')){await api('remove',{email:b.dataset.rm});vTeacher()}});document.querySelectorAll('[data-rs]').forEach(b=>b.onclick=async()=>{const p=prompt('New password for this student (6+ characters):');if(p){const r=await api('reset',{email:b.dataset.rs,password:p});alert(r.ok?'Password changed.':(r.d.error||'Failed'))}});$('#act').onclick=async()=>{await api('class/active',{active:!c.active});vTeacher()};
 document.querySelectorAll('[data-al]').forEach(b=>b.onclick=async()=>{await api('allow',{email:b.dataset.al,allow:b.dataset.v==='1'});vTeacher()});
 document.querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>replay(b.dataset.rp));document.querySelectorAll('[data-lg]').forEach(b=>b.onclick=()=>logView(b.dataset.lg));
}
const modal=h=>{const m=document.createElement('div');m.className='modal';m.innerHTML='<div class="card box">'+h+'</div>';m.onclick=e=>{if(e.target===m||e.target.id==='x'){clearInterval(m.t);m.remove()}};document.body.append(m);return m};
async function logView(e){const r=await api('events?email='+encodeURIComponent(e)),l=Array.isArray(r.d)?r.d.slice().reverse():[];modal(`<div class="top"><h3>Activity log</h3><button class="d" id="x">Close</button></div><div class="tw">${l.length?`<table>${l.map(x=>`<tr><td class="mu">${new Date(x.t).toLocaleTimeString()}</td><td>${esc(x.type)}</td><td class="mu">${esc(x.detail)}</td></tr>`).join('')}</table>`:'<p class="mu">Nothing logged yet.</p>'}</div>`)}
async function replay(e){
 const r=await api('replay?email='+encodeURIComponent(e)),ops=(r.d&&r.d.o)||[];
 const m=modal(`<div class="top"><h3>Typing replay</h3><button class="d" id="x">Close</button></div><div class="rp" id="rpo"></div><div class="row" style="margin-top:12px"><button id="pl">Play</button><input id="bar" type="range" min="0" max="${ops.length}" value="0" style="flex:1;min-width:120px"></div><div class="mu sm" id="inf" style="margin-top:8px"></div>`);
 const q=s=>m.querySelector(s);let txt='',i=0;const ap=o=>{txt=txt.slice(0,o[1])+o[3]+txt.slice(o[1]+o[2])};
 const show=()=>{q('#rpo').textContent=txt||(ops.length?'':'No typing recorded yet.');q('#bar').value=i;q('#inf').textContent='Edit '+i+' of '+ops.length+' · rewrites/deletions: '+ops.filter(o=>o[2]>0).length};
 const seek=n=>{txt='';i=0;while(i<n)ap(ops[i++]);show()};
 const step=()=>{if(i>=ops.length){clearInterval(m.t);q('#pl').textContent='Play';return}ap(ops[i++]);show()};
 q('#pl').onclick=()=>{if(m.t&&q('#pl').textContent==='Pause'){clearInterval(m.t);q('#pl').textContent='Play';return}if(i>=ops.length)seek(0);q('#pl').textContent='Pause';m.t=setInterval(step,30)};
 q('#bar').oninput=ev=>{clearInterval(m.t);q('#pl').textContent='Play';seek(+ev.target.value)};show();
}

// poll so activating / deactivating the class updates every screen
setInterval(async()=>{if(!me)return;if(me.role==='teacher'){if(!document.querySelector('.modal'))vTeacher();return}const r=await api('me');if(!r.ok)return;const was=me.open;me=r.d;if(was!==me.open){if(!me.open&&active)stopEssay();view()}},4000);
boot();
