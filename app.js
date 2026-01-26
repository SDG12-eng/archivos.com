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

// --- GESTIÓN DE SECCIONES ---
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

// --- GESTIÓN DE TIPOS (ADMIN) ---
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value;
    const fields = document.getElementById('type-fields').value.split(',').map(f => f.trim());
    if(!name || fields.length < 1) return alert("Llena los campos");
    await setDoc(doc(db, "templates", name), { name, fields });
    alert("Formulario creado");
    loadTemplates();
};

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const filter = document.getElementById('filter-type');
    const list = document.getElementById('templates-list');
    sel.innerHTML = '<option value="">-- Seleccionar --</option>';
    if(filter) filter.innerHTML = '<option value="All">Todos los tipos</option>';
    if(list) list.innerHTML = "";
    snap.forEach(d => {
        const t = d.data();
        sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        if(filter) filter.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        if(list) list.innerHTML += `<div class="list-group-item d-flex justify-content-between"><span>${t.name}</span> <button class="btn btn-sm text-danger" onclick="deleteDoc(doc(db,'templates','${t.name}')).then(loadTemplates)">X</button></div>`;
    });
}

// --- GENERAR CAMPOS PARA EL USUARIO ---
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
    await addDoc(collection(db, "records"), { type: document.getElementById('reg-template-select').value, data, fileUrl, user: sessionUser.username, timestamp: new Date() });
    alert("Guardado!"); location.reload();
});

// --- CARGAR HISTORIAL Y FILTROS ---
async function loadRecords(isHistory) {
    const tb = isHistory ? document.getElementById('historial-table-body') : document.getElementById('records-table-body');
    const filter = document.getElementById('filter-type')?.value;
    const search = document.getElementById('filter-search')?.value.toLowerCase();
    let q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q); tb.innerHTML = "";
    snap.forEach(d => {
        const r = d.data();
        if(isHistory && filter !== "All" && r.type !== filter) return;
        let details = ""; for(let k in r.data) details += `${k}: ${r.data[k]} | `;
        if(isHistory && search && !details.toLowerCase().includes(search)) return;
        tb.innerHTML += `<tr>
            <td>${r.timestamp.toDate().toLocaleDateString()}</td>
            ${isHistory ? `<td>${r.user}</td>` : ''}
            <td><span class="badge bg-primary">${r.type}</span></td>
            <td><small>${details}</small></td>
            <td><a href="${r.fileUrl}" target="_blank" class="bi bi-file-earmark"></a></td>
        </tr>`;
    });
}

// --- DESCARGAR CSV ---
window.downloadData = async () => {
    const snap = await getDocs(collection(db, "records"));
    let csv = "Fecha,Usuario,Tipo,Detalles\n";
    snap.forEach(d => {
        const r = d.data();
        let det = JSON.stringify(r.data).replace(/,/g, ';');
        csv += `${r.timestamp.toDate().toLocaleDateString()},${r.user},${r.type},${det}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Historial.csv'; a.click();
};

// --- LOGIN Y SESIÓN ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(u === "Admin" && p === "1130") return loginSuccess({ username: "Admin", group: "admin" });
    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const snap = await getDocs(q);
    if(!snap.empty) loginSuccess(snap.docs[0].data()); else alert("Error");
});

function loginSuccess(data) { localStorage.setItem('user_session', JSON.stringify(data)); location.reload(); }
window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    if(sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadTemplates(); loadStats();
}
