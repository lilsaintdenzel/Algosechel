var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var vb = document.getElementById("vb");

function syncCanvas() {
  var w = vb.offsetWidth, h = vb.offsetHeight;
  if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
}
var ro = new ResizeObserver(syncCanvas);
ro.observe(vb);

function W() { return canvas.width || vb.offsetWidth || 400; }
function H() { return canvas.height || vb.offsetHeight || 300; }

var activeId = null;
var activeTab = "code";
var typing = false;
var typeTimer = null;
var animFrame = null;
var speed = 1;
var isMobile = false;
var srchOpen = false;
var srchIdx = 0;
var THEME_KEY = "algosechel-theme";
var C = {};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function syncPalette() {
  C.bg = cssVar("--bg");
  C.sur = cssVar("--surface");
  C.br = cssVar("--b1");
  C.b1 = cssVar("--b1");
  C.ac = cssVar("--ac");
  C.ac2 = cssVar("--ac2");
  C.gr = cssVar("--gr");
  C.am = cssVar("--am");
  C.ro = cssVar("--ro");
  C.sk = cssVar("--sk");
  C.tx = cssVar("--tx");
  C.mu = cssVar("--mu");
  C.di = cssVar("--di");
}

function updateThemeButton(theme) {
  var btn = document.getElementById("themeBtn");
  var label = document.getElementById("themeBtnLabel");
  if (!btn || !label) return;
  var next = theme === "light" ? "dark" : "light";
  label.textContent = next;
  btn.setAttribute("aria-label", "Switch to " + next + " mode");
  btn.setAttribute("title", "Switch to " + next + " mode");
}

function applyTheme(theme, persist) {
  var next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  if (persist !== false) {
    try { localStorage.setItem(THEME_KEY, next); } catch (err) {}
  }
  updateThemeButton(next);
  syncPalette();
}

function toggleTheme() {
  var current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  applyTheme(current === "light" ? "dark" : "light");
}

function initTheme() {
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (err) {}
  applyTheme(savedTheme, false);
}

initTheme();

function goTab(tab) {
  activeTab = tab;
  ["code","viz","explain"].forEach(function(t) {
    document.getElementById("t-"+t).classList.toggle("on", t === tab);
    document.getElementById("p-"+t).classList.toggle("off", t !== tab);
  });
  ["mb-code","mb-viz","mb-explain"].forEach(function(id) {
    var t = id.replace("mb-","");
    document.getElementById(id).classList.toggle("on", t === tab);
  });
  if (tab === "viz") { requestAnimationFrame(syncCanvas); }
}

function checkMobile() {
  isMobile = window.innerWidth <= 580;
  if (!isMobile) {
    document.getElementById("sb").classList.remove("open");
    document.getElementById("ov").classList.remove("on");
  }
}
function toggleSB() {
  document.getElementById("sb").classList.toggle("open");
  document.getElementById("ov").classList.toggle(
    "on",
    document.getElementById("sb").classList.contains("open")
  );
}
function mNav(v) {
  if (v === "notes") { toggleSB(); return; }
  goTab(v);
}
window.addEventListener("resize", checkMobile);

function toggleSpd() {
  speed = speed === 1 ? 3 : 1;
  document.getElementById("spdBtn").textContent = speed + "x";
  document.getElementById("spdBtn").classList.toggle("on", speed > 1);
}

function setStat(msg, step) {
  document.getElementById("stMsg").textContent = msg || "";
  if (step !== undefined) document.getElementById("stStep").textContent = step;
  updateVizDesc(msg);
}
function hlLine(idx) {
  var spans = document.querySelectorAll("#codeEl span");
  var lns = document.querySelectorAll("#lc .ln");
  spans.forEach(function(s, i) { s.classList.toggle("hl-line", i === idx); });
  lns.forEach(function(l, i) { l.classList.toggle("hl", i === idx); });
}

var INFO = {};
var NOTES = [];
var CORPUS = [];
var VIZ_DESCRIPTIONS = {
  bsearch: "Binary search keeps halving the remaining search window until the target is found or the range is exhausted.",
  bubble: "Bubble sort repeatedly compares neighboring values and swaps them so larger items drift to the far end.",
  dijkstra: "Dijkstra's algorithm expands the cheapest reachable node and relaxes edge costs to build shortest paths.",
  avl: "AVL insertion checks balance factors after every insert and rotates nodes whenever one side grows too deep.",
  tcp: "The TCP handshake establishes a reliable connection by exchanging sequence numbers across three packets.",
  hashmap: "Hash map chaining groups colliding keys inside the same bucket so lookup stays organized even when slots clash.",
  quicksort: "Quick sort chooses a pivot, partitions values around it, and recursively repeats that process on each side.",
  bfs: "Breadth-first search visits the graph layer by layer so near nodes are explored before deeper ones.",
  lru: "An LRU cache keeps recently used entries at the front and evicts the oldest one when space runs out.",
  mergesort: "Merge sort splits the array into smaller pieces and then merges ordered halves back together.",
  dfs: "Depth-first search follows one branch as far as it can before backtracking to the next branch.",
  stack: "This view compares stack and queue operations so you can watch LIFO and FIFO ordering diverge in real time."
};
var TOPIC_RUNNERS = {
  bsearch: vizBsearch,
  bubble: vizBubble,
  dijkstra: vizDijkstra,
  avl: vizAVL,
  tcp: vizTCP,
  hashmap: vizHashmap,
  quicksort: vizQuicksort,
  bfs: vizBFS,
  lru: vizLRU,
  mergesort: vizMergesort,
  dfs: vizDFS,
  stack: vizStackQueue
};

function vizIntro(id) {
  if (!id) return "Pick a note and run it to see a brief explanation of what the animation is doing.";
  return VIZ_DESCRIPTIONS[id] || "This visualization is stepping through the selected concept in small, readable stages.";
}

function updateVizDesc(detail) {
  var el = document.getElementById("vizDesc");
  if (!el) return;
  var intro = vizIntro(activeId);
  var cleanDetail = detail ? String(detail).replace(/[.!?]+$/, "") : "";
  el.textContent = cleanDetail ? intro + " Current step: " + cleanDetail + "." : intro;
}

function applyTopicData(topics) {
  INFO = {};
  NOTES = topics.map(function(topic) {
    INFO[topic.id] = topic.explain || {};
    return {
      id: topic.id,
      title: topic.title,
      tag: topic.tag,
      file: topic.file,
      views: topic.views,
      prev: topic.prev,
      code: topic.code || [],
      run: TOPIC_RUNNERS[topic.runKey]
    };
  });
  CORPUS = buildCorpus();
}

async function loadTopicData() {
  var response = await fetch("data/topics.json", {cache: "no-cache"});
  if (!response.ok) throw new Error("Failed to load topic data");
  var topics = await response.json();
  applyTopicData(topics);
}

function renderExplain(id) {
  var d = INFO[id];
  var note = NOTES.filter(function(n){ return n.id === id; })[0];
  var scroll = document.getElementById("epScroll");

  if (!d || !note) {
    scroll.innerHTML = "";
    return;
  }

  var badges = d.cx.map(function(cx) {
    return '<span class="ep-badge ' + cx.c + '">' + cx.l + ": " + cx.v + "</span>";
  }).join("");

  var ucs = d.uc.map(function(u) {
    return '<div class="ep-uc"><div class="ep-uc-arr">&rarr;</div><div><div class="ep-uc-t">' + u[0] + '</div><div class="ep-uc-b">' + u[1] + "</div></div></div>";
  }).join("");

  scroll.innerHTML =
    '<div class="ep-h1">' + note.title + "</div>" +
    '<div class="ep-meta"><span class="tg tg-' + note.tag + '">' + note.tag + '</span><div class="ep-badges">' + badges + "</div></div>" +
    '<div class="ep-sec">// how it works</div>' +
    '<div class="ep-desc">' + d.desc + "</div>" +
    '<div class="ep-hr"></div>' +
    '<div class="ep-sec">// use cases</div>' +
    '<div class="ep-ucs">' + ucs + "</div>";
}

var PAGE_SIZE = 10;
var currentPage = 0;

function totalPages() { return Math.ceil(NOTES.length / PAGE_SIZE); }

function renderNL() {
  var nl = document.getElementById("nl");
  var pgInfo = document.getElementById("pgInfo");
  var pgPrev = document.getElementById("pgPrev");
  var pgNext = document.getElementById("pgNext");
  var pg = document.getElementById("pg");

  nl.innerHTML = "";

  var start = currentPage * PAGE_SIZE;
  var slice = NOTES.slice(start, start + PAGE_SIZE);
  var total = totalPages();

  slice.forEach(function(n) {
    var el = document.createElement("div");
    el.className = "ni" + (n.id === activeId ? " on" : "");
    el.innerHTML = '<div class="ni-t">'+n.title+'</div><div class="ni-r"><span class="tg tg-'+n.tag+'">'+n.tag+'</span></div><div class="ni-p">'+n.prev+"</div>";
    el.onclick = function() {
      pickNote(n.id);
      if (isMobile) {
        document.getElementById("sb").classList.remove("open");
        document.getElementById("ov").classList.remove("on");
      }
    };
    nl.appendChild(el);
  });

  if (total <= 1) {
    pg.style.display = "none";
  } else {
    pg.style.display = "flex";
    pgInfo.textContent = (currentPage + 1) + " / " + total;
    pgPrev.disabled = currentPage === 0;
    pgNext.disabled = currentPage >= total - 1;
  }
}

function changePage(dir) {
  var total = totalPages();
  currentPage = Math.max(0, Math.min(currentPage + dir, total - 1));
  renderNL();
  document.getElementById("nl").scrollTop = 0;
}

function pickNote(id) {
  stopAll();
  activeId = id;
  var idx = NOTES.findIndex(function(n){ return n.id === id; });
  if (idx >= 0) currentPage = Math.floor(idx / PAGE_SIZE);
  renderNL();
  var note = NOTES.filter(function(n){ return n.id === id; })[0];
  var vizNames = {bsearch:"array",bubble:"bar sort",dijkstra:"graph",avl:"tree",tcp:"network"};
  document.getElementById("codeTabLabel").textContent = note.file;
  document.getElementById("vizTabLabel").textContent = vizNames[id] || "visualization";
  document.getElementById("stTopic").textContent = note.tag;
  document.getElementById("stStep").textContent = "typing...";
  setStat("typing code...");
  updateVizDesc("Press Run to watch " + note.title + " animate step by step");
  document.getElementById("runBtn").disabled = true;
  renderExplain(id);
  goTab("code");
  ctx.clearRect(0, 0, W(), H());
  typeCode(note);
}

function stopAll() {
  clearTimeout(typeTimer);
  cancelAnimationFrame(animFrame);
  typing = false;
}

function lineHTML(o) {
  if (!o || o.s === undefined) return "";
  var s = o.s || "", t = o.t || "", f = o.f || "", r = o.r || "";
  if (t === "cm") return '<span class="cm">'+s+"</span>";
  if (t === "kw") return '<span class="kw">'+s+'</span><span class="fn">'+f+"</span>"+r;
  if (t === "op") return '<span class="op">'+s+"</span>"+r;
  return s;
}

function typeCode(note) {
  typing = true;
  var pre = document.getElementById("codeEl");
  pre.innerHTML = "";
  var lc = document.getElementById("lc");
  lc.innerHTML = "";
  var i = 0;
  function tick() {
    if (i >= note.code.length) {
      typing = false;
      document.getElementById("runBtn").disabled = false;
      document.getElementById("stStep").textContent = "ready";
      setStat("press Run to animate");
      var cur = document.createElement("span");
      cur.className = "cblink";
      pre.appendChild(cur);
      return;
    }
    var sp = document.createElement("span");
    sp.innerHTML = lineHTML(note.code[i]) + "\n";
    pre.appendChild(sp);
    var ln = document.createElement("div");
    ln.className = "ln";
    ln.textContent = i + 1;
    lc.appendChild(ln);
    sp.scrollIntoView({block:"nearest"});
    i++;
    typeTimer = setTimeout(tick, speed === 1 ? 55 : 18);
  }
  tick();
}

function runNow() {
  if (!activeId) return;
  cancelAnimationFrame(animFrame);
  syncPalette();
  updateVizDesc("Starting the " + (NOTES.filter(function(n){ return n.id === activeId; })[0] || {}).title + " visualization");
  document.querySelectorAll(".cblink").forEach(function(e){ e.remove(); });
  document.getElementById("runBtn").disabled = true;
  goTab("viz");
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      syncCanvas();
      ctx.clearRect(0, 0, W(), H());
      var note = NOTES.filter(function(n){ return n.id === activeId; })[0];
      note.run();
    });
  });
}

function dl() { return new Promise(function(r){ setTimeout(r, speed === 1 ? 850 : 300); }); }
function dl2() { return new Promise(function(r){ setTimeout(r, speed === 1 ? 180 : 60); }); }
function pause(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

async function vizBsearch() {
  var arr=[8,14,21,33,40,47,55,61,72,80,88,95],target=61,lo=0,hi=arr.length-1,found=-1,step=0;
  var n=arr.length,cw=Math.min(50,(W()-40)/n),ch=Math.min(42,H()*.11);
  var sx=(W()-n*cw)/2,sy=H()/2-ch/2,fs=Math.max(9,Math.min(13,cw*.28));

  function draw(mid,state) {
    ctx.clearRect(0,0,W(),H());
    ctx.font="600 "+fs+"px Courier New"; ctx.fillStyle=C.mu; ctx.textAlign="center";
    ctx.fillText("target = "+target, W()/2, sy-34);
    if (state !== "done") {
      function lbl(i,t,c){ctx.font=(fs-1)+"px Courier New";ctx.fillStyle=c;ctx.textAlign="center";ctx.fillText(t,sx+i*cw+cw/2,sy-14);}
      lbl(lo,"lo",C.gr); lbl(hi,"hi",C.ro); if(mid!=null)lbl(mid,"mid",C.ac2);
    }
    arr.forEach(function(v,i){
      var x=sx+i*cw,bg=C.sur,bc=C.br,tc=C.mu;
      if(state==="done"&&i===found){bg=C.gr+"33";bc=C.gr;tc=C.gr;}
      else if(i===mid){bg=C.ac+"33";bc=C.ac2;tc=C.ac2;}
      else if(i>=lo&&i<=hi){tc=C.tx;}
      else{bg="#0d0f16";tc=C.di;}
      ctx.fillStyle=bg;ctx.strokeStyle=bc;ctx.lineWidth=i===mid?2:1;
      ctx.fillRect(x,sy,cw-2,ch);ctx.strokeRect(x,sy,cw-2,ch);
      ctx.font="600 "+fs+"px Courier New";ctx.fillStyle=tc;ctx.textAlign="center";
      ctx.fillText(v,x+(cw-2)/2,sy+ch/2+fs*.38);
    });
    arr.forEach(function(_,i){
      ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.di;ctx.textAlign="center";
      ctx.fillText(i,sx+i*cw+(cw-2)/2,sy+ch+14);
    });
  }

  while(lo<=hi) {
    var mid=Math.floor((lo+hi)/2); step++;
    hlLine(13); setStat("lo="+lo+" hi="+hi+" mid="+mid+" val="+arr[mid],"step "+step);
    draw(mid,"searching"); await dl();
    if(arr[mid]===target){
      hlLine(16); found=mid; setStat("Found "+target+" at index "+mid,"done");
      var p=0;
      function pulse(){if(p++>8){document.getElementById("runBtn").disabled=false;return;}draw(mid,p%2===0?"done":"searching");animFrame=setTimeout(pulse,200);}
      pulse(); return;
    } else if(arr[mid]<target){hlLine(17);setStat(arr[mid]+"<"+target+" search right","step "+step);lo=mid+1;}
    else{hlLine(18);setStat(arr[mid]+">"+target+" search left","step "+step);hi=mid-1;}
    await dl();
  }
  setStat("Not found","done"); document.getElementById("runBtn").disabled=false;
}

async function vizBubble() {
  var arr=W()<400?[64,25,12,88,45,37,72,19]:[64,25,12,88,45,37,72,19,56,33,81,50];
  var n=arr.length,bw=Math.min(46,(W()-40)/n),maxH=H()-80;
  var sx=(W()-n*bw)/2,by=H()-38,fs=Math.max(8,Math.min(11,bw*.25));
  var cmp=[-1,-1],done=new Set(),step=0;

  function draw(){
    ctx.clearRect(0,0,W(),H());
    arr.forEach(function(v,i){
      var bh=(v/100)*maxH,x=sx+i*bw,y=by-bh,col=C.ac;
      if(done.has(i))col=C.gr; else if(i===cmp[0]||i===cmp[1])col=C.am;
      ctx.fillStyle=col+"33";ctx.strokeStyle=col;ctx.lineWidth=1.5;
      ctx.fillRect(x+2,y,bw-4,bh);ctx.strokeRect(x+2,y,bw-4,bh);
      ctx.fillStyle=col;ctx.font=fs+"px Courier New";ctx.textAlign="center";ctx.fillText(v,x+bw/2,y-4);
    });
    ctx.strokeStyle=C.br;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx-8,by+2);ctx.lineTo(sx+n*bw+8,by+2);ctx.stroke();
  }

  for(var p=0;p<n-1;p++){
    for(var i=0;i<n-1-p;i++){
      cmp=[i,i+1];step++;hlLine(16);setStat("Compare ["+i+"]="+arr[i]+" vs ["+(i+1)+"]="+arr[i+1],"pass "+(p+1));
      draw();await dl2();
      if(arr[i]>arr[i+1]){hlLine(19);setStat("Swap "+arr[i]+" and "+arr[i+1],"pass "+(p+1));var t=arr[i];arr[i]=arr[i+1];arr[i+1]=t;draw();await dl2();}
    }
    done.add(n-1-p);cmp=[-1,-1];
  }
  done.add(0);cmp=[-1,-1];draw();hlLine(10);setStat("Array sorted!","done");
  document.getElementById("runBtn").disabled=false;
}

async function vizDijkstra() {
  var nodes=[{id:"A",x:.15,y:.22},{id:"B",x:.45,y:.1},{id:"C",x:.78,y:.22},{id:"D",x:.22,y:.62},{id:"E",x:.58,y:.62},{id:"F",x:.88,y:.68}];
  var edges=[{a:"A",b:"B",w:4},{a:"A",b:"D",w:2},{a:"B",b:"C",w:5},{a:"B",b:"E",w:10},{a:"C",b:"F",w:3},{a:"D",b:"E",w:8},{a:"E",b:"F",w:2},{a:"B",b:"D",w:1}];
  var dist={};nodes.forEach(function(n){dist[n.id]=Infinity;});dist.A=0;
  var visited=new Set(),shortE=new Set(),pq=[{cost:0,id:"A"}],aN=null,aE=null,step=0;
  var r=Math.min(W(),H())*.055,fs=Math.max(10,r*.65),wfs=Math.max(8,r*.48);

  function np(id){var nd=nodes.filter(function(x){return x.id===id;})[0];return{x:nd.x*W(),y:nd.y*H()};}
  function draw(){
    ctx.clearRect(0,0,W(),H());
    edges.forEach(function(e){
      var a=np(e.a),b=np(e.b),k=e.a+"-"+e.b;
      ctx.strokeStyle=shortE.has(k)?C.gr:aE===k?C.am:C.br;ctx.lineWidth=shortE.has(k)?2.5:aE===k?2:1;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.font=wfs+"px Courier New";ctx.fillStyle=aE===k?C.am:C.mu;ctx.textAlign="center";
      ctx.fillText(e.w,(a.x+b.x)/2+5,(a.y+b.y)/2-5);
    });
    nodes.forEach(function(n){
      var p=np(n.id),isA=n.id===aN,isV=visited.has(n.id),isS=n.id==="A";
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle=isA?C.ac+"55":isV?C.gr+"22":C.sur;ctx.fill();
      ctx.strokeStyle=isA?C.ac2:isV?C.gr:isS?C.sk:C.br;ctx.lineWidth=isA||isS?2:1;ctx.stroke();
      ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=isA?C.ac2:isV?C.gr:C.tx;ctx.textAlign="center";ctx.fillText(n.id,p.x,p.y+fs*.36);
      ctx.font=wfs+"px Courier New";ctx.fillStyle=isV?C.gr:C.mu;ctx.fillText(dist[n.id]===Infinity?"inf":dist[n.id],p.x,p.y+r+wfs+2);
    });
  }

  while(pq.length){
    pq.sort(function(a,b){return a.cost-b.cost;});
    var top=pq.shift(),cost=top.cost,id=top.id;
    if(visited.has(id)||cost>dist[id])continue;
    visited.add(id);aN=id;step++;hlLine(12);setStat("Visiting "+id+" dist="+cost,"step "+step);draw();await dl();
    edges.filter(function(e){return e.a===id||e.b===id;}).forEach(function(e){
      var nb=e.a===id?e.b:e.a;if(visited.has(nb))return;
      aE=e.a+"-"+e.b;var nc=cost+e.w;
      if(nc<dist[nb]){dist[nb]=nc;shortE.add(aE);pq.push({cost:nc,id:nb});}
    });
    hlLine(14);setStat("Relaxed edges from "+id,"step "+step);draw();await dl();
    aE=null;aN=null;
  }
  draw();hlLine(10);setStat("Shortest paths from A complete!","done");
  document.getElementById("runBtn").disabled=false;
}

async function vizAVL() {
  var tree=null,hlN=null,step=0;
  var vals=W()<400?[50,30,70,20,40,60]:[50,30,70,20,40,60,80,10,25,35,45];
  function ht(n){return n?n.h:0;}
  function upd(n){n.h=1+Math.max(ht(n.l),ht(n.r));n.bf=ht(n.l)-ht(n.r);}
  function rR(y){var x=y.l;y.l=x.r;x.r=y;upd(y);upd(x);return x;}
  function rL(x){var y=x.r;x.r=y.l;y.l=x;upd(x);upd(y);return y;}
  function bal(n){upd(n);if(n.bf>1){if(n.l.bf<0)n.l=rL(n.l);return rR(n);}if(n.bf<-1){if(n.r.bf>0)n.r=rR(n.r);return rL(n);}return n;}
  function ins(n,v){if(!n)return{v:v,l:null,r:null,h:1,bf:0};if(v<n.v)n.l=ins(n.l,v);else n.r=ins(n.r,v);return bal(n);}
  var nr=Math.min(20,W()*.055),lh=Math.min(68,H()*.21),fs=Math.max(9,nr*.65),bfs=Math.max(7,nr*.5);
  function dt(n,x,y,sp){
    if(!n)return;
    if(n.l){var cx=x-sp,cy=y+lh;ctx.strokeStyle=C.br;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y+nr);ctx.lineTo(cx,cy-nr);ctx.stroke();dt(n.l,cx,cy,sp/2);}
    if(n.r){var cx2=x+sp,cy2=y+lh;ctx.strokeStyle=C.br;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y+nr);ctx.lineTo(cx2,cy2-nr);ctx.stroke();dt(n.r,cx2,cy2,sp/2);}
    var hl=n.v===hlN;
    ctx.beginPath();ctx.arc(x,y,nr,0,Math.PI*2);ctx.fillStyle=hl?C.ac+"55":C.sur;ctx.fill();
    ctx.strokeStyle=hl?C.ac2:n.bf===0?C.gr:Math.abs(n.bf)===1?C.am:C.ro;ctx.lineWidth=hl?2.5:1.5;ctx.stroke();
    ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=hl?C.ac2:C.tx;ctx.textAlign="center";ctx.fillText(n.v,x,y+fs*.38);
    ctx.font=bfs+"px Courier New";ctx.fillStyle=Math.abs(n.bf)>1?C.ro:C.mu;ctx.fillText("bf:"+n.bf,x,y+nr+bfs+2);
  }
  function draw(){ctx.clearRect(0,0,W(),H());if(tree)dt(tree,W()/2,nr+10,W()/4);}
  for(var vi=0;vi<vals.length;vi++){
    step++;hlN=vals[vi];hlLine(4);setStat("Inserting "+vals[vi],"step "+step);
    tree=ins(tree,vals[vi]);draw();await dl();hlN=null;draw();
  }
  setStat("AVL balanced! green=bf:0 amber=bf:+-1","done");
  document.getElementById("runBtn").disabled=false;
}

async function vizTCP() {
  var step=0;
  var cX=W()*.18,sX=W()*.82,tY=H()*.12,bY=H()*.84;
  var bw=Math.min(108,W()*.24),bh=46,fs=Math.max(9,Math.min(13,bw*.12));
  var gap=Math.min(105,(bY-tY-80)/3);
  var steps=[{from:"c",label:"SYN",sub:"seq=1000",col:C.ac2,cl:8},{from:"s",label:"SYN-ACK",sub:"seq=5000, ack=1001",col:C.am,cl:12},{from:"c",label:"ACK",sub:"ack=5001",col:C.gr,cl:15}];
  var pkts=[],est=false;

  function box(x,lbl,sub){
    ctx.fillStyle=C.sur;ctx.strokeStyle=C.br;ctx.lineWidth=1;ctx.fillRect(x-bw/2,tY-10,bw,bh);ctx.strokeRect(x-bw/2,tY-10,bw,bh);
    ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=C.tx;ctx.textAlign="center";ctx.fillText(lbl,x,tY+fs);
    ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.mu;ctx.fillText(sub,x,tY+fs*2.2);
    ctx.strokeStyle=C.br;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,tY+bh-8);ctx.lineTo(x,bY+18);ctx.stroke();ctx.setLineDash([]);
  }
  function still(){
    ctx.clearRect(0,0,W(),H());box(cX,"CLIENT","TCP Stack");box(sX,"SERVER","TCP Stack");
    pkts.forEach(function(p){
      ctx.strokeStyle=p.col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.fx,p.y);ctx.lineTo(p.tx,p.y);ctx.stroke();
      var d=p.tx>p.fx?1:-1;ctx.fillStyle=p.col;ctx.beginPath();ctx.moveTo(p.tx,p.y);ctx.lineTo(p.tx-d*9,p.y-5);ctx.lineTo(p.tx-d*9,p.y+5);ctx.closePath();ctx.fill();
      ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=p.col;ctx.textAlign="center";ctx.fillText(p.label,(p.fx+p.tx)/2,p.y-9);
      if(W()>350){ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.mu;ctx.fillText(p.sub,(p.fx+p.tx)/2,p.y+18);}
    });
    if(est){ctx.font="700 "+(Math.max(11,fs))+"px Courier New";ctx.fillStyle=C.gr;ctx.textAlign="center";ctx.fillText("Connection Established",W()/2,bY+42);}
  }
  function animPkt(s,yp){
    return new Promise(function(res){
      var fx=s.from==="c"?cX:sX,tx=s.from==="c"?sX:cX,dur=speed===1?900:380,t0=performance.now();
      function fr(now){
        var t=Math.min((now-t0)/dur,1),e=t<.5?2*t*t:-1+(4-2*t)*t,px=fx+(tx-fx)*e,dir=tx>fx?1:-1;
        still();ctx.strokeStyle=s.col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fx,yp);ctx.lineTo(px,yp);ctx.stroke();
        ctx.fillStyle=s.col;ctx.beginPath();ctx.moveTo(px,yp);ctx.lineTo(px-dir*9,yp-5);ctx.lineTo(px-dir*9,yp+5);ctx.closePath();ctx.fill();
        ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=s.col;ctx.textAlign="center";ctx.fillText(s.label,(fx+px)/2,yp-9);
        if(t<1)animFrame=requestAnimationFrame(fr);
        else{pkts.push({fx:fx,tx:tx,y:yp,label:s.label,sub:s.sub,col:s.col});still();res();}
      }
      animFrame=requestAnimationFrame(fr);
    });
  }

  for(var si=0;si<steps.length;si++){
    var s=steps[si];step++;var yp=tY+bh+28+si*gap;
    hlLine(s.cl);setStat("Sending "+s.label+" - "+s.sub,"step "+step);
    await animPkt(s,yp);await pause(speed===1?450:180);
  }
  est=true;still();hlLine(17);setStat("TCP connection established!","done");
  document.getElementById("runBtn").disabled=false;
}

async function vizHashmap() {
  var buckets = new Array(8).fill(null).map(function(){ return []; });
  var keys = ["cat","dog","fox","ant","bee","elk","gnu","owl","pig","cow"];
  var colors = [C.ac2, C.gr, C.am, C.ro, C.sk, C.ac2, C.gr, C.am, C.ro, C.sk];
  var step = 0;

  function hashFn(k) {
    var h = 0;
    for (var i=0;i<k.length;i++) h = (h + k.charCodeAt(i)) % 8;
    return h;
  }

  var bw = Math.min(60, (W()-40)/8);
  var bh = 36;
  var sx = (W() - 8*bw) / 2;
  var by = H()*0.28;
  var fs = Math.max(9, Math.min(12, bw*0.22));

  function draw(highlightBucket) {
    ctx.clearRect(0,0,W(),H());
    ctx.font = fs+"px Courier New"; ctx.textAlign="center"; ctx.fillStyle=C.mu;
    ctx.fillText("hash(key) % 8  =  bucket index", W()/2, by-28);

    for (var i=0;i<8;i++) {
      var x = sx + i*bw;
      var isHl = i === highlightBucket;
      ctx.strokeStyle = isHl ? C.ac2 : C.br;
      ctx.lineWidth = isHl ? 2 : 1;
      ctx.fillStyle = isHl ? C.ac+"22" : C.sur;
      ctx.fillRect(x, by, bw-2, bh);
      ctx.strokeRect(x, by, bw-2, bh);
      ctx.fillStyle = isHl ? C.ac2 : C.di;
      ctx.font = (fs-1)+"px Courier New"; ctx.textAlign="center";
      ctx.fillText(i, x+(bw-2)/2, by+bh+14);

      var chain = buckets[i];
      chain.forEach(function(entry, ci) {
        var cy = by + bh + 26 + ci*28;
        ctx.fillStyle = entry.col+"33";
        ctx.strokeStyle = entry.col;
        ctx.lineWidth = 1;
        ctx.fillRect(x, cy, bw-2, 22);
        ctx.strokeRect(x, cy, bw-2, 22);
        ctx.fillStyle = entry.col;
        ctx.font = (fs-1)+"px Courier New"; ctx.textAlign="center";
        ctx.fillText(entry.key, x+(bw-2)/2, cy+14);
        if (ci > 0) {
          ctx.strokeStyle = entry.col+"88"; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(x+(bw-2)/2, cy); ctx.lineTo(x+(bw-2)/2, cy-6); ctx.stroke();
        }
      });
    }
  }

  var dl3 = function(){ return new Promise(function(r){ setTimeout(r, speed===1?700:250); }); };

  for (var ki=0; ki<keys.length; ki++) {
    var key = keys[ki]; var col = colors[ki];
    var idx = hashFn(key); step++;
    hlLine(8);
    setStat('hash("'+key+'") = '+idx+" - inserting into bucket "+idx, "step "+step);
    draw(idx); await dl3();
    buckets[idx].push({key:key, col:col});
    draw(idx); await dl3();
  }
  draw(-1);
  setStat("All keys inserted - collisions chained in buckets", "done");
  document.getElementById("runBtn").disabled = false;
}

async function vizQuicksort() {
  var arr = W()<400 ? [7,2,9,4,6,1,8,3] : [7,2,9,4,6,1,8,3,5,10,11,0];
  var n = arr.length;
  var bw = Math.min(46,(W()-40)/n), maxH = H()-80;
  var sx = (W()-n*bw)/2, by = H()-38;
  var fs = Math.max(8,Math.min(11,bw*.25));
  var colors = new Array(n).fill(C.ac);
  var pivotIdx = -1, step = 0;

  function draw() {
    ctx.clearRect(0,0,W(),H());
    arr.forEach(function(v,i) {
      var bh=(v/12)*maxH, x=sx+i*bw, y=by-bh;
      var col = i===pivotIdx ? C.am : colors[i];
      ctx.fillStyle=col+"33"; ctx.strokeStyle=col; ctx.lineWidth=1.5;
      ctx.fillRect(x+2,y,bw-4,bh); ctx.strokeRect(x+2,y,bw-4,bh);
      ctx.fillStyle=col; ctx.font=fs+"px Courier New"; ctx.textAlign="center";
      ctx.fillText(v,x+bw/2,y-4);
    });
    ctx.strokeStyle=C.br; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx-8,by+2); ctx.lineTo(sx+n*bw+8,by+2); ctx.stroke();
  }

  async function qsort(lo, hi) {
    if (lo >= hi) { if (lo >= 0 && lo < colors.length) colors[lo] = C.gr; draw(); return; }
    pivotIdx = hi; step++;
    hlLine(6); setStat("Pivot = "+arr[hi]+" at idx "+hi+", partitioning ["+lo+".."+hi+"]", "step "+step);
    draw(); await dl2();
    var piv = arr[hi], si = lo;
    for (var i=lo; i<hi; i++) {
      if (arr[i] <= piv) {
        var t=arr[si]; arr[si]=arr[i]; arr[i]=t;
        si++;
      }
      draw(); await new Promise(function(r){setTimeout(r, speed===1?80:28);});
    }
    var t2=arr[si]; arr[si]=arr[hi]; arr[hi]=t2;
    colors[si] = C.gr; pivotIdx = -1;
    draw(); await dl2();
    await qsort(lo, si-1);
    await qsort(si+1, hi);
  }

  await qsort(0, arr.length-1);
  pivotIdx=-1; colors=new Array(n).fill(C.gr); draw();
  hlLine(4); setStat("Array sorted!", "done");
  document.getElementById("runBtn").disabled = false;
}

async function vizBFS() {
  var nodes = [{id:"A",x:.12,y:.15},{id:"B",x:.38,y:.08},{id:"C",x:.65,y:.08},{id:"D",x:.88,y:.15},{id:"E",x:.12,y:.5},{id:"F",x:.38,y:.42},{id:"G",x:.65,y:.42},{id:"H",x:.88,y:.5},{id:"I",x:.25,y:.82},{id:"J",x:.75,y:.82}];
  var edges = [{a:"A",b:"B"},{a:"A",b:"E"},{a:"B",b:"C"},{a:"B",b:"F"},{a:"C",b:"D"},{a:"C",b:"G"},{a:"D",b:"H"},{a:"E",b:"F"},{a:"E",b:"I"},{a:"F",b:"G"},{a:"G",b:"H"},{a:"G",b:"J"},{a:"H",b:"J"},{a:"I",b:"J"}];
  var r = Math.min(W(),H())*0.048, fs = Math.max(9,r*.7);
  var visited = new Set(), queue = ["A"], order = [], activeEdges = new Set(), step = 0;
  var nodeColors = {}, edgeColors = {};

  function np(id){ var nd=nodes.filter(function(x){return x.id===id;})[0]; return{x:nd.x*W(),y:nd.y*H()}; }
  function draw() {
    ctx.clearRect(0,0,W(),H());
    edges.forEach(function(e) {
      var a=np(e.a),b=np(e.b),k=e.a+"-"+e.b;
      ctx.strokeStyle=activeEdges.has(k)?C.am:edgeColors[k]===C.gr?C.gr:C.br;
      ctx.lineWidth=activeEdges.has(k)||edgeColors[k]===C.gr?2:1;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    });
    nodes.forEach(function(n) {
      var p=np(n.id), col=nodeColors[n.id]||C.sur;
      var bc = col===C.sur?C.br:col;
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle=col==="cur"?C.am+"55":col===C.gr?C.gr+"22":C.sur;ctx.fill();
      ctx.strokeStyle=col==="cur"?C.am:col===C.gr?C.gr:bc;ctx.lineWidth=col==="cur"?2.5:1;ctx.stroke();
      ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=col==="cur"?C.am:col===C.gr?C.gr:C.tx;ctx.textAlign="center";ctx.fillText(n.id,p.x,p.y+fs*.36);
    });
    var qstr="Queue: ["+queue.join(", ")+"]";
    ctx.font=(fs-1)+"px Courier New";ctx.fillStyle=C.mu;ctx.textAlign="center";ctx.fillText(qstr,W()/2,H()-12);
  }

  nodeColors.A = "cur";
  while (queue.length) {
    var cur = queue.shift(); step++;
    nodeColors[cur]="cur"; draw(); await dl();
    visited.add(cur); order.push(cur);
    hlLine(11); setStat("Visited "+cur+" - order: ["+order.join(", ")+"]", "step "+step);
    var nbrs = edges.filter(function(e){return e.a===cur||e.b===cur;}).map(function(e){return e.a===cur?e.b:e.a;});
    nbrs.forEach(function(nb) {
      if(!visited.has(nb)&&queue.indexOf(nb)===-1) {
        queue.push(nb); nodeColors[nb]=C.ac+"55";
        var k=cur+"-"+nb; activeEdges.add(k); edgeColors[k]=C.gr;
      }
    });
    nodeColors[cur]=C.gr; draw(); await dl();
    activeEdges.clear();
  }
  draw(); setStat("BFS complete - visited: ["+order.join(", ")+"]", "done");
  document.getElementById("runBtn").disabled = false;
}

async function vizLRU() {
  var CAP = 4;
  var cache = [];
  var ops = [["get","A"],["put","A",1],["put","B",2],["put","C",3],["put","D",4],["get","A"],["put","E",5],["get","C"],["put","F",6],["get","B"]];
  var step=0, bw=Math.min(70,(W()-60)/CAP), bh=50, gap=10;
  var sx=(W()-(CAP*(bw+gap)-gap))/2, by=H()/2-bh/2, fs=Math.max(9,Math.min(12,bw*.18));
  var msg="";

  function draw() {
    ctx.clearRect(0,0,W(),H());
    ctx.font=(fs-1)+"px Courier New";ctx.fillStyle=C.mu;ctx.textAlign="center";
    ctx.fillText("Capacity: "+CAP+"   MRU ---> LRU", W()/2, by-38);
    ctx.fillText(msg, W()/2, by+bh+34);

    for (var si=0;si<CAP;si++) {
      var x=sx+si*(bw+gap), entry=cache[si];
      var col = entry ? (si===0?C.gr:C.ac) : C.br;
      ctx.fillStyle=entry?col+"22":C.sur;ctx.strokeStyle=col;ctx.lineWidth=si===0?2:1;
      ctx.fillRect(x,by,bw,bh);ctx.strokeRect(x,by,bw,bh);
      if (entry) {
        ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=col;ctx.textAlign="center";ctx.fillText(entry.key,x+bw/2,by+bh/2-4);
        ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.mu;ctx.fillText("val:"+entry.val,x+bw/2,by+bh/2+10);
      } else {
        ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.di;ctx.textAlign="center";ctx.fillText("empty",x+bw/2,by+bh/2+4);
      }
      if (si===0) { ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.gr;ctx.textAlign="center";ctx.fillText("MRU",x+bw/2,by-8); }
      if (si===CAP-1) { ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.ro;ctx.textAlign="center";ctx.fillText("LRU",x+bw/2,by-8); }
    }
  }

  for (var oi=0;oi<ops.length;oi++) {
    var op=ops[oi]; step++;
    if (op[0]==="put") {
      hlLine(11);
      cache = cache.filter(function(e){return e&&e.key!==op[1];});
      if (cache.length>=CAP) { var evicted=cache.pop(); msg="PUT "+op[1]+" - evicted "+evicted.key+" (LRU)"; }
      else msg="PUT "+op[1]+"="+op[2];
      cache.unshift({key:op[1],val:op[2]});
    } else {
      hlLine(7);
      var hit=cache.filter(function(e){return e&&e.key===op[1];})[0];
      if (hit) { cache=cache.filter(function(e){return e&&e.key!==op[1];}); cache.unshift(hit); msg="GET "+op[1]+" - HIT, moved to MRU"; }
      else msg="GET "+op[1]+" - MISS";
    }
    setStat(msg,"step "+step); draw(); await dl();
  }
  setStat("LRU simulation complete", "done");
  document.getElementById("runBtn").disabled = false;
}

async function vizMergesort() {
  var orig = W()<400 ? [6,3,8,1,5,2,7,4] : [6,3,8,1,5,2,7,4,9,0,11,10];
  var n = orig.length;
  var bw = Math.min(42,(W()-40)/n), maxH = H()-100;
  var sx = (W()-n*bw)/2, by = H()-38, fs = Math.max(8,Math.min(11,bw*.26));
  var arr = orig.slice(), step = 0;
  var highlights = new Array(n).fill(C.ac);

  function draw() {
    ctx.clearRect(0,0,W(),H());
    arr.forEach(function(v,i) {
      var bh=Math.max(4,(v/(n+1))*maxH), x=sx+i*bw, y=by-bh, col=highlights[i];
      ctx.fillStyle=col+"33";ctx.strokeStyle=col;ctx.lineWidth=1.5;
      ctx.fillRect(x+2,y,bw-4,bh);ctx.strokeRect(x+2,y,bw-4,bh);
      ctx.fillStyle=col;ctx.font=fs+"px Courier New";ctx.textAlign="center";ctx.fillText(v,x+bw/2,y-4);
    });
    ctx.strokeStyle=C.br;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx-8,by+2);ctx.lineTo(sx+n*bw+8,by+2);ctx.stroke();
  }

  async function msort(lo, hi) {
    if (lo>=hi) { highlights[lo]=C.gr; draw(); return; }
    var mid=Math.floor((lo+hi)/2);
    for(var i=lo;i<=mid;i++) highlights[i]=C.sk;
    for(var i2=mid+1;i2<=hi;i2++) highlights[i2]=C.am;
    step++; hlLine(7); setStat("Split ["+lo+".."+mid+"] | ["+(mid+1)+".."+hi+"]", "step "+step);
    draw(); await dl2();
    await msort(lo,mid); await msort(mid+1,hi);
    var left=arr.slice(lo,mid+1), right=arr.slice(mid+1,hi+1), merged=[], li=0, ri=0;
    while(li<left.length&&ri<right.length){
      if(left[li]<=right[ri]){merged.push(left[li++]);}else{merged.push(right[ri++]);}
    }
    merged=merged.concat(left.slice(li)).concat(right.slice(ri));
    merged.forEach(function(v,i){arr[lo+i]=v;highlights[lo+i]=C.gr;});
    step++; hlLine(13); setStat("Merged ["+lo+".."+hi+"] = ["+merged.join(",")+"]", "step "+step);
    draw(); await dl2();
  }

  await msort(0, arr.length-1);
  highlights=new Array(n).fill(C.gr); draw();
  setStat("Array sorted!","done");
  document.getElementById("runBtn").disabled = false;
}

async function vizDFS() {
  var nodes = [{id:"A",x:.12,y:.15},{id:"B",x:.38,y:.08},{id:"C",x:.65,y:.08},{id:"D",x:.88,y:.15},{id:"E",x:.12,y:.5},{id:"F",x:.38,y:.42},{id:"G",x:.65,y:.42},{id:"H",x:.88,y:.5},{id:"I",x:.25,y:.82},{id:"J",x:.75,y:.82}];
  var edges = [{a:"A",b:"B"},{a:"A",b:"E"},{a:"B",b:"C"},{a:"B",b:"F"},{a:"C",b:"D"},{a:"C",b:"G"},{a:"D",b:"H"},{a:"E",b:"F"},{a:"E",b:"I"},{a:"F",b:"G"},{a:"G",b:"H"},{a:"G",b:"J"},{a:"H",b:"J"},{a:"I",b:"J"}];
  var r=Math.min(W(),H())*0.048, fs=Math.max(9,r*.7);
  var visited=new Set(), order=[], step=0;
  var visitedEdges=new Set(), activeNode=null;

  function np(id){var nd=nodes.filter(function(x){return x.id===id;})[0];return{x:nd.x*W(),y:nd.y*H()};}
  function draw(){
    ctx.clearRect(0,0,W(),H());
    edges.forEach(function(e){
      var a=np(e.a),b=np(e.b),k=e.a+"-"+e.b;
      ctx.strokeStyle=visitedEdges.has(k)?C.ac2:C.br;ctx.lineWidth=visitedEdges.has(k)?2:1;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    });
    nodes.forEach(function(n){
      var p=np(n.id),isA=n.id===activeNode,isV=visited.has(n.id);
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle=isA?C.am+"55":isV?C.ac+"22":C.sur;ctx.fill();
      ctx.strokeStyle=isA?C.am:isV?C.ac2:C.br;ctx.lineWidth=isA?2.5:1;ctx.stroke();
      ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=isA?C.am:isV?C.ac2:C.tx;ctx.textAlign="center";ctx.fillText(n.id,p.x,p.y+fs*.36);
      if(isV){ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.ac2;ctx.fillText(order.indexOf(n.id)+1,p.x+r*.7,p.y-r*.7);}
    });
    ctx.font=(fs-1)+"px Courier New";ctx.fillStyle=C.mu;ctx.textAlign="center";ctx.fillText("Visited: ["+order.join(", ")+"]",W()/2,H()-12);
  }

  async function dfs(node, from) {
    if(visited.has(node)) return;
    visited.add(node); order.push(node); activeNode=node; step++;
    if(from){var k=from+"-"+node; visitedEdges.add(k);}
    hlLine(11); setStat("Visiting "+node+" - depth stack: ["+order.join(", ")+"]","step "+step);
    draw(); await dl();
    var nbrs=edges.filter(function(e){return e.a===node||e.b===node;}).map(function(e){return e.a===node?e.b:e.a;});
    for(var i=0;i<nbrs.length;i++){ await dfs(nbrs[i],node); }
    activeNode=null;
  }

  await dfs("A", null);
  draw(); setStat("DFS complete - visited: ["+order.join(", ")+"]","done");
  document.getElementById("runBtn").disabled = false;
}

async function vizStackQueue() {
  var step=0;
  var stack=[], queue=[];
  var ops=[
    {ds:"stack",op:"push",val:10},{ds:"stack",op:"push",val:20},{ds:"stack",op:"push",val:30},
    {ds:"queue",op:"enqueue",val:"A"},{ds:"queue",op:"enqueue",val:"B"},{ds:"queue",op:"enqueue",val:"C"},
    {ds:"stack",op:"pop"},{ds:"queue",op:"dequeue"},
    {ds:"stack",op:"push",val:40},{ds:"queue",op:"enqueue",val:"D"},
    {ds:"stack",op:"pop"},{ds:"queue",op:"dequeue"}
  ];
  var bw=Math.min(50,(W()/2-40)/5), bh=38, halfW=W()/2;
  var fs=Math.max(8,Math.min(11,bw*.22));
  var hlStack=-1, hlQueue=-1;

  function draw() {
    ctx.clearRect(0,0,W(),H());
    var labelY=H()*.18;
    ctx.font="700 "+(fs+1)+"px Courier New";ctx.fillStyle=C.ac2;ctx.textAlign="center";
    ctx.fillText("STACK (LIFO)",halfW/2,labelY);
    ctx.fillText("QUEUE (FIFO)",halfW+halfW/2,labelY);

    var sBy=H()-40;
    ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.mu;ctx.textAlign="center";
    ctx.fillText("push / pop",halfW/2,sBy+16);
    stack.forEach(function(v,i){
      var x=halfW/2-bw/2, y=sBy-bh-(i*(bh+3));
      var isHl=i===stack.length-1&&hlStack===1;
      ctx.fillStyle=(isHl?C.am:C.ac)+"33";ctx.strokeStyle=isHl?C.am:C.ac;ctx.lineWidth=isHl?2:1;
      ctx.fillRect(x,y,bw,bh);ctx.strokeRect(x,y,bw,bh);
      ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=isHl?C.am:C.ac2;ctx.textAlign="center";ctx.fillText(v,x+bw/2,y+bh/2+fs*.35);
    });
    if(stack.length===0){ctx.font=(fs-1)+"px Courier New";ctx.fillStyle=C.di;ctx.textAlign="center";ctx.fillText("empty",halfW/2,sBy-bh/2);}
    ctx.strokeStyle=C.b1;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(halfW/2-bw/2-8,sBy);ctx.lineTo(halfW/2+bw/2+8,sBy);ctx.stroke();

    var qY=H()/2-bh/2, qSx=halfW+20;
    ctx.font=(fs-2)+"px Courier New";ctx.fillStyle=C.gr;ctx.textAlign="left";ctx.fillText("enqueue -->",qSx,qY+bh+18);
    ctx.fillStyle=C.ro;ctx.textAlign="right";ctx.fillText("<-- dequeue",W()-20,qY+bh+18);
    queue.forEach(function(v,i){
      var x=qSx+i*(bw+3);
      var isHl=(i===0&&hlQueue===-1)||(i===queue.length-1&&hlQueue===1);
      ctx.fillStyle=(isHl?C.gr:C.ac)+"33";ctx.strokeStyle=isHl?C.gr:C.ac;ctx.lineWidth=isHl?2:1;
      ctx.fillRect(x,qY,bw,bh);ctx.strokeRect(x,qY,bw,bh);
      ctx.font="700 "+fs+"px Courier New";ctx.fillStyle=isHl?C.gr:C.ac2;ctx.textAlign="center";ctx.fillText(v,x+bw/2,qY+bh/2+fs*.35);
    });
    if(queue.length===0){ctx.font=(fs-1)+"px Courier New";ctx.fillStyle=C.di;ctx.textAlign="center";ctx.fillText("empty",halfW+halfW/2,qY+bh/2+4);}

    var divX=halfW;
    ctx.strokeStyle=C.b1;ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(divX,20);ctx.lineTo(divX,H()-20);ctx.stroke();ctx.setLineDash([]);
  }

  for(var oi=0;oi<ops.length;oi++){
    var op=ops[oi]; step++;
    hlStack=-1; hlQueue=-1;
    if(op.ds==="stack"){
      if(op.op==="push"){stack.push(op.val);hlStack=1;hlLine(4);setStat("Stack push("+op.val+") - top is now "+op.val,"step "+step);}
      else{var popped=stack.pop();hlLine(5);setStat("Stack pop() - removed "+popped+", top is "+(stack[stack.length-1]||"empty"),"step "+step);}
    } else {
      if(op.op==="enqueue"){queue.push(op.val);hlQueue=1;hlLine(10);setStat("Queue enqueue("+op.val+") - back of line","step "+step);}
      else{var dq=queue.shift();hlLine(11);setStat("Queue dequeue() - removed "+dq+" from front","step "+step);}
    }
    draw(); await dl();
  }
  hlStack=-1;hlQueue=-1;draw();
  setStat("Stack = LIFO, Queue = FIFO - same O(1) ops, opposite order","done");
  document.getElementById("runBtn").disabled = false;
}

function buildCorpus() {
  return NOTES.map(function(n) {
    var d = INFO[n.id] || {};
    var cxTxt = (d.cx||[]).map(function(c){return c.l+" "+c.v;}).join(" ");
    var ucTxt = (d.uc||[]).map(function(u){return u[0]+" "+u[1];}).join(" ");
    var dTxt  = (d.desc||"").replace(/<[^>]+>/g,"");
    return {id:n.id,title:n.title,tag:n.tag,prev:n.prev,
      blob:[n.title,n.tag,n.prev,cxTxt,ucTxt,dTxt].join(" ").toLowerCase(),
      cx:d.cx||[],uc:d.uc||[],desc:dTxt};
  });
}
function hlMatch(text,q) {
  if (!q) return text;
  return text.replace(new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi"),"<mark>$1</mark>");
}
function getSnippet(item,q) {
  for (var i=0;i<item.uc.length;i++){
    var s=item.uc[i][0]+" - "+item.uc[i][1];
    if(s.toLowerCase().indexOf(q)>-1){var idx=s.toLowerCase().indexOf(q);return hlMatch((idx>20?"...":"")+s.slice(Math.max(0,idx-20),idx+q.length+40)+"...",q);}
  }
  if(item.desc.toLowerCase().indexOf(q)>-1){var idx2=item.desc.toLowerCase().indexOf(q);return hlMatch((idx2>20?"...":"")+item.desc.slice(Math.max(0,idx2-20),idx2+q.length+40)+"...",q);}
  return hlMatch(item.prev,q);
}

function openSearch() {
  srchOpen=true; srchIdx=0;
  document.getElementById("srchOv").classList.add("on");
  document.getElementById("srchIn").value="";
  renderSrch("");
  setTimeout(function(){document.getElementById("srchIn").focus();},50);
}
function closeSearch() {
  srchOpen=false;
  document.getElementById("srchOv").classList.remove("on");
}
function renderSrch(q) {
  var res=document.getElementById("srchRes");
  var term=q.trim().toLowerCase();
  var list=term?CORPUS.filter(function(c){return c.blob.indexOf(term)>-1;}):CORPUS;
  if(!list.length){res.innerHTML='<div class="srch-empty">no results</div>';return;}
  var html='<div class="srch-lbl">'+( term?list.length+" result"+(list.length>1?"s":""):"all notes" )+"</div>";
  list.forEach(function(item,i){
    var cxv=item.cx[1]?item.cx[1].v:item.cx[0]?item.cx[0].v:"";
    html+='<div class="sri'+(i===srchIdx?" on":"")+'" onclick="pickSrch(\''+item.id+'\')">'+
      '<div class="sri-ic">'+item.title.slice(0,2).toUpperCase()+'</div>'+
      '<div class="sri-body">'+
        '<div class="sri-t">'+hlMatch(item.title,term)+'</div>'+
        '<div class="sri-m"><span class="tg tg-'+item.tag+'">'+item.tag+'</span><span class="sri-cx">'+cxv+"</span></div>"+
        '<div class="sri-s">'+getSnippet(item,term)+"</div>"+
      "</div></div>";
  });
  res.innerHTML=html;
}
function pickSrch(id){closeSearch();pickNote(id);}

window.addEventListener("load", async function() {
  try {
    await loadTopicData();
  } catch (err) {
    console.error(err);
    document.getElementById("stNotes").textContent = "0";
    setStat("failed to load topic data", "error");
    return;
  }

  document.getElementById("stNotes").textContent = NOTES.length;

  document.getElementById("srchIn").addEventListener("input", function(e) {
    srchIdx = 0;
    renderSrch(e.target.value);
  });

  document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey||e.metaKey) && e.key==="k") { e.preventDefault(); srchOpen ? closeSearch() : openSearch(); return; }
    if (!srchOpen) return;
    var items = document.querySelectorAll(".sri");
    if (e.key==="Escape") { closeSearch(); return; }
    if (e.key==="ArrowDown") { e.preventDefault(); srchIdx = Math.min(srchIdx+1, items.length-1); }
    else if (e.key==="ArrowUp") { e.preventDefault(); srchIdx = Math.max(srchIdx-1, 0); }
    else if (e.key==="Enter") { var a = items[srchIdx]; if (a) { var m = a.getAttribute("onclick").match(/'([^']+)'/); if (m) pickSrch(m[1]); } }
    items.forEach(function(el,i) { el.classList.toggle("on", i===srchIdx); });
    if (items[srchIdx]) items[srchIdx].scrollIntoView({block:"nearest"});
  });

  checkMobile();
  renderNL();
});
