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

// --- LOGIN ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    if(u === "Admin" && p === "1130") {
        return loginSuccess({ username: "Admin", role: "admin" });
    }

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

// --- NAVEGACIÓN ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    document.getElementById(id).classList.remove('d-none');
    if(id === 'dashboard') loadStats();
    if(id === 'consultas') loadRecords();
};

// --- PLANTILLAS DINÁMICAS ---
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value;
    const fields = document.getElementById('type-fields').value.split(',').map(f => f.trim());
    await setDoc(doc(db, "templates", name), { name, fields });
    alert("Tipo Creado");
    loadTemplates();
};

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const tb = document.getElementById('templates-table-body');
    sel.innerHTML = '<option value="">-- Seleccione Tipo --</option>';
    tb.innerHTML = "";
    snap.forEach(d => {
        const t = d.data();
        sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        tb.innerHTML += `<tr><td>${t.name}</td><td>${t.fields.join(', ')}</td><td><button class="btn btn-sm btn-danger" onclick="deleteTemplate('${t.name}')">X</button></td></tr>`;
    });
}

window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = "";
    if(!type) return;
    const d = await getDoc(doc(db, "templates", type));
    d.data().fields.forEach(f => {
        cont.innerHTML += `<div class="col-md-6 mb-3"><label>${f}</label><input type="text" class="form-control dyn-input" data-f="${f}"></div>`;
    });
};

// --- GUARDAR REGISTRO ---
document.getElementById('dynamic-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    
    let fileUrl = "Sin archivo";
    const file = document.getElementById('reg-file').files[0];
    if(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData });
        const json = await res.json();
        fileUrl = json.secure_url;
    }

    const dynData = {};
    document.querySelectorAll('.dyn-input').forEach(i => { dynData[i.dataset.f] = i.value; });

    await addDoc(collection(db, "records"), {
        type: document.getElementById('reg-template-select').value,
        data: dynData,
        fileUrl,
        user: sessionUser.username,
        timestamp: new Date()
    });

    alert("Guardado!");
    location.reload();
});

// --- LECTURA DE DATOS ---
async function loadRecords() {
    const snap = await getDocs(query(collection(db, "records"), orderBy("timestamp", "desc")));
    const tb = document.getElementById('records-table-body');
    tb.innerHTML = "";
    snap.forEach(d => {
        const r = d.data();
        let detailStr = "";
        for(let k in r.data) detailStr += `<b>${k}:</b> ${r.data[k]}<br>`;
        tb.innerHTML += `<tr>
            <td>${r.timestamp.toDate().toLocaleDateString()}</td>
            <td><span class="badge bg-secondary">${r.type}</span></td>
            <td>${r.user}</td>
            <td>${detailStr}</td>
            <td><a href="${r.fileUrl}" target="_blank" class="btn btn-sm btn-outline-primary">Ver</a></td>
        </tr>`;
    });
}

// --- USUARIOS ---
document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    await addDoc(collection(db, "users"), { username, password, role });
    alert("Usuario Creado");
    loadUsers();
});

async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const tb = document.getElementById('users-table-body');
    tb.innerHTML = "";
    snap.forEach(d => {
        const u = d.data();
        tb.innerHTML += `<tr><td>${u.username}</td><td>${u.role}</td><td><button class="btn btn-sm btn-danger">Eliminar</button></td></tr>`;
    });
}

async function loadStats() {
    const r = await getDocs(collection(db, "records"));
    const t = await getDocs(collection(db, "templates"));
    const u = await getDocs(collection(db, "users"));
    document.getElementById('stat-total').innerText = r.size;
    document.getElementById('stat-types').innerText = t.size;
    document.getElementById('stat-users').innerText = u.size + 1; // +1 por el master Admin
}

// INICIO
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    if(sessionUser.role !== 'admin') document.querySelectorAll('.admin-only').forEach(e => e.remove());
    loadTemplates();
    loadStats();
}
