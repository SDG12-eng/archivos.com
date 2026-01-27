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

// --- GRUPOS ---
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
    
    list.innerHTML = "";
    let options = '<option value="">-- Seleccionar Grupo --</option>';
    
    snap.forEach(d => {
        const g = d.data().name;
        list.innerHTML += `<span class="badge bg-secondary p-2">${g} <i class="bi bi-x pointer" onclick="deleteGroup('${g}')"></i></span>`;
        options += `<option value="${g}">${g}</option>`;
    });
    
    dropdowns.forEach(dd => dd.innerHTML = options);
}

window.deleteGroup = async (id) => { if(confirm("¿Eliminar grupo?")) { await deleteDoc(doc(db, "groups", id)); loadGroups(); }};

// --- BUILDER DE FORMULARIOS ---
window.addBuilderField = () => {
    const cont = document.getElementById('admin-fields-builder');
    const div = document.createElement('div');
    div.className = "d-flex gap-1 mb-2 builder-row";
    div.innerHTML = `
        <input type="text" class="form-control form-control-sm field-name" placeholder="Nombre campo">
        <select class="form-select form-select-sm field-type" style="width: 120px;">
            <option value="text">ABC</option>
            <option value="number">123</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma</option>
        </select>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">X</button>
    `;
    cont.appendChild(div);
};

window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value;
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('.builder-row');
    let fields = [];
    rows.forEach(r => {
        fields.push({
            label: r.querySelector('.field-name').value,
            type: r.querySelector('.field-type').value
        });
    });

    if(!name || !group || fields.length < 1) return alert("Faltan datos");
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario Publicado");
    loadTemplates();
};

// --- RENDERIZADO PARA USUARIO ---
window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; if(!type) return;
    const d = await getDoc(doc(db, "templates", type));
    d.data().fields.forEach(f => {
        let inputType = f.type === 'signature' ? 'text' : f.type;
        let placeholder = f.type === 'signature' ? 'Escriba su nombre como firma' : '';
        cont.innerHTML += `<div class="col-md-6 mb-2">
            <label class="small fw-bold">${f.label}</label>
            <input type="${inputType}" class="form-control dyn-input" data-f="${f.label}" placeholder="${placeholder}">
        </div>`;
    });
};

// --- CARGA DE DATOS Y ELIMINACIÓN ---
async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const list = document.getElementById('templates-list');
    sel.innerHTML = '<option value="">-- Seleccionar Formulario --</option>';
    list.innerHTML = "";
    snap.forEach(d => {
        const t = d.data();
        if(sessionUser.group === 'admin' || sessionUser.userGroup === t.group) 
            sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between">
            <span>${t.name} (${t.group})</span>
            <button class="btn btn-sm text-danger" onclick="deleteTemplate('${t.name}')">Eliminar</button>
        </div>`;
    });
}

window.deleteTemplate = async (id) => { if(confirm("¿Eliminar formulario?")) { await deleteDoc(doc(db, "templates", id)); loadTemplates(); }};

async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const list = document.getElementById('users-list'); list.innerHTML = "";
    snap.forEach(d => {
        const u = d.data();
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${u.username} [${u.userGroup}]</span>
            <button class="btn btn-sm text-danger" onclick="deleteUser('${d.id}')">Eliminar</button>
        </div>`;
    });
}

window.deleteUser = async (id) => { if(confirm("¿Eliminar usuario?")) { await deleteDoc(doc(db, "users", id)); loadUsers(); }};

// --- RESTO DE FUNCIONES (DASHBOARD, LOGIN, REGISTRO) ---
// (Se mantienen iguales pero integrando la nueva lógica de campos)

document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group-select').value;
    const group = document.getElementById('new-role').value;
    await addDoc(collection(db, "users"), { username, password, userGroup, group });
    alert("Usuario creado"); loadUsers();
});

// Inicialización
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    loadGroups().then(() => {
        loadTemplates();
        if(sessionUser.group === 'admin') {
            document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
            loadUsers();
        }
    });
}

// Vinculación de funciones globales para botones HTML
window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };
