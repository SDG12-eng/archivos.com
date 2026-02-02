import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBdRea_F8YpEuwPiXiH5c6V3mqRC-jA18g",
    authDomain: "archivos-351d3.firebaseapp.com",
    projectId: "archivos-351d3",
    storageBucket: "archivos-351d3.firebasestorage.app",
    messagingSenderId: "1024267964788",
    appId: "1:1024267964788:web:27b02f5c6a5ac8256c1c21"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let sessionUser = JSON.parse(localStorage.getItem('user_session')) || null;
let detailsModal, biChart, chartTimeline, chartUsers;

// --- GLOBAL: Navegación & Permisos ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if(id === 'panel-admin') { window.loadGroups(); window.loadTemplates(); window.loadUsers(); }
    if(id === 'dashboard') window.loadStats();
    if(id === 'mis-registros') window.loadHistory(false);
    if(id === 'historial-maestro') window.loadHistory(true);
    if(id === 'nuevo-registro') window.loadTemplates();
    
    const nav = document.getElementById('navMain');
    if(nav && nav.classList.contains('show')) document.querySelector('.navbar-toggler').click();
};

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

window.applyPermissions = () => {
    if(!sessionUser) return;
    const permMap = { 'nav-dashboard':'dashboard', 'nav-registrar':'registrar', 'nav-misregistros':'misregistros', 'nav-admin':'admin', 'nav-historial':'historial' };
    const isSuper = (sessionUser.username === "Admin");
    
    // Toggle Menu Items
    for (const [navId, permKey] of Object.entries(permMap)) {
        const el = document.getElementById(navId);
        if(el) el.classList.toggle('d-none', !(isSuper || (sessionUser.perms && sessionUser.perms.includes(permKey))));
    }

    // Toggle KPI Usuarios (Solo Admin)
    const kpiUser = document.getElementById('kpi-users-container');
    if(kpiUser) kpiUser.classList.toggle('d-none', !isSuper);
};

// --- GESTIÓN DE FORMULARIOS (CRUD + EDICIÓN) ---

window.loadGroups = async () => {
    const s = await getDocs(collection(db,"groups")); 
    let o = '<option value="">-- Grupo --</option>'; 
    s.forEach(d=>{ o+=`<option value="${d.id}">${d.id}</option>`; });
    document.querySelectorAll('.group-dropdown-source').forEach(e=>e.innerHTML=o);
};
window.saveGroup = async () => { const n = document.getElementById('group-name-input').value.trim(); if(n) { await setDoc(doc(db,"groups",n),{name:n}); window.loadGroups(); document.getElementById('group-name-input').value=""; } };

window.loadTemplates = async () => {
    const snap = await getDocs(collection(db, "templates"));
    const regSelect = document.getElementById('reg-template-select');
    const adminList = document.getElementById('templates-list');
    const biSelect = document.getElementById('bi-template-select');
    let regOpts = '<option value="">-- Seleccionar --</option>', biOpts = regOpts, adminHtml = "";

    snap.forEach(d => {
        const t = d.data();
        const isSuper = sessionUser.username === "Admin";
        const hasAccess = sessionUser.userGroup === t.group || !t.group;
        if(isSuper || hasAccess) { biOpts += `<option value="${d.id}">${t.name}</option>`; regOpts += `<option value="${d.id}">${t.name}</option>`; }
        
        // Botones de Admin: Editar y Borrar
        adminHtml += `
            <div class="list-group-item d-flex justify-content-between align-items-center p-2">
                <span>${t.name} <small class="text-muted">(${t.group})</small></span>
                <div>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editTemplate('${d.id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${d.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </div>`;
    });
    if(regSelect) regSelect.innerHTML = regOpts; if(adminList) adminList.innerHTML = adminHtml; if(biSelect) biSelect.innerHTML = biOpts;
};

// ** Nueva Función: Editar Template **
window.editTemplate = async (id) => {
    const d = await getDoc(doc(db, "templates", id));
    if(!d.exists()) return;
    const t = d.data();

    document.getElementById('edit-template-id').value = id;
    document.getElementById('type-name').value = t.name;
    document.getElementById('type-group-select').value = t.group;
    
    // Limpiar y reconstruir campos
    const container = document.getElementById('admin-fields-builder');
    container.innerHTML = "";
    t.fields.forEach(f => {
        window.addBuilderField(f.label, f.type, f.options, f.isAnalyzable);
    });

    // UI Updates
    document.getElementById('btn-save-template').innerText = "ACTUALIZAR FORMULARIO";
    document.getElementById('btn-save-template').classList.replace('btn-primary', 'btn-warning');
    document.getElementById('btn-cancel-edit-tpl').classList.remove('d-none');
    window.scrollTo(0,0);
};

window.cancelEditTemplate = () => {
    document.getElementById('edit-template-id').value = "";
    document.getElementById('type-name').value = "";
    document.getElementById('admin-fields-builder').innerHTML = "";
    document.getElementById('btn-save-template').innerText = "PUBLICAR FORMULARIO";
    document.getElementById('btn-save-template').classList.replace('btn-warning', 'btn-primary');
    document.getElementById('btn-cancel-edit-tpl').classList.add('d-none');
};

// ** Builder con Checkbox de Análisis **
window.addBuilderField = (label="", type="text", options="", isAnalyzable=false) => {
    const c = document.getElementById('admin-fields-builder');
    const d = document.createElement('div');
    d.className = "builder-row p-2 mb-2 border rounded bg-white";
    
    // Toggle para input de opciones
    const showOpts = type === 'select' ? '' : 'd-none';
    const checked = isAnalyzable ? 'checked' : '';

    d.innerHTML = `
        <div class="d-flex gap-2 mb-1">
            <input type="text" class="form-control form-control-sm f-label" placeholder="Nombre Campo" value="${label}">
            <select class="form-select form-select-sm f-type" onchange="toggleOpts(this)" style="width:120px;">
                <option value="text" ${type==='text'?'selected':''}>Texto</option>
                <option value="number" ${type==='number'?'selected':''}>Número</option>
                <option value="select" ${type==='select'?'selected':''}>Lista</option>
                <option value="checkbox" ${type==='checkbox'?'selected':''}>Casilla</option>
                <option value="date" ${type==='date'?'selected':''}>Fecha</option>
                <option value="signature" ${type==='signature'?'selected':''}>Firma</option>
            </select>
            <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.parentElement.remove()"><i class="bi bi-x"></i></button>
        </div>
        <input type="text" class="form-control form-control-sm f-opts ${showOpts} mb-1" placeholder="Opciones (Ej: Rojo,Verde)" value="${options}">
        <div class="form-check form-switch">
            <input class="form-check-input f-analyzable" type="checkbox" ${checked}>
            <label class="form-check-label small text-muted">¿Analizar en BI?</label>
        </div>
    `;
    c.appendChild(d);
};

window.toggleOpts = (el) => {
    const inp = el.parentElement.nextElementSibling; // El input de opciones es el siguiente hermano del div padre
    if(el.value === 'select') inp.classList.remove('d-none'); else inp.classList.add('d-none');
};

window.saveTemplate = async () => {
    const id = document.getElementById('edit-template-id').value;
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('.builder-row');
    
    if(!name) return alert("Nombre requerido");
    
    let fields = [];
    rows.forEach(r => {
        fields.push({
            label: r.querySelector('.f-label').value,
            type: r.querySelector('.f-type').value,
            options: r.querySelector('.f-opts').value,
            isAnalyzable: r.querySelector('.f-analyzable').checked // Guardamos el flag
        });
    });

    const data = { name, group, fields };
    
    if(id) {
        await updateDoc(doc(db, "templates", id), data);
        alert("Formulario Actualizado");
        window.cancelEditTemplate();
    } else {
        await addDoc(collection(db, "templates"), data); // Usar ID auto de firebase para evitar conflictos
        alert("Formulario Publicado");
    }
    
    document.getElementById('type-name').value = "";
    document.getElementById('admin-fields-builder').innerHTML = "";
    window.loadTemplates();
};

window.deleteTemplate = async (id) => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db,"templates",id)); window.loadTemplates(); }};

// --- RENDERIZADO Y USO ---
window.renderDynamicFields = async () => {
    const id = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; if(!id) return;
    const d = await getDoc(doc(db, "templates", id));
    if (d.exists()) {
        d.data().fields.forEach((f, idx) => {
            const w = document.createElement('div');
            w.className = f.type==='signature'?"col-12":"col-md-6"; 
            let html = "";
            if(f.type==='select') {
                const o = f.options.split(',').map(x=>`<option value="${x.trim()}">${x.trim()}</option>`).join('');
                html = `<select class="form-select dyn-input" data-label="${f.label}"><option value="">--</option>${o}</select>`;
            } else if(f.type==='checkbox') {
                html = `<div class="form-check pt-4"><input class="form-check-input dyn-input" type="checkbox" data-label="${f.label}"><label class="form-check-label">${f.label}</label></div>`;
                w.innerHTML=html; cont.appendChild(w); return;
            } else if(f.type==='signature') {
                html = `<label class="fw-bold">${f.label}</label><canvas id="sig-${idx}" class="signature-pad"></canvas>
                        <button type="button" class="btn btn-sm btn-light border mt-1" onclick="clearCanvas(${idx})">Limpiar</button>
                        <input type="hidden" class="dyn-input" data-type="signature" data-label="${f.label}" id="inp-${idx}">`;
            } else {
                html = `<input type="${f.type}" class="form-control dyn-input" data-label="${f.label}">`;
            }
            w.innerHTML = f.type!=='signature' ? `<label class="small fw-bold">${f.label}</label>${html}` : html;
            cont.appendChild(w);
            if(f.type==='signature') window.initCanvas(idx);
        });
    }
};

// --- BI & ANALYTICS ---
// Filtra campos para mostrar SOLO los marcados como "isAnalyzable"
window.loadTemplateFieldsForBI = async () => {
    const id = document.getElementById('bi-template-select').value;
    const sel = document.getElementById('bi-field-select');
    sel.innerHTML = '<option value="">-- Campo --</option>';
    if(!id) return;
    const d = await getDoc(doc(db, "templates", id));
    if(d.exists()) {
        d.data().fields.forEach(f => {
            // Mostrar si es analizable
            if(f.isAnalyzable) {
                sel.innerHTML += `<option value="${f.label}">${f.label}</option>`;
            }
        });
    }
};

window.runCustomAnalysis = async () => {
    const tid = document.getElementById('bi-template-select').value;
    const fld = document.getElementById('bi-field-select').value;
    if(!tid || !fld) return alert("Selecciona formulario y campo");

    let q = query(collection(db, "records"), where("templateId", "==", tid));
    if(sessionUser.username !== "Admin") q = query(q, where("group", "==", sessionUser.userGroup));

    const snap = await getDocs(q);
    const data = {};
    let total = 0;

    snap.forEach(d => {
        const r = d.data();
        const item = r.details[fld];
        let val = item ? item.value : "N/A";
        if(val===true || val==='on') val = "Sí"; if(val===false) val = "No";
        data[val] = (data[val] || 0) + 1;
        total++;
    });
    
    // Render
    const ctx = document.getElementById('biChart');
    if(biChart) biChart.destroy();
    biChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    document.getElementById('bi-stats-container').innerHTML = Object.entries(data).map(([k,v])=>
        `<div class="d-flex justify-content-between border-bottom p-2"><span>${k}</span><b>${v}</b></div>`
    ).join('');
};

window.loadStats = async () => {
    const rSnap = await getDocs(collection(db,"records"));
    const tSnap = await getDocs(collection(db,"templates"));
    const uSnap = await getDocs(collection(db,"users"));
    document.getElementById('dash-total').innerText = rSnap.size;
    document.getElementById('dash-forms').innerText = tSnap.size;
    document.getElementById('dash-users').innerText = uSnap.size;

    // Gráficos Estáticos (Timeline & Top Users)
    const timeline={}, users={};
    rSnap.forEach(doc => {
        const d = doc.data();
        const date = d.date.split(',')[0];
        timeline[date] = (timeline[date] || 0) + 1;
        users[d.user] = (users[d.user] || 0) + 1;
    });

    if(chartTimeline) chartTimeline.destroy();
    chartTimeline = new Chart(document.getElementById('chartTimeline'), {
        type: 'line',
        data: { labels: Object.keys(timeline), datasets: [{ label: 'Registros por Día', data: Object.values(timeline), borderColor: '#0d6efd', fill:true, backgroundColor:'rgba(13,110,253,0.1)' }] },
        options: { maintainAspectRatio: false }
    });

    if(chartUsers) chartUsers.destroy();
    chartUsers = new Chart(document.getElementById('chartUsers'), {
        type: 'bar',
        data: { labels: Object.keys(users), datasets: [{ label: 'Registros', data: Object.values(users), backgroundColor: '#198754' }] },
        options: { maintainAspectRatio: false }
    });
};

// --- USUARIOS & PERMISOS (Igual que versión anterior) ---
window.loadUsers = async () => {
    const term = document.getElementById('search-user') ? document.getElementById('search-user').value.toLowerCase() : "";
    const list = document.getElementById('users-list');
    if(!list) return; list.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
        const u = d.data();
        if(term && !u.username.toLowerCase().includes(term)) return;
        list.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${u.username}</strong> <small>(${u.userGroup})</small></div><div><button class="btn btn-sm btn-outline-primary" onclick="editUser('${d.id}','${u.username}','${u.email}','${u.userGroup}','${u.perms?u.perms.join(','):''}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')"><i class="bi bi-trash"></i></button></div></li>`;
    });
};
window.editUser = (id,u,e,g,p)=>{document.getElementById('edit-user-id').value=id;document.getElementById('new-username').value=u;document.getElementById('new-email').value=e;document.getElementById('new-user-group-select').value=g;const ps=p?p.split(','):[];['dashboard','registrar','misregistros','admin','historial'].forEach(k=>document.getElementById('perm-'+k).checked=ps.includes(k));document.getElementById('btn-cancel-edit').classList.remove('d-none');document.getElementById('btn-user-submit').innerText="Actualizar";};
window.cancelEditUser=()=>{document.getElementById('create-user-form').reset();document.getElementById('edit-user-id').value="";document.getElementById('btn-cancel-edit').classList.add('d-none');document.getElementById('btn-user-submit').innerText="Guardar";};
window.deleteUser=async(id)=>{if(confirm("Eliminar?")){await deleteDoc(doc(db,"users",id));window.loadUsers();}};
document.getElementById('create-user-form')?.addEventListener('submit',async(e)=>{e.preventDefault();const id=document.getElementById('edit-user-id').value;const u={username:document.getElementById('new-username').value,email:document.getElementById('new-email').value,userGroup:document.getElementById('new-user-group-select').value,perms:[]};const p=document.getElementById('new-password').value;if(p)u.password=p;['dashboard','registrar','misregistros','admin','historial'].forEach(k=>{if(document.getElementById('perm-'+k).checked)u.perms.push(k)});if(id){await updateDoc(doc(db,"users",id),u);window.cancelEditUser();}else{await addDoc(collection(db,"users"),u);e.target.reset();}window.loadUsers();});

// --- HISTORIAL & EXPORTAR ---
window.loadHistory = async (isAdmin) => {
    const tb = document.getElementById(isAdmin ? 'historial-table-body' : 'user-history-body');
    if(!tb) return;
    let q = query(collection(db,"records"), orderBy("timestamp","desc"));
    if(!isAdmin) q = query(collection(db,"records"), where("user","==",sessionUser.username), orderBy("timestamp","desc"));
    
    try {
        const s = await getDocs(q); tb.innerHTML = "";
        s.forEach(d=>{
            const r = d.data();
            const safe = encodeURIComponent(JSON.stringify(r.details));
            const fileIcon = (r.fileUrl && r.fileUrl !== "Sin archivo") ? `<a href="${r.fileUrl}" target="_blank" class="text-danger"><i class="bi bi-paperclip"></i></a>` : '-';
            let row = `<tr><td>${r.date.split(',')[0]}</td>`;
            if(isAdmin) row += `<td>${r.user}</td>`;
            row += `<td>${r.templateName}</td><td>${fileIcon}</td>`;
            row += isAdmin ? `<td>...</td><td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safe}')"><i class="bi bi-eye"></i></button> <button class="btn btn-sm btn-danger" onclick="deleteRecord('${d.id}')"><i class="bi bi-trash"></i></button></td>` : `<td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safe}')">Ver</button></td>`;
            tb.innerHTML += row + '</tr>';
        });
    } catch(e){console.error(e);}
};
window.deleteRecord = async (id) => { if(confirm("Borrar?")) { await deleteDoc(doc(db,"records",id)); window.loadHistory(true); }};
window.viewDetails = (safe) => {
    const data = JSON.parse(decodeURIComponent(safe));
    const mb = document.getElementById('modal-details-body');
    mb.innerHTML = "<div class='row g-2'>" + Object.entries(data).map(([k,v])=>`<div class="col-6"><div class="border p-2 rounded"><small class="fw-bold">${k}</small><div>${v.type==='image'?`<img src="${v.value}" class="img-fluid" style="max-height:100px">`:v.value}</div></div></div>`).join('') + "</div>";
    new bootstrap.Modal(document.getElementById('detailsModal')).show();
};
window.exportTableToExcel = (id, name) => {
    let t = document.getElementById(id).cloneNode(true);
    const r = t.rows; for(let i=0;i<r.length;i++) if(r[i].cells.length>0) r[i].deleteCell(-1); // Quitar acciones
    const html = t.outerHTML.replace(/ /g, '%20');
    const a = document.createElement("a"); a.href = 'data:application/vnd.ms-excel,' + html; a.download = name + '.xls'; a.click();
};
window.filterTable = (id, txt) => { document.querySelectorAll(`#${id} tbody tr`).forEach(r => r.style.display = r.innerText.toLowerCase().includes(txt.toLowerCase()) ? '' : 'none'); };
window.filterTableByDate = () => {
    const d1 = document.getElementById('filter-date-start').value; const d2 = document.getElementById('filter-date-end').value;
    document.querySelectorAll('#global-history-table tbody tr').forEach(r => {
        const d = r.cells[0].innerText.split('/').reverse().join('-'); 
        let s = true; if(d1 && d < d1) s=false; if(d2 && d > d2) s=false;
        r.style.display = s ? '' : 'none';
    });
};

// Canvas & Login Helpers (Sin cambios mayores, copiar del anterior si hace falta)
window.initCanvas=(i)=>{const c=document.getElementById(`sig-${i}`);if(!c)return;const x=c.getContext('2d');c.width=c.offsetWidth;c.height=c.offsetHeight;let d=false;c.onmousedown=(e)=>{d=true;x.beginPath();x.moveTo(e.offsetX,e.offsetY)};c.onmousemove=(e)=>{if(d){x.lineTo(e.offsetX,e.offsetY);x.stroke()}};c.onmouseup=()=>d=false;c.ontouchstart=(e)=>{e.preventDefault();d=true;const r=c.getBoundingClientRect();x.beginPath();x.moveTo(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top)};c.ontouchmove=(e)=>{e.preventDefault();if(d){const r=c.getBoundingClientRect();x.lineTo(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top);x.stroke()}};c.ontouchend=()=>d=false;};window.clearCanvas=(i)=>{const c=document.getElementById(`sig-${i}`);c.getContext('2d').clearRect(0,0,c.width,c.height);};
document.getElementById('login-form')?.addEventListener('submit',async(e)=>{e.preventDefault();const u=document.getElementById('login-user').value,p=document.getElementById('login-pass').value;if(u==="Admin"&&p==="1130"){loginSuccess({username:"Admin",group:"admin",userGroup:"IT",perms:['dashboard','registrar','misregistros','admin','historial']});return;}const q=query(collection(db,"users"),where("username","==",u),where("password","==",p));const s=await getDocs(q);if(!s.empty)loginSuccess(s.docs[0].data());else alert("Error");});function loginSuccess(u){localStorage.setItem('user_session',JSON.stringify(u));location.reload();}
document.getElementById('dynamic-upload-form')?.addEventListener('submit', async(e)=>{e.preventDefault();const tid=document.getElementById('reg-template-select').value,tname=document.getElementById('reg-template-select').options[document.getElementById('reg-template-select').selectedIndex].text;let det={};document.querySelectorAll('.dyn-input').forEach(i=>{const l=i.getAttribute('data-label');let v=i.value,t='text';if(i.type==='checkbox')v=i.checked;if(i.type==='hidden'&&i.id.startsWith('inp-')){const x=i.id.split('-')[1];v=document.getElementById(`sig-${x}`).toDataURL();t='image';}det[l]={type:t,value:v};});const f=document.getElementById('reg-file').files[0];const fu=f?"Archivo adjunto":"Sin archivo";await addDoc(collection(db,"records"),{templateId:tid,templateName:tname,user:sessionUser.username,group:sessionUser.userGroup,date:new Date().toLocaleString(),timestamp:Date.now(),details:det,fileUrl:fu});alert("Guardado");e.target.reset();document.getElementById('dynamic-fields-container').innerHTML="";window.loadStats();});

if(sessionUser){document.getElementById('login-screen').classList.add('d-none');document.getElementById('app-screen').classList.remove('d-none');document.getElementById('user-display').innerText=sessionUser.username;document.getElementById('group-display').innerText=sessionUser.userGroup||"";window.applyPermissions();window.loadGroups();window.loadTemplates();window.loadStats();}
