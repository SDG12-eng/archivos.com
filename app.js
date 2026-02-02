import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, getDoc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let detailsModal;
let myChart = null; // Variable para el gráfico

// --- NAVEGACIÓN ---
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if(id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if(id === 'dashboard') loadStats();
    if(id === 'consultas') loadRecords(false); // Eliminado en UI pero mantenido lógica por si acaso
    if(id === 'mis-registros') loadHistory(false);
    if(id === 'historial-maestro') loadHistory(true);
    if(id === 'nuevo-registro') loadTemplates();
};

// --- GESTIÓN DE CAMPOS DINÁMICOS MEJORADA ---
window.addBuilderField = () => {
    const c = document.getElementById('admin-fields-builder');
    const div = document.createElement('div');
    div.className = "input-group mb-2 builder-row";
    div.innerHTML = `
        <input type="text" class="form-control f-label" placeholder="Nombre Campo">
        <select class="form-select f-type" onchange="toggleOptionsInput(this)">
            <option value="text">Texto Corto</option>
            <option value="textarea">Texto Largo</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="time">Hora</option>
            <option value="email">Email</option>
            <option value="select">Lista Desplegable</option>
            <option value="checkbox">Casilla Verif.</option>
            <option value="signature">Firma</option>
        </select>
        <input type="text" class="form-control f-options d-none" placeholder="Opciones (separar por coma)">
        <button class="btn btn-outline-danger" onclick="this.parentElement.remove()"><i class="bi bi-trash"></i></button>
    `;
    c.appendChild(div);
};

// Mostrar input de opciones solo si es "Select"
window.toggleOptionsInput = (selectElem) => {
    const optionsInput = selectElem.nextElementSibling;
    if(selectElem.value === 'select') {
        optionsInput.classList.remove('d-none');
        optionsInput.required = true;
    } else {
        optionsInput.classList.add('d-none');
        optionsInput.required = false;
    }
};

window.renderDynamicFields = async () => {
    const id = document.getElementById('reg-template-select').value;
    const cont = document.getElementById('dynamic-fields-container');
    cont.innerHTML = ""; 
    if(!id) return;

    const d = await getDoc(doc(db, "templates", id));
    if (d.exists()) {
        const fields = d.data().fields;
        fields.forEach((f, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = "col-md-6"; // Default layout
            
            let inputHtml = "";
            
            switch(f.type) {
                case 'textarea':
                    wrapper.className = "col-12";
                    inputHtml = `<textarea class="form-control dyn-input" data-label="${f.label}" rows="3"></textarea>`;
                    break;
                case 'select':
                    const opts = f.options ? f.options.split(',').map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('') : '';
                    inputHtml = `<select class="form-select dyn-input" data-label="${f.label}"><option value="">-- Seleccionar --</option>${opts}</select>`;
                    break;
                case 'checkbox':
                    inputHtml = `<div class="form-check pt-4"><input class="form-check-input dyn-input" type="checkbox" data-label="${f.label}"><label class="form-check-label">${f.label}</label></div>`;
                    // Override wrapper content for checkbox layout
                    wrapper.innerHTML = inputHtml;
                    cont.appendChild(wrapper);
                    return; 
                case 'signature':
                    wrapper.className = "col-12";
                    inputHtml = `<canvas id="sig-canvas-${idx}" class="signature-pad"></canvas>
                                 <button type="button" class="btn btn-sm btn-light border mt-1" onclick="clearCanvas(${idx})">Limpiar Firma</button>
                                 <input type="hidden" class="dyn-input" data-type="signature" data-label="${f.label}" id="sig-input-${idx}">`;
                    break;
                default: // text, number, date, time, email
                    inputHtml = `<input type="${f.type}" class="form-control dyn-input" data-label="${f.label}">`;
            }

            if(f.type !== 'checkbox') {
                wrapper.innerHTML = `<label class="form-label fw-bold small">${f.label}</label>${inputHtml}`;
            }
            cont.appendChild(wrapper);

            if(f.type === 'signature') initCanvas(idx);
        });
    }
};

// --- GESTIÓN DE USUARIOS (CREAR Y EDITAR) ---

document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const username = document.getElementById('new-username').value;
    const email = document.getElementById('new-email').value;
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group-select').value;
    const group = document.getElementById('new-role').value; // admin/user role

    const userData = { username, email, userGroup, group };
    if(password) userData.password = password; // Solo actualizar password si escribe algo

    if(id) {
        // Modo Edición
        await updateDoc(doc(db, "users", id), userData);
        alert("Usuario actualizado");
        cancelEditUser();
    } else {
        // Modo Creación
        if(!password) return alert("Contraseña requerida para nuevos usuarios");
        userData.password = password;
        await addDoc(collection(db, "users"), userData);
        alert("Usuario creado");
        e.target.reset();
    }
    loadUsers();
});

window.editUser = async (id, username, email, userGroup, role) => {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('new-username').value = username;
    document.getElementById('new-email').value = email || "";
    document.getElementById('new-user-group-select').value = userGroup;
    document.getElementById('new-role').value = role;
    document.getElementById('new-password').placeholder = "Dejar vacío para mantener actual";
    
    document.getElementById('btn-user-submit').innerText = "Actualizar Usuario";
    document.getElementById('btn-user-submit').classList.replace('btn-primary', 'btn-warning');
    document.getElementById('btn-cancel-edit').classList.remove('d-none');
};

window.cancelEditUser = () => {
    document.getElementById('create-user-form').reset();
    document.getElementById('edit-user-id').value = "";
    document.getElementById('new-password').placeholder = "Contraseña";
    document.getElementById('btn-user-submit').innerText = "Crear Usuario";
    document.getElementById('btn-user-submit').classList.replace('btn-warning', 'btn-primary');
    document.getElementById('btn-cancel-edit').classList.add('d-none');
};

window.loadUsers = async () => {
    const list = document.getElementById('users-list');
    list.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
        const u = d.data();
        list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center user-item">
                <div>
                    <div class="fw-bold">${u.username} <span class="badge bg-secondary">${u.group}</span></div>
                    <small class="text-muted">${u.email || 'Sin email'} | ${u.userGroup}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-primary" onclick="editUser('${d.id}', '${u.username}', '${u.email}', '${u.userGroup}', '${u.group}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${d.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </li>`;
    });
};

// --- DASHBOARD DINÁMICO (Chart.js) ---

async function loadStats() {
    const recordsSnap = await getDocs(collection(db, "records"));
    const usersSnap = await getDocs(collection(db, "users"));
    const templatesSnap = await getDocs(collection(db, "templates"));

    // KPIs
    document.getElementById('dash-total').innerText = recordsSnap.size;
    document.getElementById('dash-forms').innerText = templatesSnap.size;
    document.getElementById('dash-users').innerText = usersSnap.size;

    // Procesar datos para gráfico y lista
    const formCounts = {};
    recordsSnap.forEach(d => {
        const name = d.data().templateName || "Desconocido";
        formCounts[name] = (formCounts[name] || 0) + 1;
    });

    // Renderizar Lista Detallada
    const statsContainer = document.getElementById('dynamic-stats-container');
    statsContainer.innerHTML = "";
    Object.keys(formCounts).forEach(form => {
        statsContainer.innerHTML += `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <span>${form}</span>
                <span class="badge bg-primary rounded-pill">${formCounts[form]}</span>
            </div>`;
    });

    // Renderizar Gráfico
    const ctx = document.getElementById('mainChart');
    if(myChart) myChart.destroy(); // Destruir previo para actualizar

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(formCounts),
            datasets: [{
                label: 'Registros',
                data: Object.values(formCounts),
                backgroundColor: 'rgba(13, 110, 253, 0.7)',
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- GUARDAR TEMPLATE (Actualizado para nuevos tipos) ---
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('.builder-row');
    
    if(!name) return alert("Nombre requerido");
    
    let fields = [];
    rows.forEach(r => {
        const label = r.querySelector('.f-label').value;
        const type = r.querySelector('.f-type').value;
        const options = r.querySelector('.f-options').value;
        if(label) fields.push({ label, type, options });
    });

    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario publicado con éxito");
    loadTemplates();
};

// --- MODAL DE DETALLES MEJORADO ---
window.viewDetails = (encodedData) => {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const modalBody = document.getElementById('modal-details-body');
    let html = "<div class='row g-3'>";
    
    Object.entries(data).forEach(([key, item]) => {
        let valueDisplay = item.value;
        if(item.type === 'image') {
            valueDisplay = `<img src="${item.value}" class="img-fluid border rounded" style="max-height: 150px;">`;
        } else if (item.value === true || item.value === 'on') {
            valueDisplay = `<span class="badge bg-success">Sí</span>`;
        } else if (item.value === false) {
            valueDisplay = `<span class="badge bg-secondary">No</span>`;
        }

        html += `
            <div class="col-md-6">
                <div class="p-2 bg-white border rounded h-100">
                    <small class="text-muted fw-bold text-uppercase" style="font-size:0.7rem">${key}</small>
                    <div class="mt-1">${valueDisplay || '-'}</div>
                </div>
            </div>`;
    });
    html += "</div>";
    modalBody.innerHTML = html;
    
    if(!detailsModal) detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    detailsModal.show();
};

// --- CANVAS Y FIRMA (Reutilizado del anterior, esencial) ---
function initCanvas(idx) {
    const canvas = document.getElementById(`sig-canvas-${idx}`);
    const ctx = canvas.getContext('2d');
    let drawing = false;
    
    // Ajuste de resolución
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);

    const start = (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(getX(e), getY(e)); };
    const move = (e) => { if(!drawing) return; ctx.lineTo(getX(e), getY(e)); ctx.stroke(); };
    const end = () => drawing = false;

    const getX = (e) => { const rect = canvas.getBoundingClientRect(); return (e.touches ? e.touches[0].clientX : e.clientX) - rect.left; };
    const getY = (e) => { const rect = canvas.getBoundingClientRect(); return (e.touches ? e.touches[0].clientY : e.clientY) - rect.top; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', (e) => {e.preventDefault(); start(e)}); canvas.addEventListener('touchmove', (e) => {e.preventDefault(); move(e)});
    window.addEventListener('touchend', end);
}

window.clearCanvas = (idx) => {
    const c = document.getElementById(`sig-canvas-${idx}`);
    c.getContext('2d').clearRect(0,0,c.width,c.height);
}

// --- FUNCIONES CORE (Login, Logout, Guardar Registro, etc) ---
// ... (Se mantienen igual a la versión anterior, asegurando que capturen los nuevos tipos de input) ...

// Actualización clave en el GUARDADO para capturar checkboxes y selects
const formUpload = document.getElementById('dynamic-upload-form');
if(formUpload) {
    formUpload.addEventListener('submit', async (e) => {
        e.preventDefault();
        const templateId = document.getElementById('reg-template-select').value;
        const templateName = document.getElementById('reg-template-select').options[document.getElementById('reg-template-select').selectedIndex].text;
        
        const inputs = document.querySelectorAll('.dyn-input');
        let detailsObj = {};
        
        inputs.forEach(input => {
            const label = input.getAttribute('data-label');
            let val = input.value;
            let type = 'text';

            if(input.type === 'checkbox') {
                val = input.checked ? "Sí" : "No";
            } else if (input.tagName === 'CANVAS') {
                // lógica de firma ya manejada por hidden inputs o capturar directo aquí
                // Para simplificar, usamos el hidden input logic del canvas si existe
            } else if (input.type === 'hidden' && input.getAttribute('data-type') === 'signature') {
                 const idx = input.id.split('-')[2];
                 const canvas = document.getElementById(`sig-canvas-${idx}`);
                 val = canvas.toDataURL();
                 type = 'image';
            }
            
            detailsObj[label] = { type, value: val };
        });

        // ... resto del guardado a Firebase (igual que antes) ...
        try {
            await addDoc(collection(db, "records"), {
                templateId, templateName,
                user: sessionUser.username,
                group: sessionUser.userGroup || 'General',
                date: new Date().toLocaleString(),
                timestamp: Date.now(),
                details: detailsObj
            });
            alert("Guardado!");
            formUpload.reset();
            document.getElementById('dynamic-fields-container').innerHTML = "";
            loadStats();
        } catch(err) { console.error(err); alert("Error al guardar"); }
    });
}

// --- RESTO DE FUNCIONES ESTÁNDAR (LoadHistory, DeleteUser, SaveGroup, Login, etc.) ---
// Asegúrate de incluir las funciones básicas de la versión anterior aquí. 
// Las funciones loadGroups, deleteGroup, loginSuccess, logout, etc. son idénticas.

window.saveGroup = async () => { const n = document.getElementById('group-name-input').value; if(n) { await setDoc(doc(db,"groups",n),{name:n}); loadGroups(); }};
window.deleteGroup = async (n) => { if(confirm("Borrar?")) { await deleteDoc(doc(db,"groups",n)); loadGroups(); }};
async function loadGroups() { 
    const s = await getDocs(collection(db,"groups")); 
    let o = '<option value="">-- Grupo --</option>'; 
    let l = '';
    s.forEach(d=>{ 
        o+=`<option value="${d.id}">${d.id}</option>`; 
        l+=`<span class="badge bg-secondary me-1">${d.id} <i class="bi bi-x pointer" onclick="deleteGroup('${d.id}')"></i></span>`;
    });
    document.querySelectorAll('.group-dropdown-source').forEach(e=>e.innerHTML=o);
    document.getElementById('groups-list').innerHTML = l; // Asumiendo que existe un div para listar grupos
}

// Inicialización
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    document.getElementById('group-display').innerText = sessionUser.userGroup;
    if(sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadGroups(); loadTemplates(); loadStats();
}

// Funciones de Login (Copiar tal cual de la versión anterior)
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(u==="Admin" && p==="1130") { loginSuccess({username:"Admin", group:"admin", userGroup:"IT"}); return; }
    const q = query(collection(db,"users"), where("username","==",u), where("password","==",p));
    const s = await getDocs(q);
    if(!s.empty) loginSuccess(s.docs[0].data()); else alert("Error");
});
function loginSuccess(u) { localStorage.setItem('user_session',JSON.stringify(u)); location.reload(); }
window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };
window.deleteUser = async (id) => { if(confirm("Eliminar?")) { await deleteDoc(doc(db,"users",id)); loadUsers(); }};
window.deleteTemplate = async (id) => { if(confirm("Eliminar?")) { await deleteDoc(doc(db,"templates",id)); loadTemplates(); }};
async function loadTemplates() {
    const s = await getDocs(collection(db,"templates"));
    const sel = document.getElementById('reg-template-select');
    const lst = document.getElementById('templates-list');
    if(sel) sel.innerHTML = '<option value="">-- Seleccionar --</option>';
    if(lst) lst.innerHTML = '';
    s.forEach(d=>{
        const t = d.data();
        if(sessionUser.group==='admin' || sessionUser.userGroup===t.group) if(sel) sel.innerHTML+=`<option value="${d.id}">${t.name}</option>`;
        if(lst) lst.innerHTML+=`<div class="list-group-item d-flex justify-content-between"><span>${t.name}</span><button class="btn btn-sm btn-danger" onclick="deleteTemplate('${d.id}')">X</button></div>`;
    });
}
async function loadHistory(isAdmin) {
    const tb = document.getElementById(isAdmin ? 'historial-table-body' : 'user-history-body');
    if(!tb) return;
    let q = query(collection(db,"records"), orderBy("timestamp","desc"));
    if(!isAdmin) q = query(collection(db,"records"), where("user","==",sessionUser.username), orderBy("timestamp","desc"));
    const s = await getDocs(q);
    tb.innerHTML = "";
    s.forEach(d=>{
        const r = d.data();
        const safe = encodeURIComponent(JSON.stringify(r.details));
        tb.innerHTML += `<tr><td>${r.date}</td>${isAdmin?`<td>${r.user}</td>`:''}<td>${r.templateName}</td>${isAdmin?'<td>...</td>':''}<td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safe}')">Ver</button></td></tr>`;
    });
}
// CSV Download
window.downloadData = async () => {
    const s = await getDocs(collection(db,"records"));
    let c = "Fecha,Usuario,Formulario,Datos\n";
    s.forEach(d=>{ const r=d.data(); c+=`${r.date},${r.user},${r.templateName},"${JSON.stringify(r.details).replace(/"/g,"'")}"\n`; });
    const b = new Blob([c],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download="data.csv"; a.click();
};
