import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIGURACIÓN
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

// 2. FUNCIONES GLOBALES (DEFINIDAS INMEDIATAMENTE)
window.showSection = (id) => {
    console.log("Cambiando a sección:", id);
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(s => s.classList.add('d-none'));
    
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    // Cargas específicas
    if(id === 'dashboard') loadStats();
    if(id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if(id === 'historial-maestro') loadRecords(true);
    if(id === 'consultas') loadRecords(false);
};

window.logout = () => {
    localStorage.removeItem('user_session');
    location.reload();
};

// --- LOGIN (CORREGIDO PARA ADMIN 1130) ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value.trim();

        console.log("Intento de login:", u);

        // Validación inmediata de Admin
        if(u === "Admin" && p === "1130") {
            console.log("Acceso Admin detectado");
            loginSuccess({ username: "Admin", group: "admin", userGroup: "Soporte Técnico" });
            return;
        }

        // Validación en Firebase para otros usuarios
        try {
            const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
            const snap = await getDocs(q);
            if(!snap.empty) {
                loginSuccess(snap.docs[0].data());
            } else {
                alert("Usuario o contraseña incorrectos");
            }
        } catch (error) {
            console.error("Error en login:", error);
            alert("Error de conexión con la base de datos");
        }
    });
}

function loginSuccess(data) {
    localStorage.setItem('user_session', JSON.stringify(data));
    location.reload();
}

// --- RESTO DE FUNCIONES (VINCULADAS A WINDOW) ---

window.saveGroup = async () => {
    const name = document.getElementById('group-name-input').value.trim();
    if(!name) return;
    await setDoc(doc(db, "groups", name), { name });
    document.getElementById('group-name-input').value = "";
    loadGroups();
};

window.deleteGroup = async (name) => {
    if(confirm(`¿Eliminar grupo ${name}?`)) {
        await deleteDoc(doc(db, "groups", name));
        loadGroups();
    }
};

window.addBuilderField = () => {
    const cont = document.getElementById('admin-fields-builder');
    const div = document.createElement('div');
    div.className = "d-flex gap-1 mb-2 builder-row";
    div.innerHTML = `
        <input type="text" class="form-control form-control-sm field-label" placeholder="Nombre">
        <select class="form-select form-select-sm field-type">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma</option>
        </select>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">X</button>
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
    if(!name || !group || fields.length === 0) return alert("Faltan datos del formulario");
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario Guardado");
    loadTemplates();
};

window.deleteTemplate = async (id) => {
    if(confirm("¿Eliminar formulario?")) { await deleteDoc(doc(db, "templates", id)); loadTemplates(); }
};

window.deleteUser = async (id) => {
    if(confirm("¿Eliminar usuario?")) { await deleteDoc(doc(db, "users", id)); loadUsers(); }
};

// --- CARGAS AUTOMÁTICAS ---

async function loadGroups() {
    const snap = await getDocs(collection(db, "groups"));
    const list = document.getElementById('groups-list');
    const dds = document.querySelectorAll('.group-dropdown-source');
    if(!list) return;
    list.innerHTML = "";
    let opts = '<option value="">-- Seleccionar Grupo --</option>';
    snap.forEach(d => {
        const g = d.data().name;
        list.innerHTML += `<span class="badge bg-secondary p-2">${g} <i class="bi bi-x pointer" onclick="deleteGroup('${g}')"></i></span>`;
        opts += `<option value="${g}">${g}</option>`;
    });
    dds.forEach(d => d.innerHTML = opts);
}

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const sel = document.getElementById('reg-template-select');
    const list = document.getElementById('templates-list');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Seleccionar Formulario --</option>';
    list.innerHTML = "";
    snap.forEach(d => {
        const t = d.data();
        if(sessionUser.group === 'admin' || sessionUser.userGroup === t.group) 
            sel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        list.innerHTML += `<div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${t.name}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteTemplate('${t.name}')">X</button>
        </div>`;
    });
}

// Inicialización de sesión
let sessionUser = JSON.parse(localStorage.getItem('user_session')) || null;

if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    
    if(sessionUser.group === 'admin') {
        document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    }
    
    // Cargar datos iniciales
    loadGroups();
    loadTemplates();
    loadStats();
}

// --- OTRAS FUNCIONES REQUERIDAS ---
// (Aquí irían loadStats, loadRecords, renderDynamicFields, viewDetails, loadUsers)
// Asegúrate de incluirlas como estaban antes pero dentro de este flujo.
