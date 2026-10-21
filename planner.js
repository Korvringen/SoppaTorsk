/* A screen-based planning flow; existing recipe and store logic stays in app.js. */
(() => {
  const main = document.querySelector('main');
  const shell = document.createElement('section');
  shell.className = 'planner';
  shell.innerHTML = `<nav class="step-track" aria-label="Planeringens steg"><span>1 Butik</span><span>2 Matval</span><span>3 Förslag</span></nav><div class="screen-heading"><p class="eyebrow" id="screen-kicker"></p><h2 id="screen-title" tabindex="-1"></h2><p id="screen-description"></p></div><div class="screen-content"></div><footer class="planner-actions"><button type="button" class="secondary" id="planner-back">Tillbaka</button><button type="button" class="primary" id="planner-next">Nästa</button></footer><p class="planner-error" role="alert" hidden></p>`;
  main.append(shell);
  const content = shell.querySelector('.screen-content');
  const screens = Array.from({length:5}, () => {const el=document.createElement('div');el.className='planner-screen';content.append(el);return el;});
  const favoriteView=document.getElementById('favorites-view');favoriteView.hidden=false;screens[4].append(favoriteView);
  const move = (selector, target) => document.querySelectorAll(selector).forEach(el=>target.append(el));
  move('.store-choice',screens[0]);
  move('#weekly-tab, #mustiga-tab',document.querySelector('.mode-tabs'));
  screens[1].append(document.querySelector('.mode-tabs'));
  const weekly = document.createElement('div'), single = document.createElement('div');
  screens[1].append(weekly,single);
  move('.fields, .planning-extras',weekly);
  // Fieldsets are selected explicitly because the store fieldset precedes protein.
  weekly.append(document.querySelector('#protein-options').closest('fieldset'));
  move('.mustiga-fields, .single-time',single);
  single.append(document.querySelector('#mustiga-protein-options').closest('fieldset'));
  const extras = document.createElement('details');extras.className='food-extras';extras.innerHTML='<summary>Fler matval och önskemål</summary>';screens[1].append(extras);
  const weeklyExtras=document.createElement('div'),singleExtras=document.createElement('div');extras.append(weeklyExtras,singleExtras);
  move('.settings > .protein-choice, .veg-minimum, #prefer-deals',weeklyExtras);
  // Keep the complete checkbox label, including its accessible name.
  const deal=document.querySelector('#prefer-deals');const dealLabel=document.querySelector('.settings .deal-preference');dealLabel.prepend(deal);screens[0].append(dealLabel);
  move('.mustiga-settings > .protein-choice, .mustiga-search',singleExtras);
  const results=document.querySelector('#results');screens[2].append(results);
  const shopping=document.querySelector('#shopping').closest('section');screens[3].append(shopping);
  screens[2].append(document.querySelector('#mustiga-results'));
  const resultTabs=document.createElement('nav');resultTabs.className='result-tabs';resultTabs.setAttribute('aria-label','Visa resultat');resultTabs.innerHTML='<button type="button" data-result="2">Middagar</button><button type="button" data-result="3">Inköpslista</button>';shell.insertBefore(resultTabs,content);
  document.querySelector('.welcome').hidden=true;
  document.querySelector('#weekly-view').hidden=true;document.querySelector('#mustiga-view').hidden=true;
  const session=window.soppaSession,restored=session?.hasPlan?session.view:null;
  let step=restored&&[0,1,2,3,4].includes(restored.step)?restored.step:0,mode=restored?.mode==='mustiga'?'mustiga':'weekly',busy=false,returnStep=step===4?1:step;
  const headings=[['STEG 1 AV 3','Först, din butik.','Vi letar efter guldkornen där du handlar.'],['STEG 2 AV 3','Vad blir det för gott?','Din budget. Dina favoriter. Vi fixar resten.'],['STEG 3 AV 3','Veckan är serverad!','Svep bland middagarna. Tryck för receptet.'],['STEG 3 AV 3','Redo för butiken.','Allt du behöver, samlat på ett ställe.']];
  headings.push(['DINA FAVORITER','Det godaste, sparat.','Lägg en favorit i veckan eller öppna receptet.']);
  document.addEventListener('soppa:screen',event=>{if(busy)return;const target=event.detail;if(![2,4].includes(target))return;if(target===4)returnStep=step;else mode='weekly';step=target;render();});
  function render(focus=true){
    shell.dataset.step=String(step);shell.classList.toggle('is-busy',busy);
    screens.forEach((el,i)=>el.hidden=i!==step);
    weekly.hidden=weeklyExtras.hidden=mode!=='weekly';single.hidden=singleExtras.hidden=mode==='weekly';
    results.hidden=step!==2||mode!=='weekly';document.querySelector('#mustiga-results').hidden=step!==2||mode==='weekly';
    shell.querySelector('#screen-kicker').textContent=busy?'ETT ÖGONBLICK, VI DUKAR FRAM…':headings[step][0];shell.querySelector('#screen-title').textContent=headings[step][1];shell.querySelector('#screen-description').textContent=headings[step][2];
    if(step===2&&mode==='mustiga')shell.querySelector('#screen-title').textContent='Maten är serverad!';
    shell.querySelectorAll('.step-track span').forEach((el,i)=>{el.classList.toggle('active',i===Math.min(step,2));if(i===Math.min(step,2))el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    shell.querySelector('.step-track').hidden=step===4;
    resultTabs.hidden=step<2||step===4||mode!=='weekly';resultTabs.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.result)===step)));
    const back=shell.querySelector('#planner-back'),next=shell.querySelector('#planner-next');back.hidden=step===0;back.disabled=next.disabled=busy;
    back.textContent=step>=2?'Ändra matval':'Tillbaka';next.textContent=busy?'Tar fram förslag…':step===0?'Nu väljer vi maten':step===1?'Duka fram förslagen':step===2&&mode==='weekly'?'Till inköpslistan':'Ny planering';
    next.setAttribute('aria-label',next.textContent);
    if(step===4){back.hidden=true;next.textContent='Tillbaka till planeringen';next.setAttribute('aria-label',next.textContent);}
    session?.setView({step,mode});
    content.scrollTop=0;if(focus)shell.querySelector('#screen-title').focus({preventScroll:true});
  }
  // Replace the former page-switching handlers with state changes inside the flow.
  for(const [id,value] of [['weekly-tab','weekly'],['mustiga-tab','mustiga']]){const original=document.getElementById(id),button=original.cloneNode(true);original.replaceWith(button);button.addEventListener('click',()=>{mode=value;document.querySelectorAll('.mode-tab').forEach(el=>{const active=el.id===id;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});render(false);});}
  shell.querySelector('#planner-back').onclick=()=>{step=step>=2?1:0;render();};
  shell.querySelector('#planner-next').onclick=async()=>{
    if(busy)return;
    if(step===4){step=returnStep;render();return;}
    if(step===1){const input=document.querySelector(mode==='weekly'?'#budget':'#mustiga-budget');if(!input.reportValidity())return;busy=true;render(false);const error=shell.querySelector('.planner-error');error.hidden=true;try{if(mode==='weekly')await generateEnhanced();else await findMustigaRecipe();step=2;}catch(e){error.textContent=e.message||'Det gick inte att ta fram middagar. Försök igen.';error.hidden=false;}finally{busy=false;render();}return;}
    step=step===0?1:step===2&&mode==='weekly'?3:0;render();
  };
  resultTabs.onclick=event=>{const button=event.target.closest('[data-result]');if(button){step=Number(button.dataset.result);render();}};
  document.querySelector('#mustiga-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();shell.querySelector('#planner-next').click();}},true);
  document.querySelectorAll('.mode-tab').forEach(el=>{const active=(el.id==='weekly-tab')===(mode==='weekly');el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});
  render(false);
})();
