import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const CLOUD_NAME = "df79cjkl";
const UPLOAD_PRESET = "sistema_archivos"; 

let sessionUser = JSON.parse(localStorage.getItem('user_session')) || null;
const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));

// --- VINCULACIÓN GLOBAL (SOLUCIÓN AL ERROR DE NAVEGACIÓN) ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if(id === 'dashboard') loadStats();
    if(id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if(id === 'historial-maestro') loadRecords(true);
    if(id === 'consultas') loadRecords(false);

    const nav = document.getElementById('navMain');
    if (nav && nav.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getInstance(nav) || new bootstrap.Collapse(nav);
        bsCollapse.hide();
    }
};

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

// --- GESTIÓN DE GRUPOS ---
window.saveGroup = async () => {
    const name = document.getElementById('group-name-input').value.trim();
    if(!name) return alert("Escribe un nombre de grupo");
    await setDoc(doc(db, "groups", name), { name });
    document.getElementById('group-name-input').value = "";
    loadGroups();
};

window.deleteGroup = async (name) => {
    if(confirm(`¿Eliminar grupo "${name}"?`)) { await deleteDoc(doc(db, "groups", name)); loadGroups(); }
};

async function loadGroups() {
    const snap = await getDocs(collection(db, "groups"));
    const list = document.getElementById('groups-list');
    const dropdowns = document.querySelectorAll('.group-dropdown-source');
    list.innerHTML = "";
    let options = '<option value="">-- Seleccionar Grupo --</option>';
    snap.forEach(d => {
        const g = d.data().name;
        list.innerHTML += `<span class="badge bg-secondary p-2">${g} <i class="bi bi-x-circle pointer ms-1" onclick="deleteGroup('${g}')"></i></span>`;
        options += `<option value="${g}">${g}</option>`;
    });
    dropdowns.forEach(dd => dd.innerHTML = options);
}

// --- BUILDER DE FORMULARIOS ---
window.addBuilderField = () => {
    const cont = document.getElementById('admin-fields-builder');
    const div = document.createElement('div');
    div.className = "d-flex gap-1 mb-2 builder-row";
    div.innerHTML = `
        <input type="text" class="form-control form-control-sm field-label" placeholder="Nombre campo">
        <select class="form-select form-select-sm field-type" style="width: 130px;">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma</option>
        </select>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-trash"></i></button>
    `;
    cont.appendChild(div);
};

window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('.builder-row');
    let fields = [];
    rows.forEach(r => {
        fields.push({ label: r.querySelector('.field-label').value, type: r.querySelector('.field-type').value });
    });
    if(!name || !group || fields.length === 0) return alert("Datos incompletos");
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario publicado!");
    loadTemplates();
};

window.deleteTemplate = async (id) => { if(confirm("¿Eliminar?")) { await deleteDoc(doc(db, "templates", id)); loadTemplates(); } };

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const list = document.getElementById('templates-list');
    sel.innerHTML = '<option value="">-- Seleccionar Formulario --</option>';
    list.innerHTML = "";
    snap.forEach(d => {
        const t = d.data();
        if(sessionUser.group === 'admin' || sessionUser.userGroup === t.group) sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span><b>${t.name}</b> (${t.group})</span>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${t.name}')">Borrar</button>
        </div>`;
    });
}

// --- USUARIOS ---
document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group-select').value;
    const group = document.getElementById('new-role').value;
    await addDoc(collection(db, "users"), { username, password, userGroup, group });
    alert("Usuario registrado");
    loadUsers();
});

async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const list = document.getElementById('users-list'); list.innerHTML = "";
    snap.forEach(d => {
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${d.data().username} (${d.data().userGroup})</span>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')">X</button>
        </div>`;
    });
}

window.deleteUser = async (id) => { if(confirm("¿Eliminar usuario?")) { await deleteDoc(doc(db, "users", id)); loadUsers(); } };

// --- REGISTROS ---
window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; if(!type) return;
    const d = await getDoc(doc(db, "templates", type));
    d.data().fields.forEach(f => {
        let ph = f.type === 'signature' ? 'Firme con su nombre' : '';
        cont.innerHTML += `<div class="col-md-6 mb-2">
            <label class="small fw-bold">${f.label}</label>
            <input type="${f.type === 'signature' ? 'text' : f.type}" class="form-control dyn-input" data-f="${f.label}" placeholder="${ph}">
        </div>`;
    });
};

document.getElementById('dynamic-upload-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save'); btn.disabled = true;
    let fileUrl = "Sin archivo";
    const file = document.getElementById('reg-file').files[0];
    if(file) {
        const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: fd });
        const json = await res.json(); fileUrl = json.secure_url;
    }
    const data = {};
    document.querySelectorAll('.dyn-input').forEach(i => { data[i.dataset.f] = i.value; });
    await addDoc(collection(db, "records"), { 
        type: document.getElementById('reg-template-select').value, 
        data, fileUrl, user: sessionUser.username, userGroup: sessionUser.userGroup, timestamp: new Date() 
    });
    alert("Guardado!"); location.reload();
});

// --- VISUALIZACIÓN ---
async function loadRecords(isHistory) {
    const tb = isHistory ? document.getElementById('historial-table-body') : document.getElementById('records-table-body');
    let q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    if(!isHistory) q = query(collection(db, "records"), where("user", "==", sessionUser.username), orderBy("timestamp", "desc"));
    const snap = await getDocs(q); tb.innerHTML = "";
    snap.forEach(d => {
        const r = d.data();
        tb.innerHTML += `<tr>
            <td>${r.timestamp.toDate().toLocaleDateString()}</td>
            ${isHistory ? `<td>${r.user}</td><td>${r.userGroup}</td>` : ''}
            <td>${r.type}</td>
            <td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${d.id}')">Ver</button></td>
        </tr>`;
    });
}

window.viewDetails = async (id) => {
    const d = await getDoc(doc(db, "records", id));
    const r = d.data();
    const list = document.getElementById('details-list');
    list.innerHTML = "";
    for(let k in r.data) list.innerHTML += `<li class="list-group-item d-flex justify-content-between"><b>${k}:</b> <span>${r.data[k]}</span></li>`;
    document.getElementById('file-link-container').innerHTML = r.fileUrl !== "Sin archivo" ? `<a href="${r.fileUrl}" target="_blank" class="btn btn-primary">Ver Adjunto</a>` : "Sin archivo";
    detailsModal.show();
};

// --- LOGIN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(u === "Admin" && p === "1130") return loginSuccess({ username: "Admin", group: "admin", userGroup: "Admin" });
    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const snap = await getDocs(q);
    if(!snap.empty) loginSuccess(snap.docs[0].data()); else alert("Acceso denegado");
});

function loginSuccess(data) { localStorage.setItem('user_session', JSON.stringify(data)); location.reload(); }

async function loadStats() {
    const r = await getDocs(collection(db, "records"));
    const t = await getDocs(collection(db, "templates"));
    const u = await getDocs(collection(db, "users"));
    const statDiv = document.getElementById('stats-summary');
    if(statDiv) statDiv.innerHTML = `
        <div class="col-4"><div class="card p-3 bg-primary text-white"><h3>${r.size}</h3><small>Archivos</small></div></div>
        <div class="col-4"><div class="card p-3 bg-dark text-white"><h3>${t.size}</h3><small>Formularios</small></div></div>
        <div class="col-4"><div class="card p-3 bg-info text-white"><h3>${u.size + 1}</h3><small>Usuarios</small></div></div>`;
}

// INICIO
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    if(sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadGroups().then(() => { loadTemplates(); loadStats(); });
}
