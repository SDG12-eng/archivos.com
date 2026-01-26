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

// --- LOGIN MAESTRO ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    if(u === "Admin" && p === "1130") {
        return loginSuccess({ username: "Admin", group: "admin" });
    }

    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const snap = await getDocs(q);

    if(!snap.empty) {
        loginSuccess(snap.docs[0].data());
    } else {
        alert("Usuario o Contraseña incorrectos");
    }
});

function loginSuccess(data) {
    localStorage.setItem('user_session', JSON.stringify(data));
    location.reload();
}

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

// --- NAVEGACIÓN ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    document.getElementById(id).classList.remove('d-none');
    if(id === 'dashboard') loadStats();
    if(id === 'historial-maestro') loadRecords(true);
    if(id === 'consultas') loadRecords(false);
};

// --- GESTIÓN ADMIN ---
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value;
    const group = document.getElementById('type-group').value;
    const fields = document.getElementById('type-fields').value.split(',').map(f => f.trim());
    if(!name || fields.length < 1) return alert("Llena todos los campos");
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario creado"); loadTemplates();
};

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const filter = document.getElementById('filter-type');
    const list = document.getElementById('templates-list');
    
    sel.innerHTML = '<option value="">-- Seleccionar --</option>';
    if(filter) filter.innerHTML = '<option value="All">Todos</option>';
    if(list) list.innerHTML = "";

    snap.forEach(d => {
        const t = d.data();
        // Solo mostrar formularios del grupo del usuario o todos si es admin
        if(sessionUser.group === 'admin' || sessionUser.group === t.group) {
            sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        }
        if(filter) filter.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        if(list) list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span><b>${t.name}</b> (${t.group})</span>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteDoc(doc(db,'templates','${t.name}')).then(loadTemplates)">Eliminar</button>
        </div>`;
    });
}

window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; if(!type) return;
    const d = await getDoc(doc(db, "templates", type));
    d.data().fields.forEach(f => {
        cont.innerHTML += `<div class="col-md-6 mb-2"><label class="small fw-bold">${f}</label><input type="text" class="form-control dyn-input" data-f="${f}"></div>`;
    });
};

// --- REGISTRO Y ARCHIVOS ---
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
    const dynData = {};
    document.querySelectorAll('.dyn-input').forEach(i => { dynData[i.dataset.f] = i.value; });

    await addDoc(collection(db, "records"), {
        type: document.getElementById('reg-template-select').value,
        data: dynData, fileUrl, user: sessionUser.username,
        group: sessionUser.group, timestamp: new Date()
    });
    alert("Guardado correctamente"); location.reload();
});

// --- LECTURA DE REGISTROS ---
async function loadRecords(isHistory) {
    const tb = isHistory ? document.getElementById('historial-table-body') : document.getElementById('records-table-body');
    const filter = document.getElementById('filter-type')?.value;
    let q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    if(!isHistory) q = query(collection(db, "records"), where("user", "==", sessionUser.username), orderBy("timestamp", "desc"));

    const snap = await getDocs(q); tb.innerHTML = "";
    snap.forEach(d => {
        const r = d.data();
        if(isHistory && filter !== "All" && r.type !== filter) return;
        let details = ""; for(let k in r.data) details += `<b>${k}:</b> ${r.data[k]} | `;
        tb.innerHTML += `<tr>
            <td>${r.timestamp.toDate().toLocaleDateString()}</td>
            ${isHistory ? `<td>${r.user}</td><td>${r.group}</td>` : ''}
            <td><span class="badge bg-primary">${r.type}</span></td>
            <td><small>${details}</small></td>
            <td><a href="${r.fileUrl}" target="_blank" class="bi bi-file-earmark-arrow-down"></a></td>
        </tr>`;
    });
}

// --- DASHBOARD Y EXCEL ---
async function loadStats() {
    const rSnap = await getDocs(collection(db, "records"));
    const uSnap = await getDocs(collection(db, "users"));
    const tSnap = await getDocs(collection(db, "templates"));

    document.getElementById('stats-summary').innerHTML = `
        <div class="col-4"><div class="card p-3 text-center bg-primary text-white"><h3>${rSnap.size}</h3><small>Archivos</small></div></div>
        <div class="col-4"><div class="card p-3 text-center bg-dark text-white"><h3>${tSnap.size}</h3><small>Formularios</small></div></div>
        <div class="col-4"><div class="card p-3 text-center bg-info text-white"><h3>${uSnap.size + 1}</h3><small>Usuarios</small></div></div>
    `;

    const counts = {}; rSnap.forEach(d => { counts[d.data().type] = (counts[d.data().type] || 0) + 1; });
    const chart = document.getElementById('distribution-chart'); chart.innerHTML = "";
    for(let type in counts) {
        let pct = Math.round((counts[type] / rSnap.size) * 100);
        chart.innerHTML += `<label class="small">${type} (${pct}%)</label><div class="progress mb-2" style="height: 12px;"><div class="progress-bar" style="width: ${pct}%"></div></div>`;
    }
}

window.downloadData = async () => {
    const snap = await getDocs(collection(db, "records"));
    let csv = "Fecha,Usuario,Grupo,Tipo,Detalles\n";
    snap.forEach(d => {
        const r = d.data();
        let details = JSON.stringify(r.data).replace(/,/g, ';');
        csv += `${r.timestamp.toDate().toLocaleDateString()},${r.user},${r.group},${r.type},${details}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Reporte_General.csv'; a.click();
};

// --- GESTIÓN USUARIOS ---
document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const group = document.getElementById('new-group').value;
    await addDoc(collection(db, "users"), { username, password, group });
    alert("Usuario creado"); loadUsers();
});

async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const list = document.getElementById('users-list'); list.innerHTML = "";
    snap.forEach(d => {
        const u = d.data();
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between">
            <span>${u.username} (${u.group})</span>
            <button class="btn btn-sm text-danger" onclick="deleteDoc(doc(db,'users','${d.id}')).then(loadUsers)">X</button>
        </div>`;
    });
}

// INICIO DE SESIÓN
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = `${sessionUser.username} (${sessionUser.group})`;
    if(sessionUser.group === 'admin') {
        document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
        loadUsers();
    }
    loadTemplates(); loadStats();
}
