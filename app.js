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

// --- NAVEGACIÓN ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    document.getElementById(id).classList.remove('d-none');
    if(id === 'dashboard') loadStats();
    if(id === 'panel-admin') { loadTemplates(); loadUsers(); }
    if(id === 'historial-maestro') loadRecords(true);
    if(id === 'consultas') loadRecords(false);
    const nav = document.getElementById('navMain');
    if (nav.classList.contains('show')) new bootstrap.Collapse(nav).hide();
};

// --- GESTIÓN DE FORMULARIOS (ADMIN) ---
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value;
    const group = document.getElementById('type-group-target').value;
    const fields = document.getElementById('type-fields').value.split(',').map(f => f.trim());
    if(!name || !group || fields.length < 1) return alert("Complete todos los campos");
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario '" + name + "' creado para el grupo '" + group + "'");
    loadTemplates();
};

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const filter = document.getElementById('filter-type');
    const list = document.getElementById('templates-list');
    
    sel.innerHTML = '<option value="">-- Seleccionar Formulario --</option>';
    if(filter) filter.innerHTML = '<option value="All">Todos los tipos</option>';
    if(list) list.innerHTML = "";

    snap.forEach(d => {
        const t = d.data();
        // Lógica de Grupos: Si el usuario es admin ve todo, si no, solo su grupo
        if(sessionUser.group === 'admin' || sessionUser.userGroup === t.group) {
            sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        }
        if(filter) filter.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        if(list) list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span><b>${t.name}</b> (Grupo: ${t.group})</span>
            <button class="btn btn-sm text-danger" onclick="deleteDoc(doc(db,'templates','${t.name}')).then(loadTemplates)">Eliminar</button>
        </div>`;
    });
}

// --- GENERAR CAMPOS DINÁMICOS ---
window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; if(!type) return;
    const d = await getDoc(doc(db, "templates", type));
    d.data().fields.forEach(f => {
        cont.innerHTML += `<div class="col-md-6 mb-2"><label class="small fw-bold">${f}</label><input type="text" class="form-control dyn-input" data-f="${f}"></div>`;
    });
};

// --- GUARDAR REGISTRO ---
document.getElementById('dynamic-upload-form').addEventListener('submit', async (e) => {
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
        data, 
        fileUrl, 
        user: sessionUser.username, 
        userGroup: sessionUser.userGroup,
        timestamp: new Date() 
    });
    alert("Registro guardado con éxito"); location.reload();
});

// --- CARGAR REGISTROS E HISTORIAL ---
async function loadRecords(isHistory) {
    const tb = isHistory ? document.getElementById('historial-table-body') : document.getElementById('records-table-body');
    const filter = document.getElementById('filter-type')?.value;
    const search = document.getElementById('filter-search')?.value.toLowerCase();
    
    let q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    if(!isHistory) q = query(collection(db, "records"), where("user", "==", sessionUser.username), orderBy("timestamp", "desc"));

    const snap = await getDocs(q); tb.innerHTML = "";
    snap.forEach(d => {
        const r = d.data();
        if(isHistory && filter !== "All" && r.type !== filter) return;
        
        // Búsqueda en detalles
        let detailsText = JSON.stringify(r.data).toLowerCase();
        if(isHistory && search && !detailsText.includes(search)) return;

        let rowId = d.id;
        tb.innerHTML += `<tr>
            <td>${r.timestamp.toDate().toLocaleDateString()}</td>
            ${isHistory ? `<td>${r.user}</td>` : ''}
            <td><span class="badge bg-primary">${r.type}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewDetails('${rowId}')"><i class="bi bi-list-ul"></i> Ver Detalles</button>
            </td>
        </tr>`;
    });
}

// --- VER DETALLES EN MODAL (LISTA) ---
window.viewDetails = async (id) => {
    const docSnap = await getDoc(doc(db, "records", id));
    const r = docSnap.data();
    const list = document.getElementById('details-list');
    const linkCont = document.getElementById('file-link-container');
    
    list.innerHTML = "";
    for(let campo in r.data) {
        list.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="text-muted small">${campo}:</span>
            <span class="fw-bold">${r.data[campo]}</span>
        </li>`;
    }
    
    linkCont.innerHTML = r.fileUrl !== "Sin archivo" 
        ? `<a href="${r.fileUrl}" target="_blank" class="btn btn-primary"><i class="bi bi-file-earmark-text"></i> Ver Documento Adjunto</a>`
        : `<span class="text-muted italic">No hay archivos adjuntos</span>`;
        
    detailsModal.show();
};

// --- GESTIÓN DE USUARIOS (REGISTRO EN FIREBASE) ---
document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group').value.trim();
    const group = document.getElementById('new-role').value;

    await addDoc(collection(db, "users"), { username, password, userGroup, group });
    alert("Usuario '" + username + "' registrado en el grupo '" + userGroup + "'");
    loadUsers();
});

async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const list = document.getElementById('users-list'); list.innerHTML = "";
    snap.forEach(d => {
        const u = d.data();
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span><b>${u.username}</b> (${u.userGroup})</span>
            <button class="btn btn-sm text-danger" onclick="deleteDoc(doc(db,'users','${d.id}')).then(loadUsers)">X</button>
        </div>`;
    });
}

// --- LOGIN ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    
    if(u === "Admin" && p === "1130") return loginSuccess({ username: "Admin", group: "admin", userGroup: "admin" });
    
    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const snap = await getDocs(q);
    
    if(!snap.empty) {
        loginSuccess(snap.docs[0].data());
    } else {
        alert("Credenciales incorrectas");
    }
});

function loginSuccess(data) {
    localStorage.setItem('user_session', JSON.stringify(data));
    location.reload();
}

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

// --- ESTADÍSTICAS ---
async function loadStats() {
    const rSnap = await getDocs(collection(db, "records"));
    const tSnap = await getDocs(collection(db, "templates"));
    const uSnap = await getDocs(collection(db, "users"));

    document.getElementById('stats-summary').innerHTML = `
        <div class="col-4"><div class="card p-3 text-center bg-primary text-white"><h3>${rSnap.size}</h3><small>Registros</small></div></div>
        <div class="col-4"><div class="card p-3 text-center bg-dark text-white"><h3>${tSnap.size}</h3><small>Formularios</small></div></div>
        <div class="col-4"><div class="card p-3 text-center bg-info text-white"><h3>${uSnap.size + 1}</h3><small>Usuarios</small></div></div>
    `;
}

// --- DESCARGA ---
window.downloadData = async () => {
    const snap = await getDocs(collection(db, "records"));
    let csv = "Fecha,Usuario,Grupo,Tipo,Detalles\n";
    snap.forEach(d => {
        const r = d.data();
        let det = JSON.stringify(r.data).replace(/,/g, ';');
        csv += `${r.timestamp.toDate().toLocaleDateString()},${r.user},${r.userGroup},${r.type},${det}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Historial_Completo.csv'; a.click();
};

// INICIO
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = `${sessionUser.username} (${sessionUser.userGroup})`;
    if(sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadTemplates(); loadStats();
}
