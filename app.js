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
let detailsModal;
let biChart = null;
let chartTimeline = null;
let chartUsers = null;

// --- FUNCIONES GLOBALES ---

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if(id === 'panel-admin') { window.loadGroups(); window.loadTemplates(); window.loadUsers(); }
    if(id === 'dashboard') window.loadStats();
    if(id === 'mis-registros') window.loadHistory(false);
    if(id === 'historial-maestro') window.loadHistory(true);
    if(id === 'nuevo-registro') window.loadTemplates();
    
    // Cerrar menú móvil
    const nav = document.getElementById('navMain');
    if(nav && nav.classList.contains('show')) document.querySelector('.navbar-toggler').click();
};

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

window.applyPermissions = () => {
    if(!sessionUser) return;
    const permMap = { 'nav-dashboard':'dashboard', 'nav-registrar':'registrar', 'nav-misregistros':'misregistros', 'nav-admin':'admin', 'nav-historial':'historial' };
    const isSuper = (sessionUser.username === "Admin");
    for (const [navId, permKey] of Object.entries(permMap)) {
        const el = document.getElementById(navId);
        if(el) el.classList.toggle('d-none', !(isSuper || (sessionUser.perms && sessionUser.perms.includes(permKey))));
    }
};

// --- CRUD BASE ---
window.loadGroups = async () => {
    const s = await getDocs(collection(db,"groups")); 
    let o = '<option value="">-- Seleccionar --</option>'; 
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
        const hasGroupAccess = sessionUser.userGroup === t.group || !t.group;
        if(isSuper || hasGroupAccess) { biOpts += `<option value="${d.id}">${t.name}</option>`; regOpts += `<option value="${d.id}">${t.name}</option>`; }
        adminHtml += `<div class="list-group-item d-flex justify-content-between p-2"><span>${t.name} <small class="text-muted">(${t.group})</small></span><button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${d.id}')">X</button></div>`;
    });
    if(regSelect) regSelect.innerHTML = regOpts; if(adminList) adminList.innerHTML = adminHtml; if(biSelect) biSelect.innerHTML = biOpts;
};
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('.builder-row');
    if(!name) return alert("Nombre requerido");
    let fields = [];
    rows.forEach(r => { fields.push({ label: r.querySelector('.f-label').value, type: r.querySelector('.f-type').value, options: r.querySelector('.f-opts') ? r.querySelector('.f-opts').value : "" }); });
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Publicado"); window.loadTemplates();
};
window.deleteTemplate = async (id) => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db,"templates",id)); window.loadTemplates(); }};

// --- USUARIOS ---
window.loadUsers = async () => {
    const term = document.getElementById('search-user') ? document.getElementById('search-user').value.toLowerCase() : "";
    const list = document.getElementById('users-list');
    if(!list) return; list.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
        const u = d.data();
        if(term && !u.username.toLowerCase().includes(term)) return;
        list.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${u.username}</strong> <small>(${u.userGroup})</small><br><small>${u.email||''}</small></div><div><button class="btn btn-sm btn-outline-primary" onclick="editUser('${d.id}','${u.username}','${u.email}','${u.userGroup}','${u.perms?u.perms.join(','):''}')">Edit</button> <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')">X</button></div></li>`;
    });
};
window.editUser = (id, u, e, g, p) => {
    document.getElementById('edit-user-id').value = id; document.getElementById('new-username').value = u; document.getElementById('new-email').value = e; document.getElementById('new-user-group-select').value = g;
    const perms = p ? p.split(',') : [];
    ['dashboard','registrar','misregistros','admin','historial'].forEach(k => document.getElementById('perm-'+k).checked = perms.includes(k));
    document.getElementById('btn-cancel-edit').classList.remove('d-none');
};
window.cancelEditUser = () => { document.getElementById('create-user-form').reset(); document.getElementById('edit-user-id').value=""; document.getElementById('btn-cancel-edit').classList.add('d-none'); };
window.deleteUser = async (id) => { if(confirm("Eliminar?")) { await deleteDoc(doc(db,"users",id)); window.loadUsers(); }};
document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const u = { username: document.getElementById('new-username').value, email: document.getElementById('new-email').value, userGroup: document.getElementById('new-user-group-select').value, perms: [] };
    const p = document.getElementById('new-password').value; if(p) u.password = p;
    ['dashboard','registrar','misregistros','admin','historial'].forEach(k => { if(document.getElementById('perm-'+k).checked) u.perms.push(k); });
    if(id) { await updateDoc(doc(db,"users",id),u); window.cancelEditUser(); } else { await addDoc(collection(db,"users"),u); e.target.reset(); }
    window.loadUsers();
});

// --- HISTORIAL MEJORADO ---
window.loadHistory = async (isAdmin) => {
    const tb = document.getElementById(isAdmin ? 'historial-table-body' : 'user-history-body');
    if(!tb) return;
    let q = query(collection(db,"records"), orderBy("timestamp","desc"));
    if(!isAdmin) q = query(collection(db,"records"), where("user","==",sessionUser.username), orderBy("timestamp","desc"));
    
    try {
        const s = await getDocs(q);
        tb.innerHTML = "";
        s.forEach(d=>{
            const r = d.data();
            const safe = encodeURIComponent(JSON.stringify(r.details));
            // Icono de adjunto
            const fileIcon = (r.fileUrl && r.fileUrl !== "Sin archivo") 
                ? `<a href="${r.fileUrl}" target="_blank" class="btn btn-sm btn-light border text-danger" title="Ver adjunto"><i class="bi bi-paperclip"></i></a>` 
                : '<span class="text-muted">-</span>';

            let row = `<tr>
                <td class="date-cell">${r.date.split(',')[0]}</td>`; // Solo fecha para tabla
            
            if(isAdmin) row += `<td>${r.user}</td>`;
            row += `<td>${r.templateName}</td>
                    <td>${fileIcon}</td>`;
            
            if(isAdmin) {
                row += `<td>...</td><td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safe}')">Ver</button> <button class="btn btn-sm btn-danger" onclick="deleteRecord('${d.id}')">X</button></td>`;
            } else {
                row += `<td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safe}')">Ver Detalles</button></td>`;
            }
            row += `</tr>`;
            tb.innerHTML += row;
        });
    } catch (e) { console.error(e); tb.innerHTML="<tr><td colspan='6'>Error de índices. Ver consola.</td></tr>"; }
};

// --- FILTROS DE TABLA (CLIENT SIDE) ---
window.filterTable = (tableId, query) => {
    const trs = document.querySelectorAll(`#${tableId} tbody tr`);
    query = query.toLowerCase();
    trs.forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
};

window.filterTableByDate = () => {
    const start = document.getElementById('filter-date-start').value;
    const end = document.getElementById('filter-date-end').value;
    if(!start && !end) return;

    const trs = document.querySelectorAll('#global-history-table tbody tr');
    trs.forEach(tr => {
        const dateText = tr.querySelector('.date-cell').innerText; // formato dd/mm/yyyy o similar
        // Convertir string de fecha a objeto Date depende del locale, asumimos formato simple
        // Para simplificar comparamos strings ISO si están disponibles, sino parseo simple
        // Aquí usaremos la comparación de texto simple si el formato coincide, o Date parsing
        // Mejor aproximación:
        const rowDate = new Date(dateText.split('/').reverse().join('-')); // dd/mm/yyyy -> yyyy-mm-dd
        
        let show = true;
        if(start && rowDate < new Date(start)) show = false;
        if(end && rowDate > new Date(end)) show = false;
        tr.style.display = show ? '' : 'none';
    });
};

// --- EXPORTAR A EXCEL (.XLS) ---
window.exportTableToExcel = (tableId, filename) => {
    let downloadLink;
    const dataType = 'application/vnd.ms-excel';
    const tableSelect = document.getElementById(tableId);
    
    // Clonar tabla para evitar modificar la original (ocultar botones)
    const tableClone = tableSelect.cloneNode(true);
    // Remover última columna (acciones) en el clon
    const rows = tableClone.rows;
    for (let i = 0; i < rows.length; i++) {
        if(rows[i].cells.length > 0) rows[i].deleteCell(-1); 
    }

    const tableHTML = tableClone.outerHTML.replace(/ /g, '%20');
    
    filename = filename ? filename + '.xls' : 'excel_data.xls';
    downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);
    
    if(navigator.msSaveOrOpenBlob){
        var blob = new Blob(['\ufeff', tableHTML], { type: dataType });
        navigator.msSaveOrOpenBlob( blob, filename);
    } else {
        downloadLink.href = 'data:' + dataType + ', ' + tableHTML;
        downloadLink.download = filename;
        downloadLink.click();
    }
};

// --- DASHBOARD MULTI-CHART ---
window.loadStats = async () => {
    const rSnap = await getDocs(collection(db,"records"));
    const tSnap = await getDocs(collection(db,"templates"));
    const uSnap = await getDocs(collection(db,"users"));
    document.getElementById('dash-total').innerText = rSnap.size;
    document.getElementById('dash-forms').innerText = tSnap.size;
    document.getElementById('dash-users').innerText = uSnap.size;

    // Procesar Datos para Gráficos
    const timelineData = {};
    const userActivity = {};

    rSnap.forEach(doc => {
        const d = doc.data();
        // Timeline (Fecha corta)
        const dateKey = d.date.split(',')[0]; 
        timelineData[dateKey] = (timelineData[dateKey] || 0) + 1;
        // User Activity
        userActivity[d.user] = (userActivity[d.user] || 0) + 1;
    });

    // Gráfico 1: Timeline
    if(chartTimeline) chartTimeline.destroy();
    chartTimeline = new Chart(document.getElementById('chartTimeline'), {
        type: 'line',
        data: {
            labels: Object.keys(timelineData),
            datasets: [{ label: 'Registros por Día', data: Object.values(timelineData), borderColor: '#0d6efd', tension: 0.3, fill: true }]
        },
        options: { maintainAspectRatio: false }
    });

    // Gráfico 2: Top Usuarios
    if(chartUsers) chartUsers.destroy();
    chartUsers = new Chart(document.getElementById('chartUsers'), {
        type: 'bar',
        data: {
            labels: Object.keys(userActivity),
            datasets: [{ label: 'Registros', data: Object.values(userActivity), backgroundColor: '#198754' }]
        },
        options: { maintainAspectRatio: false }
    });
};

// ... (Mantener funciones: addBuilderField, toggleOpts, renderDynamicFields, initCanvas, clearCanvas, viewDetails, loadTemplateFieldsForBI, runCustomAnalysis, renderBIChart, renderBIList, deleteRecord) 
// COPIA AQUI LAS FUNCIONES DEL SCRIPT ANTERIOR QUE FALTAN (renderDynamicFields, canvas, etc) SON IDÉNTICAS.
// Por espacio, asegúrate de incluir las funciones de renderizado dinámico y canvas que te di en el código previo.

// --- RENDER Y OTROS (Resumen) ---
window.addBuilderField = () => { const c=document.getElementById('admin-fields-builder'); const d=document.createElement('div'); d.className="input-group mb-2 builder-row"; d.innerHTML=`<input type="text" class="form-control f-label" placeholder="Nombre"><select class="form-select f-type" onchange="toggleOpts(this)"><option value="text">Texto</option><option value="number">Número</option><option value="select">Lista</option><option value="checkbox">Casilla</option><option value="date">Fecha</option><option value="signature">Firma</option></select><input type="text" class="form-control f-opts d-none" placeholder="Op1,Op2"><button class="btn btn-outline-danger" onclick="this.parentElement.remove()">X</button>`; c.appendChild(d); };
window.toggleOpts = (el) => { el.nextElementSibling.classList.toggle('d-none', el.value !== 'select'); };
window.renderDynamicFields = async () => { const id=document.getElementById('reg-template-select').value; const c=document.getElementById('dynamic-fields-container'); c.innerHTML=""; if(!id)return; const d=await getDoc(doc(db,"templates",id)); if(d.exists()) d.data().fields.forEach((f,i)=>{ const w=document.createElement('div'); w.className=f.type==='signature'?"col-12":"col-md-6"; let h=""; if(f.type==='select'){const o=f.options.split(',').map(x=>`<option value="${x.trim()}">${x.trim()}</option>`).join(''); h=`<select class="form-select dyn-input" data-label="${f.label}"><option value="">--</option>${o}</select>`;} else if(f.type==='checkbox'){h=`<div class="form-check pt-4"><input class="form-check-input dyn-input" type="checkbox" data-label="${f.label}"><label>${f.label}</label></div>`; w.innerHTML=h; c.appendChild(w); return;} else if(f.type==='signature'){h=`<label class="fw-bold">${f.label}</label><canvas id="sig-${i}" class="signature-pad"></canvas><button type="button" class="btn btn-sm btn-light border" onclick="clearCanvas(${i})">X</button><input type="hidden" class="dyn-input" data-type="signature" data-label="${f.label}" id="inp-${i}">`;} else {h=`<input type="${f.type}" class="form-control dyn-input" data-label="${f.label}">`;} if(f.type!=='signature') w.innerHTML=`<label class="small fw-bold">${f.label}</label>${h}`; else w.innerHTML=h; c.appendChild(w); if(f.type==='signature') window.initCanvas(i); }); };
window.initCanvas = (i) => { const c=document.getElementById(`sig-${i}`); if(!c)return; const x=c.getContext('2d'); c.width=c.offsetWidth; c.height=c.offsetHeight; let d=false; c.onmousedown=(e)=>{d=true;x.beginPath();x.moveTo(e.offsetX,e.offsetY)}; c.onmousemove=(e)=>{if(d){x.lineTo(e.offsetX,e.offsetY);x.stroke()}}; c.onmouseup=()=>d=false; c.ontouchstart=(e)=>{e.preventDefault();d=true;const r=c.getBoundingClientRect();x.beginPath();x.moveTo(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top)}; c.ontouchmove=(e)=>{e.preventDefault();if(d){const r=c.getBoundingClientRect();x.lineTo(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top);x.stroke()}}; c.ontouchend=()=>d=false; };
window.clearCanvas = (i) => { const c=document.getElementById(`sig-${i}`); c.getContext('2d').clearRect(0,0,c.width,c.height); };
window.deleteRecord = async (id) => { if(confirm("Borrar?")) { await deleteDoc(doc(db,"records",id)); window.loadHistory(true); }};
window.viewDetails = (safe) => { const d=JSON.parse(decodeURIComponent(safe)); document.getElementById('modal-details-body').innerHTML = Object.entries(d).map(([k,v])=>`<div class="border p-2 mb-2 rounded"><small class="fw-bold">${k}</small><div>${v.type==='image'?`<img src="${v.value}" class="img-fluid" style="max-height:100px">`:v.value}</div></div>`).join(''); new bootstrap.Modal(document.getElementById('detailsModal')).show(); };

// Custom BI Logic
window.loadTemplateFieldsForBI = async () => { const id=document.getElementById('bi-template-select').value; const s=document.getElementById('bi-field-select'); s.innerHTML='<option value="">--</option>'; if(!id)return; const d=await getDoc(doc(db,"templates",id)); if(d.exists()) d.data().fields.forEach(f=>{ if(['select','radio','checkbox'].includes(f.type)) s.innerHTML+=`<option value="${f.label}">${f.label}</option>`; }); };
window.runCustomAnalysis = async () => { const tid=document.getElementById('bi-template-select').value, fld=document.getElementById('bi-field-select').value; if(!tid||!fld)return alert("Datos incompletos"); const q=query(collection(db,"records"),where("templateId","==",tid)); const s=await getDocs(q); const d={}; let tot=0; s.forEach(doc=>{ const r=doc.data(); if(r.details[fld]){ let v=r.details[fld].value; if(v===true)v="Sí";if(v===false)v="No"; d[v]=(d[v]||0)+1; tot++; } }); if(biChart)biChart.destroy(); biChart=new Chart(document.getElementById('biChart'),{type:'doughnut',data:{labels:Object.keys(d),datasets:[{data:Object.values(d),backgroundColor:['#0d6efd','#198754','#ffc107','#dc3545']}]}}); document.getElementById('bi-stats-container').innerHTML = Object.entries(d).map(([k,v])=>`<div class="d-flex justify-content-between border-bottom p-2"><span>${k}</span><b>${v}</b></div>`).join(''); };

// SUBMIT REGISTRO
document.getElementById('dynamic-upload-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tid = document.getElementById('reg-template-select').value;
    const tname = document.getElementById('reg-template-select').options[document.getElementById('reg-template-select').selectedIndex].text;
    let det = {};
    document.querySelectorAll('.dyn-input').forEach(i => {
        const l = i.getAttribute('data-label'); let v = i.value; let t = 'text';
        if(i.type==='checkbox') v=i.checked;
        if(i.type==='hidden' && i.id.startsWith('inp-')) { const idx=i.id.split('-')[1]; v=document.getElementById(`sig-${idx}`).toDataURL(); t='image'; }
        det[l] = {type:t, value:v};
    });
    // Simulación de subida de archivo (o usa tu lógica de Cloudinary aquí)
    const f = document.getElementById('reg-file').files[0];
    // Para demo: Guardamos nombre si hay archivo. Para real: subir a storage y obtener URL.
    const fUrl = f ? "Archivo adjunto (Demo)" : "Sin archivo"; 

    await addDoc(collection(db,"records"), { templateId:tid, templateName:tname, user:sessionUser.username, group:sessionUser.userGroup, date:new Date().toLocaleString(), timestamp:Date.now(), details:det, fileUrl: fUrl });
    alert("Guardado"); e.target.reset(); document.getElementById('dynamic-fields-container').innerHTML=""; window.loadStats();
});

// LOGIN / INIT
document.getElementById('login-form')?.addEventListener('submit', async (e)=>{ e.preventDefault(); const u=document.getElementById('login-user').value, p=document.getElementById('login-pass').value; if(u==="Admin"&&p==="1130"){ loginSuccess({username:"Admin",group:"admin",userGroup:"IT",perms:['dashboard','registrar','misregistros','admin','historial']}); return; } const q=query(collection(db,"users"),where("username","==",u),where("password","==",p)); const s=await getDocs(q); if(!s.empty)loginSuccess(s.docs[0].data()); else alert("Error"); });
function loginSuccess(u){ localStorage.setItem('user_session',JSON.stringify(u)); location.reload(); }
if(sessionUser) { document.getElementById('login-screen').classList.add('d-none'); document.getElementById('app-screen').classList.remove('d-none'); document.getElementById('user-display').innerText=sessionUser.username; document.getElementById('group-display').innerText=sessionUser.userGroup||""; window.applyPermissions(); window.loadGroups(); window.loadTemplates(); window.loadStats(); }
