// --- LOGIN ACTUALIZADO ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errorMsg = document.getElementById('login-error');

    // Convertimos el usuario a un correo ficticio para Firebase
    const email = user.toLowerCase() === "admin" ? "admin@sistema.local" : `${user.toLowerCase()}@sistema.local`;
    
    // TRUCO: Si la contraseña es corta, le añadimos ceros al final para cumplir los 6 caracteres de Firebase
    const securePass = pass.length < 6 ? pass.padEnd(6, "0") : pass;

    try {
        await signInWithEmailAndPassword(auth, email, securePass);
    } catch (error) {
        // Si el Admin maestro no existe, lo creamos (Bootstrapping)
        if (user === "Admin" && pass === "1130") {
            try {
                const userCred = await createUserWithEmailAndPassword(auth, "admin@sistema.local", "113000"); 
                await setDoc(doc(db, "users", userCred.user.uid), {
                    username: "Admin",
                    role: "admin",
                    createdAt: new Date()
                });
                alert("Usuario Admin configurado con éxito.");
                location.reload();
            } catch (createError) {
                errorMsg.innerText = "Error: " + createError.message;
                errorMsg.style.display = 'block';
            }
        } else {
            errorMsg.innerText = "Usuario o contraseña incorrectos.";
            errorMsg.style.display = 'block';
        }
    }
});
