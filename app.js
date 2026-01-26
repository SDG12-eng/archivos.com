// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// Configuración Cloudinary
const CLOUD_NAME = "df79cjkl"; // Corregido según tu texto
const UPLOAD_PRESET = "sistema_archivos"; // ¡Debes crear este preset en Cloudinary como 'Unsigned'!

// --- ESTADO GLOBAL ---
let currentUserData = null;

// --- GESTIÓN DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuario logueado: buscar sus datos adicionales (rol)
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            initApp();
        } else {
            // Caso especial: Es el primer login del Admin creado manualmente
            if(user.email === "admin@sistema.local") {
                currentUserData = { username: "Admin", role: "admin" };
                initApp();
            }
        }
    } else {
        // No logueado
        showLogin();
    }
});

function showLogin() {
    document.getElementById('login-screen').classList.remove('d-none');
    document.getElementById('app-screen').classList.add('d-none');
}

function initApp() {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    
    document.getElementById('user-display').innerText = `${currentUserData.username} (${currentUserData.role})`;
    
    // Control de Permisos (Menu)
    if (currentUserData.role !== 'admin') {
        document.getElementById('nav-usuarios').classList.add('d-none');
        // document.getElementById('nav-nuevo').classList.add('d-none'); // Descomentar si los applicants NO pueden subir
    } else {
        document.getElementById('nav-usuarios').classList.remove('d-none');
    }

    loadDashboardData(); // Cargar dashboard por defecto
}

// --- LOGIN (Lógica Especial Admin/1130) ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errorMsg = document.getElementById('login-error');

    // Mapeo simple de usuarios a emails falsos para Firebase Auth
    // Firebase requiere email, así que convertimos "Usuario" a "usuario@sistema.local"
    const email = user.toLowerCase() === "admin" ? "admin@sistema.local" : `${user.toLowerCase()}@sistema.local`;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // El onAuthStateChanged se encargará del resto
    } catch (error) {
        // Si el usuario es Admin y da error, intentamos crearlo la primera vez (Bootstrapping)
        if (user === "Admin" && pass === "1130" && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
            try {
                // Crear el Admin maestro si no existe
                const userCred = await createUserWithEmailAndPassword(auth, "admin@sistema.local", "11301130"); // Firebase pide min 6 chars
                // Guardar perfil en Firestore
                await setDoc(doc(db, "users", userCred.user.uid), {
                    username: "Admin",
                    role: "admin",
                    createdAt: new Date()
                });
                alert("Usuario Admin inicializado. Bienvenido.");
                // Automáticamente loguea
            } catch (createError) {
                errorMsg.innerText = "Error creando Admin: " + createError.message;
                errorMsg.style.display = 'block';
            }
        } else {
            errorMsg.innerText = "Credenciales incorrectas.";
            errorMsg.style.display = 'block';
            console.error(error);
        }
    }
});

window.logout = () => {
    logAction("Logout", "Usuario cerró sesión");
    signOut(auth);
    currentUserData = null;
    location.reload();
};

// --- NAVEGACIÓN ---
window.showSection = (sectionId) => {
    // Ocultar todas
    document.querySelectorAll('.content-section').forEach(el => el.classList.add('d-none'));
    // Mostrar seleccionada
    document.getElementById(sectionId).classList.remove('d-none');
    // Activar nav link
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    // Cargar datos según sección
    if(sectionId === 'dashboard') loadDashboardData();
    if(sectionId === 'consultas') loadRecords();
    if(sectionId === 'usuarios') loadUsers();
    if(sectionId === 'logs') loadLogs();
};

// --- FUNCIONES DE CLOUDINARY Y REGISTRO ---
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerText = "Procesando...";

    const category = document.getElementById('reg-category').value;
    const title = document.getElementById('reg-title').value;
    const fileInput = document.getElementById('reg-file');
    
    // Captura campos dinámicos
    const dynData = {};
    if(document.getElementById('field1-key').value) dynData[document.getElementById('field1-key').value] = document.getElementById('field1-val').value;
    if(document.getElementById('field2-key').value) dynData[document.getElementById('field2-key').value] = document.getElementById('field2-val').value;

    let fileUrl = "Sin archivo";
    
    // Subir a Cloudinary
    if (fileInput.files[0]) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('upload_preset', UPLOAD_PRESET); 

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            fileUrl = data.secure_url;
        } catch (err) {
            alert("Error subiendo imagen");
            console.error(err);
            btn.disabled = false;
            return;
        }
    }

    // Guardar en Firestore
    try {
        await addDoc(collection(db, "records"), {
            category,
            title,
            dynamicData: dynData,
            fileUrl,
            createdBy: currentUserData.username,
            timestamp: new Date()
        });
        
        await logAction("Nuevo Registro", `Creó documento: ${title}`);
        alert("Registro exitoso");
        document.getElementById('upload-form').reset();
    } catch (e) {
        console.error("Error Firestore", e);
        alert("Error guardando datos");
    }
    
    btn.disabled = false;
    btn.innerText = "Guardar Registro";
});

// --- FUNCIONES DE LECTURA DE DATOS ---

async function loadDashboardData() {
    const q = query(collection(db, "records"));
    const snap = await getDocs(q);
    const usersSnap = await getDocs(collection(db, "users"));
    
    document.getElementById('stat-total').innerText = snap.size;
    document.getElementById('stat-users').innerText = usersSnap.size;
    
    // Calcular categorías únicas
    const cats = new Set();
    snap.forEach(doc => cats.add(doc.data().category));
    document.getElementById('stat-cats').innerText = cats.size;
}

async function loadRecords() {
    const tbody = document.getElementById('records-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
    
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        const date = d.timestamp ? d.timestamp.toDate().toLocaleDateString() : "N/A";
        
        // Formatear datos dinámicos
        let extras = "";
        for (const [key, val] of Object.entries(d.dynamicData || {})) {
            extras += `<small><b>${key}:</b> ${val}</small><br>`;
        }

        const fileLink = d.fileUrl && d.fileUrl.startsWith('http') 
            ? `<a href="${d.fileUrl}" target="_blank" class="file-link"><i class="bi bi-file-earmark-arrow-down"></i> Ver</a>` 
            : '<span class="text-muted">-</span>';

        const row = `
            <tr>
                <td>${date}</td>
                <td><span class="badge bg-secondary">${d.category}</span></td>
                <td>${d.title}</td>
                <td>${d.createdBy}</td>
                <td>${extras}</td>
                <td>${fileLink}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

async function loadLogs() {
    if(currentUserData.role !== 'admin') {
        document.getElementById('logs-table-body').innerHTML = "<tr><td colspan='4'>Acceso denegado.</td></tr>";
        return;
    }
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), where("timestamp", ">", new Date(Date.now() - 86400000 * 7))); // Últimos 7 días
    const snap = await getDocs(q);
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        tbody.innerHTML += `<tr>
            <td>${d.timestamp.toDate().toLocaleString()}</td>
            <td>${d.user}</td>
            <td>${d.action}</td>
            <td>${d.details}</td>
        </tr>`;
    });
}

// --- GESTIÓN DE USUARIOS ---
document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUser = document.getElementById('new-username').value;
    const newPass = document.getElementById('new-password').value;
    const newRole = document.getElementById('new-role').value;

    try {
        // Crear en Firebase Auth
        // Nota: Para crear usuarios secundarios sin desloguear al admin, se necesita una Cloud Function o usar una App secundaria.
        // TRUCO SIMPLE JS: Solo guardaremos en Firestore "simuladamente" o usaremos un registro temporal.
        // Dado que esto es client-side puro, la forma correcta es crear el Auth. 
        // LIMITACIÓN: Auth SDK client-side loguea automáticamente al crear usuario. 
        // SOLUCIÓN: Usaremos solo Firestore para la gestión visual y crearemos el Auth "on the fly" o instruiremos al admin.
        
        // Mejor enfoque para este prototipo: Guardar en Firestore para control, y el Auth real se crea
        // cuando esa persona intenta loguearse por primera vez (lógica de registro abierto o validado).
        
        // Para simplificar tu petición: Vamos a crear un segundo objeto Auth temporal
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        
        const email = `${newUser.toLowerCase()}@sistema.local`;
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, newPass);
        
        // Guardar en Firestore principal
        await setDoc(doc(db, "users", userCred.user.uid), {
            username: newUser,
            role: newRole,
            createdAt: new Date()
        });

        await logAction("Crear Usuario", `Admin creó a ${newUser}`);
        alert(`Usuario ${newUser} creado correctamente.`);
        loadUsers();
        document.getElementById('create-user-form').reset();
        
        // Limpiar app secundaria
        // secondaryApp.delete(); // Opcional
    } catch (err) {
        alert("Error: " + err.message);
    }
});

async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        tbody.innerHTML += `<tr><td>${d.username}</td><td>${d.role}</td><td>${d.createdAt ? d.createdAt.toDate().toLocaleDateString() : '-'}</td></tr>`;
    });
}

// --- UTILIDADES ---
async function logAction(action, details) {
    await addDoc(collection(db, "logs"), {
        user: currentUserData ? currentUserData.username : "Anon",
        action,
        details,
        timestamp: new Date()
    });
}

window.filterTable = () => {
    const input = document.getElementById("search-input");
    const filter = input.value.toUpperCase();
    const table = document.querySelector("#records-table-body"); // Corregido selector
    const tr = table.getElementsByTagName("tr");

    for (let i = 0; i < tr.length; i++) {
        // Buscar en columnas Titulo (2) y Categoria (1)
        const tdTitle = tr[i].getElementsByTagName("td")[2];
        const tdCat = tr[i].getElementsByTagName("td")[1];
        if (tdTitle || tdCat) {
            const txtValue = (tdTitle.textContent || tdTitle.innerText) + " " + (tdCat.textContent || tdCat.innerText);
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
};
