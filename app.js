import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
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

// --- 1. NAVEGACIÓN Y CARGA INICIAL ---
window.showSection = (id) => {
    // Ocultar todo
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    // Mostrar objetivo
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    // Cargas específicas según la sección
    if (id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if (id === 'nuevo-registro') { loadTemplates(); } // CORRECCIÓN: Cargar formularios al entrar aquí
    if (id === 'historial-maestro') { loadHistory(); }
    if (id === 'dashboard') { loadStats(); }
};

// --- 2. SISTEMA DE REGISTROS DINÁMICOS ---

// A. Cargar lista de Formularios (Templates)
async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    
    // 1. Rellenar Dropdown de Registro (Usuario)
    const regSelect = document.getElementById('reg-template-select');
    if (regSelect) {
        let options = '<option value="">-- Seleccionar Formulario --</option>';
        snap.forEach(d => {
            const t = d.data();
            // Mostrar si es admin o si el usuario pertenece al grupo
            if (sessionUser.group === 'admin' || sessionUser.userGroup === t.group || !t.group) {
                options += `<option value="${d.id}">${t.name}</option>`;
            }
        });
        regSelect.innerHTML = options;
    }

    // 2. Rellenar Lista del Panel Admin
    const adminList = document.getElementById('templates-list');
    if (adminList) {
        adminList.innerHTML = "";
        snap.forEach(d => {
            const t = d.data();
            adminList.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${t.name} <small class="text-muted">(${t.group})</small></span>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${d.id}')">X</button>
                </div>`;
        });
    }
}

// B. Dibujar campos al seleccionar
window.renderDynamicFields = async () => {
    const id = document.getElementById('reg-template-select').value;
    const container = document.getElementById('dynamic-fields-container');
    container.innerHTML = "";

    if (!id) return;

    try {
        const docRef = await getDoc(doc(db, "templates", id));
        if (docRef.exists()) {
            const fields = docRef.data().fields || [];
            fields.forEach(f => {
                const div = document.createElement('div');
                div.className = "col-md-6";
                div.innerHTML = `
                    <label class="form-label small fw-bold">${f.label}</label>
                    <input type="${f.type === 'signature' ? 'text' : f.type}" 
                           class="form-control dyn-input" 
                           data-label="${f.label}" 
                           placeholder="${f.type === 'signature' ? 'Escriba nombre para firmar' : ''}" required>
                `;
                container.appendChild(div);
            });
        }
    } catch (e) {
        console.error("Error cargando campos", e);
    }
};

// C. GUARDAR EL REGISTRO (CORREGIDO)
const formUpload = document.getElementById('dynamic-upload-form');
if (formUpload) {
    formUpload.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const templateId = document.getElementById('reg-template-select').value;
        const templateName = document.getElementById('reg-template-select').options[document.getElementById('reg-template-select').selectedIndex].text;
        
        if (!templateId) return alert("Selecciona un formulario");

        // 1. Recolectar datos de inputs dinámicos
        const inputs = document.querySelectorAll('.dyn-input');
        let detailsObj = {};
        let detailsString = "";

        inputs.forEach(input => {
            const label = input.getAttribute('data-label');
            const value = input.value;
            detailsObj[label] = value;
            detailsString += `${label}: ${value} | `;
        });

        // 2. Guardar en Firebase
        try {
            await addDoc(collection(db, "records"), {
                templateId: templateId,
                templateName: templateName,
                user: sessionUser.username,
                group: sessionUser.userGroup || 'General',
                date: new Date().toLocaleString(),
                timestamp: Date.now(),
                details: detailsObj,
                detailsPreview: detailsString // Para mostrar fácil en tabla
            });
            
            alert("✅ Registro guardado exitosamente");
            formUpload.reset();
            document.getElementById('dynamic-fields-container').innerHTML = ""; // Limpiar campos
            loadStats(); // Actualizar dashboard
        } catch (error) {
            console.error(error);
            alert("Error al guardar: " + error.message);
        }
    });
}

// --- 3. FUNCIONES DEL PANEL ADMIN ---

window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('#admin-fields-builder > div');
    
    if (!name) return alert("Ponle nombre al formulario");

    let fields = [];
    rows.forEach(r => {
        const label = r.querySelector('.f-label').value;
        const type = r.querySelector('.f-type').value;
        if (label) fields.push({ label, type });
    });

    // Usamos el nombre como ID para simplificar, o generamos uno auto
    await setDoc(doc(db, "templates", name), { 
        name, 
        group, 
        fields, 
        createdAt: Date.now() 
    });
    
    alert("Formulario Publicado");
    document.getElementById('type-name').value = "";
    document.getElementById('admin-fields-builder').innerHTML = "";
    loadTemplates();
};

window.deleteTemplate = async (id) => {
    if (confirm("¿Borrar este formulario?")) {
        await deleteDoc(doc(db, "templates", id));
        loadTemplates();
    }
};

window.addBuilderField = () => {
    const c = document.getElementById('admin-fields-builder');
    const d = document.createElement('div');
    d.className = "d-flex gap-2 mb-2 align-items-center bg-white p-2 border rounded";
    d.innerHTML = `
        <input type="text" class="form-control form-control-sm f-label" placeholder="Nombre del Campo (ej: Cantidad)">
        <select class="form-select form-select-sm f-type" style="width: 100px;">
            <option value="text">Texto</option>
            <option value="number">Núm</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma</option>
        </select>
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
    `;
    c.appendChild(d);
};

// --- 4. GESTIÓN DE USUARIOS Y GRUPOS ---

window.saveGroup = async () => {
    const n = document.getElementById('group-name-input').value.trim();
    if (!n) return;
    await setDoc(doc(db, "groups", n), { name: n });
    document.getElementById('group-name-input').value = "";
    loadGroups();
};

async function loadGroups() {
    const s = await getDocs(collection(db, "groups"));
    const sel = document.querySelectorAll('.group-dropdown-source');
    let opts = '<option value="">-- Grupo --</option>';
    s.forEach(d => opts += `<option value="${d.id}">${d.id}</option>`);
    sel.forEach(e => e.innerHTML = opts);
}

window.loadUsers = async () => {
    const l = document.getElementById('users-list');
    if (!l) return;
    l.innerHTML = "";
    const s = await getDocs(collection(db, "users"));
    s.forEach(d => {
        const u = d.data();
        l.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span><b>${u.username}</b> <small>(${u.userGroup})</small></span>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')">X</button>
            </li>`;
    });
};

window.deleteUser = async (id) => {
    if (confirm("¿Eliminar usuario?")) {
        await deleteDoc(doc(db, "users", id));
        loadUsers();
    }
};

// --- 5. HISTORIAL Y ESTADÍSTICAS ---

async function loadHistory() {
    const t = document.getElementById('historial-table-body');
    if (!t) return;
    t.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
    
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const s = await getDocs(q);
    
    t.innerHTML = "";
    if(s.empty) { t.innerHTML = "<tr><td colspan='5'>Sin registros</td></tr>"; return; }

    s.forEach(d => {
        const r = d.data();
        t.innerHTML += `
            <tr>
                <td>${r.date}</td>
                <td>${r.user} <span class="badge bg-secondary">${r.group}</span></td>
                <td class="fw-bold text-primary">${r.templateName}</td>
                <td><small>${r.detailsPreview || 'Ver detalles'}</small></td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteRecord('${d.id}')">Borrar</button></td>
            </tr>`;
    });
}

window.deleteRecord = async (id) => {
    if(confirm("¿Borrar este registro del historial?")) {
        await deleteDoc(doc(db, "records", id));
        loadHistory();
    }
}

async function loadStats() {
    const s1 = await getDocs(collection(db, "records"));
    const s2 = await getDocs(collection(db, "templates"));
    const s3 = await getDocs(collection(db, "users"));
    
    document.getElementById('dash-total').innerText = s1.size;
    document.getElementById('dash-forms').innerText = s2.size;
    document.getElementById('dash-users').innerText = s3.size;
}

// --- 6. LOGIN ---

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    if (u === "Admin" && p === "1130") {
        loginSuccess({ username: "Admin", group: "admin", userGroup: "Soporte" });
        return;
    }

    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const s = await getDocs(q);
    if (!s.empty) loginSuccess(s.docs[0].data());
    else alert("Credenciales incorrectas");
});

document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group-select').value;
    const group = document.getElementById('new-role').value;
    
    await addDoc(collection(db, "users"), { username, password, userGroup, group });
    alert("Usuario Creado");
    document.getElementById('create-user-form').reset();
    loadUsers();
});

function loginSuccess(u) {
    localStorage.setItem('user_session', JSON.stringify(u));
    location.reload();
}

window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

// --- INICIALIZACIÓN ---
if (sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    
    if (sessionUser.group === 'admin') {
        document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    }
    
    loadStats(); // Cargar dashboard inicial
}
