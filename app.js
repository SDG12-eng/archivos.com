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
            // Solo permitir agrupar por campos de texto, select o checkbox
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
        
        // Filtro de Fecha (Manual porque Firestore range filters son complejos con índices)
        const recDate = new Date(r.timestamp); // Asumiendo timestamp guardado
        let inRange = true;
        if(startDate && recDate < new Date(startDate)) inRange = false;
        if(endDate && recDate > new Date(endDate + "T23:59:59")) inRange = false;

        if(inRange) {
            // Obtener valor del campo dinámico
            const detailItem = r.details[targetField];
            let val = detailItem ? detailItem.value : "Sin Dato";
            
            // Normalizar
            if(val === true) val = "Sí";
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
        type: 'doughnut', // O 'bar'
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Cantidad',
                data: Object.values(data),
                backgroundColor: [
                    '#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0', '#6610f2'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Distribución por: ${label}` }
            }
        }
    });
}

function renderBIList(data, total) {
    const cont = document.getElementById('bi-stats-container');
    cont.innerHTML = `<h6 class="text-center border-bottom pb-2">Total Muestra: ${total}</h6>`;
    
    Object.entries(data).forEach(([key, val]) => {
        const pct = ((val/total)*100).toFixed(1);
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
    
    // Recolectar datos básicos
    const userData = {
        username: document.getElementById('new-username').value,
        email: document.getElementById('new-email').value,
        userGroup: document.getElementById('new-user-group-select').value,
        perms: [] // Array de permisos
    };

    // Recolectar Password (solo si se escribe)
    const pass = document.getElementById('new-password').value;
    if(pass) userData.password = pass;
    else if(!id) return alert("Contraseña obligatoria para nuevos usuarios");

    // Recolectar Checkboxes de Permisos
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
        // Reset checkboxes
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

        // Visualizar permisos como badges
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

// --- GESTIÓN DE FORMULARIOS (Igual que antes, añadiendo carga para BI) ---
async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const regSelect = document.getElementById('reg-template-select');
    const adminList = document.getElementById('templates-list');
    const biSelect = document.getElementById('bi-template-select'); // Select del Dashboard

    let regOpts = '<option value="">-- Seleccionar --</option>';
    let biOpts = '<option value="">-- Seleccionar --</option>';
    let adminHtml = "";

    snap.forEach(d => {
        const t = d.data();
        const isSuper = sessionUser.username === "Admin";
        const hasGroupAccess = sessionUser.userGroup === t.group || !t.group;

        // Populate BI Select (Dashboard)
        if(isSuper || hasGroupAccess) {
            biOpts += `<option value="${d.id}">${t.name}</option>`;
        }

        // Populate Registrar Select
        if(isSuper || hasGroupAccess) {
            regOpts += `<option value="${d.id}">${t.name}</option>`;
        }

        // Populate Admin List
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

// --- RENDERIZADO DINÁMICO (Igual que versión anterior) ---
// (Incluye soporte para selects, checkbox, etc. Se mantiene idéntico al bloque del mensaje previo)
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

// --- LOGIN (Actualizado para guardar permisos) ---
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

// --- INIT ---
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    document.getElementById('group-display').innerText = sessionUser.userGroup || "";
    
    // APLICAR PERMISOS
    applyPermissions();
    
    loadGroups(); loadTemplates(); loadStats();
}

// ... Resto de funciones auxiliares (renderDynamicFields, saveTemplate, etc) se mantienen ...
// IMPORTANTE: Asegúrate de incluir aquí las funciones:
// window.renderDynamicFields
// window.saveTemplate
// window.saveGroup
// window.deleteUser / Group / Template
// window.logout
// window.viewDetails (Modal)
// window.downloadData
// initCanvas / clearCanvas
