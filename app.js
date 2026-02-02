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

// --- FUNCIONES GLOBALES (ACCESIBLES DESDE HTML) ---

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    // Cargas dinámicas
    if(id === 'panel-admin') { window.loadGroups(); window.loadTemplates(); window.loadUsers(); }
    if(id === 'dashboard') window.loadStats();
    if(id === 'mis-registros') window.loadHistory(false);
    if(id === 'historial-maestro') window.loadHistory(true);
    if(id === 'nuevo-registro') window.loadTemplates();
    
    // Cerrar menú móvil
    const nav = document.getElementById('navMain');
    if(nav && nav.classList.contains('show')) {
        document.querySelector('.navbar-toggler').click();
    }
};

window.logout = () => {
    localStorage.removeItem('user_session');
    location.reload();
};

// --- GESTIÓN DE PERMISOS (CRÍTICO) ---
window.applyPermissions = () => {
    if(!sessionUser) return;
    
    const permMap = {
        'nav-dashboard': 'dashboard',
        'nav-registrar': 'registrar',
        'nav-misregistros': 'misregistros',
        'nav-admin': 'admin',
        'nav-historial': 'historial'
    };

    // SIEMPRE dar acceso total al usuario "Admin"
    const isSuper = (sessionUser.username === "Admin");

    for (const [navId, permKey] of Object.entries(permMap)) {
        const el = document.getElementById(navId);
        if(el) {
            // Mostrar si es Admin O si tiene el permiso explícito
            if(isSuper || (sessionUser.perms && sessionUser.perms.includes(permKey))) {
                el.classList.remove('d-none');
            } else {
                el.classList.add('d-none');
            }
        }
    }
};

// --- CRUD Y DATOS ---

window.loadGroups = async () => {
    const s = await getDocs(collection(db,"groups")); 
    let o = '<option value="">-- Seleccionar --</option>'; 
    s.forEach(d=>{ o+=`<option value="${d.id}">${d.id}</option>`; });
    document.querySelectorAll('.group-dropdown-source').forEach(e=>e.innerHTML=o);
};

window.saveGroup = async () => { 
    const n = document.getElementById('group-name-input').value.trim(); 
    if(n) { await setDoc(doc(db,"groups",n),{name:n}); window.loadGroups(); document.getElementById('group-name-input').value=""; }
};

window.loadTemplates = async () => {
    const snap = await getDocs(collection(db, "templates"));
    const regSelect = document.getElementById('reg-template-select');
    const adminList = document.getElementById('templates-list');
    const biSelect = document.getElementById('bi-template-select');

    let regOpts = '<option value="">-- Seleccionar --</option>';
    let biOpts = '<option value="">-- Seleccionar --</option>';
    let adminHtml = "";

    snap.forEach(d => {
        const t = d.data();
        const isSuper = sessionUser.username === "Admin";
        const hasGroupAccess = sessionUser.userGroup === t.group || !t.group;

        if(isSuper || hasGroupAccess) {
            biOpts += `<option value="${d.id}">${t.name}</option>`;
            regOpts += `<option value="${d.id}">${t.name}</option>`;
        }
        adminHtml += `<div class="list-group-item d-flex justify-content-between p-2"><span>${t.name} <small class="text-muted">(${t.group})</small></span><button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${d.id}')">X</button></div>`;
    });

    if(regSelect) regSelect.innerHTML = regOpts;
    if(adminList) adminList.innerHTML = adminHtml;
    if(biSelect) biSelect.innerHTML = biOpts;
};

window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('.builder-row');
    if(!name) return alert("Nombre requerido");
    let fields = [];
    rows.forEach(r => {
        const label = r.querySelector('.f-label').value;
        const type = r.querySelector('.f-type').value;
        const options = r.querySelector('.f-opts') ? r.querySelector('.f-opts').value : "";
        if(label) fields.push({ label, type, options });
    });
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Publicado");
    window.loadTemplates();
};

window.deleteTemplate = async (id) => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db,"templates",id)); window.loadTemplates(); }};

// --- USUARIOS ---

window.loadUsers = async () => {
    const term = document.getElementById('search-user') ? document.getElementById('search-user').value.toLowerCase() : "";
    const list = document.getElementById('users-list');
    if(!list) return;
    list.innerHTML = "";
    
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
        const u = d.data();
        if(term && !u.username.toLowerCase().includes(term)) return;
        const permsBadges = u.perms ? u.perms.map(p => `<span class="badge bg-secondary p-1" style="font-size:0.6rem">${p}</span>`).join(' ') : '';
        const safePerms = u.perms ? u.perms.join(',') : '';

        list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${u.username}</strong> <small class="text-muted">(${u.userGroup})</small><br>
                    <small>${u.email || ''}</small>
                    <div class="mt-1">${permsBadges}</div>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-primary" onclick="editUser('${d.id}', '${u.username}', '${u.email}', '${u.userGroup}', '${safePerms}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </li>`;
    });
};

window.editUser = (id, uname, email, ugroup, permsString) => {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('new-username').value = uname;
    document.getElementById('new-email').value = email || '';
    document.getElementById('new-user-group-select').value = ugroup;
    const perms = permsString ? permsString.split(',') : [];
    ['dashboard','registrar','misregistros','admin','historial'].forEach(p => {
        document.getElementById('perm-'+p).checked = perms.includes(p);
    });
    const btn = document.getElementById('btn-user-submit');
    btn.innerText = "Guardar Cambios"; btn.classList.replace('btn-primary', 'btn-warning');
    document.getElementById('btn-cancel-edit').classList.remove('d-none');
};

window.cancelEditUser = () => {
    document.getElementById('create-user-form').reset();
    document.getElementById('edit-user-id').value = "";
    document.querySelectorAll('.perm-check').forEach(c => c.checked = false);
    const btn = document.getElementById('btn-user-submit');
    btn.innerText = "Guardar Usuario"; btn.classList.replace('btn-warning', 'btn-primary');
    document.getElementById('btn-cancel-edit').classList.add('d-none');
};

window.deleteUser = async (id) => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db,"users",id)); window.loadUsers(); }};

document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const userData = {
        username: document.getElementById('new-username').value,
        email: document.getElementById('new-email').value,
        userGroup: document.getElementById('new-user-group-select').value,
        perms: []
    };
    const pass = document.getElementById('new-password').value;
    if(pass) userData.password = pass; else if(!id) return alert("Contraseña obligatoria");

    if(document.getElementById('perm-dashboard').checked) userData.perms.push('dashboard');
    if(document.getElementById('perm-registrar').checked) userData.perms.push('registrar');
    if(document.getElementById('perm-misregistros').checked) userData.perms.push('misregistros');
    if(document.getElementById('perm-admin').checked) userData.perms.push('admin');
    if(document.getElementById('perm-historial').checked) userData.perms.push('historial');

    if(id) { await updateDoc(doc(db, "users", id), userData); alert("Actualizado"); window.cancelEditUser(); } 
    else { await addDoc(collection(db, "users"), userData); alert("Creado"); e.target.reset(); }
    window.loadUsers();
});

// --- RENDERIZADO Y BI ---

window.addBuilderField = () => {
    const c = document.getElementById('admin-fields-builder');
    const d = document.createElement('div');
    d.className = "input-group mb-2 builder-row";
    d.innerHTML = `
        <input type="text" class="form-control f-label" placeholder="Nombre">
        <select class="form-select f-type" onchange="toggleOpts(this)">
            <option value="text">Texto</option><option value="number">Número</option><option value="select">Lista</option><option value="checkbox">Casilla</option><option value="date">Fecha</option><option value="signature">Firma</option>
        </select>
        <input type="text" class="form-control f-opts d-none" placeholder="Op1,Op2">
        <button class="btn btn-outline-danger" onclick="this.parentElement.remove()">X</button>`;
    c.appendChild(d);
};

window.toggleOpts = (el) => {
    const inp = el.nextElementSibling;
    if(el.value === 'select') inp.classList.remove('d-none'); else inp.classList.add('d-none');
};

window.renderDynamicFields = async () => {
    const id = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; 
    if(!id) return;
    const d = await getDoc(doc(db, "templates", id));
    if (d.exists()) {
        d.data().fields.forEach((f, idx) => {
            const w = document.createElement('div');
            w.className = f.type==='signature'?"col-12":"col-md-6"; 
            let html = "";
            if(f.type==='select') {
                const o = f.options.split(',').map(x=>`<option value="${x.trim()}">${x.trim()}</option>`).join('');
                html = `<select class="form-select dyn-input" data-label="${f.label}"><option value="">Select</option>${o}</select>`;
            } else if(f.type==='checkbox') {
                html = `<div class="form-check pt-4"><input class="form-check-input dyn-input" type="checkbox" data-label="${f.label}"><label class="form-check-label">${f.label}</label></div>`;
                w.innerHTML=html; cont.appendChild(w); return;
            } else if(f.type==='signature') {
                html = `<label class="fw-bold">${f.label}</label><canvas id="sig-${idx}" class="signature-pad"></canvas>
                        <button type="button" class="btn btn-sm btn-light border" onclick="clearCanvas(${idx})">Limpiar</button>
                        <input type="hidden" class="dyn-input" data-type="signature" data-label="${f.label}" id="inp-${idx}">`;
            } else {
                html = `<input type="${f.type}" class="form-control dyn-input" data-label="${f.label}">`;
            }
            if(f.type!=='signature') w.innerHTML = `<label class="small fw-bold">${f.label}</label>${html}`;
            else w.innerHTML = html;
            cont.appendChild(w);
            if(f.type==='signature') window.initCanvas(idx);
        });
    }
};

window.initCanvas = (idx) => {
    const c = document.getElementById(`sig-${idx}`);
    if(!c) return;
    const ctx = c.getContext('2d');
    let draw = false;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const start=(e)=>{draw=true;ctx.beginPath();ctx.moveTo(getX(e),getY(e));};
    const move=(e)=>{if(!draw)return;ctx.lineTo(getX(e),getY(e));ctx.stroke();};
    const end=()=>draw=false;
    const getX=(e)=>{const r=c.getBoundingClientRect();return (e.touches?e.touches[0].clientX:e.clientX)-r.left;};
    const getY=(e)=>{const r=c.getBoundingClientRect();return (e.touches?e.touches[0].clientY:e.clientY)-r.top;};
    c.addEventListener('mousedown',start); c.addEventListener('mousemove',move); window.addEventListener('mouseup',end);
    c.addEventListener('touchstart',(e)=>{e.preventDefault();start(e)}); c.addEventListener('touchmove',(e)=>{e.preventDefault();move(e)}); window.addEventListener('touchend',end);
};
window.clearCanvas = (idx) => { const c=document.getElementById(`sig-${idx}`); c.getContext('2d').clearRect(0,0,c.width,c.height); };

window.loadTemplateFieldsForBI = async () => {
    const id = document.getElementById('bi-template-select').value;
    const sel = document.getElementById('bi-field-select');
    sel.innerHTML = '<option value="">-- Campo --</option>';
    if(!id) return;
    const d = await getDoc(doc(db, "templates", id));
    if(d.exists()) {
        d.data().fields.forEach(f => {
            if(['text', 'select', 'checkbox', 'radio'].includes(f.type)) {
                sel.innerHTML += `<option value="${f.label}">${f.label}</option>`;
            }
        });
    }
};

window.runCustomAnalysis = async () => {
    const tid = document.getElementById('bi-template-select').value;
    const fld = document.getElementById('bi-field-select').value;
    const d1 = document.getElementById('bi-date-start').value;
    const d2 = document.getElementById('bi-date-end').value;
    if(!tid || !fld) return alert("Selecciona datos");

    let q = query(collection(db, "records"), where("templateId", "==", tid));
    if(sessionUser.username !== "Admin") q = query(q, where("group", "==", sessionUser.userGroup));

    const snap = await getDocs(q);
    const data = {};
    let total = 0;

    snap.forEach(d => {
        const r = d.data();
        const rd = new Date(r.timestamp);
        let ok = true;
        if(d1 && rd < new Date(d1)) ok = false;
        if(d2 && rd > new Date(d2 + "T23:59:59")) ok = false;

        if(ok) {
            const item = r.details[fld];
            let val = item ? item.value : "Sin Dato";
            if(val===true || val==='on') val = "Sí";
            if(val===false) val = "No";
            data[val] = (data[val] || 0) + 1;
            total++;
        }
    });
    
    // Render Chart
    const ctx = document.getElementById('biChart');
    if(biChart) biChart.destroy();
    biChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Render List
    const cont = document.getElementById('bi-stats-container');
    cont.innerHTML = `<h6 class="text-center pb-2">Total: ${total}</h6>`;
    Object.entries(data).forEach(([k, v]) => {
        const pct = total > 0 ? ((v/total)*100).toFixed(1) : 0;
        cont.innerHTML += `<div class="d-flex justify-content-between p-2 border-bottom"><span>${k}</span><div><span class="fw-bold">${v}</span> <span class="badge bg-light text-dark">${pct}%</span></div></div>`;
    });
};

window.loadStats = async () => {
    const r = await getDocs(collection(db,"records"));
    const t = await getDocs(collection(db,"templates"));
    const u = await getDocs(collection(db,"users"));
    document.getElementById('dash-total').innerText = r.size;
    document.getElementById('dash-forms').innerText = t.size;
    document.getElementById('dash-users').innerText = u.size;
};

// --- LOGIN & INICIO ---

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    
    if(u==="Admin" && p==="1130") { 
        loginSuccess({username:"Admin", group:"admin", userGroup:"IT", perms:[]}); 
        return; 
    }

    const q = query(collection(db,"users"), where("username","==",u), where("password","==",p));
    const s = await getDocs(q);
    if(!s.empty) loginSuccess(s.docs[0].data()); else alert("Credenciales incorrectas");
});

function loginSuccess(u) { localStorage.setItem('user_session', JSON.stringify(u)); location.reload(); }

// --- HISTORIAL ---
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
            tb.innerHTML += `<tr><td>${r.date}</td>${isAdmin?`<td>${r.user}</td>`:''}<td>${r.templateName}</td>${isAdmin?'<td>...</td>':''}<td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safe}')">Ver</button> ${isAdmin?`<button class="btn btn-sm btn-danger" onclick="deleteRecord('${d.id}')">X</button>`:''}</td></tr>`;
        });
    } catch (e) { console.error(e); tb.innerHTML="<tr><td colspan='5'>Error índices (Ver consola)</td></tr>"; }
};

window.deleteRecord = async (id) => { if(confirm("Borrar?")) { await deleteDoc(doc(db,"records",id)); window.loadHistory(true); }};

window.viewDetails = (safe) => {
    const data = JSON.parse(decodeURIComponent(safe));
    const mb = document.getElementById('modal-details-body');
    let h = "<div class='row g-2'>";
    Object.entries(data).forEach(([k,v]) => {
        let val = v.value;
        if(v.type==='image') val = `<img src="${val}" class="img-fluid border" style="max-height:100px">`;
        h += `<div class="col-6"><div class="border p-2 rounded"><small class="fw-bold">${k}</small><div>${val}</div></div></div>`;
    });
    mb.innerHTML = h + "</div>";
    if(!detailsModal) detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    detailsModal.show();
};

window.downloadData = async () => {
    const s = await getDocs(collection(db,"records"));
    let c = "Fecha,Usuario,Formulario,Datos\n";
    s.forEach(d=>{ const r=d.data(); c+=`${r.date},${r.user},${r.templateName},"${JSON.stringify(r.details).replace(/"/g,"'")}"\n`; });
    const b = new Blob([c],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download="data.csv"; a.click();
};

if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    document.getElementById('group-display').innerText = sessionUser.userGroup || "";
    window.applyPermissions();
    window.loadGroups(); window.loadTemplates(); window.loadStats();
}
