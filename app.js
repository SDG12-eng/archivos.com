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

// --- NAVEGACIÓN Y CONTROL GLOBAL ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if(id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if(id === 'dashboard') loadStats();
    if(id === 'consultas') loadRecords(false);
    if(id === 'historial-maestro') loadRecords(true);
};

// --- GESTIÓN DE CAMPOS DINÁMICOS (MOSTRAR AL SELECCIONAR) ---
window.renderDynamicFields = async () => {
    const type = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = "<p class='text-muted small'>Cargando campos...</p>"; 
    
    if(!type) {
        cont.innerHTML = "";
        return;
    }

    try {
        const d = await getDoc(doc(db, "templates", type));
        if (d.exists()) {
            cont.innerHTML = ""; // Limpiar cargando
            const fields = d.data().fields;
            fields.forEach(f => {
                const col = document.createElement('div');
                col.className = "col-md-6 mb-3";
                
                let inputHtml = "";
                if(f.type === 'signature') {
                    inputHtml = `<input type="text" class="form-control dyn-input border-primary" data-f="${f.label}" placeholder="Escriba su nombre completo">`;
                } else {
                    inputHtml = `<input type="${f.type}" class="form-control dyn-input" data-f="${f.label}">`;
                }

                col.innerHTML = `<label class="form-label small fw-bold">${f.label}</label>${inputHtml}`;
                cont.appendChild(col);
            });
        }
    } catch (error) {
        console.error("Error al cargar campos:", error);
        cont.innerHTML = "<span class='text-danger'>Error al cargar el formulario.</span>";
    }
};

// --- GESTIÓN DE USUARIOS (LISTAR Y ELIMINAR) ---
window.loadUsers = async () => {
    const list = document.getElementById('users-list');
    if(!list) return;
    list.innerHTML = "<li class='list-group-item text-center'>Cargando usuarios...</li>";

    try {
        const snap = await getDocs(collection(db, "users"));
        list.innerHTML = "";
        
        if(snap.empty) {
            list.innerHTML = "<li class='list-group-item text-muted italic'>No hay usuarios creados</li>";
        }

        snap.forEach(d => {
            const u = d.data();
            const li = document.createElement('li');
            li.className = "list-group-item d-flex justify-content-between align-items-center shadow-sm mb-1 rounded";
            li.innerHTML = `
                <div>
                    <strong class="text-primary">${u.username}</strong> 
                    <span class="badge bg-light text-dark ms-2 border">${u.userGroup || 'Sin Grupo'}</span>
                    <small class="text-muted d-block">${u.group === 'admin' ? 'Administrador' : 'Usuario Estándar'}</small>
                </div>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteUser('${d.id}')">
                    <i class="bi bi-trash"></i> Eliminar
                </button>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        list.innerHTML = "<li class='list-group-item text-danger'>Error al cargar usuarios</li>";
    }
};

window.deleteUser = async (id) => {
    if(confirm("¿Estás seguro de eliminar este usuario? Perderá el acceso de inmediato.")) {
        await deleteDoc(doc(db, "users", id));
        loadUsers(); // Recargar lista
    }
};

// --- OTRAS FUNCIONES ADMIN ---
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
    let opts = '<option value="">-- Seleccionar Grupo --</option>';
    snap.forEach(d => {
        const g = d.data().name;
        list.innerHTML += `<span class="badge bg-secondary p-2 me-1 mb-1">${g} <i class="bi bi-x pointer ms-1" onclick="deleteGroup('${g}')"></i></span>`;
        opts += `<option value="${g}">${g}</option>`;
    });
    dropdowns.forEach(dd => dd.innerHTML = opts);
}

window.deleteGroup = async (name) => {
    if(confirm(`¿Eliminar grupo ${name}?`)) { await deleteDoc(doc(db, "groups", name)); loadGroups(); }
};

// --- LOGIN ---
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
    if(!snap.empty) loginSuccess(snap.docs[0].data()); else alert("Credenciales incorrectas");
});

function loginSuccess(data) {
    localStorage.setItem('user_session', JSON.stringify(data));
    location.reload();
}

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

// --- INICIO DE APP ---
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = `Usuario: ${sessionUser.username}`;
    if(sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadGroups();
}
