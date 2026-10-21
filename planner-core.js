/* Pure planning and basket calculations, shared by the app and its tests. */
(function(root){
  const baseName=r=>r.ingredients[0].replace(/\s+\d.*$/,'').toLowerCase();
  const names=r=>new Set(r.ingredients.map(x=>x.replace(/\s+\d.*$/,'').toLowerCase()));
  const carb=r=>/pasta|spaghetti|lasagne|risoni/i.test(r.name+' '+r.ingredients.join(' '))?'pasta':/potatis/i.test(r.name+' '+r.ingredients.join(' '))?'potatis':/ris|risotto/i.test(r.name+' '+r.ingredients.join(' '))?'ris':'annat';
  function choose({pool,previous=[],locks=new Set(),days,people,budget,vegetarian=0,random=Math.random,preference=()=>0}){
    const kept=previous.filter(r=>locks.has(r.name));
    if(kept.length>days)throw Error('Du har fler låsta middagar än antal dagar. Lås upp en middag eller välj fler dagar.');
    if(kept.some(r=>!pool.some(p=>p.name===r.name)))throw Error('En låst middag passar inte dina nya matval. Lås upp den eller ändra matvalen.');
    const picked=[...kept],available=pool.filter(r=>!kept.some(k=>k.name===r.name));
    if(vegetarian-kept.filter(r=>r.protein==='vegetariskt').length>days-kept.length)throw Error('De låsta middagarna lämnar för få platser för ditt vegetariska önskemål.');
    if(available.length+kept.length<days)throw Error('För få olika rätter matchar dina val. Välj fler proteiner eller färre begränsningar.');
    if(pool.filter(r=>r.protein==='vegetariskt').length<vegetarian)throw Error('För få vegetariska rätter matchar dina val. Justera dina matval.');
    while(picked.length<days){
      const left=days-picked.length,spent=picked.reduce((s,r)=>s+r.price*people,0),target=(budget-spent)/left/people;
      const vegNeeded=vegetarian-picked.filter(r=>r.protein==='vegetariskt').length;
      let choices=available.filter(r=>vegNeeded<left||r.protein==='vegetariskt');
      if(!choices.length)throw Error('Det går inte att uppfylla önskemålen med de låsta middagarna.');
      const ranked=choices.map(r=>{
        const sameProtein=picked.filter(p=>p.protein===r.protein).length;
        const sameMain=picked.filter(p=>baseName(p)===baseName(r)).length;
        const sameCarb=picked.filter(p=>carb(p)===carb(r)).length;
        const overlap=picked.reduce((n,p)=>n+[...names(r)].filter(x=>names(p).has(x)&&x!==baseName(r)&&!/^salt|peppar|olja|kryddor/.test(x)).length,0);
        const remainingPool=available.filter(p=>p!==r).sort((a,b)=>a.price-b.price);
        const neededVeg=Math.max(0,vegNeeded-(r.protein==='vegetariskt'?1:0));
        const reserved=remainingPool.filter(p=>p.protein==='vegetariskt').slice(0,neededVeg);
        const cheapest=[...reserved,...remainingPool.filter(p=>!reserved.includes(p)).slice(0,left-1-reserved.length)];
        const remaining=cheapest.reduce((sum,p)=>sum+p.price*people,0);
        const over=Math.max(0,spent+r.price*people+remaining-budget);
        return {r,score:over*100+Math.abs(r.price-target)*.3+sameProtein*14+sameMain*80+sameCarb*15-Math.min(overlap,4)*3-preference(r)+random()*8};
      }).sort((a,b)=>a.score-b.score);
      const next=ranked[0].r;picked.push(next);available.splice(available.indexOf(next),1);
    }
    // Preserve the positions of locked cards.
    const positions=previous.slice(0,days).filter(r=>locks.has(r.name));
    const queue=picked.filter(r=>!positions.includes(r));
    return Array.from({length:days},(_,i)=>previous[i]&&locks.has(previous[i].name)?previous[i]:queue.shift());
  }
  function packageCost(amount,unit,product){
    const normalize=(n,u)=>({g:['weight',n],kg:['weight',n*1000],ml:['volume',n],dl:['volume',n*100],l:['volume',n*1000],st:['count',n]})[u];
    const needed=normalize(amount,unit),pack=normalize(Number(product.amount),String(product.unit||'').toLowerCase());
    if(!needed||!pack||needed[0]!==pack[0]||!(pack[1]>0)||!Number.isFinite(product.price))return null;
    return {used:product.price*needed[1]/pack[1],checkout:product.price*Math.ceil(needed[1]/pack[1]),packs:Math.ceil(needed[1]/pack[1])};
  }
  function minutes(time){const values=String(time).match(/\d+/g);return values?Math.max(...values.map(Number)):Infinity;}
  function portions(dinnerPeople,lunchboxes=0){return {dinnerPeople:Number(dinnerPeople),lunchboxes:Number(lunchboxes),people:Number(dinnerPeople)+Number(lunchboxes)};}
  const api={choose,packageCost,baseName,minutes,portions};root.SoppaCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
