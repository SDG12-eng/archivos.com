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
// Variable para guardar el Modal de Bootstrap
let detailsModal; 

window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('d-none');

    if (id === 'panel-admin') { loadGroups(); loadTemplates(); loadUsers(); }
    if (id === 'nuevo-registro') { loadTemplates(); }
    if (id === 'historial-maestro') { loadHistory(true); } // true = admin mode
    if (id === 'mis-registros') { loadHistory(false); } // false = user mode
    if (id === 'dashboard') { loadStats(); }
};

// --- GESTIÓN DE FORMULARIOS DINÁMICOS Y CANVAS ---

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const regSelect = document.getElementById('reg-template-select');
    const adminList = document.getElementById('templates-list');

    if (regSelect) {
        let options = '<option value="">-- Seleccionar Formulario --</option>';
        snap.forEach(d => {
            const t = d.data();
            if (sessionUser.group === 'admin' || sessionUser.userGroup === t.group || !t.group) {
                options += `<option value="${d.id}">${t.name}</option>`;
            }
        });
        regSelect.innerHTML = options;
    }

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

// DIBUJAR CAMPOS (Incluye Lógica del Canvas)
window.renderDynamicFields = async () => {
    const id = document.getElementById('reg-template-select').value;
    const container = document.getElementById('dynamic-fields-container');
    container.innerHTML = "";
    if (!id) return;

    const docRef = await getDoc(doc(db, "templates", id));
    if (docRef.exists()) {
        const fields = docRef.data().fields || [];
        fields.forEach((f, index) => {
            const div = document.createElement('div');
            div.className = "col-md-12"; // Ocupar todo el ancho para firmas
            
            if (f.type === 'signature') {
                // LOGICA ESPECIAL PARA FIRMA
                div.innerHTML = `
                    <label class="form-label fw-bold">${f.label}</label>
                    <canvas id="sig-canvas-${index}" class="signature-pad"></canvas>
                    <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="clearCanvas(${index})">Borrar Firma</button>
                    <input type="hidden" class="dyn-input" data-type="signature" data-label="${f.label}" id="sig-input-${index}">
                `;
                container.appendChild(div);
                initCanvas(index); // Iniciar dibujo
            } else {
                // CAMPOS NORMALES
                div.className = "col-md-6";
                div.innerHTML = `
                    <label class="form-label small fw-bold">${f.label}</label>
                    <input type="${f.type}" class="form-control dyn-input" data-type="text" data-label="${f.label}" required>
                `;
                container.appendChild(div);
            }
        });
    }
};

// INICIALIZAR EL DIBUJO EN CANVAS
function initCanvas(index) {
    const canvas = document.getElementById(`sig-canvas-${index}`);
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    // Ajustar resolución del canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";

    const startDraw = (e) => { isDrawing = true; ctx.beginPath(); ctx.moveTo(getX(e), getY(e)); };
    const draw = (e) => { if(!isDrawing) return; ctx.lineTo(getX(e), getY(e)); ctx.stroke(); };
    const stopDraw = () => { isDrawing = false; };

    const getX = (e) => (e.touches ? e.touches[0].clientX : e.clientX) - canvas.getBoundingClientRect().left;
    const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY) - canvas.getBoundingClientRect().top;

    // Mouse
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw);
    // Touch (Celulares)
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stopDraw);
}

window.clearCanvas = (index) => {
    const canvas = document.getElementById(`sig-canvas-${index}`);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// GUARDAR REGISTRO
const formUpload = document.getElementById('dynamic-upload-form');
if (formUpload) {
    formUpload.addEventListener('submit', async (e) => {
        e.preventDefault();
        const templateId = document.getElementById('reg-template-select').value;
        const templateName = document.getElementById('reg-template-select').options[document.getElementById('reg-template-select').selectedIndex].text;
        
        if (!templateId) return alert("Selecciona un formulario");

        // Recolectar datos
        const inputs = document.querySelectorAll('.dyn-input'); // Inputs normales y ocultos de firma
        let detailsObj = {};
        
        // Procesar campos
        inputs.forEach(input => {
            const label = input.getAttribute('data-label');
            const type = input.getAttribute('data-type');
            
            if (type === 'signature') {
                // Buscar el canvas asociado y convertir a imagen Base64
                const canvasId = input.id.replace('sig-input-', 'sig-canvas-');
                const canvas = document.getElementById(canvasId);
                // Si el canvas está vacío (blanco), guardar string vacío o aviso
                // (Para simplificar, guardamos lo que haya)
                detailsObj[label] = { type: 'image', value: canvas.toDataURL() };
            } else {
                detailsObj[label] = { type: 'text', value: input.value };
            }
        });

        try {
            await addDoc(collection(db, "records"), {
                templateId, templateName,
                user: sessionUser.username,
                group: sessionUser.userGroup || 'General',
                date: new Date().toLocaleString(),
                timestamp: Date.now(),
                details: detailsObj
            });
            
            alert("✅ Registro guardado exitosamente");
            formUpload.reset();
            document.getElementById('dynamic-fields-container').innerHTML = "";
            loadStats();
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
    });
}

// --- HISTORIAL Y VISUALIZACIÓN DE DETALLES ---

async function loadHistory(isAdmin) {
    const tableId = isAdmin ? 'historial-table-body' : 'user-history-body';
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Cargando...</td></tr>";
    
    // Consulta diferente según rol
    let q;
    if (isAdmin) {
        q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    } else {
        // Para usuario normal, filtrar por su username
        // NOTA: Firebase puede pedirte crear un índice en la consola para esta consulta compuesta.
        q = query(collection(db, "records"), where("user", "==", sessionUser.username), orderBy("timestamp", "desc"));
    }

    try {
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        
        if(snap.empty) { 
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>No se encontraron registros.</td></tr>"; 
            return; 
        }

        snap.forEach(d => {
            const r = d.data();
            // Convertir objeto de detalles a string JSON para pasar al botón
            const safeData = encodeURIComponent(JSON.stringify(r.details));
            
            let rowHTML = `<tr>
                <td>${r.date}</td>`;
            
            if(isAdmin) {
                rowHTML += `<td>${r.user}</td>`;
            }

            rowHTML += `
                <td class="fw-bold text-primary">${r.templateName}</td>`;
            
            if(isAdmin) {
                rowHTML += `
                <td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safeData}')">👁️ Ver Datos</button></td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteRecord('${d.id}')">🗑️</button></td>`;
            } else {
                // Vista usuario normal
                rowHTML += `<td><button class="btn btn-sm btn-info text-white" onclick="viewDetails('${safeData}')">👁️ Ver Detalles</button></td>`;
            }
            
            rowHTML += `</tr>`;
            tbody.innerHTML += rowHTML;
        });
    } catch (error) {
        console.error("Error historial:", error);
        tbody.innerHTML = `<tr><td colspan='5' class='text-danger'>Error: Probablemente falta índice en Firebase.<br>Ver consola (F12).</td></tr>`;
    }
}

// FUNCIÓN PARA ABRIR MODAL CON DETALLES
window.viewDetails = (encodedData) => {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const modalBody = document.getElementById('modal-details-body');
    
    let htmlContent = '<ul class="list-group list-group-flush">';
    
    for (const [key, item] of Object.entries(data)) {
        htmlContent += `<li class="list-group-item">
            <h6 class="fw-bold mb-1">${key}</h6>`;
        
        if (item.type === 'image') {
            // Mostrar imagen de firma
            htmlContent += `<img src="${item.value}" class="img-fluid border rounded" style="max-height: 100px;">`;
        } else {
            // Mostrar texto normal
            htmlContent += `<p class="mb-0 text-muted">${item.value}</p>`;
        }
        htmlContent += `</li>`;
    }
    htmlContent += '</ul>';
    
    modalBody.innerHTML = htmlContent;
    
    // Abrir Modal Bootstrap
    if (!detailsModal) {
        detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    }
    detailsModal.show();
};

window.deleteRecord = async (id) => {
    if(confirm("¿Borrar permanentemente?")) {
        await deleteDoc(doc(db, "records", id));
        // Recargar la vista actual (Admin)
        loadHistory(true);
    }
}

// --- RESTO DEL CÓDIGO (PANEL ADMIN, LOGIN, ETC) ---

window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const group = document.getElementById('type-group-select').value;
    const rows = document.querySelectorAll('#admin-fields-builder > div');
    
    if (!name) return alert("Falta nombre del formulario");
    let fields = [];
    rows.forEach(r => {
        const label = r.querySelector('.f-label').value;
        const type = r.querySelector('.f-type').value;
        if (label) fields.push({ label, type });
    });
    await setDoc(doc(db, "templates", name), { name, group, fields });
    alert("Formulario Publicado");
    loadTemplates();
};

window.deleteTemplate = async (id) => {
    if (confirm("¿Borrar formulario?")) await deleteDoc(doc(db, "templates", id)); loadTemplates();
};

window.addBuilderField = () => {
    const c = document.getElementById('admin-fields-builder');
    const d = document.createElement('div');
    d.className = "d-flex gap-2 mb-2 align-items-center bg-white p-2 border rounded";
    d.innerHTML = `
        <input type="text" class="form-control form-control-sm f-label" placeholder="Etiqueta">
        <select class="form-select form-select-sm f-type">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="signature">Firma (Canvas)</option>
        </select>
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>`;
    c.appendChild(d);
};

window.saveGroup = async () => {
    const n = document.getElementById('group-name-input').value.trim();
    if (!n) return;
    await setDoc(doc(db, "groups", n), { name: n });
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
    if (confirm("¿Eliminar usuario?")) { await deleteDoc(doc(db, "users", id)); loadUsers(); }
};

async function loadStats() {
    const s1 = await getDocs(collection(db, "records"));
    const s2 = await getDocs(collection(db, "templates"));
    const s3 = await getDocs(collection(db, "users"));
    document.getElementById('dash-total').innerText = s1.size;
    document.getElementById('dash-forms').innerText = s2.size;
    document.getElementById('dash-users').innerText = s3.size;
}

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if (u === "Admin" && p === "1130") { loginSuccess({ username: "Admin", group: "admin", userGroup: "Soporte" }); return; }
    const q = query(collection(db, "users"), where("username", "==", u), where("password", "==", p));
    const s = await getDocs(q);
    if (!s.empty) loginSuccess(s.docs[0].data());
    else alert("Error login");
});

document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const userGroup = document.getElementById('new-user-group-select').value;
    const group = document.getElementById('new-role').value;
    await addDoc(collection(db, "users"), { username, password, userGroup, group });
    alert("Usuario Creado"); loadUsers();
});

function loginSuccess(u) { localStorage.setItem('user_session', JSON.stringify(u)); location.reload(); }
window.logout = () => { localStorage.removeItem('user_session'); location.reload(); };

if (sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    if (sessionUser.group === 'admin') document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('d-none'));
    loadStats();
}
