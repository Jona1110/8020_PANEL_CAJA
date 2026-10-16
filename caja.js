// ====== PEGA AQUÍ TU NUEVA URL DE APPS SCRIPT ======
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzIEdxJv-1mJdEUppqqpUtvzsLIIGMNy4NdwIViUxTEzObrz1FcHMXFSIs3-mPVXC9N/exec"; 

let salesChartInstance = null; 
let pendingActionId = null; // Variable global para recordar qué íbamos a confirmar

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha-actual').innerText = new Date().toLocaleDateString('es-ES', opciones);
});

// ==== SISTEMA DE NOTIFICACIONES CUSTOM ====
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="material-symbols-rounded" style="font-size: 1.2em;">check_circle</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2800); 
}

function showCustomModal(type, title, message, actionType = 'alert', confirmCallback = null) {
    const modal = document.getElementById('custom-alert');
    const icon = document.getElementById('alert-icon');
    const actions = document.getElementById('alert-actions');
    
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = message;
    
    // Configurar icono
    const iconConfig = {
        'success': { class: 'success', icon: 'task_alt' },
        'error': { class: 'error', icon: 'error' },
        'warning': { class: 'warning', icon: 'warning' },
        'info': { class: 'info', icon: 'info' }
    };
    icon.className = `alert-icon ${iconConfig[type].class}`;
    icon.innerHTML = `<span class="material-symbols-rounded" style="font-size: 36px;">${iconConfig[type].icon}</span>`;
    
    // Configurar botones (Es alerta simple o requiere Confirmar/Cancelar)
    if(actionType === 'alert') {
        actions.innerHTML = `<button class="alert-btn primary" onclick="cerrarCustomModal()">Entendido</button>`;
    } else if (actionType === 'confirm') {
        actions.innerHTML = `
            <button class="alert-btn secondary" onclick="cerrarCustomModal()">Cancelar</button>
            <button class="alert-btn primary" id="btn-confirm-modal">Confirmar</button>
        `;
        document.getElementById('btn-confirm-modal').onclick = () => {
            cerrarCustomModal();
            if(confirmCallback) confirmCallback();
        };
    } else if (actionType === 'danger') {
        actions.innerHTML = `
            <button class="alert-btn secondary" onclick="cerrarCustomModal()">Cancelar</button>
            <button class="alert-btn danger" id="btn-confirm-modal">Cerrar Caja</button>
        `;
        document.getElementById('btn-confirm-modal').onclick = () => {
            cerrarCustomModal();
            if(confirmCallback) confirmCallback();
        };
    }
    
    modal.classList.add('active');
}

function cerrarCustomModal() { document.getElementById('custom-alert').classList.remove('active'); }

// ==== INICIALIZACIÓN Y NAVEGACIÓN ====
function initDashboard() {
    cargarPedidos();
    cargarMenu();
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`sec-${tabId}`).classList.add('active');
    btnElement.classList.add('active');
    
    const titles = { 'pedidos': 'Panel Central', 'menu': 'Editor de Menú', 'reportes': 'Reportes y Cierre' };
    document.getElementById('tab-title').innerText = titles[tabId];

    if(tabId === 'reportes') cargarReportes();
}

// ==== MÓDULO: CAJA / PEDIDOS ====
async function cargarPedidos() {
    const container = document.getElementById('pedidos-container');
    container.innerHTML = '<div class="empty-state">Sincronizando con base de datos...</div>';
    
    try {
        const response = await fetch(`${WEBHOOK_URL}?action=getPedidos`);
        const pedidos = await response.json();
        
        const pendientesCocina = pedidos.filter(p => p.Estado === 'Pendiente').length;
        const listosEntrega = pedidos.filter(p => p.Estado === 'Listo para entregar').length;
        
        document.getElementById('stat-activas').innerText = pedidos.length;
        document.getElementById('stat-cocina').innerText = pendientesCocina;
        document.getElementById('stat-listas').innerText = listosEntrega;

        if (pedidos.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: #6b7280;">
                    <span class="material-symbols-rounded" style="font-size: 3em; color: #d1d5db;">check_circle</span>
                    <p>No hay órdenes activas en este momento.</p>
                </div>`;
            return;
        }

        let html = '';
        pedidos.forEach(p => {
            const isReady = p.Estado === 'Listo para entregar';
            const badgeClass = isReady ? 'ready' : 'pending';
            const indicatorClass = isReady ? 'indicator-ready' : 'indicator-pending';
            const btnClass = isReady ? 'ready-btn' : '';
            const btnText = isReady ? 'Cobrar y Cerrar' : 'Forzar Cobro';
            const btnIcon = isReady ? 'payments' : 'warning';

            html += `
                <div class="pedido-card">
                    <div class="card-indicator ${indicatorClass}"></div>
                    <div class="pedido-header">
                        <span class="mesa-tag">${p.Mesa}</span>
                        <span class="badge ${badgeClass}">${p.Estado}</span>
                    </div>
                    <div class="pedido-id">Ticket: ${p.ID_Pedido}</div>
                    <div class="pedido-detalle">${p.Detalle}</div>
                    <div class="pedido-footer">
                        <div class="total-wrapper">
                            <span>Total a pagar</span>
                            <div class="pedido-total">$${parseFloat(p.Total).toFixed(2)}</div>
                        </div>
                        <button class="cobrar-btn ${btnClass}" onclick="confirmarCobro('${p.ID_Pedido}')">
                            <span class="material-symbols-rounded">${btnIcon}</span> ${btnText}
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) { container.innerHTML = '<div class="empty-state">Error al cargar pedidos. Verifica tu conexión.</div>'; }
}

function confirmarCobro(idPedido) {
    showCustomModal('info', 'Cobrar Ticket', `¿Confirmas el cobro y cierre del ticket ${idPedido}?`, 'confirm', () => ejecutarCobro(idPedido));
}

function ejecutarCobro(idPedido) {
    fetch(WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateStatus', idPedido: idPedido, newStatus: 'Cobrado' })
    })
    .then(() => {
        showToast('Ticket cobrado correctamente');
        cargarPedidos();
    })
    .catch(err => showCustomModal('error', 'Error', 'No se pudo registrar el cobro. Revisa tu conexión.'));
}

// ==== MÓDULO: REPORTES Y CIERRE DE CAJA ====
async function cargarReportes() {
    try {
        const response = await fetch(`${WEBHOOK_URL}?action=getReportes`);
        const historial = await response.json();
        
        const hoyStr = new Date().toLocaleDateString('es-ES');
        let ingresosHoy = 0, ticketsHoy = 0;
        const ventasPorDia = {}; 

        const ultimos7Dias = [];
        for (let i = 6; i >= 0; i--) {
            let d = new Date(); d.setDate(d.getDate() - i);
            let dStr = d.toLocaleDateString('es-ES');
            ultimos7Dias.push(dStr); ventasPorDia[dStr] = 0;
        }

        historial.forEach(p => {
            let fechaValor = p['Fecha y Hora'] || p.Fecha;
            if(!fechaValor) return; 

            const fechaStr = new Date(fechaValor).toLocaleDateString('es-ES');

            if (p.Estado === 'Cobrado' || p.Estado === 'Archivado') {
                let total = parseFloat(p.Total) || 0;
                if (ventasPorDia[fechaStr] !== undefined) ventasPorDia[fechaStr] += total;
                if (fechaStr === hoyStr) { ingresosHoy += total; ticketsHoy++; }
            }
        });

        document.getElementById('rep-ingresos-hoy').innerText = `$${ingresosHoy.toFixed(2)}`;
        document.getElementById('rep-ordenes-hoy').innerText = ticketsHoy;

        dibujarGrafica(ultimos7Dias, ultimos7Dias.map(fecha => ventasPorDia[fecha]));
    } catch (error) { console.error("Error cargando reportes:", error); }
}

function dibujarGrafica(etiquetas, datos) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Ingresos por Día ($)', data: datos,
                borderColor: '#3d5a2d', backgroundColor: 'rgba(61, 90, 45, 0.1)',
                borderWidth: 3, pointBackgroundColor: '#9fb580', pointRadius: 5, fill: true, tension: 0.3
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value; } } } } }
    });
}

function confirmarCierreCaja() {
    showCustomModal(
        'warning', 
        'Cierre de Caja Manual', 
        'Esto tomará todas las órdenes cobradas de hoy y las archivará en el historial. Este proceso es irreversible y dejará tu corte en ceros para el siguiente turno.\n\n¿Deseas continuar?', 
        'danger', 
        ejecutarCierreCajaReal
    );
}

function ejecutarCierreCajaReal() {
    const btn = document.querySelector('.ready-btn');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-rounded spin-icon">sync</span> Procesando Cierre...`;
    btn.disabled = true;

    fetch(WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'cerrarCaja' })
    }).then(r => r.json()).then(data => {
        if(data.status === 'success') {
            showCustomModal('success', 'Corte Z Exitoso', `Resumen del Turno:\n\n- Tickets Procesados: ${data.count}\n- Total Recaudado: $${data.total.toFixed(2)}\n\nLos tickets han sido archivados.`);
            btn.innerHTML = `<span class="material-symbols-rounded">check_circle</span> Caja Cerrada`;
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; cargarReportes(); }, 2500);
        }
    }).catch(err => {
        showCustomModal('error', 'Error en el Cierre', 'No se pudo realizar el corte. Intenta nuevamente.');
        btn.innerHTML = txtOriginal; btn.disabled = false;
    });
}

// ==== MÓDULO: GESTOR DE MENÚ ====
async function cargarMenu() {
    const container = document.getElementById('menu-editor-container');
    container.innerHTML = '<div class="empty-state">Cargando inventario...</div>';
    try {
        const response = await fetch(`${WEBHOOK_URL}?action=getMenu`);
        const menu = await response.json();
        let html = '';
        menu.forEach((item, index) => {
            if(!item.Nombre) return; 
            const idCat = `cat-${index}`, idNom = `nom-${index}`, idDesc = `desc-${index}`, idPre = `pre-${index}`, idIcoHidden = `ico-hidden-${index}`, idIcoPreview = `ico-prev-${index}`;
            let esBase64 = item.Icono && item.Icono.startsWith('data:image');
            let previewContent = esBase64 ? `<img src="${item.Icono}">` : `<span class="material-symbols-rounded" style="color:#aaa;">image</span>`;
            html += `
                <div class="edit-card">
                    <div class="row-group">
                        <div class="edit-group"><label>Categoría</label><input type="text" id="${idCat}" class="edit-input" value="${item.Categoria}"></div>
                        <div class="edit-group" style="flex: 0.5;"><label>Imagen</label><div class="image-upload-wrapper"><div class="img-preview-box" id="${idIcoPreview}">${previewContent}</div><input type="file" accept="image/*" class="file-input" style="width: 85px;" onchange="procesarImagen(event, '${idIcoHidden}', '${idIcoPreview}')"><input type="hidden" id="${idIcoHidden}" value="${item.Icono || ''}"></div></div>
                    </div>
                    <div class="edit-group"><label>Nombre</label><input type="text" id="${idNom}" class="edit-input" value="${item.Nombre}"></div>
                    <div class="edit-group"><label>Descripción</label><textarea id="${idDesc}" class="edit-input">${item.Descripcion}</textarea></div>
                    <div class="edit-group"><label>Precio ($)</label><input type="number" id="${idPre}" class="edit-input" value="${item.Precio}"></div>
                    <button class="save-full-btn" onclick="guardarEdicionCompleta('${item.Nombre}', ${index}, this)"><span class="material-symbols-rounded">save</span> Guardar</button>
                </div>`;
        });
        container.innerHTML = html;
    } catch (error) { container.innerHTML = '<div class="empty-state">Error al cargar el menú.</div>'; }
}

function procesarImagen(event, hiddenId, previewId) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 150; const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.7); 
            document.getElementById(hiddenId).value = base64Data; document.getElementById(previewId).innerHTML = `<img src="${base64Data}">`;
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function guardarEdicionCompleta(nombreOriginal, index, btnElement) {
    const data = { action: 'updateMenuItem', originalNombre: nombreOriginal, categoria: document.getElementById(`cat-${index}`).value, nombre: document.getElementById(`nom-${index}`).value, descripcion: document.getElementById(`desc-${index}`).value, precio: parseFloat(document.getElementById(`pre-${index}`).value), icono: document.getElementById(`ico-hidden-${index}`).value };
    
    if(!data.nombre || !data.precio) { 
        showCustomModal('warning', 'Campos Incompletos', 'El nombre y el precio del platillo son obligatorios.'); 
        return; 
    }
    
    const txt = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="material-symbols-rounded spin-icon" style="font-size:18px;">sync</span> Sincronizando...`; 
    btnElement.disabled = true;
    
    fetch(WEBHOOK_URL, { method: 'POST', body: JSON.stringify(data) })
    .then(r => r.json()).then(d => {
        if(d.status === 'success') {
            showToast(`Platillo "${data.nombre}" actualizado`);
            btnElement.classList.add('success'); 
            btnElement.innerHTML = `<span class="material-symbols-rounded">check_circle</span> Actualizado`;
            setTimeout(() => { btnElement.classList.remove('success'); btnElement.innerHTML = txt; btnElement.disabled = false; if(nombreOriginal !== data.nombre) cargarMenu(); }, 2000);
        }
    }).catch(() => { 
        showCustomModal('error', 'Error al Guardar', 'No pudimos actualizar el platillo. Revisa tu conexión.');
        btnElement.innerHTML = txt; btnElement.disabled = false; 
    });
}