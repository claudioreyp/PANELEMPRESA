// Cambiamos a la API de la nube (Render)
const API_BASE = "https://automatizaciondb.onrender.com/api";
const TABLE_NAME = "negocios";

// UI Elements
const formNegocio = document.getElementById('formNegocio');
const btnGenerarPass = document.getElementById('btnGenerarPass');
const inputContrasena = document.getElementById('contrasena');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const btnInitDB = document.getElementById('btnInitDB');

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Modals
const modalOverlay = document.getElementById('editModal');
const closeModalBtn = document.getElementById('closeModal');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editNombre = document.getElementById('editNombre');
const editPlan = document.getElementById('editPlan');
const editEstatus = document.getElementById('editEstatus');

// Helper: Genereate random password
function generarContrasena() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    inputContrasena.value = password;
}

// Helpers: Toasts
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize DB Table
async function inicializarTabla() {
    try {
        const res = await fetch(`${API_BASE}/tablas/${TABLE_NAME}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: "TEXT",
                contrasena: "TEXT",
                estatus: "TEXT",
                plan: "TEXT"
            })
        });
        
        if (res.ok) {
            statusIndicator.className = "indicator online";
            statusText.innerText = "API & BD Conectada";
            showToast("Conectado. Tabla lista.");
            cargarNegocios();
        } else {
            throw new Error("No pudo conectar");
        }
    } catch (e) {
        statusIndicator.className = "indicator offline";
        statusText.innerText = "Error de Conexión. Asegúrate de encender la API.";
        showToast("Error de conexión a la API", "error");
    }
}

// Create Negocio
async function crearNegocio(e) {
    e.preventDefault();
    const data = {
        nombre: document.getElementById('nombre').value,
        contrasena: inputContrasena.value,
        plan: document.getElementById('plan').value,
        estatus: document.getElementById('estatus').value
    };

    try {
        const res = await fetch(`${API_BASE}/datos/${TABLE_NAME}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast("Negocio creado exitosamente");
            formNegocio.reset();
            generarContrasena();
            cargarNegocios();
        } else {
            const err = await res.json();
            showToast(`Error: ${err.detail || 'Desconocido'}`, 'error');
        }
    } catch (e) {
        showToast("Error de red al crear negocio", "error");
    }
}

// Load Negocios
async function cargarNegocios() {
    try {
        const res = await fetch(`${API_BASE}/datos/${TABLE_NAME}`);
        if (!res.ok) throw new Error("Tabla no existe o vacía");
        
        const negocios = await res.json();
        
        tableBody.innerHTML = '';
        if (negocios.length === 0) {
            emptyState.style.display = 'block';
            document.querySelector('#negociosTable').style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            document.querySelector('#negociosTable').style.display = 'table';
            
            negocios.forEach(n => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${n.id}</td>
                    <td><strong>${n.nombre}</strong></td>
                    <td><span style="opacity: 0.5">••••••••</span> <button class="icon-btn" onclick="alert('Contra: ${n.contrasena}')" title="Ver Clave"><i class="fa-solid fa-eye"></i></button></td>
                    <td><span class="plan-badge ${n.plan.toLowerCase()}">${n.plan}</span></td>
                    <td><span class="badge ${n.estatus.toLowerCase()}">${n.estatus}</span></td>
                    <td class="actions-cell">
                        <button class="edit-btn" onclick="openEditModal(${n.id}, '${n.nombre}', '${n.plan}', '${n.estatus}')" title="Editar Estatus/Plan"><i class="fa-solid fa-pen"></i></button>
                        <button class="danger-btn" onclick="borrarNegocio(${n.id})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }
    } catch (e) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'block';
        document.querySelector('#negociosTable').style.display = 'none';
    }
}

// Delete Negocio
async function borrarNegocio(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este negocio permanentemente?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/datos/${TABLE_NAME}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("Negocio eliminado");
            cargarNegocios();
        } else {
            showToast("Error al eliminar", "error");
        }
    } catch (e) {
        showToast("Error de red", "error");
    }
}

// Modal logic for Updating
function openEditModal(id, nombre, plan, estatus) {
    editId.value = id;
    editNombre.value = nombre;
    editPlan.value = plan;
    editEstatus.value = estatus;
    modalOverlay.classList.add('active');
}

closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editId.value;
    
    try {
        // Obtenemos el registro actual primero para no machacar la contraseña sin querer, 
        // pero nuestra API PUT sobreescribe. En una dinámica enviamos lo que queremos.
        // Wait, "PUT" replaces entire row in our dynamic API so we need to fetch the row first, OR we can just ignore it or fetch it.
        // Let's fetch the current row first.
        const resGet = await fetch(`${API_BASE}/datos/${TABLE_NAME}`);
        const all = await resGet.json();
        const current = all.find(x => x.id == id);
        
        current.estatus = editEstatus.value;
        current.plan = editPlan.value;
        
        // Remove id for the PUT body
        delete current.id;
        
        const res = await fetch(`${API_BASE}/datos/${TABLE_NAME}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(current)
        });
        
        if (res.ok) {
            showToast("Actualizado correctamente");
            modalOverlay.classList.remove('active');
            cargarNegocios();
        }
    } catch(err) {
        showToast("Error actualizando", "error");
    }
});

// Event Listeners
btnInitDB.addEventListener('click', inicializarTabla);
formNegocio.addEventListener('submit', crearNegocio);
btnGenerarPass.addEventListener('click', generarContrasena);

// Startup
generarContrasena();

// ==========================================
// LOGIN LOGIC
// ==========================================
const loginForm = document.getElementById('loginForm');
const loginScreen = document.getElementById('loginScreen');
const mainDashboard = document.getElementById('mainDashboard');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;

    if (user === 'superadmin' && pass === 'serpaureqgom') {
        showToast("¡Bienvenido, Administrador!", "success");
        
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
            mainDashboard.style.display = 'block';
            mainDashboard.style.animation = 'slideUp 0.8s ease';
        }, 500);
    } else {
        showToast("Acceso Denegado: Usuario o contraseña incorrectos", "error");
        // Shake animation for error feedback
        const loginCard = document.querySelector('.login-card');
        loginCard.classList.add('shake');
        setTimeout(() => loginCard.classList.remove('shake'), 400);
        
        document.getElementById('loginPass').value = ""; // Clear password securely
    }
});
