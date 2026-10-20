export function setupPropertiesPanel(){
  const panel=document.querySelector('.right-panel'),layout=document.querySelector('.layout'),key='facade-studio-properties-ui-v1';
  let saved={};try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))saved=parsed}catch{}
  const collapsed=Array.isArray(saved.collapsed)?saved.collapsed:[];
  const store=()=>{try{localStorage.setItem(key,JSON.stringify({hidden:panel.hidden,collapsed:[...panel.querySelectorAll('.property-section-toggle')].map((button,i)=>button.getAttribute('aria-expanded')==='false'?i:null).filter(i=>i!==null)}))}catch{}};
  panel.id='properties-panel';
  const toggle=document.createElement('button');toggle.id='toggle-properties';toggle.type='button';toggle.setAttribute('aria-controls',panel.id);document.querySelector('.toolbar-end').append(toggle);
  const setVisible=visible=>{panel.hidden=!visible;layout.classList.toggle('properties-hidden',!visible);toggle.classList.toggle('active',visible);toggle.setAttribute('aria-expanded',String(visible));toggle.textContent=visible?'Properties ▸':'Properties ◂';toggle.title=visible?'Hide Properties panel':'Show Properties panel';store()};
  toggle.onclick=()=>setVisible(panel.hidden);
  const close=document.createElement('button');close.type='button';close.className='close-properties';close.textContent='×';close.title='Hide Properties panel';close.setAttribute('aria-label','Hide Properties panel');close.onclick=()=>setVisible(false);panel.querySelector('.panel-heading').append(close);
  panel.querySelectorAll('#inspector > section').forEach((section,i)=>{
    const title=section.querySelector('.section-title');if(!title)return;
    const button=document.createElement('button');button.type='button';button.className='section-title property-section-toggle';
    const number=document.createElement('span');number.textContent=title.querySelector('span')?.textContent||'';
    const label=document.createElement('span');label.className='property-section-name';label.textContent=title.querySelector('h2')?.textContent||'';
    const caret=document.createElement('span');caret.className='property-caret';caret.textContent='⌄';caret.setAttribute('aria-hidden','true');button.append(number,label,caret);
    const body=document.createElement('div');body.className='property-section-body';body.id='property-section-'+i;button.setAttribute('aria-controls',body.id);
    title.replaceWith(button);for(const child of [...section.childNodes])if(child!==button)body.append(child);section.append(body);
    function expand(value){body.hidden=!value;button.setAttribute('aria-expanded',String(value));section.classList.toggle('property-collapsed',!value)}
    expand(!collapsed.includes(i));button.onclick=()=>{expand(body.hidden);store()};
  });
  setVisible(saved.hidden!==true);
}
