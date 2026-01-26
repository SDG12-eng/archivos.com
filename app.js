import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- LOGIN SIN AUTH (DIRECTO A FIRESTORE) ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('login-user').value.trim();
    const passVal = document.getElementById('login-pass').value.trim();

    if(userVal === "Admin" && passVal === "1130") {
        loginSuccess({ username: "Admin", role: "admin" });
        return;
    }

    const q = query(collection(db, "users"), where("username", "==", userVal), where("password", "==", passVal));
    const snap = await getDocs(q);

    if(!snap.empty) {
        const userData = snap.docs[0].data();
        loginSuccess(userData);
    } else {
        alert("Usuario o contraseña incorrectos");
    }
});

function loginSuccess(data) {
    sessionUser = data;
    localStorage.setItem('user_session', JSON.stringify(data));
    location.reload();
}

window.logout = () => {
    localStorage.removeItem('user_session');
    location.reload();
};

// --- GESTIÓN DE PLANTILLAS (ADMIN) ---
window.saveTemplate = async () => {
    const name = document.getElementById('type-name').value.trim();
    const fieldsStr = document.getElementById('type-fields').value;
    const fieldsArray = fieldsStr.split(',').map(f => f.trim());

    if(!name || fieldsArray.length === 0) return alert("Llena los campos");

    await setDoc(doc(db, "templates", name), {
        name: name,
        fields: fieldsArray
    });
    alert("Tipo guardado");
    loadTemplates();
};

async function loadTemplates() {
    const snap = await getDocs(collection(db, "templates"));
    const select = document.getElementById('reg-template-select');
    const tbody = document.getElementById('templates-table-body');
    
    if(select) select.innerHTML = '<option value="">-- Seleccione --</option>';
    if(tbody) tbody.innerHTML = "";

    snap.forEach(doc => {
        const t = doc.data();
        if(select) select.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        if(tbody) {
            tbody.innerHTML += `<tr>
                <td>${t.name}</td>
                <td>${t.fields.join(', ')}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteTemplate('${t.name}')">Eliminar</button></td>
            </tr>`;
        }
    });
}

// --- RENDER DINÁMICO DE CAMPOS ---
window.renderDynamicFields = async () => {
    const typeName = document.getElementById('reg-template-select').value;
    const container = document.getElementById('dynamic-fields-container');
    container.innerHTML = "";

    if(!typeName) return;

    const docRef = doc(db, "templates", typeName);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const fields = docSnap.data().fields;
        fields.forEach(field => {
            container.innerHTML += `
                <div class="col-md-4 mb-3">
                    <label class="form-label">${field}</label>
                    <input type="text" class="form-control dyn-input" data-field="${field}" placeholder="Ingrese ${field}">
                </div>
            `;
        });
    }
};

// --- GUARDAR REGISTRO ---
document.getElementById('dynamic-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('reg-template-select').value;
    const inputs = document.querySelectorAll('.dyn-input');
    let dataValues = {};

    inputs.forEach(input => {
        dataValues[input.getAttribute('data-field')] = input.value;
    });

    await addDoc(collection(db, "records"), {
        type: type,
        data: dataValues,
        user: sessionUser.username,
        timestamp: new Date()
    });

    alert("Datos registrados con éxito");
    showSection('dashboard');
});

// Inicialización
if(sessionUser) {
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
    document.getElementById('user-display').innerText = sessionUser.username;
    loadTemplates();
}
