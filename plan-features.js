/* Persistent plans, locks, cooking mode and a grouped shopping list. */
(() => {
  const KEY='soppatorsk-plan-v1';let state={version:1,locks:[],checks:[],shopping:false,view:{mode:'weekly',step:0}},storageOK=true;
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.version===1)state={...state,...saved};}catch{}
  const locks=new Set(Array.isArray(state.locks)?state.locks:[]),checks=new Set(Array.isArray(state.checks)?state.checks:[]);
  let shoppingActive=!!state.shopping,priceRun=0,cookIndex=0;
  const note=document.createElement('p');note.className='save-note';note.setAttribute('role','status');document.querySelector('header').after(note);note.hidden=true;
  const byName=new Map(recipes.map(r=>[r.name,r]));
  const fieldIds=['budget','days','people','vegetarian-min','mustiga-budget','mustiga-people','mustiga-search','store-place'];
  function persist(){
    state={...state,version:1,locks:[...locks],checks:[...checks],shopping:shoppingActive,menu:current.map(r=>r.name),config:lastConfig,fields:Object.fromEntries(fieldIds.map(id=>[id,document.getElementById(id).value])),protein:[...selected],carbs:[...selectedCarbs],singleProtein:[...mustigaSelected],singleCarbs:[...mustigaSelectedCarbs]};
    try{localStorage.setItem(KEY,JSON.stringify(state));note.hidden=true;}catch{storageOK=false;note.textContent='Din webbläsare kunde inte spara planeringen. Den finns kvar så länge sidan är öppen.';note.hidden=false;}
  }
  window.soppaSession={get view(){return state.view;},get hasPlan(){return current.length>0||!!state.single?.length;},setView(view){state.view=view;persist();}};
  document.addEventListener('change',persist);
  document.addEventListener('click',event=>{if(event.target.closest('.chip'))queueMicrotask(persist);});
  // Filters inspect recipe text, not manufacturers' allergen declarations.
  avoidChoices.skaldjur.push('kräft','krabb','hummer','mussl','ostron','scampi');
  avoidChoices.laktos.push('mjölk','smör','ricotta','mozzarella','cheddar','chèvre');
  avoidChoices.gluten.push('soja','vetemjöl','tunnbröd');
  for(const id of ['exclude-options','mustiga-exclude-options']){
    const p=document.createElement('p');p.className='filter-note';p.textContent='Filtrerar ord i receptens namn och ingredienser. Det är ingen allergikontroll. Såser, buljong och andra sammansatta varor kan innehålla allergener. Kontrollera alltid förpackningarnas innehåll och spårmärkning.';document.getElementById(id).after(p);
  }
  const menuTools=document.createElement('div');menuTools.className='menu-tools';menuTools.innerHTML='<span id="lock-count"></span><button type="button" class="text-button" id="refresh-unlocked">Byt olåsta</button>';
  document.getElementById('menu').before(menuTools);
  menuTools.append(document.getElementById('share'));
  const planMessage=document.createElement('p');planMessage.className='plan-message';planMessage.setAttribute('role','status');menuTools.before(planMessage);
  const pricePanel=document.createElement('details');pricePanel.className='price-panel';pricePanel.innerHTML='<summary>Vad kostar det vid kassan?</summary><div class="price-breakdown"></div>';
  document.querySelector('#results .summary').after(pricePanel);
  const progress=document.createElement('div');progress.className='shopping-progress';progress.setAttribute('aria-live','polite');document.getElementById('shopping').before(progress);
  function category(name){
    if(/pulver|krydda|oregano|timjan|salt|peppar|buljong|olja|vinäger|honung|soja|pesto|puré|saffran|chili/.test(name))return 'Skafferi';
    if(/krossade|konserv|tomatsås|bönor|kikärt|majs/.test(name))return 'Skafferi';
    if(/lax|torsk|fisk|räk|kyckling|kött|färs|biff|fläsk|korv|kassler|högrev|bacon|entrecôte|salsiccia|chorizo|sej|kolja|havskatt|pulled/.test(name))return 'Kött & fisk';
    if(/grädde|mjölk|ost|smör|yoghurt|crème|halloumi|burrata|parmesan|ägg|chèvre/.test(name))return 'Mejeri & ägg';
    if(/potatis|lök|vitlök|citron|lime|broccoli|spenat|svamp|champinjon|paprika|morot|avokado|sallad|tomat|ärtor|zucchini|gurka|dill|persilja/.test(name))return 'Frukt & grönt';
    if(/bröd|tortilla/.test(name))return 'Bröd';return 'Skafferi';
  }
  function basketRows(){
    const sums=new Map();
    if(!lastConfig)return [];
    current.forEach(r=>r.ingredients.forEach(raw=>{
      const item=parsedIngredient(scaled(raw,lastConfig.people));item.name=item.name.trim().toLowerCase();
      const conversion={kg:[1000,'g'],dl:[100,'ml'],l:[1000,'ml']};if(conversion[item.unit]){item.amount*=conversion[item.unit][0];item.unit=conversion[item.unit][1];}
      const key=item.name+'|'+item.unit,prior=sums.get(key);if(prior&&item.unit)prior.amount+=item.amount;else if(!prior)sums.set(key,{...item,key});
    }));return [...sums.values()].map(item=>({...item,key:item.key+'|'+item.amount}));
  }
  function rowText(item){return item.unit?`${item.name} ${item.amount.toLocaleString('sv-SE',{maximumFractionDigits:1})} ${item.unit}`:item.name;}
  function updateProgress(){const boxes=[...document.querySelectorAll('#shopping input')],done=boxes.filter(b=>b.checked).length;progress.textContent=boxes.length?`${done} av ${boxes.length} varor klara${done===boxes.length?' · Allt i korgen!':''}`:'Lägg till veckans varor för att börja handla.';}
  function drawShopping(){
    const list=document.getElementById('shopping');list.replaceChildren();
    if(!shoppingActive){updateProgress();return;}
    const rows=basketRows().filter(item=>!pantryItems.has(item.name));
    for(const group of ['Frukt & grönt','Kött & fisk','Mejeri & ägg','Bröd','Skafferi']){
      const items=rows.filter(item=>category(item.name)===group).sort((a,b)=>a.name.localeCompare(b.name,'sv'));
      if(!items.length)continue;
      const section=document.createElement('li');section.className='shopping-department';const title=document.createElement('h3');title.textContent=group;const ul=document.createElement('ul');section.append(title,ul);list.append(section);
      items.forEach(item=>{const li=document.createElement('li');li.dataset.item=item.key;const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.checked=checks.has(item.key);box.setAttribute('aria-label',rowText(item));text.textContent=rowText(item);label.append(box,text);li.append(label);ul.append(li);box.onchange=()=>{box.checked?checks.add(item.key):checks.delete(item.key);updateProgress();persist();};});
    }
    document.getElementById('add-all').hidden=true;document.getElementById('list-intro').hidden=true;document.getElementById('reset-checks').hidden=false;document.querySelector('.list-actions').hidden=false;updateProgress();
  }
  async function refreshPrices(){
    const run=++priceRun,rows=basketRows();const panel=pricePanel.querySelector('.price-breakdown');
    const estimate=current.reduce((sum,r)=>sum+r.price*lastConfig.people,0);
    document.getElementById('cost-label').textContent='UPPSKATTAD RECEPTKOSTNAD';
    panel.textContent='Receptkostnaden uppskattar maten som används. Vid kassan betalar du för hela förpackningar. Utan matchade butikspriser kan vi inte beräkna kassakostnaden.';
    if(!selectedStore||!rows.length)return;
    panel.textContent='Matchar hela förpackningar i din butik…';
    const storeKey=selectedStore.key||`${selectedStore.chain}:${selectedStore.store_id}`;
    const priced=await Promise.all(rows.map(async item=>{try{const product=await resolveIndexedPrice(rowText(item),storeKey);return {item,product,cost:product?SoppaCore.packageCost(item.amount,item.unit,product):null};}catch{return {item,product:null,cost:null};}}));
    if(run!==priceRun)return;
    const matched=priced.filter(x=>x.cost),used=matched.reduce((n,x)=>n+x.cost.used,0),checkout=matched.reduce((n,x)=>n+x.cost.checkout,0);
    panel.replaceChildren();const intro=document.createElement('p');intro.textContent=`${matched.length} av ${rows.length} ingredienser har pris och jämförbar förpackningsstorlek hos ${selectedStore.name}.`;panel.append(intro);
    const numbers=document.createElement('p');numbers.textContent=matched.length?`Matchad del: ${kronor(used)} för mängden som används · ${kronor(checkout)} för hela förpackningar.`:'Kassakostnaden är okänd tills varor och förpackningsstorlekar kan matchas.';panel.append(numbers);
    const caveat=document.createElement('p');caveat.textContent=matched.length===rows.length?'Beräknad korg, inte ett garanterat kassapris. Utgår från att du köper allt från början.':'Detta är en delsumma, inte hela kassakostnaden. Övriga varor saknar verifierat pris eller jämförbar mängd. Receptkostnaden ovan är fortfarande en uppskattning.';panel.append(caveat);
    document.getElementById('price-attribution').hidden=false;
    priced.forEach(({item,product,cost})=>{const li=[...document.querySelectorAll('#shopping [data-item]')].find(el=>el.dataset.item===item.key);if(!li)return;li.querySelector('.item-price')?.remove();const detail=document.createElement('small');detail.className='item-price';detail.textContent=cost?`${cost.packs} förp. · ca ${kronor(cost.checkout)} · ${product.name}${product.package?' ('+product.package+')':''}`:'Förpackningspris saknas';li.append(detail);});
  }
  // Use one current basket calculation instead of the legacy per-recipe price labels.
  updateIndexedPrices=refreshPrices;hydrateShoppingPrices=refreshPrices;
  const originalRender=renderMenu;
  renderMenu=function(){
    originalRender();
    const total=current.reduce((sum,r)=>sum+r.price*lastConfig.people,0),remaining=lastConfig.budget-total;
    document.getElementById('cost-label').textContent='UPPSKATTAD RECEPTKOSTNAD';
    document.querySelector('.remaining .eyebrow').textContent=remaining<0?'ÖVER BUDGET':'KVAR AV BUDGET';document.getElementById('remaining').textContent=kronor(Math.abs(remaining));
    document.querySelectorAll('#menu .meal').forEach((el,index)=>{const recipe=current[index],locked=locks.has(recipe.name),button=document.createElement('button');button.type='button';button.className='lock-meal';button.textContent=locked?'🔒 Låst':'Lås';button.setAttribute('aria-pressed',String(locked));button.setAttribute('aria-label',`${locked?'Lås upp':'Lås'} ${recipe.name}`);button.onclick=()=>{locked?locks.delete(recipe.name):locks.add(recipe.name);const scroll=document.getElementById('menu').scrollLeft;renderMenu();document.getElementById('menu').scrollLeft=scroll;};el.append(button);el.classList.toggle('is-locked',locked);el.querySelector('.swap-icon').disabled=locked;});
    document.getElementById('lock-count').textContent=`${current.filter(r=>locks.has(r.name)).length} av ${current.length} låsta`;
    planMessage.textContent='';
    drawShopping();persist();
  };
  generateEnhanced=async function(){
    const config={budget:Number(document.getElementById('budget').value),days:Number(document.getElementById('days').value),people:Number(document.getElementById('people').value)};
    const pool=selectedRecipes().filter(recipeAllowed);
    await loadStoreDeals();primeRecipeDeals(pool);
    const next=SoppaCore.choose({pool,previous:current,locks,days:config.days,people:config.people,budget:config.budget,vegetarian:Number(document.getElementById('vegetarian-min').value),preference:r=>Math.min(recipeDeals.get(r.name)?.count||0,3)*3+(favorites.has(r.name)?2:0)-(current.some(old=>old.name===r.name)?12:0)});
    lastConfig=config;current=next;renderMenu();void refreshPrices();
  };
  document.getElementById('refresh-unlocked').onclick=async()=>{try{await generateEnhanced();}catch(error){planMessage.textContent=error.message;}};
  swapMealAt=function(index){
    if(locks.has(current[index].name))return;
    const tempLocks=new Set(current.filter((_,i)=>i!==index).map(r=>r.name));
    try{const pool=selectedRecipes().filter(recipeAllowed).filter(r=>r.name!==current[index].name);current=SoppaCore.choose({pool,previous:current,locks:tempLocks,days:current.length,people:lastConfig.people,budget:lastConfig.budget,vegetarian:Number(document.getElementById('vegetarian-min').value)});renderMenu();void refreshPrices();}catch(error){planMessage.textContent=error.message;}
  };
  document.getElementById('add-all').removeEventListener('click',addAll);document.getElementById('add-all').removeEventListener('click',addAllEnhanced);
  addAllEnhanced=function(){shoppingActive=true;drawShopping();persist();void refreshPrices();};
  document.getElementById('add-all').addEventListener('click',addAllEnhanced);
  // Replace legacy reset/share listeners: rows now live under departments.
  for(const id of ['reset-checks','share-list']){const el=document.getElementById(id),copy=el.cloneNode(true);el.replaceWith(copy);}
  document.getElementById('reset-checks').textContent='Börja om med kryssen';document.getElementById('reset-checks').onclick=()=>{checks.clear();drawShopping();persist();};
  document.getElementById('share-list').onclick=async()=>{const text='SoppaTorsk – inköpslista\n'+basketRows().filter(x=>!pantryItems.has(x.name)).map(x=>`${checks.has(x.key)?'✓':'☐'} ${rowText(x)}`).join('\n');try{if(navigator.share)await navigator.share({title:'SoppaTorsk',text});else await navigator.clipboard.writeText(text);}catch{}};
  const oldRecipe=showDetailedRecipe;
  hydrateRecipePrices=async function(recipe,people){
    const note=document.getElementById('recipe-price-note');if(!note||!selectedStore)return;
    const storeKey=selectedStore.key||`${selectedStore.chain}:${selectedStore.store_id}`;
    const priced=await Promise.all(recipe.ingredients.map(async raw=>{const item=parsedIngredient(scaled(raw,people));try{const product=await resolveIndexedPrice(raw,storeKey);return {product,cost:product?SoppaCore.packageCost(item.amount,item.unit,product):null};}catch{return {product:null,cost:null};}}));
    if(activeRecipe!==recipe||!note.isConnected)return;
    note.textContent='Priserna nedan gäller hela förpackningar i din butik. Rader utan jämförbar mängd saknar beräkning.';
    document.querySelectorAll('[data-recipe-ingredient]').forEach((row,index)=>{row.querySelector('.recipe-ingredient-price')?.remove();const {product,cost}=priced[index],small=document.createElement('small');small.className='recipe-ingredient-price';small.textContent=cost?`${kronor(cost.used)} för använd mängd · ${cost.packs} förp. kostar ca ${kronor(cost.checkout)} · ${product.name}`:'Förpackningskostnad kan inte beräknas';row.append(small);});
  };
  showDetailedRecipe=function(recipe,people,source='weekly'){
    oldRecipe(recipe,people,source);
    const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='Börja laga · steg för steg';button.onclick=()=>{cookIndex=0;drawCooking(recipe,people);};document.querySelector('#recipe-content .recipe-meta').after(button);
    const swap=document.getElementById('swap-meal');if(locks.has(recipe.name)&&source==='weekly'){swap.disabled=true;swap.textContent='Middagen är låst – lås upp i veckomenyn';}
  };
  function drawCooking(recipe,people,ingredients=false){
    const content=document.getElementById('recipe-content');content.replaceChildren();const title=document.createElement('h2');title.textContent=recipe.name;content.append(title);
    const meta=document.createElement('p');meta.className='recipe-meta';meta.textContent=`För ${people} personer · ${ingredients?'Ingredienser':`Steg ${cookIndex+1} av ${recipe.steps.length}`}`;content.append(meta);
    const tabs=document.createElement('div');tabs.className='cooking-tabs';const toggle=document.createElement('button');toggle.type='button';toggle.className='secondary';toggle.textContent=ingredients?'Tillbaka till steget':'Visa ingredienser';toggle.onclick=()=>drawCooking(recipe,people,!ingredients);tabs.append(toggle);content.append(tabs);
    if(ingredients){const ul=document.createElement('ul');recipe.ingredients.forEach(raw=>{const li=document.createElement('li');li.textContent=scaled(raw,people);ul.append(li);});content.append(ul);}else{
      const instruction=document.createElement('p');instruction.className='cooking-instruction';instruction.tabIndex=-1;instruction.textContent=scaledStep(recipe.steps[cookIndex],people);content.append(instruction);
      const nav=document.createElement('div');nav.className='cooking-nav';const prev=document.createElement('button'),next=document.createElement('button');prev.type=next.type='button';prev.className='secondary';next.className='primary';prev.textContent='Föregående';prev.disabled=cookIndex===0;next.textContent=cookIndex===recipe.steps.length-1?'Klart – smaklig måltid!':'Nästa steg';prev.onclick=()=>{cookIndex--;drawCooking(recipe,people);};next.onclick=()=>{if(cookIndex===recipe.steps.length-1){document.getElementById('recipe-dialog').close();return;}cookIndex++;drawCooking(recipe,people);};nav.append(prev,next);content.append(nav);instruction.focus({preventScroll:true});
    }
    document.getElementById('recipe-dialog').scrollTop=0;
  }
  const oldSingle=findMustigaRecipe;
  findMustigaRecipe=async function(){await oldSingle();state.single=[...document.querySelectorAll('#mustiga-result h3')].map(el=>el.textContent);state.singlePeople=Number(document.getElementById('mustiga-people').value);persist();};
  document.getElementById('mustiga-new').removeEventListener('click',oldSingle);
  document.getElementById('mustiga-new').addEventListener('click',findMustigaRecipe);
  // Restore only known recipe IDs; never trust saved markup or recipe instructions.
  if(state.fields)fieldIds.forEach(id=>{if(typeof state.fields[id]==='string')document.getElementById(id).value=state.fields[id];});
  if(Array.isArray(state.protein))selected=new Set(state.protein.filter(x=>proteins.includes(x)));
  if(Array.isArray(state.carbs))selectedCarbs=new Set(state.carbs.filter(x=>carbohydrates.includes(x)));
  if(Array.isArray(state.singleProtein))mustigaSelected=new Set(state.singleProtein.filter(x=>proteins.includes(x)));
  if(Array.isArray(state.singleCarbs))mustigaSelectedCarbs=new Set(state.singleCarbs.filter(x=>carbohydrates.includes(x)));
  renderProtein();renderCarbs();renderMustigaProtein();renderMustigaCarbs();
  if(state.config&&Number.isFinite(state.config.people)&&state.config.people>0&&Number.isFinite(state.config.budget)&&Array.isArray(state.menu)){
    current=state.menu.map(name=>byName.get(name)).filter(Boolean);lastConfig=state.config;if(current.length){renderMenu();void refreshPrices();}
  }
  if(Array.isArray(state.single)){
    const target=document.getElementById('mustiga-result');target.replaceChildren();state.single.forEach(name=>{const r=byName.get(name);if(!r)return;const button=document.createElement('button'),icon=document.createElement('div'),text=document.createElement('div'),title=document.createElement('h3'),meta=document.createElement('p');button.type='button';button.className='mustiga-recipe';icon.className='meal-icon';icon.textContent=r.icon;title.textContent=r.name;meta.textContent=`ca ${kronor(r.price*(state.singlePeople||2))} för ${state.singlePeople||2} personer · ${r.time}`;text.append(title,meta);button.append(icon,text);button.onclick=()=>showDetailedRecipe(r,state.singlePeople||2,'mustiga');target.append(button);});
  }
})();
