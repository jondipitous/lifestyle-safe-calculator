
"use strict";

// Lifestyle-Safe Upgrade Calculator V28.7
// Indicative financial planning model

const initial={
 mode:"upgrader",sale:950000,hdb:180000,
 refund:310000,oa:25000,pureCash:400000,
 pureCPF:250000,joint:true,
 name1:"Buyer 1",status1:"SC",age1:34,wage1:8000,
 name2:"Buyer 2",status2:"SC",age2:43,wage2:6500,
 backup:120000,topup:200000,commit:1000,
 protection:true,debts:0,rate:3
};
let v={...initial},step=3;
try{
 const s=JSON.parse(localStorage.getItem("lsc-app"));
 if(s&&typeof s==="object")v={...v,...s};
}catch(e){}
const $=id=>document.getElementById(id);
const money=(n,u=100)=>!Number.isFinite(n)?"—":
 (n<0?"−":"")+"S$"+
 (Math.round(Math.abs(n)/u)*u).toLocaleString("en-SG");
const h=n=>money(n),d=n=>money(n,1),t=n=>money(n,10);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",
 '"':"&quot;","'":"&#39;"
})[c]);
const row=(a,b)=>`<div class="row"><span>${a}</span>
 <span class="money">${b}</span></div>`;
const grid=s=>`<div class="grid2">${s}</div>`;
const input=(k,label,currency=true)=>`<div>
 <label>${label}</label>
 ${currency?'<div class="inputwrap"><span class="prefix">S$</span>':""}
 <input data-key="${k}" type="number" min="0" step="any"
 value="${v[k]}">
 ${currency?"</div>":""}</div>`;
const pills=(k,opts)=>`<div class="pills">${
 opts.map(([n,label])=>`<button data-set="${k}"
 data-val="${n}" class="${v[k]===n?"active":""}">
 ${label}</button>`).join("")
}</div>`;
const presets = pills;
const note=s=>`<p class="small">${s}</p>`;
function calculate(){
 const selling=v.sale*.0218+2800;
 const net=v.sale-v.hdb-selling;
 const refund=Math.min(Math.max(0,net),v.refund);
 const cash=v.mode==="purchaser"?v.pureCash:net-refund;
 const cpf=v.mode==="purchaser"?v.pureCPF:refund+v.oa;
 const income=v.wage1+(v.joint?v.wage2:0);
 const age=income?(v.age1*v.wage1+
  (v.joint?v.age2*v.wage2:0))/income:0;
 const tenure=income?Math.max(0,Math.min(30,
  Math.floor(65-age))):0;
 const mixed=v.joint&&v.status1!==v.status2;
 const absdRate=mixed?0:
  (v.status1==="PR"||(v.joint&&v.status2==="PR"))?.05:0;
 const oaRate=a=>a<=35?.23:a<=45?.21:a<=50?.19:
  a<=55?.15:a<=60?.12:a<=65?.035:a<=70?.01:0;
 const flows=Array.from({length:120},(_,i)=>{
  const y=Math.floor(i/12);
  return {
   a:Math.min(8000,v.wage1)*oaRate(v.age1+y),
   b:v.joint?Math.min(8000,v.wage2)*oaRate(v.age2+y):0
  };
 });
 const factor=r=>{
  const n=tenure*12,x=r/1200;
  return n<1||r>100?Infinity:
   x===0?1/n:x/(1-Math.pow(1+x,-n));
 };
 const actual=factor(v.rate),stress=factor(4);
 const bankCap=Number.isFinite(stress)?
  Math.max(0,(income*.55-v.debts)/stress):0;
 const bsd=p=>{
  let left=p,out=0;
  for(const [cap,r] of [[180000,.01],[180000,.02],
   [640000,.03],[500000,.04],[1500000,.05],
   [Infinity,.06]]){
   const a=Math.min(left,cap);
   out+=a*r;left-=a;
   if(left<=0)break;
  }
  return Math.floor(out+1e-7);
 };
 const schedule=(loan,commit,protection)=>{
  const payment=loan*actual;
  let carry=0,gross=0,paid=0,shield=0;
  const years=[];
  for(let y=0;y<4;y++){
   let oa=0,cashPaid=0,reserve=0;
   for(let m=0;m<12;m++){
    const f=flows[y*12+m];
    const contrib=f.a+f.b;
    const used=Math.min(payment,carry+contrib);
    const gap=Math.max(0,payment-used);
    const fromCash=protection?Math.min(commit,gap):gap;
    const fromReserve=protection?gap-fromCash:0;
    carry=Math.max(0,carry+contrib-payment);
    oa+=used;cashPaid+=fromCash;reserve+=fromReserve;
    gross+=gap;paid+=fromCash;shield+=fromReserve;
   }
   years.push({oa:oa/12,cash:cashPaid/12,
    reserve:reserve/12});
  }
  return {payment,gross,paid,shield,years};
 };
 const evaluate=(p,loan,top,commit,backup,protect)=>{
  const spend=cash+top-(backup?v.backup:0);
  const limit=Math.min(.75*p,bankCap);
  if((v.mode==="upgrader"&&net<0)||p<=0||spend<0||
   tenure<1||!Number.isFinite(actual)||
   loan<0||loan>limit+.0001)return null;
  const stamp=bsd(p),legal=3000,absd=p*absdRate;
  const fees=stamp+legal,allFees=fees+absd;
  const feeCPF=Math.min(cpf,allFees),feeCash=allFees-feeCPF;
  const plan=schedule(loan,commit,protect);
  const shield=protect?plan.shield:0;
  const shieldCPF=Math.min(Math.max(0,cpf-feeCPF),shield);
  const shieldCash=shield-shieldCPF;
  const remainingCash=spend-feeCash-shieldCash;
  const remainingCPF=cpf-feeCPF-shieldCPF;
  const down=p-loan;
  const cashDown=Math.max(.05*p,down-remainingCPF);
  const cpfDown=down-cashDown;
  if(remainingCash+1e-5<cashDown||cpfDown< -1e-5||
   cpfDown>remainingCPF+1e-5)return null;
  return {p,loan,ltv:100*loan/p,down,cashDown,
   cpfDown,stamp,legal,absd,fees,allFees,feeCPF,
   feeCash,shield,shieldCPF,shieldCash,
   remainingCash,remainingCPF,...plan};
 };
 // Retains the original V28.7 indicative optimiser.
 const solve=(top,commit,backup,protect)=>{
  if((v.mode==="upgrader"&&net<0)||tenure<1||
   !Number.isFinite(actual)||bankCap<=0||
   cash+top<(backup?v.backup:0))return null;
  const at=p=>{
   const hi=Math.min(.75*p,bankCap);
   if(hi<=0)return null;
   const upper=evaluate(p,hi,top,commit,backup,protect);
   if(!upper)return null;
   let lo=0,high=hi;
   for(let i=0;i<35;i++){
    const mid=(lo+high)/2;
    if(evaluate(p,mid,top,commit,backup,protect))
     high=mid;
    else lo=mid;
   }
   return evaluate(p,Math.min(hi,high+.01),
    top,commit,backup,protect)||upper;
  };
  let lo=1,hi=6000,best=null;
  while(lo<=hi){
   const mid=Math.floor((lo+hi)/2);
   const x=at(mid*1000);
   if(x){best=x;lo=mid+1;}else hi=mid-1;
  }
  return best;
 };
 return {cash,cpf,selling,net,age,tenure,
  bankCap,flows,absdRate,mixed,
  A:solve(0,0,false,false),
  B:solve(v.topup,v.commit,true,v.protection)};
}

function funds(R){
 const modes=`<div class="segment">
 ${[["upgrader","HDB Upgrader"],
 ["purchaser","Pure Purchaser"]].map(([k,l])=>
 `<button data-set="mode" data-val="${k}"
 class="${v.mode===k?"active":""}">${l}</button>`
 ).join("")}</div>`;
 const inputs=v.mode==="upgrader"?`
 ${note("Calculate funds after selling your HDB.")}
 ${grid(input("sale","Selling Price")+
 input("hdb","Outstanding HDB Loan")+
 input("refund","CPF Refund + AI")+
 input("oa","Existing CPF OA"))}
 <div class="panel gap">
 ${row("Agent Fee (2%)",h(v.sale*.02))}
 ${row("GST on Agent Fee (9%)",h(v.sale*.0018))}
 ${row("Selling Legal Fees",h(2800))}
 <hr>${row("<b>Selling Expenses</b>",h(R.selling))}
 </div>
 ${R.net<0?'<p class="warning">Insufficient sale proceeds.</p>':""}
 `:`${note("Enter funds already available for purchase.")}
 ${grid(input("pureCash","Cash on Hand")+
 input("pureCPF","CPF OA Available"))}
 ${note("Use only eligible CPF OA funds.")}`;
 return `<h2>Step 1 · Available Purchase Funds</h2>
 <div class="section">${modes}${inputs}
 ${grid(`<div class="panel"><div class="statlabel">
 Assets (Cash)</div><div class="med">${h(R.cash)}</div></div>
 <div class="panel"><div class="statlabel">
 Assets (CPF)</div><div class="med">${h(R.cpf)}</div></div>`)}
 ${row("<b>Total Purchase Funds</b>",
 `<b>${h(R.cash+R.cpf)}</b>`)}</div>`;
}

function buyer(n){
 const s="status"+n;
 return `<div class="section"><h3>Buyer ${n}</h3>
 ${grid(`<div><label>Buyer Name</label>
 <input data-key="name${n}" value="${esc(v["name"+n])}"></div>
 <div><label>Residency</label><select data-key="${s}">
 <option value="SC" ${v[s]==="SC"?"selected":""}>SC</option>
 <option value="PR" ${v[s]==="PR"?"selected":""}>PR</option>
 </select></div>`+
 input("age"+n,"Age",false)+
 input("wage"+n,"Gross Salary / Mo"))}</div>`;
}
function forecast(R,key,label,age,color){
 const data=Array.from({length:10},(_,i)=>{
  const f=R.flows[i*12];
  return key==="all"?f.a+f.b:f[key];
 });
 const max=Math.max(1,...data);
 return `<div class="section"><h3>${esc(label)} · Monthly CPF OA</h3>
 ${data.map((n,i)=>`<div class="flex" style="gap:7px">
 <span class="tiny" style="width:55px;flex-shrink:0">
 ${key==="all"?"Year "+(i+1):"Age "+(age+i)}</span>
 <div class="bar" style="flex:1;height:11px">
 <div style="background:${color};width:${100*n/max}%"></div>
 </div><span class="tiny money" style="width:85px;
 text-align:right">${t(n)}</span></div>`).join("")}</div>`;
}
function cpfStep(R){
 return `<h2>Step 2 · CPF OA Forecast</h2>
 <div class="section">
 <label><input data-key="joint" type="checkbox"
 style="width:auto;margin-right:8px"
 ${v.joint?"checked":""}>Joint Buyers</label>
 ${buyer(1)}${v.joint?"<hr>"+buyer(2):""}
 <div class="panel gap"><h3>Monthly CPF OA · Year 1</h3>
 ${row(esc(v.name1),t(R.flows[0].a))}
 ${v.joint?row(esc(v.name2),t(R.flows[0].b)):""}
 <hr>${row("<b>Combined CPF OA</b>",
 `<b>${t(R.flows[0].a+R.flows[0].b)}</b>`)}</div>
 ${row("First-Property ABSD Rate",R.absdRate*100+"%")}
 ${R.mixed?note("0% assumes an eligible married SC–PR couple buying their first matrimonial home."):""}
 ${forecast(R,"a",v.name1,v.age1,"#278f8b")}
 ${v.joint?forecast(R,"b",v.name2,v.age2,"#c79752"):""}
 ${forecast(R,"all","Household",0,"#7485c8")}
 ${note("CPF OA estimates use simplified contribution rates and stable salaries.")}
 </div>`;
}
function backupStep(R){
 return `<h2>Step 3 · Protected Backup</h2>
 <div class="section">
 ${row("Assets (Cash)",h(R.cash))}
 ${input("backup","Protected Backup (Cash)")}
 <hr>${row("<b>Remaining Cash</b>",
 `<b>${h(R.cash-v.backup)}</b>`)}
 ${R.cash<v.backup?'<p class="warning">Backup exceeds cash on hand.</p>':""}
 ${note("Backup only applies to Structure B.")}</div>`;
}

function finance(x,isB){
 return grid(`<div class="finance">
 <div class="statlabel" style="min-height:28px">
 ${isB?"Optimized":"Selected"} Bank Loan</div>
 <div class="med money">${h(x.loan)}</div>
 <div class="tiny">${x.ltv.toFixed(1)}% LTV</div>
 <hr><div class="tiny">Bank financing</div></div>
 <div class="finance">
 <div class="statlabel" style="min-height:28px">
 Downpayment</div><div class="med money">${h(x.down)}</div>
 <div class="tiny">${(100-x.ltv).toFixed(1)}% (CPF/Cash)</div>
 <hr><div class="tiny">BSD + Legal: ${h(x.fees)}</div>
 ${x.absd>0?`<div class="tiny">ABSD: ${h(x.absd)}</div>`:""}
 ${isB&&v.protection?`<div class="tiny">
 Shield: ${h(x.shield)}</div>`:""}</div>`);
}
function funding(x,isB){
 const colors=["#278fb9","#e5a047","#8972ce"];
 return `<h3>Four-Year Mortgage Funding</h3>
 <div class="legend">
 <span><i class="dot" style="background:${colors[0]}"></i>CPF OA</span>
 <span><i class="dot" style="background:${colors[1]}"></i>Cash</span>
 ${isB&&v.protection?`<span><i class="dot"
 style="background:${colors[2]}"></i>Shield</span>`:""}
 </div><div class="section">
 ${x.years.map((y,i)=>`<div class="bars">
 ${row("<b>Year "+(i+1)+"</b>",d(x.payment)+"/mo")}
 <div class="bar">
 ${[y.oa,y.cash,...(isB&&v.protection?[y.reserve]:[])]
 .map((n,j)=>`<div style="width:${
  100*n/Math.max(1,x.payment)}%;
 background:${colors[j]}"></div>`).join("")}
 </div><div class="flex tiny">
 <span>OA ${t(y.oa)}</span>
 <span>Cash ${t(y.cash)}</span>
 ${isB&&v.protection?`<span>Shield ${t(y.reserve)}</span>`:""}
 </div></div>`).join("")}</div>`;
}
function protectionBox(x){
 return `<div class="panel section">
 <div class="flex">
 <div style="min-width:0;flex:1">
 <b style="font-size:12px;white-space:nowrap">
 48-Month Mortgage Protection</b>
 <div class="tiny">${v.protection?
 "ON · Protect monthly cash flow":"OFF · No mortgage reserve"}</div>
 </div><button data-toggle="protection"
 class="${v.protection?"active":""}">
 ${v.protection?"ON":"OFF"}</button></div>
 <hr>
 ${v.protection?`
 ${input("commit","Monthly Cash Commitment (48 Months)")}
 ${presets("commit",[[0,"S$0"],[1000,"S$1k"],
 [2000,"S$2k"],[3000,"S$3k"]])}
 ${x?`<hr>
 ${row("Projected Mortgage Shortfall",h(x.gross))}
 ${row("Funded by Monthly Cash",h(-x.paid))}
 <hr>${row("<b>Mortgage Shield Required</b>",
 `<b>${h(x.shield)}</b>`)}`:""}
 `:note("Mortgage shortfalls require future cash. No shield reserved.")}
 </div>`;
}
function topupBox(){
 return `<div class="panel section">
 <h3>Cash Top-Up (Personal Savings)</h3>
 ${input("topup","Cash Top-Up")}
 ${presets("topup",[[0,"S$0"],[50000,"S$50k"],
 [100000,"S$100k"],[200000,"S$200k"]])}</div>`;
}
function allocation(R,x){
 return `<h3>Equity Allocation</h3>
 <div class="section">
 ${row("<b>Assets (Cash)</b>",h(R.cash+v.topup))}
 ${row("− Protected Backup (Cash)",h(-v.backup))}
 <hr>${row("<b>Assets (CPF)</b>",h(R.cpf))}
 ${row("− BSD + Legal (CPF)",
 h(-Math.min(R.cpf,x.fees)))}
 ${x.absd>0?row("− ABSD (CPF)",
 h(-Math.max(0,x.feeCPF-Math.min(R.cpf,x.fees)))):""}
 ${v.protection?row("− Mortgage Shield (CPF)",
 h(-x.shieldCPF)):""}
 ${x.feeCash+x.shieldCash>0?row("− Cash costs / shield",
 h(-x.feeCash-x.shieldCash)):""}
 <hr>${row("<b>Remaining Cash</b>",h(x.remainingCash))}
 ${row("<b>Remaining CPF</b>",h(x.remainingCPF))}
 <div class="panel">
 <div class="statlabel">Downpayment</div>
 <div class="med">${h(x.down)}</div>
 <div class="small">Cash ${h(x.cashDown)} ·
 CPF ${h(x.cpfDown)}</div></div></div>`;
}
function results(R){
 const capacity=`<div class="panel section">
 <h3>Purchase Capacity Based on Income/Age</h3>
 ${grid(`<div><div class="statlabel">Maximum Bank Loan</div>
 <div class="med">${h(R.bankCap)}</div></div>
 <div><div class="statlabel">Indicative Loan Tenure</div>
 <div class="med">${R.tenure} years</div></div>`)}
 ${note("Income-weighted age: "+R.age.toFixed(1)+" years")}
 <hr><div class="statlabel">Total Equity Available (Cash + CPF)</div>
 <div class="big">${h(R.cash+R.cpf)}</div>
 ${note("Cash "+h(R.cash)+" + CPF OA "+h(R.cpf))}
 <hr>${note("55% TDSR · 4% stress rate")}
 ${R.absdRate>0?row("First-Property ABSD",
 R.absdRate*100+"%"):""}
 ${R.mixed?note("SC–PR matrimonial home remission assumed; verify eligibility."):""}
 ${grid(input("debts","Existing Monthly Debts")+
 input("rate","Mortgage Interest (%)",false))}</div>`;
 const A=R.A,B=R.B;
 return `<h2>Step 4 · Purchase Structures</h2>
 <div class="section">${capacity}
 <div class="card structure-a section">
 <div><h3>↗ Structure A · Maximum Purchase Power</h3>
 ${note("Maximise your property buying capacity")}</div>
 ${grid(`<div><div class="statlabel">Max Purchase Price</div>
 <div class="big">${A?h(A.p):"—"}</div></div>
 <div><div class="statlabel">Monthly Mortgage</div>
 <div class="big">${A?d(A.payment):"—"}</div></div>`)}
 ${A?`${finance(A,false)}
 ${row("Total Purchase Costs",h(A.allFees))}
 <hr>${funding(A,false)}`:
 note("No feasible purchase under these assumptions.")}
 </div>
 <div class="card structure-b section">
 <div><h3>♧ Structure B · Lifestyle Protection</h3>
 ${note("Protect your financial safety net")}</div>
 ${grid(`<div><div class="statlabel">Max Purchase Price</div>
 <div class="big">${B?h(B.p):"—"}</div></div>
 <div><div class="statlabel">Monthly Mortgage</div>
 <div class="big">${B?d(B.payment):"—"}</div></div>`)}
 ${B?finance(B,true):""}
 ${protectionBox(B)}
 ${topupBox()}
 ${B?`<hr>${allocation(R,B)}
 <hr>${funding(B,true)}`:
 note("No feasible protected purchase under these assumptions.")}
 </div></div>`;
}

function render(){
 
try {
  const test = results(calculate());
} catch (error) {
  alert("Step 4 error: " + error.message);
}

 const R=calculate();
 const views=[funds,cpfStep,backupStep,results];
 $("calculator-content").innerHTML=views[step](R);
 document.querySelectorAll("[data-step]").forEach(b=>{
  b.classList.toggle("active",Number(b.dataset.step)===step);
 });
 $("back-button").style.display=step===0?"none":"";
 $("next-button").textContent=
  step===3?"Review Funds →":"Next →";
}

document.addEventListener("click",e=>{
 const tab=e.target.closest("[data-step]");
 if(tab){step=Number(tab.dataset.step);render();return;}
 const preset=e.target.closest("[data-set]");
 if(preset){
  const k=preset.dataset.set;
  const value=preset.dataset.val;
  v[k]=k==="mode"?value:Number(value);
  localStorage.setItem("lsc-app",JSON.stringify(v));
  render();return;
 }
 const toggle=e.target.closest("[data-toggle]");
 if(toggle){
  v[toggle.dataset.toggle]=!v[toggle.dataset.toggle];
  localStorage.setItem("lsc-app",JSON.stringify(v));
  render();
 }
});
document.addEventListener("change",e=>{
 const node=e.target.closest("[data-key]");
 if(!node)return;
 const k=node.dataset.key;
 v[k]=node.type==="checkbox"?node.checked:
  node.type==="number"?Math.max(0,Number(node.value)||0):
  node.value;
 localStorage.setItem("lsc-app",JSON.stringify(v));
 render();
});
$("back-button").onclick=()=>{
 step=Math.max(0,step-1);render();
};
$("next-button").onclick=()=>{
 step=step===3?0:step+1;render();
};
render();
