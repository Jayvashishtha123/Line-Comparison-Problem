let currentPage=1;
let pageSize=10;
let grouped=true;
let currentQuery='';
let currentFilters={};
let currentSortKey='';
let currentSortDirection='asc';
let statusChart=null;
let categoryChart=null;
let portfolioMetricsChart=null;
let deadlineProximityChart=null;
let statusDialogProjectId='';
let currentAuditProjectId=null;
let currentEditWizardStep=1;
window.lastTotalPages=1;
let isSyncingScroll=false;

const CURRENT_YEAR=Number(window.CURRENT_YEAR||new Date().getFullYear());
const NEXT_YEAR=Number(window.NEXT_YEAR||(CURRENT_YEAR+1));

function budgetFieldKey(year){
  return `budget_${year}_flag`;
}

function benefitsFieldKey(year){
  return `benefits_plan_${year}`;
}

const BLANK_TOKEN='__BLANK__';
const dashboardEl=document.getElementById('dashboard');
const search=document.getElementById('globalSearch');
const suggestionsEl=document.getElementById('suggestions');
const searchWrapEl=document.querySelector('.search-wrap');
const mInitiativeInput=document.getElementById('mInitiativeInput');
const mInitiativeSuggestions=document.getElementById('mInitiativeSuggestions');
const mProjectInput=document.getElementById('mProjectInput');
const mProjectNameSuggestions=document.getElementById('mProjectNameSuggestions');
const clearFiltersBtn=document.getElementById('clearFilters');
const exportCsvBtn=document.getElementById('exportCsv');
const importExcelBtn=document.getElementById('importExcel');
const importFileInput=document.getElementById('importFileInput');
const columnChooserBtn=document.getElementById('columnChooserBtn');
const columnChooserMenu=document.getElementById('columnChooserMenu');
const columnChooserCount=document.getElementById('columnChooserCount');
let lastFailedExportFileBase64='';
let lastFailedExportFileName='';
const DASHBOARD_COLUMN_STORAGE_KEY='dashboard.optionalColumns';
const DEFAULT_OPTIONAL_COLUMN_KEYS=[];
const DEFAULT_DASHBOARD_COLUMN_KEYS=['project_name','project_status_display','description','budget','end_date','technology','project_otd_phase','actions'];
let selectedOptionalColumnKeys=loadSelectedOptionalColumnKeys();
let pendingOptionalColumnKeys=[];

function escapeHtml(value){
  return String(value??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function normalizePicklistValues(value){
  if(Array.isArray(value)) return value.map(item=>String(item).trim()).filter(Boolean);
  return String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
}

function initMultiPicklist(root){
  if(!root) return null;
  const hidden=root.querySelector('input[type="hidden"]');
  const chips=root.querySelector('.multi-picklist-chips');
  const input=root.querySelector('.multi-picklist-input');
  const toggle=root.querySelector('.multi-picklist-toggle');
  const menu=root.querySelector('.multi-picklist-menu');
  const placeholder=root.dataset.placeholder||'Click to add more teams...';
  let selected=new Set();

  function syncHidden(){
    if(hidden) hidden.value=Array.from(selected).join(', ');
  }

  function renderMenu(filterText=''){
    const query=filterText.trim().toLowerCase();
    menu?.querySelectorAll('button[data-value]').forEach(button=>{
      const value=button.dataset.value||'';
      const label=(button.textContent||'').trim().toLowerCase();
      button.classList.toggle('is-selected', selected.has(value));
      button.hidden=!!query && !label.includes(query);
    });
  }

  function renderChips(){
    if(!chips) return;
    chips.innerHTML='';
    if(!selected.size){
      chips.innerHTML=`<span class="multi-picklist-empty">${placeholder}</span>`;
      if(input) input.value='';
      syncHidden();
      renderMenu(input ? input.value : '');
      return;
    }
    selected.forEach(value=>{
      const chip=document.createElement('span');
      chip.className='multi-picklist-chip';
      chip.innerHTML=`<span>${escapeHtml(value)}</span><button type="button" aria-label="Remove ${escapeHtml(value)}">&times;</button>`;
      chip.querySelector('button')?.addEventListener('click', ()=>{
        selected.delete(value);
        renderChips();
      });
      chips.appendChild(chip);
    });
    syncHidden();
    renderMenu(input ? input.value : '');
  }

  function openMenu(){
    root.classList.add('is-open');
    renderMenu(input ? input.value : '');
  }

  function closeMenu(){
    root.classList.remove('is-open');
    if(input) input.value='';
    renderMenu('');
  }

  function toggleValue(value){
    const normalized=String(value||'').trim();
    if(!normalized) return;
    if(selected.has(normalized)) selected.delete(normalized);
    else selected.add(normalized);
    renderChips();
  }

  root.querySelectorAll('button[data-value]').forEach(button=>{
    button.addEventListener('click', ()=>{
      toggleValue(button.dataset.value);
      input?.focus();
      openMenu();
    });
  });

  input?.addEventListener('focus', openMenu);
  input?.addEventListener('input', ()=>{ openMenu(); renderMenu(input.value); });
  input?.addEventListener('keydown', event=>{
    if(event.key==='Backspace' && !input.value && selected.size){
      const last=Array.from(selected).pop();
      if(last) selected.delete(last);
      renderChips();
    }
  });
  toggle?.addEventListener('click', ()=>{
    if(root.classList.contains('is-open')) closeMenu();
    else openMenu();
    input?.focus();
  });

  const onDocumentClick=(event)=>{ if(!root.contains(event.target)) closeMenu(); };
  document.addEventListener('click', onDocumentClick);

  root.setValues = (value) => {
    selected=new Set(normalizePicklistValues(value));
    renderChips();
  };
  root.getValues = () => Array.from(selected);
  renderChips();
  closeMenu();
  return root;
}

async function loadDashboard(){
  const params=new URLSearchParams({
    q:currentQuery,
    page:currentPage,
    page_size:pageSize,
    grouped:String(grouped),
    filters:JSON.stringify(currentFilters),
    sort_key:currentSortKey,
    sort_dir:currentSortDirection
  });
  const res=await fetch('/project/api/dashboard?'+params.toString());
  const data=await res.json();
  renderDashboard(data);
  renderCharts(data);
}

function hasActiveFilters(){
  const hasSearch=Boolean((currentQuery||'').trim());
  const hasColumnFilters=Object.keys(currentFilters||{}).some(key=>{
    const val=currentFilters[key];
    return Array.isArray(val) ? val.length>0 : Boolean(val);
  });
  return hasSearch || hasColumnFilters;
}

function updateClearFiltersVisibility(){
  if(!clearFiltersBtn) return;
  clearFiltersBtn.classList.toggle('hidden', !hasActiveFilters());
}

function clearAllFilters(){
  currentFilters={};
  currentQuery='';
  currentPage=1;
  if(search) search.value='';
  hideSuggestions();
  updateClearFiltersVisibility();
  loadDashboard();
}

function loadSelectedOptionalColumnKeys(){
  try{
    const raw=window.localStorage.getItem(DASHBOARD_COLUMN_STORAGE_KEY);
    if(raw===null) return [...DEFAULT_OPTIONAL_COLUMN_KEYS];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed.filter(Boolean):[...DEFAULT_OPTIONAL_COLUMN_KEYS];
  }catch(e){
    return [...DEFAULT_OPTIONAL_COLUMN_KEYS];
  }
}

function saveSelectedOptionalColumnKeys(){
  try{
    window.localStorage.setItem(DASHBOARD_COLUMN_STORAGE_KEY, JSON.stringify(selectedOptionalColumnKeys));
  }catch(e){
    // Ignore storage failures.
  }
}

function columnCssClass(key){
  return `col-${String(key||'').replace(/_/g,'-')}`;
}

function stickyColumnClass(key){
  if(key==='project_name') return 'sticky-col sticky-col-left';
  if(key==='actions') return 'sticky-col sticky-col-right';
  return '';
}

function renderProjectNameCell(project){
  const name=escapeHtml(displayText(project.project_name,''));
  const projectId=escapeHtml(displayText(project.project_id,''));
  return `<div class='project-cell-main'>${name}</div>${projectId?`<div class='project-cell-sub'>${projectId}</div>`:''}`;
}

function renderEndDateCell(project){
  const adjusted=cleanDate(project.adjusted_end_date);
  const estimated=cleanDate(project.estd_end_date);
  if(adjusted) return `<div>${escapeHtml(adjusted)}</div>${estimated?`<div class='muted'><span class='date-label'>Est:</span> ${escapeHtml(estimated)}</div>`:''}`;
  return estimated?`<div>${escapeHtml(estimated)}</div>`:'<div class="muted">—</div>';
}

function renderAuditCell(audit){
  const details=(audit.entries||[]).map(x=>escapeHtml(x)).join('<br/>');
  return `${details}${audit.has_view_all?"<br/><button class='view-audit'>View All</button>":''}`;
}

function renderActionCell(){
  const viewBtn=`<button class='view-btn row-action-btn' title='View Project' aria-label='View Project'><span aria-hidden='true'>&#128065;</span></button>`;
  const updateBtn=`<button class='update-btn row-action-btn' title='Update Project' aria-label='Update Project'><span aria-hidden='true'>&#9998;</span></button>`;
  const deleteBtn=window.IS_ADMIN?`<button class='delete-btn row-action-btn' title='Delete Project' aria-label='Delete Project'><span aria-hidden='true'>&#128465;</span></button>`:'';
  return `${viewBtn}${updateBtn}${deleteBtn}`;
}

function getDashboardColumnDefinitions(){
  const currentBudgetField=budgetFieldKey(CURRENT_YEAR);
  const currentBenefitsField=benefitsFieldKey(CURRENT_YEAR);
  return [
    {key:'project_name', header:'Project', defaultVisible:true, locked:true, chooser:true, filterable:false, render:(project)=>renderProjectNameCell(project)},
    {key:'project_status_display', header:'Status', defaultVisible:true, lockedDefault:true, chooser:true, filterKey:'project_status_display', optionKey:'project_status_display', render:(project)=>{
      const status=displayText(project.project_status_display,'NA').toString();
      return `<span class='status-pill status-${escapeHtml(status)}'>${escapeHtml(status||'NA')}</span>`;
    }},
    {key:'description', header:'Description', defaultVisible:true, lockedDefault:true, chooser:true, filterable:false, render:(project)=>truncate(project.description||'')},
    {key:'budget', header:'Budget', defaultVisible:true, lockedDefault:true, chooser:true, filterable:false, render:(project)=>escapeHtml(displayText(project.budget,''))},
    {key:'end_date', header:'End Date', defaultVisible:true, lockedDefault:true, chooser:true, filterable:false, render:(project)=>renderEndDateCell(project)},
    {key:'technology', header:'Technology', defaultVisible:true, lockedDefault:true, chooser:true, filterKey:'technology', optionKey:'technology', render:(project)=>escapeHtml(displayText(project.technology,''))},
    {key:'project_otd_phase', header:'Phase', defaultVisible:true, lockedDefault:true, chooser:true, filterKey:'project_otd_phase', optionKey:'project_otd_phase', render:(project)=>{
      const phase=displayText(project.project_otd_phase,'');
      return `<span class='phase-pill ${phaseCellClass(phase)}'>${escapeHtml(phase||'N/A')}</span>`;
    }},
    {key:'initiative_name', header:'Initiative', chooser:true, filterKey:'initiative_name', optionKey:'initiative_name', render:(project)=>escapeHtml(displayText(project.initiative_name,''))},
    {key:'dt_team_accountable', header:'DT Team Accountable', chooser:true, filterKey:'dt_team_accountable', optionKey:'dt_team_accountable', render:(project)=>{
      const dtTeam=displayText(project.dt_team_accountable,'');
      const leader=dtTeamLeader(dtTeam);
      return `<div class='dt-team-name'>${escapeHtml(dtTeam)}</div>${leader?`<div class='dt-team-leader'>${escapeHtml(leader)}</div>`:''}`;
    }},
    {key:'project_otd_status_display', header:'OTD Status', chooser:true, filterKey:'project_otd_status_display', optionKey:'project_otd_status_display', render:(project)=>{
      const otd=displayText(project.project_otd_status_display,'');
      return `<span class='otd-pill ${otdCellClass(otd)}'>${escapeHtml(otd||'N/A')}</span>`;
    }},
    {key:'state', header:'State', chooser:true, filterKey:'state', optionKey:'state', render:(project)=>{
      const state=displayText(project.state,'');
      return `<span class='state-pill ${stateCellClass(state)}'>${escapeHtml(state||'N/A')}</span>`;
    }},
    {key:'category', header:'Category', chooser:true, filterKey:'category', optionKey:'category', render:(project)=>escapeHtml(displayText(project.category,''))},
    {key:'business_unit', header:'Business Unit', chooser:true, filterKey:'business_unit', optionKey:'business_unit', render:(project)=>escapeHtml(displayText(project.business_unit,''))},
    {key:'primary_function', header:'Primary Function', chooser:true, filterKey:'primary_function', optionKey:'primary_function', render:(project)=>escapeHtml(displayText(project.primary_function,''))},
    {key:'region', header:'Region', chooser:true, filterKey:'region', optionKey:'region', render:(project)=>escapeHtml(displayText(project.region,''))},
    {key:'executive_sponsor', header:'Executive Sponsor', chooser:true, filterable:false, render:(project)=>escapeHtml(displayText(project.executive_sponsor,''))},
    {key:'budget_plan', header:'Budget Plan', chooser:true, filterKey:currentBudgetField, optionKey:currentBudgetField, render:(project)=>`<span class='yn-pill ${ynClass(project[currentBudgetField])}'>${escapeHtml(displayText(project[currentBudgetField],'—'))}</span>`},
    {key:'benefits_plan', header:'Benefits Plan', chooser:true, filterKey:currentBenefitsField, optionKey:currentBenefitsField, render:(project)=>`<span class='yn-pill ${ynClass(project[currentBenefitsField])}'>${escapeHtml(displayText(project[currentBenefitsField],'—'))}</span>`},
    {key:'level_of_effort', header:'Level of Effort', chooser:true, filterable:false, render:(project)=>`<span class='loe-pill ${loeClass(project.level_of_effort)}'>${escapeHtml(displayText(project.level_of_effort,'—'))}</span>`},
    {key:'audit_trail', header:'Audit Trail', chooser:true, filterable:false, render:(project)=>renderAuditCell(project.audit_trail||{entries:[],has_view_all:false})},
    {key:'actions', header:'Actions', defaultVisible:true, locked:true, chooser:false, filterable:false, render:()=>renderActionCell()}
  ];
}

function getVisibleDashboardColumns(){
  return getDashboardColumnDefinitions().filter(column=>column.defaultVisible || selectedOptionalColumnKeys.includes(column.key));
}

function pruneHiddenColumnFilters(){
  const visibleFilterKeys=new Set(getVisibleDashboardColumns().map(column=>column.filterKey).filter(Boolean));
  Object.keys(currentFilters).forEach(key=>{
    if(!visibleFilterKeys.has(key)) delete currentFilters[key];
  });
}

function updateColumnChooserButton(){
  if(!columnChooserCount) return;
  const count=getVisibleDashboardColumns().filter(column=>column.key!=='project_name' && column.key!=='actions').length;
  columnChooserCount.textContent=String(count);
}

function closeColumnChooserMenu(){
  columnChooserMenu?.classList.add('hidden');
  columnChooserBtn?.setAttribute('aria-expanded','false');
  pendingOptionalColumnKeys=[];
}

function renderColumnChooserMenu(){
  if(!columnChooserMenu) return;
  const columns=getDashboardColumnDefinitions().filter(column=>column.chooser!==false);
  const chooserLabelMap={
    dt_team_accountable:'DT Team',
    executive_sponsor:'Sponsor'
  };
  if(!pendingOptionalColumnKeys.length && selectedOptionalColumnKeys.length){
    pendingOptionalColumnKeys=[...selectedOptionalColumnKeys];
  }
  function countSelected(){
    return columns.filter(c=>c.defaultVisible||c.lockedDefault||pendingOptionalColumnKeys.includes(c.key)).length;
  }
  const items=columns.map(column=>{
    const isAlwaysLocked=column.locked&&!column.lockedDefault;
    const isDefaultLocked=!!column.lockedDefault;
    const isOptional=!isAlwaysLocked&&!isDefaultLocked;
    const isChecked=!isOptional||pendingOptionalColumnKeys.includes(column.key);
    let itemClass='cc-item';
    if(isAlwaysLocked) itemClass+=' cc-item-locked';
    else if(isDefaultLocked) itemClass+=' cc-item-default';
    const checkboxAttrs=isOptional
      ?`data-key="${escapeHtml(column.key)}"`
      :`disabled`;
    const checkHtml=`<input type="checkbox" class="cc-checkbox" ${checkboxAttrs} ${isChecked?'checked':''}>`;
    const displayLabel=chooserLabelMap[column.key]||column.header;
    return `<label class="${itemClass}">${checkHtml}<span class="cc-item-name">${escapeHtml(displayLabel)}</span>${isAlwaysLocked?'<span class="cc-always-shown">always shown</span>':''}</label>`;
  }).join('');
  columnChooserMenu.innerHTML=`
    <div class="column-chooser-shell">
      <div class="cc-heading">Select Columns to Display</div>
      <div class="cc-list">${items}</div>
      <div class="cc-footer">
        <span class="cc-count">Showing ${countSelected()} columns total</span>
        <button type="button" id="columnChooserSelect" class="cc-select-btn">Select</button>
      </div>
    </div>`;
  columnChooserMenu.querySelectorAll('.cc-checkbox:not(:disabled)').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const key=cb.dataset.key;
      if(cb.checked){
        if(!pendingOptionalColumnKeys.includes(key)) pendingOptionalColumnKeys.push(key);
      }else{
        pendingOptionalColumnKeys=pendingOptionalColumnKeys.filter(k=>k!==key);
      }
      const countEl=columnChooserMenu.querySelector('.cc-count');
      if(countEl) countEl.textContent=`Showing ${countSelected()} columns total`;
    });
  });
  columnChooserMenu.querySelector('#columnChooserSelect')?.addEventListener('click',()=>{
    pendingOptionalColumnKeys=[];
    columnChooserMenu.querySelectorAll('.cc-checkbox:not(:disabled)').forEach(cb=>{
      if(cb.checked) pendingOptionalColumnKeys.push(cb.dataset.key);
    });
    selectedOptionalColumnKeys=[...pendingOptionalColumnKeys];
    saveSelectedOptionalColumnKeys();
    pruneHiddenColumnFilters();
    updateColumnChooserButton();
    closeColumnChooserMenu();
    loadDashboard();
  });
  updateColumnChooserButton();
}

function toggleColumnChooserMenu(){
  if(!columnChooserMenu || !columnChooserBtn) return;
  const willOpen=columnChooserMenu.classList.contains('hidden');
  if(willOpen){
    pendingOptionalColumnKeys=[...selectedOptionalColumnKeys];
    renderColumnChooserMenu();
    columnChooserMenu.classList.remove('hidden');
    columnChooserBtn.setAttribute('aria-expanded','true');
  }else{
    closeColumnChooserMenu();
  }
}

function csvEscape(value){
  const text=String(value??'');
  return `"${text.replace(/"/g,'""')}"`;
}

function normalizeCsvValue(value){
  if(value===null || value===undefined) return '';
  return String(value).replace(/\r?\n/g,' ').trim();
}

function buildCsv(rows){
  const currentBudgetField=budgetFieldKey(CURRENT_YEAR);
  const currentBenefitsField=benefitsFieldKey(CURRENT_YEAR);
  const nextBudgetField=budgetFieldKey(NEXT_YEAR);
  const nextBenefitsField=benefitsFieldKey(NEXT_YEAR);
  const exportColumns=[
    {header:'Project Status', key:'project_status'},
    {header:'Initiative Name', key:'initiative_name'},
    {header:'Project Name', key:'project_name'},
    {header:'Description', key:'description'},
    {header:'DT Team Accountable', key:'dt_team_accountable'},
    {header:'OTD Status', key:'project_otd_status'},
    {header:'State', key:'state'},
    {header:'Phase', key:'project_otd_phase'},
    {header:'Estd End Date', key:'estd_end_date', isDate:true},
    {header:'Adjusted End Date', key:'adjusted_end_date', isDate:true},
    {header:'Category', key:'category'},
    {header:'Business Unit', key:'business_unit'},
    {header:'Primary Function', key:'primary_function'},
    {header:'Region', key:'region'},
    {header:'Executive Sponsor', key:'executive_sponsor'},
    {header:`${CURRENT_YEAR} Budget Flag`, key:currentBudgetField},
    {header:`${CURRENT_YEAR} Benefits Plan`, key:currentBenefitsField},
    {header:`${NEXT_YEAR} Budget Flag`, key:nextBudgetField},
    {header:`${NEXT_YEAR} Benefits Plan`, key:nextBenefitsField},
    {header:'DT Teams Involved', key:'dt_teams_involved'},
    {header:'DT Lead', key:'dt_lead'},
    {header:'Business Project Lead', key:'business_project_lead'},
    {header:'Level of Effort', key:'level_of_effort'},
    {header:'Technology', key:'technology'},
    {header:'Budget', key:'budget'},
    {header:'Filter Key', key:'filter_key'}
  ];
  const headers=exportColumns.map(c=>c.header);
  const lines=[headers.map(csvEscape).join(',')];

  rows.forEach(p=>{
    const record=exportColumns.map(col=>{
      const rawValue=p[col.key];
      if(col.isDate) return normalizeCsvValue(cleanDate(rawValue));
      return normalizeCsvValue(rawValue);
    });
    lines.push(record.map(csvEscape).join(','));
  });

  return lines.join('\r\n');
}

async function fetchAllTableRowsForExport(){
  const rows=[];
  let page=1;
  let totalPages=1;
  do{
    const params=new URLSearchParams({
      q:currentQuery,
      page:String(page),
      page_size:'100',
      grouped:'false',
      filters:JSON.stringify(currentFilters),
      sort_key:currentSortKey,
      sort_dir:currentSortDirection
    });
    const res=await fetch('/project/api/dashboard?'+params.toString());
    const data=await res.json();
    if(!res.ok || data.success===false) throw new Error(data.error||'Failed to load export data');
    rows.push(...(data.items||[]));
    totalPages=data.pages||1;
    page+=1;
  }while(page<=totalPages);
  return rows;
}

async function exportToCsv(){
  if(!exportCsvBtn) return;
  const originalText=exportCsvBtn.textContent;
  exportCsvBtn.disabled=true;
  exportCsvBtn.textContent='Exporting...';
  try{
    const rows=await fetchAllTableRowsForExport();
    const csv=buildCsv(rows);
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    const stamp=new Date().toISOString().slice(0,10);
    link.href=url;
    link.download=`project_export_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }catch(err){
    alert(err.message||'Unable to export CSV');
  }finally{
    exportCsvBtn.disabled=false;
    exportCsvBtn.textContent=originalText;
  }
}

function normalizeBlank(value){
  if(value===null || value===undefined) return '';
  const s=String(value).trim();
  if(!s) return '';
  return s.toLowerCase()==='(blank)' ? '' : String(value);
}

function displayText(value, fallback=''){
  const normalized=normalizeBlank(value);
  return normalized==='' ? fallback : normalized;
}

function truncate(text,n=90){
  const content=displayText(text,'');
  if(!content) return '';
  if(content.length<=n) return escapeHtml(content);
  return `<span class='desc-short'>${escapeHtml(content.slice(0,n))}... <a href='#' class='expand-desc'>more</a></span><span class='desc-full' style='display:none;'>${escapeHtml(content)} <a href='#' class='collapse-desc'>less</a></span>`;
}

function projectStatusCellClass(v){
  const x=(v||'NA').toString().trim().toUpperCase();
  if(x==='G') return 'cell-project-status-g';
  if(x==='Y' || x==='A') return 'cell-project-status-y';
  if(x==='R') return 'cell-project-status-r';
  if(x==='HOLD') return 'cell-project-status-hold';
  if(x==='NA' || x==='N/A' || x==='') return 'cell-project-status-na';
  return 'cell-project-status-neutral';
}

function otdCellClass(v){
  const x=(v||'').toString().toLowerCase().replace('-', ' ').trim();
  if(x==='on track') return 'cell-otd-ontrack';
  if(x==='adjusted plan') return 'cell-otd-adjusted';
  if(x==='slip') return 'cell-otd-slip';
  if(x==='na' || x==='n/a') return 'cell-otd-na';
  return 'cell-otd-neutral';
}

function stateCellClass(v){
  const x=(v||'').toString().trim().toLowerCase();
  if(x==='active') return 'cell-state-active';
  if(x==='evaluation') return 'cell-state-evaluation';
  if(x==='funnel') return 'cell-state-funnel';
  if(x==='closure') return 'cell-state-closure';
  if(x==='hold') return 'cell-state-hold';
  if(x==='cancelled') return 'cell-state-cancelled';
  return 'cell-state-neutral';
}

function phaseCellClass(v){
  const x=(v||'').toString().trim().toLowerCase();
  if(x==='discovery') return 'cell-phase-discovery';
  if(x==='requirements') return 'cell-phase-requirements';
  if(x==='build') return 'cell-phase-build';
  if(x==='verify') return 'cell-phase-verify';
  if(x==='launch') return 'cell-phase-launch';
  if(x==='post-launch') return 'cell-phase-postlaunch';
  if(x==='agile') return 'cell-phase-agile';
  if(x==='funnel') return 'cell-phase-funnel';
  return 'cell-phase-neutral';
}

function otdPillClass(v){
  const x=(v||'').toString().toLowerCase().replace('-', ' ').trim();
  if(x==='on track') return 'otd-pill-ontrack';
  if(x==='adjusted plan') return 'otd-pill-adjusted';
  if(x==='slip') return 'otd-pill-slip';
  return 'otd-pill-na';
}

function statePillClass(v){
  const x=(v||'').toString().trim().toLowerCase();
  if(x==='active') return 'state-pill-active';
  if(x==='evaluation') return 'state-pill-evaluation';
  if(x==='funnel') return 'state-pill-funnel';
  if(x==='closure') return 'state-pill-closure';
  if(x==='hold') return 'state-pill-hold';
  if(x==='cancelled') return 'state-pill-cancelled';
  return 'state-pill-na';
}

function phasePillClass(v){
  const x=(v||'').toString().trim().toLowerCase();
  if(x==='discovery') return 'phase-pill-discovery';
  if(x==='requirements') return 'phase-pill-requirements';
  if(x==='build') return 'phase-pill-build';
  if(x==='verify') return 'phase-pill-verify';
  if(x==='launch') return 'phase-pill-launch';
  if(x==='post-launch') return 'phase-pill-postlaunch';
  if(x==='agile') return 'phase-pill-agile';
  if(x==='funnel') return 'phase-pill-funnel';
  return 'phase-pill-na';
}

function loeClass(v){
  const x=(v||'').toString().toLowerCase();
  if(['small','s'].includes(x)) return 'loe-small';
  if(['medium','m'].includes(x)) return 'loe-medium';
  if(['large','l'].includes(x)) return 'loe-large';
  if(['xlarge','xl','extra large'].includes(x)) return 'loe-xlarge';
  return 'loe-default';
}

function ynClass(v){
  const x=(v||'').toString().trim().toUpperCase();
  if(x==='Y' || x==='YES') return 'yn-yes';
  if(x==='N' || x==='NO') return 'yn-no';
  if(x==='HOLD') return 'yn-hold';
  if(x==='UPDATED') return 'yn-updated';
  return 'yn-default';
}

function cleanDate(d){
  if(!d) return '';
  return String(d).split(' ')[0].split('T')[0];
}

function setEditWizardStep(step){
  currentEditWizardStep=Math.max(1,Math.min(3,step));
  ['1','2','3'].forEach(n=>{
    const stepEl=document.getElementById(`mWizardStep${n}`);
    const panelEl=document.getElementById(`mPanel${n}`);
    const idx=Number(n);
    if(stepEl){
      stepEl.classList.toggle('is-active', idx===currentEditWizardStep);
      stepEl.classList.toggle('is-done', idx<currentEditWizardStep);
    }
    if(panelEl){
      panelEl.classList.toggle('is-active', idx===currentEditWizardStep);
    }
  });
}

function dtTeamLeader(team){
  const key=displayText(team,'').trim();
  if(!key) return '';
  const mapping={
    'Data & AI':'Minal <MINAL.Merchant@gevernova.com>',
    'Enterprise Applications':'Karthik <AnilKumar.Karthik@gevernova.com>',
    'Technology Enablement & Transformation':'Taufan <Taufan.Tjioe@gevernova.com>',
    'Product Tech Solutions & Operations':'Steven <stevensmith@gevernova.com>'
  };
  return mapping[key]||'Leader Not Mapped';
}

function rowHtml(p, extraClass='', columns=getVisibleDashboardColumns()){
  const cells=columns.map(column=>{
    const classes=[columnCssClass(column.key), stickyColumnClass(column.key)];
    if(column.key==='project_status_display') classes.push(`cell-project-status ${projectStatusCellClass(displayText(p.project_status_display,'NA').toString())}`);
    if(column.key==='dt_team_accountable') classes.push('dt-team-cell');
    if(column.key==='actions') classes.push('actions-cell');
    if(column.key==='project_otd_status_display') classes.push('cell-otd');
    if(column.key==='state') classes.push('cell-state');
    if(column.key==='project_otd_phase') classes.push('cell-phase');
    return `<td class='${classes.filter(Boolean).join(' ')}'>${column.render(p)}</td>`;
  }).join('');
  return `<tr data-id='${escapeHtml(p.project_id)}' class='${extraClass}'>${cells}</tr>`;
}

function uniq(rows,key){
  const set=new Set();
  rows.forEach(r=>{
    const raw=r[key];
    const s=String(raw??'').trim();
    const v=(!s || s.toLowerCase()==='(blank)') ? BLANK_TOKEN : s;
    set.add(v);
  });
  return [...set].sort((a,b)=>{
    if(a===BLANK_TOKEN) return 1;
    if(b===BLANK_TOKEN) return -1;
    return a.localeCompare(b,undefined,{sensitivity:'base'});
  });
}

function filterSelect(label,key,options){
  const selected=(currentFilters[key]&&currentFilters[key][0])||'';
  const list=(options||[]).filter(v=>String(v)!=='').map(v=>String(v));
  return `<label class='th-filter-label'><select class='col-filter' data-key='${escapeHtml(key)}'><option value=''>All</option>${list.map(v=>`<option value='${escapeHtml(v)}' ${selected===v?'selected':''}>${escapeHtml(v===BLANK_TOKEN?'(Blank)':v)}</option>`).join('')}</select></label>`;
}

function headerCell(label, key=''){
  const nextDirection=(currentSortKey===key && currentSortDirection==='asc') ? 'desc' : 'asc';
  const isSorted=currentSortKey===key;
  const upActiveClass=isSorted && currentSortDirection==='asc' ? ' is-active' : '';
  const downActiveClass=isSorted && currentSortDirection==='desc' ? ' is-active' : '';
  return `<th class='${[columnCssClass(key), stickyColumnClass(key)].filter(Boolean).join(' ')}'><div class='th-head'><span class='th-title'>${escapeHtml(label)}</span><button type='button' class='th-sort' data-sort-key='${escapeHtml(key)}' data-next-dir='${nextDirection}' aria-label='Sort ${escapeHtml(label)} ${nextDirection}'><span class='th-sort-up${upActiveClass}'>&#708;</span><span class='th-sort-down${downActiveClass}'>&#709;</span></button></div></th>`;
}

function resolveOptions(filterOptions,key,rows,fallbackKey){
  if(filterOptions && Array.isArray(filterOptions[key])) return filterOptions[key];
  return uniq(rows,fallbackKey||key);
}

function filterCellHtml(column, filterOptions, rows){
  if(!column.filterKey) return '';
  return filterSelect('Filter', column.filterKey, resolveOptions(filterOptions, column.optionKey||column.filterKey, rows, column.filterKey));
}

function tableHtml(rows,filterOptions){
  const columns=getVisibleDashboardColumns();
  const filterCells=columns.map(column=>`<th class='${[columnCssClass(column.key), stickyColumnClass(column.key)].filter(Boolean).join(' ')}'>${filterCellHtml(column,filterOptions,rows)}</th>`).join('');
  return `<div class='table-scroll'><table><thead><tr>${columns.map(column=>headerCell(column.header,column.key)).join('')}</tr><tr class='filter-row'>${filterCells}</tr></thead><tbody>${rows.map(row=>rowHtml(row,'',columns)).join('')}</tbody></table></div>`;
}

function groupedTableHtml(groups,filterOptions){
  const allRows=groups.flatMap(g=>g.projects||[]);
  const columns=getVisibleDashboardColumns();
  const filterCells=columns.map(column=>`<th class='${[columnCssClass(column.key), stickyColumnClass(column.key)].filter(Boolean).join(' ')}'>${filterCellHtml(column,filterOptions,allRows)}</th>`).join('');
  const body=groups.map((g,idx)=>{
    const gid=`g${idx}`;
    const header=`<tr class='initiative-row' data-group='${gid}'><td colspan='${columns.length}'><span class='group-chevron'>&#9660;</span><strong>(${g.project_count}) ${escapeHtml(displayText(g.initiative_name,'(No Initiative)'))}</strong></td></tr>`;
    const rows=(g.projects||[]).map(project=>rowHtml(project,`group-row ${gid}`,columns)).join('');
    return header+rows;
  }).join('');
  return `<div class='table-scroll'><table><thead><tr>${columns.map(column=>headerCell(column.header,column.key)).join('')}</tr><tr class='filter-row'>${filterCells}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function setPageInfo(data){
  const total=data.grouped?(data.project_total||0):(data.total||0);
  const headingHtml=`<span class="projects-title">All Projects</span><span class="projects-count">${escapeHtml(String(total))}</span>`;
  document.querySelectorAll('.pager-showing').forEach(el=>{el.innerHTML=headingHtml;});
}

function renderPageButtons(totalPages,curPage){
  const MAX_VISIBLE=5;
  let pages=[];
  if(totalPages<=MAX_VISIBLE+2){
    for(let i=1;i<=totalPages;i++) pages.push(i);
  }else{
    let start=Math.max(1,curPage-2);
    let end=Math.min(totalPages,start+MAX_VISIBLE-1);
    if(end-start<MAX_VISIBLE-1) start=Math.max(1,end-MAX_VISIBLE+1);
    if(start>1){pages.push(1);if(start>2)pages.push('...');}
    for(let i=start;i<=end;i++) pages.push(i);
    if(end<totalPages){if(end<totalPages-1)pages.push('...');pages.push(totalPages);}
  }
  const btns=pages.map(p=>{
    if(p==='...') return `<span class="pager-ellipsis">\u2026</span>`;
    return `<button class="pager-page-btn${p===curPage?' is-active':''}" data-page="${p}">${p}</button>`;
  }).join('');
  const nextDisabled=curPage>=totalPages;
  const nextBtn=`<button class="pager-next-btn"${nextDisabled?' disabled':''}>Next</button>`;
  document.querySelectorAll('.pager-pages').forEach(el=>{
    el.innerHTML=btns+nextBtn;
    el.querySelectorAll('.pager-page-btn').forEach(btn=>btn.addEventListener('click',()=>{
      currentPage=Number(btn.dataset.page);loadDashboard();
    }));
    el.querySelector('.pager-next-btn').addEventListener('click',()=>{
      if(curPage<totalPages){currentPage=curPage+1;loadDashboard();}
    });
  });
}

function renderSummaryCards(data){
  const summary=data.summary_cards||{};
  const compliance=summary.update_compliance||{};

  const totalProjects=Number(summary.total_projects||data.project_total||0);
  const onTrack=Number(summary.on_track||0);
  const atRisk=Number(summary.at_risk||0);
  const offTrack=Number(summary.off_track||0);
  const overdue=Number(summary.overdue||0);
  const compliancePercent=Number(compliance.percent||0);
  const updatedThisMonth=Number(compliance.updated_this_month||0);
  const totalInitiatives=Number(data.grouped ? data.total || 0 : new Set((data.items||[]).map(item=>String(item.initiative_name||'').trim()||'(No Initiative)')).size);

  const percentageText=(value)=>{
    if(!totalProjects) return '0% of portfolio';
    return `${Math.round((Number(value||0)*100)/totalProjects)}% of portfolio`;
  };

  const totalEl=document.getElementById('cardTotalProjects');
  const totalSubEl=document.getElementById('cardTotalProjectsSub');
  const onTrackEl=document.getElementById('cardOnTrack');
  const onTrackSubEl=document.getElementById('cardOnTrackSub');
  const atRiskEl=document.getElementById('cardAtRisk');
  const atRiskSubEl=document.getElementById('cardAtRiskSub');
  const offTrackEl=document.getElementById('cardOffTrack');
  const offTrackSubEl=document.getElementById('cardOffTrackSub');
  const overdueEl=document.getElementById('cardOverdue');
  const overdueSubEl=document.getElementById('cardOverdueSub');
  const complianceEl=document.getElementById('cardUpdateCompliance');
  const complianceSubEl=document.getElementById('cardUpdateComplianceSub');

  if(totalEl) totalEl.textContent=String(totalProjects);
  if(totalSubEl) totalSubEl.textContent=`${totalInitiatives} initiatives`;
  if(onTrackEl) onTrackEl.textContent=String(onTrack);
  if(onTrackSubEl) onTrackSubEl.textContent=percentageText(onTrack);
  if(atRiskEl) atRiskEl.textContent=String(atRisk);
  if(atRiskSubEl) atRiskSubEl.textContent=percentageText(atRisk);
  if(offTrackEl) offTrackEl.textContent=String(offTrack);
  if(offTrackSubEl) offTrackSubEl.textContent=percentageText(offTrack);
  if(overdueEl) overdueEl.textContent=String(overdue);
  if(overdueSubEl) overdueSubEl.textContent='Past committed date';
  if(complianceEl) complianceEl.textContent=`${compliancePercent}%`;
  if(complianceSubEl) complianceSubEl.textContent=`${updatedThisMonth}/${totalProjects} updated this month`;
}

function renderDashboard(data){
  const filterOptions=data.filter_options||{};
  window.lastTotalPages=data.pages||1;
  pruneHiddenColumnFilters();
  updateColumnChooserButton();
  renderSummaryCards(data);
  if(data.grouped){
    dashboardEl.innerHTML=groupedTableHtml(data.items||[],filterOptions);
    setPageInfo(data);
  }else{
    dashboardEl.innerHTML=tableHtml(data.items||[],filterOptions);
    setPageInfo(data);
  }
  updatePaginationState();
  updateClearFiltersVisibility();
  wireInteractiveHandlers();
}

function updatePaginationState(){
  renderPageButtons(window.lastTotalPages||1,currentPage);
}

function counts(items, groupedMode, key){
  const rows=groupedMode?items.flatMap(g=>g.projects):items;
  const map={};
  rows.forEach(r=>{
    const shown=displayText(r[key],'Blank');
    const v=shown || 'Blank';
    map[v]=(map[v]||0)+1;
  });
  return {labels:Object.keys(map), values:Object.values(map)};
}

function renderCharts(data){
  const loe=(data.chart_data && data.chart_data.level_of_effort) ? data.chart_data.level_of_effort : counts(data.items,data.grouped,'level_of_effort');
  const category=(data.chart_data && data.chart_data.category) ? data.chart_data.category : counts(data.items,data.grouped,'category');
  const deadlineProximity=(data.chart_data && data.chart_data.deadline_proximity) ? data.chart_data.deadline_proximity : {labels:['Overdue','0-7 Days','8-14 Days','15-30 Days','30+ Days','Unknown'],values:[0,0,0,0,0,0]};
  const sctx=document.getElementById('statusChart').getContext('2d');
  const cctx=document.getElementById('categoryChart').getContext('2d');
  const pctx=document.getElementById('portfolioMetricsChart').getContext('2d');
  const dctx=document.getElementById('deadlineProximityChart').getContext('2d');
  if(statusChart) statusChart.destroy();
  if(categoryChart) categoryChart.destroy();
  if(portfolioMetricsChart) portfolioMetricsChart.destroy();
  if(deadlineProximityChart) deadlineProximityChart.destroy();

  const loeColors=(loe.labels||[]).map(l=>{
    const key=String(l||'').trim().toLowerCase();
    if(['small','s'].includes(key)) return '#bccfd2';
    if(['medium','m'].includes(key)) return '#86b8bc';
    if(['large','l'].includes(key)) return '#3e8d93';
    if(['xlarge','xl'].includes(key)) return '#0b6f73';
    if(['xx-large','xxlarge'].includes(key)) return '#005e60';
    if(['extra large'].includes(key)) return '#005e60';
    if(key==='tbd') return '#bdbdbd';
    return '#90a4ae';
  });

  statusChart=new Chart(sctx,{
    type:'bar',
    data:{
      labels:loe.labels,
      datasets:[{
        label:'Projects by size',
        data:loe.values,
        backgroundColor:loeColors,
        borderRadius:6,
        borderSkipped:false
      }]
    },
    options:{
      maintainAspectRatio:false,
      scales:{
        x:{grid:{display:false},ticks:{font:{size:11}}},
        y:{beginAtZero:true,ticks:{precision:0,font:{size:11}},grid:{color:'#e5e7eb'}}
      },
      plugins:{
        legend:{display:false},
        title:{display:true,text:'Level of Effort',align:'start',font:{size:16,weight:'700'},color:'#2f3743',padding:{top:4,bottom:0}},
        subtitle:{display:true,text:'Projects by size',align:'start',font:{size:12,weight:'500'},color:'#6b7280',padding:{bottom:8}}
      }
    }
  });
  
  // Calculate percentages for pie chart
  const total=category.values.reduce((sum,val)=>sum+val,0);
  
  const categoryColors=(category.labels||[]).map(label=>{
    const key=String(label||'').trim().toLowerCase();
    if(key==='mustdo' || key==='must-do') return '#005e60';
    if(key==='productivity') return '#2f80ed';
    if(key==='strategic/ltgrowth' || key==='strategic / lt growth' || key==='strategic/lt growth') return '#38a800';
    return '#cfcfcf';
  });

  categoryChart=new Chart(cctx,{
    type:'doughnut',
    data:{
      labels:category.labels,
      datasets:[{
        data:category.values,
        backgroundColor:categoryColors,
        borderColor:'#ffffff',
        borderWidth:2,
        hoverOffset:4
      }]
    },
    options:{
      maintainAspectRatio:false,
      cutout:'56%',
      plugins:{
        legend:{
          position:'bottom',
          labels:{usePointStyle:true,pointStyle:'circle',boxWidth:8,font:{size:11}}
        },
        title:{display:true,text:'Project Category',align:'start',font:{size:16,weight:'700'},color:'#2f3743',padding:{top:4,bottom:0}},
        subtitle:{display:true,text:'Strategic mix',align:'start',font:{size:12,weight:'500'},color:'#6b7280',padding:{bottom:8}},
        tooltip:{callbacks:{label:function(context){const label=context.label||'';const value=context.parsed;const percentage=((value/total)*100).toFixed(1);return label+': '+value+' projects ('+percentage+'%)';}}}
      }
    }
  });
  
  // Render Portfolio Metrics Chart (State only)
  renderPortfolioMetricsChart(data, pctx);

  renderDeadlineProximityChart(deadlineProximity, dctx);
}

function renderDeadlineProximityChart(deadlineProximity, ctx){
  const barColors=['#c5161d','#8f5a1b','#b88432','#2f80ed','#38a800','#bdbdbd'];
  const cumulative=[];
  let running=0;
  (deadlineProximity.values||[]).forEach(v=>{
    running+=Number(v||0);
    cumulative.push(running);
  });

  deadlineProximityChart=new Chart(ctx,{
    type:'bar',
    data:{
      labels:deadlineProximity.labels,
      datasets:[
        {
          type:'bar',
          label:'Projects',
          data:deadlineProximity.values,
          backgroundColor:barColors,
          borderColor:barColors,
          borderWidth:1,
          borderRadius:4,
          borderSkipped:false,
          yAxisID:'y'
        },
        {
          type:'line',
          label:'Cumulative risk',
          data:cumulative,
          borderColor:'#0a6f73',
          backgroundColor:'#0a6f73',
          pointBackgroundColor:'#0a6f73',
          pointBorderColor:'#0a6f73',
          pointRadius:3,
          tension:0.3,
          fill:false,
          yAxisID:'y'
        }
      ]
    },
    options:{
      maintainAspectRatio:false,
      scales:{
        x:{ticks:{font:{size:11}},grid:{display:false}},
        y:{beginAtZero:true,ticks:{precision:0,font:{size:11}},grid:{color:'#e5e7eb'}}
      },
      plugins:{
        legend:{display:false},
        title:{
          display:true,
          text:'Deadline Proximity',
          align:'start',
          font:{size:16,weight:'700'},
          color:'#2f3743',
          padding:{top:4,bottom:0}
        },
        subtitle:{
          display:true,
          text:'Time remaining & cumulative risk',
          align:'start',
          font:{size:12,weight:'500'},
          color:'#6b7280',
          padding:{bottom:8}
        },
        tooltip:{
          callbacks:{
            label:function(context){
              const value=typeof context.parsed==='object' ? context.parsed.y : context.parsed;
              return `${context.dataset.label}: ${value} projects`;
            }
          }
        }
      }
    }
  });
}

function renderPortfolioMetricsChart(data, ctx){
  // Define all possible state values to ensure they all appear
  const allStates=['Active','Evaluation','Funnel','Closure','Hold','Cancelled'];
  
  // Get counts for State from full filtered dataset (server-provided)
  const rawStateData=(data.chart_data && data.chart_data.state)
    ? data.chart_data.state
    : counts(data.items,data.grouped,'state');
  const stateCounts={};
  rawStateData.labels.forEach((label,idx)=>{
    stateCounts[label]=rawStateData.values[idx];
  });
  
  // Build complete dataset with all states, filling 0 for missing
  const stateData={
    labels:allStates,
    values:allStates.map(state=>stateCounts[state]||0)
  };
  
  // Color coding for state values
  const colors=stateData.labels.map(l=>{
    const key=(l||'').toString().trim().toLowerCase();
    if(key==='active') return '#0b6f73';
    if(key==='funnel') return '#4e9a9e';
    if(key==='closure') return '#2f80ed';
    if(key==='evaluation') return '#8ec5ff';
    if(key==='hold') return '#c5c7cb';
    if(key==='cancelled') return '#c5161d';
    return '#90a4ae';
  });
  
  portfolioMetricsChart=new Chart(ctx,{
    type:'bar',
    data:{
      labels:stateData.labels,
      datasets:[{
        label:'Project Count',
        data:stateData.values,
        backgroundColor:colors,
        borderColor:colors.map(c=>c),
        borderWidth:1
      }]
    },
    options:{
      maintainAspectRatio:false,
      indexAxis:'y',
      scales:{
        x:{
          beginAtZero:true,
          ticks:{
            precision:0,
            font:{size:11}
          }
        },
        y:{
          ticks:{
            font:{size:11}
          }
        }
      },
      plugins:{
        legend:{display:false},
        title:{
          display:true,
          text:'Project State',
          align:'start',
          font:{size:16,weight:'700'},
          color:'#2f3743',
          padding:{top:4,bottom:0}
        },
        subtitle:{
          display:true,
          text:'Pipeline distribution',
          align:'start',
          font:{size:12,weight:'500'},
          color:'#6b7280',
          padding:{bottom:8}
        }
      }
    }
  });
}

async function openStatusDialog(projectId){
  const res=await fetch(`/project/${projectId}/all-fields`);
  const data=await res.json();
  if(!data.success) return alert(data.error||'Unable to open dialog');
  const p=data.project;
  statusDialogProjectId=projectId;
  document.getElementById('mInitiativeInput').value=p.initiative_name||'';
  document.getElementById('mProjectInput').value=p.project_name||'';
  document.getElementById('mDescription').value=p.description||'';
  document.getElementById('mDTTeam').value=p.dt_team_accountable||'';
  document.getElementById('mState').value=p.state||'';
  document.getElementById('mProjectStatus').value=p.project_status||'NA';
  document.getElementById('mOTD').value=p.project_otd_status||'';
  document.getElementById('mPhase').value=p.project_otd_phase||'';
  document.getElementById('mEstdEndDate').value=p.estd_end_date||'';
  document.getElementById('mAdjusted').value=p.adjusted_end_date||'';
  document.getElementById('mCategory').value=p.category||'';
  document.getElementById('mBusinessUnit').value=p.business_unit||'';
  document.getElementById('mPrimaryFunction').value=p.primary_function||'';
  document.getElementById('mRegion').value=p.region||'';
  document.getElementById('mExecSponsor').value=p.executive_sponsor||'';
  const currentBudgetField=budgetFieldKey(CURRENT_YEAR);
  const currentBenefitsField=benefitsFieldKey(CURRENT_YEAR);
  const nextBudgetField=budgetFieldKey(NEXT_YEAR);
  const nextBenefitsField=benefitsFieldKey(NEXT_YEAR);
  document.getElementById(`mBudget${CURRENT_YEAR}`).value=p[currentBudgetField]||'';
  document.getElementById(`mBenefits${CURRENT_YEAR}`).value=p[currentBenefitsField]||'';
  document.getElementById(`mBudget${NEXT_YEAR}`).value=p[nextBudgetField]||'';
  document.getElementById(`mBenefits${NEXT_YEAR}`).value=p[nextBenefitsField]||'';
  // Set combined Budget Plan and Benefits Plan selects based on CURRENT_YEAR values
  const mBudgetSelect=document.getElementById('mBudgetSelect');
  const mBenefitsSelect=document.getElementById('mBenefitsSelect');
  if(mBudgetSelect) mBudgetSelect.value=p[currentBudgetField]||'';
  if(mBenefitsSelect) mBenefitsSelect.value=p[currentBenefitsField]||'';
  mEditDTTeamsPicklist?.setValues(p.dt_teams_involved||[]);
  document.getElementById('mDTLead').value=p.dt_lead||'';
  document.getElementById('mBizLead').value=p.business_project_lead||'';
  document.getElementById('mLOE').value=p.level_of_effort||'';
  document.getElementById('mTechnology').value=p.technology||'';
  document.getElementById('mBudget').value=p.budget||'';
  document.getElementById('mComments').value=p.status_comments||'';
  const errEl=document.getElementById('mError');
  if(errEl){
    errEl.textContent='';
    errEl.classList.add('hidden');
  }
  applyStatusModalRules();
  setEditWizardStep(1);
  document.getElementById('statusModal').classList.remove('hidden');
}

function applyStatusModalRules(){
  const stateEl=document.getElementById('mState');
  const otdEl=document.getElementById('mOTD');
  const estdEndDateEl=document.getElementById('mEstdEndDate');
  const estdMandatoryHintEl=document.getElementById('mEstdMandatoryHint');
  const adjustedEl=document.getElementById('mAdjusted');
  const state=(stateEl.value||'').trim();
  const enableOTD=state==='Active';
  if(!enableOTD) otdEl.value='';
  otdEl.disabled=!enableOTD;
  otdEl.required=enableOTD;
  if(otdEl.disabled){
    otdEl.title='OTD Status is enabled only when State is Active.';
    otdEl.setAttribute('aria-describedby','disabled-field-note');
  } else {
    otdEl.title='';
    otdEl.removeAttribute('aria-describedby');
  }
  const otdVal=(otdEl.value||'').toLowerCase().replace('-',' ').trim();
  const showAdj=otdVal==='adjusted plan';
  const requireActualEndDate=otdVal==='on track' || otdVal==='slip';
  if(estdEndDateEl) estdEndDateEl.required=requireActualEndDate;
  if(estdMandatoryHintEl) estdMandatoryHintEl.classList.toggle('hidden', !requireActualEndDate);
  document.getElementById('mAdjustedWrap').style.display=showAdj?'flex':'none';
  adjustedEl.required=showAdj;
  adjustedEl.disabled=!showAdj;
  if(adjustedEl.disabled){
    adjustedEl.title='Adjusted End Date is disabled until OTD Status is set to Adjusted plan.';
    adjustedEl.setAttribute('aria-describedby','disabled-field-note');
  } else {
    adjustedEl.title='';
    adjustedEl.removeAttribute('aria-describedby');
  }
}

function openUpdateSuccessModal(projectId){
  const updateSuccessId=document.getElementById('projectUpdateSuccessId');
  if(updateSuccessId) updateSuccessId.textContent=projectId||'';
  document.getElementById('projectUpdateSuccessModal')?.classList.remove('hidden');
}

function closeUpdateSuccessModal(){
  document.getElementById('projectUpdateSuccessModal')?.classList.add('hidden');
}

function detailRowsHtml(project){
  const currentBudgetField=budgetFieldKey(CURRENT_YEAR);
  const currentBenefitsField=benefitsFieldKey(CURRENT_YEAR);
  const fields=[
    ['Project Status','project_status'],
    ['Initiative Name','initiative_name'],
    ['Project Name','project_name'],
    ['Description','description'],
    ['DT Team Accountable','dt_team_accountable'],
    ['DT Teams Involved','dt_teams_involved'],
    ['DT Lead','dt_lead'],
    ['Executive Sponsor','executive_sponsor'],
    ['Business Project Lead','business_project_lead'],
    ['State','state'],
    ['OTD Status','project_otd_status'],
    ['Phase','project_otd_phase'],
    ['Estimated End Date','estd_end_date'],
    ['Adjusted End Date','adjusted_end_date'],
    ['Category','category'],
    ['Business Unit','business_unit'],
    ['Primary Function','primary_function'],
    ['Region','region'],
    ['Budget Plan',currentBudgetField],
    ['Benefits Plan',currentBenefitsField],
    ['Level of Effort','level_of_effort'],
    ['Technology','technology'],
    ['Budget','budget']
  ];

  return fields.map(([label,key])=>{
    let value=project[key];
    if(Array.isArray(value)) value=value.join(', ');
    value=displayText(value,'—');
    return `<div class='project-view-item'><div class='project-view-label'>${escapeHtml(label)}</div><div class='project-view-value'>${escapeHtml(value)}</div></div>`;
  }).join('');
}

async function openProjectViewModal(projectId){
  const res=await fetch(`/project/${projectId}/all-fields`);
  const data=await res.json();
  if(!data.success) return alert(data.error||'Unable to open project details');
  const project=data.project||{};
  const metaEl=document.getElementById('projectViewMeta');
  const detailsEl=document.getElementById('projectViewDetails');
  if(metaEl) metaEl.textContent=displayText(project.project_name,'Project');
  if(detailsEl) detailsEl.innerHTML=detailRowsHtml(project);
  document.getElementById('projectViewModal')?.classList.remove('hidden');
}

function closeProjectViewModal(){
  document.getElementById('projectViewModal')?.classList.add('hidden');
}

async function saveStatusDialog(){
  const errEl=document.getElementById('mError');
  if(errEl){
    errEl.textContent='';
    errEl.classList.add('hidden');
  }
  const currentBudgetField=budgetFieldKey(CURRENT_YEAR);
  const currentBenefitsField=benefitsFieldKey(CURRENT_YEAR);
  const nextBudgetField=budgetFieldKey(NEXT_YEAR);
  const nextBenefitsField=benefitsFieldKey(NEXT_YEAR);

  const payload={
    initiative_name:document.getElementById('mInitiativeInput').value,
    project_name:document.getElementById('mProjectInput').value,
    description:document.getElementById('mDescription').value,
    dt_team_accountable:document.getElementById('mDTTeam').value,
    state:document.getElementById('mState').value,
    project_status:document.getElementById('mProjectStatus').value,
    project_otd_status:document.getElementById('mOTD').value,
    project_otd_phase:document.getElementById('mPhase').value,
    estd_end_date:document.getElementById('mEstdEndDate').value,
    adjusted_end_date:document.getElementById('mAdjusted').value,
    category:document.getElementById('mCategory').value,
    business_unit:document.getElementById('mBusinessUnit').value,
    primary_function:document.getElementById('mPrimaryFunction').value,
    region:document.getElementById('mRegion').value,
    executive_sponsor:document.getElementById('mExecSponsor').value,
    [currentBudgetField]:document.getElementById(`mBudget${CURRENT_YEAR}`).value,
    [currentBenefitsField]:document.getElementById(`mBenefits${CURRENT_YEAR}`).value,
    [nextBudgetField]:document.getElementById(`mBudget${NEXT_YEAR}`).value,
    [nextBenefitsField]:document.getElementById(`mBenefits${NEXT_YEAR}`).value,
    dt_teams_involved:mEditDTTeamsPicklist ? mEditDTTeamsPicklist.getValues() : [],
    dt_lead:document.getElementById('mDTLead').value,
    business_project_lead:document.getElementById('mBizLead').value,
    level_of_effort:document.getElementById('mLOE').value,
    technology:document.getElementById('mTechnology').value,
    budget:document.getElementById('mBudget').value,
    status_comments:document.getElementById('mComments').value
  };
  const res=await fetch(`/project/${statusDialogProjectId}/edit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await res.json();
  if(!data.success){
    if(errEl){
      errEl.textContent=(data.errors||[]).map(e=>`${e.field}: ${e.message}`).join(' | ')||data.error||'Failed to update';
      errEl.classList.remove('hidden');
    }
    else alert(data.error||'Failed to update');
    return;
  }
  document.getElementById('statusModal').classList.add('hidden');
  openUpdateSuccessModal(statusDialogProjectId);
}

function formatAuditTimestamp(ts){
  if(!ts) return '';
  try{
    const d=new Date(ts);
    return d.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }catch(e){return ts;}
}

async function openAudit(projectId){
  currentAuditProjectId=projectId;
  const res=await fetch(`/project/${projectId}/audit-trail/full`);
  const data=await res.json();
  const list=document.getElementById('auditList');
  const sort=document.getElementById('auditSort').value;
  const batches=(data.batches||[]).slice();
  if(sort==='asc') batches.reverse();
  if(!batches.length){
    list.innerHTML='<li class="audit-empty">No audit entries found.</li>';
  } else {
    list.innerHTML=batches.map(b=>{
      const ts=formatAuditTimestamp(b.timestamp);
      const changeLabel=b.change_count===1?'1 change':`${b.change_count} changes`;
      const changes=b.changes.map(c=>{
        const oldV=c.old_value===''?'(empty)':escapeHtml(c.old_value);
        const newV=c.new_value===''?'(empty)':escapeHtml(c.new_value);
        return `<li><span class="audit-field">${escapeHtml(c.field_name)}</span><span class="audit-arrow"> &rsaquo; </span><span class="audit-old">${oldV}</span><span class="audit-arrow"> → </span><span class="audit-new">${newV}</span></li>`;
      }).join('');
      return `<li class="audit-batch">
        <div class="audit-batch-header">
          <span class="audit-batch-user">👤 ${escapeHtml(b.user)}</span>
          <span class="audit-batch-count">${changeLabel}</span>
          <span class="audit-batch-ts">${ts}</span>
        </div>
        <ul class="audit-batch-changes">${changes}</ul>
      </li>`;
    }).join('');
  }
  document.getElementById('auditModal').classList.remove('hidden');
}

async function deleteProject(projectId){
  if(!window.IS_ADMIN){
    alert('Admin permission required to delete projects.');
    return;
  }
  if(!confirm('Delete this project? This action cannot be undone.')) return;
  const res=await fetch(`/project/${projectId}`,{method:'DELETE'});
  const data=await res.json();
  if(!data.success){
    alert(data.error||'Failed to delete project');
    return;
  }
  loadDashboard();
}

function closeImportResultModal(){
  document.getElementById('importResultModal')?.classList.add('hidden');
}

function renderImportFailures(failedRows){
  const failuresWrap=document.getElementById('importFailuresWrap');
  const failuresBody=document.getElementById('importFailuresBody');
  const downloadBtn=document.getElementById('downloadFailedRows');
  if(!failuresWrap || !failuresBody) return;

  const rows=Array.isArray(failedRows) ? failedRows : [];
  if(!rows.length){
    failuresWrap.classList.add('hidden');
    failuresBody.innerHTML='';
    if(downloadBtn) downloadBtn.classList.add('hidden');
    return;
  }

  failuresWrap.classList.remove('hidden');
  if(downloadBtn){
    downloadBtn.classList.toggle('hidden', !lastFailedExportFileBase64);
  }
  failuresBody.innerHTML=rows.map(row=>`<tr>
    <td>${escapeHtml(row.row_number||'')}</td>
    <td>${escapeHtml(row.project_name||'')}</td>
    <td>${escapeHtml(row.reason||'')}</td>
  </tr>`).join('');
}

function showImportResult(summaryText, failedRows, failedExportFileBase64='', failedExportFileName=''){
  lastFailedExportFileBase64=failedExportFileBase64||'';
  lastFailedExportFileName=failedExportFileName||'';
  const summaryEl=document.getElementById('importSummaryText');
  if(summaryEl) summaryEl.textContent=summaryText||'';
  renderImportFailures(failedRows||[]);
  document.getElementById('importResultModal')?.classList.remove('hidden');
}

function downloadFailedRowsFile(){
  if(!lastFailedExportFileBase64){
    return alert('No failed records file is available for download.');
  }

  try{
    const raw=atob(lastFailedExportFileBase64);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i+=1){
      bytes[i]=raw.charCodeAt(i);
    }
    const blob=new Blob([
      bytes
    ],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=lastFailedExportFileName||`failed_import_rows_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }catch(err){
    alert('Unable to download failed rows file.');
  }
}

async function importProjectsFromExcel(file){
  if(!file) return;
  const originalText=importExcelBtn ? importExcelBtn.textContent : 'Import Excel';
  if(importExcelBtn){
    importExcelBtn.disabled=true;
    importExcelBtn.textContent='Importing...';
  }

  try{
    const formData=new FormData();
    formData.append('file', file);
    const res=await fetch('/project/api/import',{method:'POST',body:formData});
    const data=await res.json();
    if(!res.ok || data.success===false){
      throw new Error(data.error||'Import failed');
    }

    const summaryText=data.message||`Imported ${data.imported_count||0} of ${data.total_rows||0}. ${data.failed_count||0} rows failed`;
    showImportResult(
      summaryText,
      data.failed_rows||[],
      data.failed_export_file_base64||'',
      data.failed_export_file_name||''
    );
    await loadDashboard();
  }catch(err){
    alert(err.message||'Unable to import projects');
  }finally{
    if(importExcelBtn){
      importExcelBtn.disabled=false;
      importExcelBtn.textContent=originalText;
    }
    if(importFileInput) importFileInput.value='';
  }
}

function hideSuggestions(){
  suggestionsEl.innerHTML='';
}

async function fetchElasticSuggestions(endpoint, query='', maxItems=500){
  const params=new URLSearchParams({q:String(query||''), max_items:String(maxItems)});
  const res=await fetch(endpoint+'?'+params.toString());
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||'Unable to load suggestions');
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

function hydrateInitiativeDatalist(listEl, suggestions){
  if(!listEl) return;
  const items=(suggestions||[])
    .map(item=>String(item||'').trim())
    .filter(Boolean);
  listEl.innerHTML=items.map(item=>`<option value="${escapeHtml(item)}"></option>`).join('');
}

function wireElasticSearch(inputEl, listEl, endpoint){
  if(!inputEl || !listEl) return;
  let debounceTimer=null;

  const refreshSuggestions=async()=>{
    try{
      const suggestions=await fetchElasticSuggestions(endpoint, inputEl.value||'', 500);
      hydrateInitiativeDatalist(listEl, suggestions);
    }catch(_err){
      hydrateInitiativeDatalist(listEl, []);
    }
  };

  inputEl.addEventListener('focus', refreshSuggestions);
  inputEl.addEventListener('input', ()=>{
    if(debounceTimer) clearTimeout(debounceTimer);
    debounceTimer=setTimeout(refreshSuggestions, 140);
  });
}

function renderBudgetBenefitModalFields(){
  const container=document.getElementById('mBudgetBenefitsFields');
  if(!container) return;
  const options=`
    <option value="">— Select —</option>
    <option value="Y">Y</option>
    <option value="N">N</option>
  `;
  container.innerHTML=`
    <label>
      <span class='field-label'>Budget Plan</span>
      <div class='segmented-choice' id='mBudgetChoiceGroup'>
        <button type='button' class='segmented-option' data-target='budget' data-value='Y'><span class='segmented-icon'>✓</span> Yes</button>
        <button type='button' class='segmented-option is-negative' data-target='budget' data-value='N'><span class='segmented-icon'>✕</span> No</button>
      </div>
    </label>
    <label>
      <span class='field-label'>Benefits Plan</span>
      <div class='segmented-choice' id='mBenefitsChoiceGroup'>
        <button type='button' class='segmented-option' data-target='benefits' data-value='Y'><span class='segmented-icon'>✓</span> Yes</button>
        <button type='button' class='segmented-option is-negative' data-target='benefits' data-value='N'><span class='segmented-icon'>✕</span> No</button>
      </div>
    </label>
    <div id="mBudgetBenefitFieldsContainer" style="display:contents;"></div>
  `;
  const years=[CURRENT_YEAR,NEXT_YEAR];
  const hiddenContainer=document.getElementById('mBudgetBenefitFieldsContainer');
  hiddenContainer.innerHTML=years.map(year=>`
    <select name="budget_${year}_flag" id="mBudget${year}" style="display:none;"></select>
    <select name="benefits_plan_${year}" id="mBenefits${year}" style="display:none;"></select>
  `).join('');
  years.forEach(year=>{
    const budgetSel=document.getElementById(`mBudget${year}`);
    const benefitsSel=document.getElementById(`mBenefits${year}`);
    if(budgetSel) budgetSel.innerHTML=options;
    if(benefitsSel) benefitsSel.innerHTML=options;
  });
  container.querySelectorAll('.segmented-option').forEach(button=>{
    button.addEventListener('click', ()=>syncModalBudgetBenefitValues(button.dataset.target, button.dataset.value));
  });
  syncModalBudgetBenefitValues('budget', '');
  syncModalBudgetBenefitValues('benefits', '');
}

function syncModalBudgetBenefitValues(target, selectedValue){
  const budgetVal=target==='budget' ? selectedValue : (document.getElementById(`mBudget${CURRENT_YEAR}`)?.value||'');
  const benefitsVal=target==='benefits' ? selectedValue : (document.getElementById(`mBenefits${CURRENT_YEAR}`)?.value||'');
  const years=[CURRENT_YEAR,NEXT_YEAR];
  years.forEach(year=>{
    const budgetSel=document.getElementById(`mBudget${year}`);
    const benefitsSel=document.getElementById(`mBenefits${year}`);
    if(budgetSel) budgetSel.value=budgetVal;
    if(benefitsSel) benefitsSel.value=benefitsVal;
  });
  document.querySelectorAll('#mBudgetChoiceGroup .segmented-option').forEach(button=>{
    button.classList.toggle('is-active', button.dataset.value===budgetVal);
  });
  document.querySelectorAll('#mBenefitsChoiceGroup .segmented-option').forEach(button=>{
    button.classList.toggle('is-active', button.dataset.value===benefitsVal);
  });
}

function renderAPModalBudgetBenefitFields(){
  const container=document.getElementById('apModalBudgetBenefitsFields');
  if(!container) return;
  const options=`
    <option value="">— Select —</option>
    <option value="Y">Y</option>
    <option value="N">N</option>
  `;
  container.innerHTML=`
    <label>
      <span class='field-label'>Budget Plan</span>
      <div class='segmented-choice' id='apModalBudgetChoiceGroup'>
        <button type='button' class='segmented-option' data-target='budget' data-value='Y'><span class='segmented-icon'>✓</span> Yes</button>
        <button type='button' class='segmented-option is-negative' data-target='budget' data-value='N'><span class='segmented-icon'>✕</span> No</button>
      </div>
    </label>
    <label>
      <span class='field-label'>Benefits Plan</span>
      <div class='segmented-choice' id='apModalBenefitsChoiceGroup'>
        <button type='button' class='segmented-option' data-target='benefits' data-value='Y'><span class='segmented-icon'>✓</span> Yes</button>
        <button type='button' class='segmented-option is-negative' data-target='benefits' data-value='N'><span class='segmented-icon'>✕</span> No</button>
      </div>
    </label>
    <div id="apModalBudgetBenefitFieldsContainer" style="display:contents;"></div>
  `;
  const years=[CURRENT_YEAR,NEXT_YEAR];
  const hiddenContainer=document.getElementById('apModalBudgetBenefitFieldsContainer');
  hiddenContainer.innerHTML=years.map(year=>`
    <select name="budget_${year}_flag" id="apModalBudget${year}" style="display:none;"></select>
    <select name="benefits_plan_${year}" id="apModalBenefits${year}" style="display:none;"></select>
  `).join('');
  years.forEach(year=>{
    const budgetSel=document.getElementById(`apModalBudget${year}`);
    const benefitsSel=document.getElementById(`apModalBenefits${year}`);
    if(budgetSel) budgetSel.innerHTML=options;
    if(benefitsSel) benefitsSel.innerHTML=options;
  });
  container.querySelectorAll('.segmented-option').forEach(button=>{
    button.addEventListener('click', ()=>syncAPModalBudgetBenefitValues(button.dataset.target, button.dataset.value));
  });
  syncAPModalBudgetBenefitValues('budget', '');
  syncAPModalBudgetBenefitValues('benefits', '');
}

function syncAPModalBudgetBenefitValues(target, selectedValue){
  const budgetVal=target==='budget' ? selectedValue : (document.getElementById(`apModalBudget${CURRENT_YEAR}`)?.value||'');
  const benefitsVal=target==='benefits' ? selectedValue : (document.getElementById(`apModalBenefits${CURRENT_YEAR}`)?.value||'');
  const years=[CURRENT_YEAR,NEXT_YEAR];
  years.forEach(year=>{
    const budgetSel=document.getElementById(`apModalBudget${year}`);
    const benefitsSel=document.getElementById(`apModalBenefits${year}`);
    if(budgetSel) budgetSel.value=budgetVal;
    if(benefitsSel) benefitsSel.value=benefitsVal;
  });
  document.querySelectorAll('#apModalBudgetChoiceGroup .segmented-option').forEach(button=>{
    button.classList.toggle('is-active', button.dataset.value===budgetVal);
  });
  document.querySelectorAll('#apModalBenefitsChoiceGroup .segmented-option').forEach(button=>{
    button.classList.toggle('is-active', button.dataset.value===benefitsVal);
  });
}

function getSelectedSelectValues(selectEl){
  if(!selectEl) return [];
  return Array.from(selectEl.selectedOptions || []).map(option=>option.value).filter(Boolean);
}

function formDataToPayload(formData){
  const payload={};
  for(const [key,value] of formData.entries()){
    if(payload[key]===undefined){
      payload[key]=value;
    }else if(Array.isArray(payload[key])){
      payload[key].push(value);
    }else{
      payload[key]=[payload[key], value];
    }
  }
  Object.keys(payload).forEach(key=>{
    if(Array.isArray(payload[key])){
      payload[key]=payload[key].join(', ');
    }
  });
  return payload;
}

function wireInteractiveHandlers(){
  dashboardEl.querySelectorAll('.initiative-row').forEach(hdr=>hdr.onclick=()=>{
    const gid=hdr.dataset.group;
    const rows=dashboardEl.querySelectorAll(`.group-row.${gid}`);
    const chevron=hdr.querySelector('.group-chevron');
    const isOpen=!rows.length?true:rows[0].style.display!=='none';
    rows.forEach(r=>r.style.display=isOpen?'none':'table-row');
    if(chevron) chevron.innerHTML=isOpen?'&#9654;':'&#9660;';
  });
  dashboardEl.querySelectorAll('.expand-desc').forEach(a=>a.onclick=(e)=>{e.preventDefault();const td=e.target.closest('td');td.querySelector('.desc-short').style.display='none';td.querySelector('.desc-full').style.display='inline';});
  dashboardEl.querySelectorAll('.collapse-desc').forEach(a=>a.onclick=(e)=>{e.preventDefault();const td=e.target.closest('td');td.querySelector('.desc-short').style.display='inline';td.querySelector('.desc-full').style.display='none';});
  dashboardEl.querySelectorAll('.view-btn').forEach(btn=>btn.onclick=(e)=>openProjectViewModal(e.currentTarget.closest('tr').dataset.id));
  dashboardEl.querySelectorAll('.update-btn').forEach(btn=>btn.onclick=(e)=>openStatusDialog(e.target.closest('tr').dataset.id));
  dashboardEl.querySelectorAll('.delete-btn').forEach(btn=>btn.onclick=(e)=>deleteProject(e.target.closest('tr').dataset.id));
  dashboardEl.querySelectorAll('.view-audit').forEach(btn=>btn.onclick=(e)=>openAudit(e.target.closest('tr').dataset.id));
  dashboardEl.querySelectorAll('.col-filter').forEach(sel=>sel.onchange=(e)=>{
    const key=e.target.dataset.key;
    const val=e.target.value;
    if(!val){
      delete currentFilters[key];
    }else{
      currentFilters[key]=[val];
    }
    currentPage=1;
    updateClearFiltersVisibility();
    loadDashboard();
  });
  dashboardEl.querySelectorAll('.th-sort[data-sort-key]').forEach(btn=>btn.onclick=(e)=>{
    e.preventDefault();
    const sortKey=e.currentTarget.dataset.sortKey||'';
    const nextDir=e.currentTarget.dataset.nextDir||'asc';
    if(!sortKey) return;
    currentSortKey=sortKey;
    currentSortDirection=nextDir==='desc' ? 'desc' : 'asc';
    currentPage=1;
    loadDashboard();
  });
  // Page navigation is handled by renderPageButtons()
  
  // Sync horizontal scrollbars
  syncHorizontalScrollbars();
}

function syncHorizontalScrollbars(){
  const topScrollWrapper=document.querySelector('.top-scroll-wrapper');
  const topScrollContent=document.querySelector('.top-scroll-content');
  
  if(!topScrollWrapper || !topScrollContent) return;
  
  // Get all table-scroll elements (can be multiple in grouped view)
  const tableScrolls=dashboardEl.querySelectorAll('.table-scroll');
  if(!tableScrolls.length) return;
  
  // Use the first table to determine width
  const firstTable=tableScrolls[0].querySelector('table');
  if(firstTable){
    // Set top scroll content width to match full scrollable table width
    topScrollContent.style.width=firstTable.scrollWidth+'px';
  }

  topScrollWrapper.scrollLeft=tableScrolls[0].scrollLeft;
  
  // Sync from top scrollbar to all table scrolls
  topScrollWrapper.onscroll=function(){
    if(isSyncingScroll) return;
    isSyncingScroll=true;
    tableScrolls.forEach(ts=>{
      ts.scrollLeft=topScrollWrapper.scrollLeft;
    });
    isSyncingScroll=false;
  };
  
  // Sync from any table scroll to top scrollbar and other tables
  tableScrolls.forEach(tableScroll=>{
    tableScroll.onscroll=function(){
      if(isSyncingScroll) return;
      isSyncingScroll=true;
      topScrollWrapper.scrollLeft=this.scrollLeft;
      tableScrolls.forEach(ts=>{
        if(ts!==this){
          ts.scrollLeft=this.scrollLeft;
        }
      });
      isSyncingScroll=false;
    };
  });
}

document.getElementById('pageSize').addEventListener('change',(e)=>{pageSize=Number(e.target.value);currentPage=1;loadDashboard();});
exportCsvBtn?.addEventListener('click',exportToCsv);
clearFiltersBtn?.addEventListener('click',clearAllFilters);
columnChooserBtn?.addEventListener('click',(event)=>{
  event.stopPropagation();
  toggleColumnChooserMenu();
});
document.getElementById('toggleGrouping')?.addEventListener('click',()=>{grouped=!grouped;currentPage=1;loadDashboard();});
document.getElementById('expandAll')?.addEventListener('click',()=>{dashboardEl.querySelectorAll('.initiative-row').forEach(h=>{const gid=h.dataset.group;dashboardEl.querySelectorAll(`.group-row.${gid}`).forEach(r=>r.style.display='table-row');const c=h.querySelector('.group-chevron');if(c) c.innerHTML='&#9660;';});});
document.getElementById('collapseAll')?.addEventListener('click',()=>{dashboardEl.querySelectorAll('.initiative-row').forEach(h=>{const gid=h.dataset.group;dashboardEl.querySelectorAll(`.group-row.${gid}`).forEach(r=>r.style.display='none');const c=h.querySelector('.group-chevron');if(c) c.innerHTML='&#9654;';});});
document.getElementById('mCancel').addEventListener('click',()=>document.getElementById('statusModal').classList.add('hidden'));
document.getElementById('mCancel1')?.addEventListener('click',()=>document.getElementById('statusModal').classList.add('hidden'));
document.getElementById('mCancel2')?.addEventListener('click',()=>document.getElementById('statusModal').classList.add('hidden'));
document.getElementById('mNext1')?.addEventListener('click',()=>setEditWizardStep(2));
document.getElementById('mBack2')?.addEventListener('click',()=>setEditWizardStep(1));
document.getElementById('mNext2')?.addEventListener('click',()=>setEditWizardStep(3));
document.getElementById('mBack3')?.addEventListener('click',()=>setEditWizardStep(2));
document.getElementById('mClose').addEventListener('click',()=>document.getElementById('statusModal').classList.add('hidden'));
document.getElementById('mSave').addEventListener('click',saveStatusDialog);
document.getElementById('mState').addEventListener('change',applyStatusModalRules);
document.getElementById('mOTD').addEventListener('change',applyStatusModalRules);
document.getElementById('projectUpdateSuccessCloseX')?.addEventListener('click', closeUpdateSuccessModal);
document.getElementById('projectUpdateSuccessBackToDashboard')?.addEventListener('click', ()=>{
  closeUpdateSuccessModal();
  loadDashboard();
});
document.getElementById('projectViewClose')?.addEventListener('click',closeProjectViewModal);
document.getElementById('projectViewCloseX')?.addEventListener('click',closeProjectViewModal);
document.getElementById('auditClose').addEventListener('click',()=>document.getElementById('auditModal').classList.add('hidden'));
document.getElementById('auditCloseX').addEventListener('click',()=>document.getElementById('auditModal').classList.add('hidden'));
document.getElementById('auditSort').addEventListener('change',()=>{const open=!document.getElementById('auditModal').classList.contains('hidden');if(open && currentAuditProjectId){openAudit(currentAuditProjectId);}});
document.getElementById('importResultClose')?.addEventListener('click',closeImportResultModal);
document.getElementById('importResultCloseX')?.addEventListener('click',closeImportResultModal);
document.getElementById('downloadFailedRows')?.addEventListener('click',downloadFailedRowsFile);
importExcelBtn?.addEventListener('click',()=>importFileInput?.click());
importFileInput?.addEventListener('change',()=>{
  const file=importFileInput.files && importFileInput.files[0];
  if(!file) return;
  importProjectsFromExcel(file);
});

search.addEventListener('input', async()=>{
  currentQuery=search.value.trim();
  currentPage=1;
  updateClearFiltersVisibility();
  loadDashboard();
  if(!currentQuery){hideSuggestions();return;}
  const res=await fetch('/project/api/search-suggestions?q='+encodeURIComponent(currentQuery));
  const data=await res.json();
  const items=(data.suggestions||[]).map(s=>`<div data-v='${encodeURIComponent(String(s))}'>${escapeHtml(s)}</div>`).join('');
  suggestionsEl.innerHTML=items?`<div class='suggestions-list'>${items}</div>`:'';
  suggestionsEl.querySelectorAll('.suggestions-list div').forEach(d=>d.onclick=()=>{
    const value=decodeURIComponent(d.dataset.v||'');
    search.value=value;
    currentQuery=value;
    hideSuggestions();
    updateClearFiltersVisibility();
    loadDashboard();
  });
});

search.addEventListener('keydown',(e)=>{
  if(e.key==='Escape') hideSuggestions();
});

document.addEventListener('click',(e)=>{
  if(!searchWrapEl || searchWrapEl.contains(e.target)) return;
  hideSuggestions();
});

document.addEventListener('click',(event)=>{
  if(!columnChooserMenu || !columnChooserBtn) return;
  if(columnChooserMenu.contains(event.target) || columnChooserBtn.contains(event.target)) return;
  closeColumnChooserMenu();
});

renderBudgetBenefitModalFields();
renderColumnChooserMenu();

// Add Project Modal Handler
let apModalStep=1;
const addProjectBtn=document.getElementById('addProjectBtn');
const addProjectModal=document.getElementById('addProjectModal');
const apModalForm=document.getElementById('apModalForm');
const apModalCharCount=document.getElementById('apModalCharCount');
const apModalDescInput=apModalForm?.querySelector('[name="description"]');
const apModalInitiativeInput=apModalForm?.querySelector('[name="initiative_name"]');
const apModalInitiativeSuggestions=document.getElementById('apModalInitiativeSuggestions');
const apModalProjectNameInput=apModalForm?.querySelector('[name="project_name"]');
const apModalProjectNameSuggestions=document.getElementById('apModalProjectNameSuggestions');
const apModalProjectDupAlert=document.getElementById('apModalProjectDupAlert');
const apModalProjectDupName=document.getElementById('apModalProjectDupName');
const apModalProjectDupMeta=document.getElementById('apModalProjectDupMeta');
const apModalProjectDupBadge=document.getElementById('apModalProjectDupBadge');
const apModalDupContinue=document.getElementById('apModalDupContinue');
const apModalDupUseExisting=document.getElementById('apModalDupUseExisting');
const apModalStateInput=apModalForm?.querySelector('[name="state"]');
const apModalOtdInput=apModalForm?.querySelector('[name="project_otd_status"]');
const apModalAdjustedInput=apModalForm?.querySelector('[name="adjusted_end_date"]');
const projectSuccessModal=document.getElementById('projectCreateSuccessModal');
const projectSuccessId=document.getElementById('projectSuccessId');
let apModalDupSelectedMatch=null;

function openProjectSuccessModal(projectId){
  if(projectSuccessId) projectSuccessId.textContent=projectId||'';
  projectSuccessModal?.classList.remove('hidden');
}

function closeProjectSuccessModal(){
  projectSuccessModal?.classList.add('hidden');
}

async function fetchProjectNameDuplicates(query, maxItems=3){
  const params=new URLSearchParams({q:String(query||''), max_items:String(maxItems)});
  const res=await fetch('/project/api/project-name-duplicates?'+params.toString());
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||'Unable to load duplicate project matches');
  return Array.isArray(data.matches) ? data.matches : [];
}

function hideAPModalDuplicateAlert(){
  if(apModalProjectDupAlert) apModalProjectDupAlert.classList.add('hidden');
  apModalDupSelectedMatch=null;
}

function renderAPModalDuplicateAlert(match){
  if(!apModalProjectDupAlert || !match) return;
  if(apModalProjectDupName) apModalProjectDupName.textContent=match.project_name||'';
  const meta=[match.project_id, match.initiative_name, match.state].filter(Boolean).join(' | ');
  if(apModalProjectDupMeta) apModalProjectDupMeta.textContent=meta;
  if(apModalProjectDupBadge) apModalProjectDupBadge.textContent=match.risk_badge||'NA';
  apModalProjectDupAlert.classList.remove('hidden');
}

async function checkAPModalProjectNameDuplicate(){
  const query=(apModalProjectNameInput?.value||'').trim();
  if(!query || query.length<3){
    hideAPModalDuplicateAlert();
    return;
  }
  try{
    const matches=await fetchProjectNameDuplicates(query, 3);
    if(!matches.length){
      hideAPModalDuplicateAlert();
      return;
    }
    apModalDupSelectedMatch=matches[0];
    renderAPModalDuplicateAlert(apModalDupSelectedMatch);
  }catch(_err){
    hideAPModalDuplicateAlert();
  }
}

function applyAPModalRules(){
  if(!apModalForm || !apModalStateInput || !apModalOtdInput || !apModalAdjustedInput) return;
  const apModalEstdInput=apModalForm.querySelector('[name="estd_end_date"]');
  const apModalEstdMandatoryHint=document.getElementById('apModalEstdMandatoryHint');
  const state=(apModalStateInput.value||'').trim();
  const enableOTD=state==='Active';
  if(!enableOTD) apModalOtdInput.value='';
  apModalOtdInput.disabled=!enableOTD;
  apModalOtdInput.required=enableOTD;
  if(apModalOtdInput.disabled){
    apModalOtdInput.title='OTD Status is enabled only when State is Active.';
    apModalOtdInput.setAttribute('aria-describedby','disabled-field-note');
  } else {
    apModalOtdInput.title='';
    apModalOtdInput.removeAttribute('aria-describedby');
  }
  const otdVal=(apModalOtdInput.value||'').toLowerCase().replace('-', ' ').trim();
  const showAdj=otdVal==='adjusted plan';
  const requireActualEndDate=otdVal==='on track' || otdVal==='slip';
  const adjWrap=document.getElementById('apModalAdjWrap');
  const warning=document.getElementById('apModalOtdWarning');
  if(apModalEstdInput) apModalEstdInput.required=requireActualEndDate;
  if(apModalEstdMandatoryHint) apModalEstdMandatoryHint.classList.toggle('hidden', !requireActualEndDate);
  if(adjWrap) adjWrap.style.display=showAdj ? 'flex' : 'none';
  apModalAdjustedInput.required=showAdj;
  apModalAdjustedInput.setCustomValidity(showAdj && !apModalAdjustedInput.value ? 'Please fill out this field.' : '');
  if(!showAdj) apModalAdjustedInput.value='';
  apModalAdjustedInput.disabled=!showAdj;
  if(warning) warning.classList.toggle('hidden', otdVal!=='slip');
}

function setAPModalStep(step){
  apModalStep=Math.max(1,Math.min(3,step));
  document.querySelectorAll('.apModal-step').forEach(el=>{
    const idx=Number(el.dataset.step||'1');
    el.classList.toggle('is-active', idx===apModalStep);
    el.classList.toggle('is-done', idx<apModalStep);
  });
  document.querySelectorAll('.apModal-panel').forEach(el=>{
    const idx=Number(el.dataset.panel||'1');
    el.classList.toggle('is-active', idx===apModalStep);
  });
}

function closeAPModal(){
  addProjectModal?.classList.add('hidden');
  if(apModalForm) apModalForm.reset();
  mDTTeamsPicklist?.setValues([]);
  renderAPModalBudgetBenefitFields();
  applyAPModalRules();
  hideAPModalDuplicateAlert();
  apModalStep=1;
  setAPModalStep(1);
}

function openAPModal(){
  addProjectModal?.classList.remove('hidden');
  apModalStep=1;
  setAPModalStep(1);
  if(apModalForm) apModalForm.reset();
  mDTTeamsPicklist?.setValues([]);
  renderAPModalBudgetBenefitFields();
  applyAPModalRules();
  hideAPModalDuplicateAlert();
}

if(addProjectBtn){
  addProjectBtn.addEventListener('click',(e)=>{
    e.preventDefault();
    openAPModal();
  });
}

if(addProjectModal){
  document.getElementById('addProjCloseX')?.addEventListener('click',closeAPModal);
  document.getElementById('apModalCancel1')?.addEventListener('click',closeAPModal);
  document.getElementById('apModalCancel2')?.addEventListener('click',closeAPModal);
  document.getElementById('apModalCancel3')?.addEventListener('click',closeAPModal);
  document.getElementById('apModalNext1')?.addEventListener('click',()=>setAPModalStep(2));
  document.getElementById('apModalBack2')?.addEventListener('click',()=>setAPModalStep(1));
  document.getElementById('apModalNext2')?.addEventListener('click',()=>setAPModalStep(3));
  document.getElementById('apModalBack3')?.addEventListener('click',()=>setAPModalStep(2));
  apModalStateInput?.addEventListener('change',applyAPModalRules);
  apModalOtdInput?.addEventListener('change',applyAPModalRules);
  
  // Character counter for description
  if(apModalDescInput && apModalCharCount){
    apModalDescInput.addEventListener('input',()=>{
      apModalCharCount.textContent=apModalDescInput.value.length;
    });
  }

  let apModalDuplicateDebounceTimer=null;
  apModalProjectNameInput?.addEventListener('input', ()=>{
    if(apModalDuplicateDebounceTimer) clearTimeout(apModalDuplicateDebounceTimer);
    apModalDuplicateDebounceTimer=setTimeout(checkAPModalProjectNameDuplicate, 180);
  });
  apModalProjectNameInput?.addEventListener('blur', checkAPModalProjectNameDuplicate);

  apModalDupContinue?.addEventListener('click', ()=>{
    if(!apModalProjectNameInput) return;
    apModalProjectNameInput.value='';
    apModalProjectNameInput.dispatchEvent(new Event('input', {bubbles:true}));
    hideAPModalDuplicateAlert();
    apModalProjectNameInput.focus();
    checkAPModalProjectNameDuplicate();
  });
  apModalDupUseExisting?.addEventListener('click', ()=>{
    const projectId=apModalDupSelectedMatch?.project_id;
    if(!projectId) return;
    closeAPModal();
    openStatusDialog(projectId);
  });

  // Form submission
  apModalForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    applyAPModalRules();
    if(!apModalForm.checkValidity()){
      apModalForm.reportValidity();
      return;
    }
    const formData=new FormData(apModalForm);
    const payload=formDataToPayload(formData);
    
    try{
      const res=await fetch('/project/add', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await res.json();
      
      if(!data.success){
        alert((data.errors||[]).map(e=>`${e.field}: ${e.message}`).join('\n')||data.error||'Failed to create project');
        return;
      }
      
      closeAPModal();
      openProjectSuccessModal(data.project_id);
      await loadDashboard();
    }catch(err){
      alert('Error creating project: '+err.message);
    }
  });
}

wireElasticSearch(apModalInitiativeInput, apModalInitiativeSuggestions, '/project/api/initiative-suggestions');
wireElasticSearch(apModalProjectNameInput, apModalProjectNameSuggestions, '/project/api/project-name-suggestions');
wireElasticSearch(mInitiativeInput, mInitiativeSuggestions, '/project/api/initiative-suggestions');
wireElasticSearch(mProjectInput, mProjectNameSuggestions, '/project/api/project-name-suggestions');

const mEditDTTeamsPicklist=initMultiPicklist(document.getElementById('mEditDTTeamsPicklist'));
const mDTTeamsPicklist=initMultiPicklist(document.getElementById('mDTTeamsPicklist'));
renderAPModalBudgetBenefitFields();
applyAPModalRules();
document.getElementById('projectSuccessCloseX')?.addEventListener('click', closeProjectSuccessModal);
document.getElementById('projectSuccessAddAnother')?.addEventListener('click', ()=>{
  closeProjectSuccessModal();
  openAPModal();
});
document.getElementById('projectSuccessBackToDashboard')?.addEventListener('click', ()=>{
  closeProjectSuccessModal();
  loadDashboard();
});

loadDashboard();
