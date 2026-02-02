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
let biChart = null; // Instancia del gráfico BI

// --- NAVEGACIÓN BASADA EN PERMISOS ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    // Cargas perezosas
    if(id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if(id === 'dashboard') loadStats();
    if(id === 'mis-registros') loadHistory(false);
    if(id === 'historial-maestro') loadHistory(true);
    if(id === 'nuevo-registro') loadTemplates();
};

function applyPermissions() {
    if(!sessionUser) return;
    
    // Mapeo ID del Nav -> Clave del Permiso en BD
    const permMap = {
        'nav-dashboard': 'dashboard',
        'nav-registrar': 'registrar',
        'nav-misregistros': 'misregistros',
        'nav-admin': 'admin',
        'nav-historial': 'historial'
    };

    // Si es superadmin (Admin/1130) tiene todo
    const isSuper = (sessionUser.username === "Admin");

    for (const [navId, permKey] of Object.entries(permMap)) {
        const el = document.getElementById(navId);
        // Mostrar si es SuperAdmin O si el array de permisos incluye la clave
        if(isSuper || (sessionUser.perms && sessionUser.perms.includes(permKey))) {
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    }
}

// --- DASHBOARD BI (ANALISIS PERSONALIZADO) ---

// 1. Cargar campos del formulario seleccionado para filtrar
window.loadTemplateFieldsForBI = async () => {
    const templateId = document.getElementById('bi-template-select').value;
    const fieldSelect = document.getElementById('bi-field-select');
    fieldSelect.innerHTML = '<option value="">-- Seleccionar Campo --</option>';
    
    if(!templateId) return;

    const d = await getDoc(doc(db, "templates", templateId));
    if(d.exists()) {
        d.data().fields.forEach(f => {
            // Solo permitir agrupar por campos categóricos
            if(['text', 'select', 'checkbox', 'radio'].includes(f.type)) {
                fieldSelect.innerHTML += `<option value="${f.label}">${f.label}</option>`;
            }
        });
    }
};

// 2. Ejecutar Análisis
window.runCustomAnalysis = async () => {
    const templateId = document.getElementById('bi-template-select').value;
    const targetField = document.getElementById('bi-field-select').value;
    const startDate = document.getElementById('bi-date-start').value;
    const endDate = document.getElementById('bi-date-end').value;

    if(!templateId || !targetField) return alert("Selecciona Formulario y Campo");

    // Construir Query
    let q = query(collection(db, "records"), where("templateId", "==", templateId));
    
    // Filtro de Grupo (Seguridad)
    if(sessionUser.username !== "Admin") {
        q = query(q, where("group", "==", sessionUser.userGroup));
    }

    const snap = await getDocs(q);
    const dataCounts = {};
    let total = 0;

    snap.forEach(d => {
        const r = d.data();
        
        // Filtro de Fecha (Manual)
        const recDate = new Date(r.timestamp);
        let inRange = true;
        if(startDate && recDate < new Date(startDate)) inRange = false;
        if(endDate && recDate > new Date(endDate + "T23:59:59")) inRange = false;

        if(inRange) {
            // Obtener valor del campo dinámico
            const detailItem = r.details[targetField];
            let val = detailItem ? detailItem.value : "Sin Dato";
            
            // Normalizar
            if(val === true || val === 'on') val = "Sí";
            if(val === false) val = "No";
            
            dataCounts[val] = (dataCounts[val] || 0) + 1;
            total++;
        }
    });

    renderBIChart(dataCounts, targetField);
    renderBIList(dataCounts, total);
};

function renderBIChart(data, label) {
    const ctx = document.getElementById('biChart');
    if(biChart) biChart.destroy();

    biChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Cantidad',
                data: Object.values(data),
                backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0', '#6610f2'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: `Distribución por: ${label}` } }
        }
    });
}

function renderBIList(data, total) {
    const cont = document.getElementById('bi-stats-container');
    cont.innerHTML = `<h6 class="text-center border-bottom pb-2">Total Muestra: ${total}</h6>`;
    
    Object.entries(data).forEach(([key, val]) => {
        const pct = total > 0 ? ((val/total)*100).toFixed(1) : 0;
        cont.innerHTML += `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <span>${key}</span>
                <div>
                    <span class="fw-bold">${val}</span>
                    <span class="badge bg-light text-dark ms-1">${pct}%</span>
                </div>
            </div>`;
    });
}

// --- GESTIÓN DE USUARIOS CON PERMISOS ---

document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    
    const userData = {
        username: document.getElementById('new-username').value,
        email: document.getElementById('new-email').value,
        userGroup: document.getElementById('new-user-group-select').value,
        perms: [] 
    };

    const pass = document.getElementById('new-password').value;
    if(pass) userData.password = pass;
    else if(!id) return alert("Contraseña obligatoria para nuevos usuarios");

    // Recolectar Permisos
    if(document.getElementById('perm-dashboard').checked) userData.perms.push('dashboard');
    if(document.getElementById('perm-registrar').checked) userData.perms.push('registrar');
    if(document.getElementById('perm-misregistros').checked) userData.perms.push('misregistros');
    if(document.getElementById('perm-admin').checked) userData.perms.push('admin');
    if(document.getElementById('perm-historial').checked) userData.perms.push('historial');

    if(id) {
        await updateDoc(doc(db, "users", id), userData);
        alert("Usuario Actualizado");
        cancelEditUser();
    } else {
        await addDoc(collection(db, "users"), userData);
        alert("Usuario Creado");
        e.target.reset();
        document.querySelectorAll('.perm-check').forEach(c => c.checked = false);
    }
    loadUsers();
});

window.editUser = (id, uname, email, ugroup, permsString) => {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('new-username').value = uname;
    document.getElementById('new-email').value = email || '';
    document.getElementById('new-user-group-select').value = ugroup;
    document.getElementById('new-password').placeholder = "Vacío para mantener actual";
    
    const perms = permsString ? permsString.split(',') : [];
    document.getElementById('perm-dashboard').checked = perms.includes('dashboard');
    document.getElementById('perm-registrar').checked = perms.includes('registrar');
    document.getElementById('perm-misregistros').checked = perms.includes('misregistros');
    document.getElementById('perm-admin').checked = perms.includes('admin');
    document.getElementById('perm-historial').checked = perms.includes('historial');

    const btn = document.getElementById('btn-user-submit');
    btn.innerText = "Guardar Cambios";
    btn.classList.replace('btn-primary', 'btn-warning');
    document.getElementById('btn-cancel-edit').classList.remove('d-none');
};

window.cancelEditUser = () => {
    document.getElementById('create-user-form').reset();
    document.getElementById('edit-user-id').value = "";
    document.querySelectorAll('.perm-check').forEach(c => c.checked = false);
    const btn = document.getElementById('btn-user-submit');
    btn.innerText = "Guardar Usuario";
    btn.classList.replace('btn-warning', 'btn-primary');
    document.getElementById('btn-cancel-edit').classList.add('d-none');
};

window.loadUsers = async () => {
    const term = document.getElementById('search-user').value.toLowerCase();
    const list = document.getElementById('users-list');
    list.innerHTML = "";
    
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
        const u = d.data();
        if(term && !u.username.toLowerCase().includes(term)) return;

        const permsBadges = u.perms ? u.perms.map(p => `<span class="badge bg-secondary p-1" style="font-size:0.6rem">${p}</span>`).join(' ') : '';

        list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${u.username}</strong> <small class="text-muted">(${u.userGroup})</small><br>
                    <small>${u.email || 'No Email'}</small><br>
                    <div class="mt-1">${permsBadges}</div>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-primary" onclick="editUser('${d.id}', '${u.username}', '${u.email}', '${u.userGroup}', '${u.perms ? u.perms.join(',') : ''}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </li>`;
    });
};

// --- GESTIÓN DE FORMULARIOS ---

async function loadTemplates() {
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

        // Lógica: Todos los formularios disponibles para Admin en BI, y solo los propios para usuarios
        if(isSuper || hasGroupAccess) {
            biOpts += `<option value="${d.id}">${t.name}</option>`;
            regOpts += `<option value="${d.id}">${t.name}</option>`;
        }

        adminHtml += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${t.name} <small class="text-muted">(${t.group})</small></span>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${d.id}')">X</button>
            </div>`;
    });

    if(regSelect) regSelect.innerHTML = regOpts;
    if(adminList) adminList.innerHTML = adminHtml;
    if(biSelect) biSelect.innerHTML = biOpts;
}

window.addBuilderField = () => {
    const c = document.getElementById('admin-fields-builder');
    const d = document.createElement('div');
    d.className = "input-group mb-2 builder-row";
    d.innerHTML = `
        <input type="text" class="form-control f-label" placeholder="Nombre">
        <select class="form-select f-type" onchange="toggleOpts(this)">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="select">Lista</option>
            <option value="checkbox">Casilla</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma</option>
        </select>
        <input type="text" class="form-control f-opts d-none" placeholder="Opciones (a,b,c)">
        <button class="btn btn-outline-danger" onclick="this.parentElement.remove()">X</button>`;
    c.appendChild(d);
};

window.toggleOpts = (el) => {
    const inp = el.nextElementSibling;
    if(el.value === 'select') inp.classList.remove('d-none');
    else inp.classList.add('d-none');
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
        const options = r.querySelector('.f-opts').value;
        if(label) fields.push({ label, type, options });
    });

    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario Publicado");
    loadTemplates();
};

// --- RENDERIZADO DINÁMICO (REGISTRO) ---

window.renderDynamicFields = async () => {
    const id = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; 
    if(!id) return;

    const d = await getDoc(doc(db, "templates", id));
    if (d.exists()) {
        const fields = d.data().fields;
        fields.forEach((f, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = "col-md-6"; 
            
            let inputHtml = "";
            
            switch(f.type) {
                case 'select':
                    const opts = f.options ? f.options.split(',').map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('') : '';
                    inputHtml = `<select class="form-select dyn-input" data-label="${f.label}"><option value="">-- Seleccionar --</option>${opts}</select>`;
                    break;
                case 'checkbox':
                    inputHtml = `<div class="form-check pt-4"><input class="form-check-input dyn-input" type="checkbox" data-label="${f.label}"><label class="form-check-label">${f.label}</label></div>`;
                    wrapper.innerHTML = inputHtml;
                    cont.appendChild(wrapper);
                    return; 
                case 'signature':
                    wrapper.className = "col-12";
                    inputHtml = `<label class="form-label fw-bold">${f.label}</label><canvas id="sig-canvas-${idx}" class="signature-pad"></canvas>
                                 <button type="button" class="btn btn-sm btn-light border mt-1" onclick="clearCanvas(${idx})">Limpiar</button>
                                 <input type="hidden" class="dyn-input" data-type="signature" data-label="${f.label}" id="sig-input-${idx}">`;
                    break;
                default: 
                    inputHtml = `<input type="${f.type}" class="form-control dyn-input" data-label="${f.label}">`;
            }

            if(f.type !== 'checkbox' && f.type !== 'signature') {
                wrapper.innerHTML = `<label class="form-label fw-bold small">${f.label}</label>${inputHtml}`;
            } else if (f.type === 'signature') {
                wrapper.innerHTML = inputHtml;
            }
            
            cont.appendChild(wrapper);
            if(f.type === 'signature') initCanvas(idx);
        });
    }
};

// --- GUARDAR REGISTRO ---
const formUpload = document.getElementById('dynamic-upload-form');
if(formUpload) {
    formUpload.addEventListener('submit', async (e) => {
        e.preventDefault();
        const templateId = document.getElementById('reg-template-select').value;
        const templateName = document.getElementById('reg-template-select').options[document.getElementById('reg-template-select').selectedIndex].text;
        
        if(!templateId) return alert("Selecciona formulario");

        const inputs = document.querySelectorAll('.dyn-input');
        let detailsObj = {};
        
        inputs.forEach(input => {
            const label = input.getAttribute('data-label');
            let val = input.value;
            let type = 'text';

            if(input.type === 'checkbox') {
                val = input.checked ? "Sí" : "No";
            } else if (input.type === 'hidden' && input.getAttribute('data-type') === 'signature') {
                 const idx = input.id.split('-')[2];
                 const canvas = document.getElementById(`sig-canvas-${idx}`);
                 val = canvas.toDataURL();
                 type = 'image';
            }
            
            detailsObj[label] = { type, value: val };
        });

        // Archivo (Cloudinary - Simplificado)
        // Nota: Asegúrate de configurar Cloudinary real si lo usas.
        let fileUrl = "Sin archivo";
        
        try {
            await addDoc(collection(db, "records"), {
                templateId, templateName,
                user: sessionUser.username,
                group: sessionUser.userGroup || 'General',
                date: new Date().toLocaleString(),
                timestamp: Date.now(),
                details: detailsObj,
                fileUrl
            });
            alert("Guardado!");
            formUpload.reset();
            document.getElementById('dynamic-fields-container').innerHTML = "";
            loadStats();
        } catch(err) { console.error(err); alert("Error al guardar"); }
    });
}

// --- CANVAS Y FIRMA ---
function initCanvas(idx) {
    const canvas = document.getElementById(`sig-canvas-${idx}`);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let drawing = false;
    
    // Resize
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const start = (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(getX(e), getY(e)); };
    const move = (e) => { if(!drawing) return; ctx.lineTo(getX(e), getY(e)); ctx.stroke(); };
    const end = () => drawing = false;

    const getX = (e) => { const rect = canvas.getBoundingClientRect(); return (e.touches ? e.touches[0].clientX : e.clientX) - rect.left; };
    const getY = (e) => { const rect = canvas.getBoundingClientRect(); return (e.touches ? e.touches[0].clientY : e.clientY) - rect.top; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', (e) => {e.preventDefault(); start(e)}); 
    canvas.addEventListener('touchmove', (e) => {e.preventDefault(); move(e)});
    window.addEventListener('touchend', end);
}

window.clearCanvas = (idx) => {
    const c = document.getElementById(`sig-canvas-${idx}`);
    c.getContext('2d').clearRect(0,0,c.width,c.height);
}

// --- AUXILIARES (Login, Grupos, Borrar) ---

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    
    if(u==="Admin" && p==="1130") { 
        loginSuccess({username:"Admin", group:"admin", userGroup:"IT", perms:['dashboard','registrar','misregistros','admin','historial']}); 
        return; 
    }

    const q = query(collection(db,"users"), where("username","==",u), where("password","==",p));
    const s = await getDocs(q);
    if(!s.empty) loginSuccess(s.docs[0].data());
    else alert("Credenciales inválidas");
});

function loginSuccess(u) {
    localStorage.setItem('user_session', JSON.stringify(u));
    location.reload();
}

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

window.saveGroup = async () => { const n = document.getElementById('group-name-input').value.trim(); if(n) { await setDoc(doc(db,"groups",n),{name:n}); loadGroups(); }};
window.deleteGroup = async (n) => { if(confirm("Borrar?")) { await deleteDoc(doc(db,"groups",n)); loadGroups(); }};
async function loadGroups() { 
    const s = await getDocs(collection(db,"groups")); 
    let o = '<option value="">-- Grupo --</option>'; 
    s.forEach(d=>{ o+=`<option value="${d.id}">${d.id}</option>`; });
    document.querySelectorAll('.group-dropdown-source').forEach(e=>e.innerHTML=o);
}

window.deleteUser = async (id) => { if(confirm("Eliminar?")) { await deleteDoc(doc(db,"users",id)); loadUsers(); }};
window.deleteTemplate = async (id) => { if(confirm("Eliminar?")) { await deleteDoc(doc(db,"templates",id)); loadTemplates(); }};
window.deleteRecord = async (id) => { if(confirm("Borrar?")) { await deleteDoc(doc(db,"records",id)); loadHistory(true); }};

async function loadHistory(isAdmin) {
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
}

window.viewDetails = (encodedData) => {
    const data = JSON.parse(decodeURIComponent(encodedData));
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
}

async function loadStats() {
    const r = await getDocs(collection(db,"records"));
    const t = await getDocs(collection(db,"templates"));
    const u = await getDocs(collection(db,"users"));
    document.getElementById('dash-total').innerText = r.size;
    document.getElementById('dash-forms').innerText = t.size;
    document.getElementById('dash-users').innerText = u.size;
}

window.downloadData = async () => {
    const s = await getDocs(collection(db,"records"));
    let c = "Fecha,Usuario,Formulario,Datos\n";
    s.forEach(d=>{ const r=d.data(); c+=`${r.date},${r.user},${r.templateName},"${JSON.stringify(r.details).replace(/"/g,"'")}"\n`; });
    const b = new Blob([c],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download="data.csv"; a.click();
};

// INIT
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    document.getElementById('group-display').innerText = sessionUser.userGroup || "";
    
    applyPermissions();
    loadGroups(); loadTemplates(); loadStats();
}
