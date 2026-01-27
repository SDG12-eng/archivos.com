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
let sessionUser = JSON.parse(localStorage.getItem('user_session')) || null;

// --- SOLUCIÓN AL REFERENCE ERROR ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if(id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if(id === 'dashboard') loadStats();
    if(id === 'consultas') loadRecords(false);
    if(id === 'historial-maestro') loadRecords(true);
};

// --- RENDER DE CAMPOS DINÁMICOS AL SELECCIONAR FORMULARIO ---
window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; 
    
    if(!type) return;

    const d = await getDoc(doc(db, "templates", type));
    if (d.exists()) {
        const fields = d.data().fields;
        fields.forEach(f => {
            const div = document.createElement('div');
            div.className = "col-md-6 mb-3";
            div.innerHTML = `
                <label class="form-label small fw-bold">${f.label}</label>
                <input type="${f.type === 'signature' ? 'text' : f.type}" 
                       class="form-control dyn-input" 
                       data-f="${f.label}" 
                       placeholder="${f.type === 'signature' ? 'Firma digital (Nombre)' : ''}">
            `;
            cont.appendChild(div);
        });
    }
};

// --- GESTIÓN DE USUARIOS (HISTORIAL Y ELIMINAR) ---
window.loadUsers = async () => {
    const list = document.getElementById('users-list');
    if(!list) return;
    const snap = await getDocs(collection(db, "users"));
    list.innerHTML = "";
    snap.forEach(d => {
        const u = d.data();
        list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span><strong>${u.username}</strong> (${u.userGroup})</span>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')">Eliminar</button>
            </li>`;
    });
};

window.deleteUser = async (id) => {
    if(confirm("¿Eliminar usuario?")) {
        await deleteDoc(doc(db, "users", id));
        loadUsers();
    }
};

// --- PANEL ADMIN: GRUPOS Y FORMULARIOS ---
window.saveGroup = async () => {
    const name = document.getElementById('group-name-input').value.trim();
    if(!name) return;
    await setDoc(doc(db, "groups", name), { name });
    document.getElementById('group-name-input').value = "";
    loadGroups();
};

async function loadGroups() {
    const snap = await getDocs(collection(db, "groups"));
    const list = document.getElementById('groups-list');
    const dropdowns = document.querySelectorAll('.group-dropdown-source');
    if(!list) return;
    list.innerHTML = "";
    let opts = '<option value="">-- Seleccionar Grupo --</option>';
    snap.forEach(d => {
        const g = d.data().name;
        list.innerHTML += `<span class="badge bg-secondary p-2 me-1">${g}</span>`;
        opts += `<option value="${g}">${g}</option>`;
    });
    dropdowns.forEach(dd => dd.innerHTML = opts);
}

window.addBuilderField = () => {
    const cont = document.getElementById('admin-fields-builder');
    const div = document.createElement('div');
    div.className = "d-flex gap-1 mb-2";
    div.innerHTML = `
        <input type="text" class="form-control form-control-sm f-label" placeholder="Nombre campo">
        <select class="form-select form-select-sm f-type">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma</option>
        </select>
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>`;
    cont.appendChild(div);
};

window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('#admin-fields-builder > div');
    let fields = [];
    rows.forEach(r => {
        fields.push({ label: r.querySelector('.f-label').value, type: r.querySelector('.f-type').value });
    });
    if(!name || fields.length === 0) return alert("Completa el formulario");
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Publicado!");
    loadTemplates();
};

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Seleccionar --</option>';
    snap.forEach(d => {
        const t = d.data();
        if(sessionUser.group === 'admin' || sessionUser.userGroup === t.group)
            sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
    });
}

// --- LOGIN Y SESIÓN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    
    if(u === "Admin" && p === "1130") {
        loginSuccess({ username: "Admin", group: "admin", userGroup: "Soporte" });
        return;
    }

    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const snap = await getDocs(q);
    if(!snap.empty) loginSuccess(snap.docs[0].data());
    else alert("Error de acceso");
});

document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group-select').value;
    const group = document.getElementById('new-role').value;
    await addDoc(collection(db, "users"), { username, password, userGroup, group });
    alert("Usuario Creado");
    loadUsers();
});

function loginSuccess(data) {
    localStorage.setItem('user_session', JSON.stringify(data));
    location.reload();
}

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

// --- INICIO ---
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    if(sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadGroups();
    loadTemplates();
}
