// --- Variables Globales ---
let capturables = JSON.parse(localStorage.getItem('rose_capturables_data')) || {};
let typeCache = JSON.parse(localStorage.getItem('rose_type_cache')) || {};
let objetosDisponibles = JSON.parse(localStorage.getItem('rose_items_data')) || {};
let personajes = JSON.parse(localStorage.getItem('maker_personajes')) || [];
let tareas = JSON.parse(localStorage.getItem('maker_tareas')) || [];
let historia = JSON.parse(localStorage.getItem('maker_historia')) || []; 

let pokeActual = ""; 
let objetoActual = ""; 
let todosLosPokemon = []; 
let editandoPersonajeId = null;
let tempAvatarBase64 = "";
let escenaActualId = null; 
let dragSrcId = null; 

// --- VARIABLES PARA PAGINACIÓN Y FILTROS ---
let todosLosPokemonData = [];
let todosLosObjetosData = [];
let pokemonMostrados = 0;
let objetosMostrados = 0;
const ITEMS_POR_PAGINA = 50;

window.pokemonFiltradosActual = []; 
window.cacheFiltroTipo = null; 

// --- PARCHE DE MIGRACIÓN AUTOMÁTICA DE DATOS ---
for (let name in capturables) {
    if (capturables[name] && !Array.isArray(capturables[name])) capturables[name] = [ capturables[name] ]; 
}
for (let name in objetosDisponibles) {
    if (typeof objetosDisponibles[name] === 'boolean') delete objetosDisponibles[name]; 
}

let configuracion = JSON.parse(localStorage.getItem('maker_config')) || {};
configuracion.nombreJuego = configuracion.nombreJuego || "Pokémon Fangame";
configuracion.zonas = configuracion.zonas || [];
configuracion.facciones = configuracion.facciones || [];
configuracion.clases = configuracion.clases || [];

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem('maker_theme') === 'dark') document.body.classList.add('dark-mode');
    const inputName = document.getElementById("config_game_name");
    if(inputName) inputName.value = configuracion.nombreJuego !== "Pokémon Fangame" ? configuracion.nombreJuego : "";
    
    renderZonas(); renderFacciones(); renderClases(); actualizarDatalistZonas(); actualizarSelectorMapas(); renderPersonajes(); renderTareas(); renderEscenas(); 
    cargarPokemon(); cargarObjetos();
});

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) localStorage.setItem('maker_theme', 'dark');
    else localStorage.setItem('maker_theme', 'light');
}

function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
}

function cambiarPestana(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'tab_personajes') actualizarSelectsPersonajes(); 
    if (tabId === 'tab_mapas') { actualizarSelectorMapas(); renderEcosistema(); }
}

function toggleVista() { document.querySelectorAll('.pokemon-grid').forEach(grid => grid.classList.toggle('lista')); }

function aplicarOrden(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const btnCargar = grid.querySelector("div[id^='btn_cargar_mas_']");
    if(btnCargar) grid.removeChild(btnCargar);
    const cards = Array.from(grid.querySelectorAll(".pokemon-card"));
    
    cards.sort((a, b) => {
        let aMarcado = false; let bMarcado = false;
        if(gridId === "pokemon_grid") {
            aMarcado = capturables[a.dataset.nombre] && capturables[a.dataset.nombre].length > 0;
            bMarcado = capturables[b.dataset.nombre] && capturables[b.dataset.nombre].length > 0;
        } else if (gridId === "item_grid") {
            aMarcado = objetosDisponibles[a.dataset.nombre] && objetosDisponibles[a.dataset.nombre].length > 0;
            bMarcado = objetosDisponibles[b.dataset.nombre] && objetosDisponibles[b.dataset.nombre].length > 0;
        }
        if (aMarcado !== bMarcado) return bMarcado - aMarcado;
        if (gridId === "pokemon_grid") return parseInt(a.dataset.id) - parseInt(b.dataset.id);
        else return a.dataset.nombre.localeCompare(b.dataset.nombre);
    });
    cards.forEach(card => grid.appendChild(card));
    if(btnCargar) grid.appendChild(btnCargar);
}

function ordenarArrayMaestro(array, dictGuardados, tipo) {
    array.sort((a, b) => {
        let aMarcado = dictGuardados[a.name] && dictGuardados[a.name].length > 0;
        let bMarcado = dictGuardados[b.name] && dictGuardados[b.name].length > 0;
        if (aMarcado !== bMarcado) return bMarcado - aMarcado;
        if (tipo === 'poke') return parseInt(a.url.split('/')[6]) - parseInt(b.url.split('/')[6]);
        else return a.name.localeCompare(b.name);
    });
}

// --- Tracker Tareas ---
function agregarTarea() {
    const titleInput = document.getElementById("task_title_input"); const catInput = document.getElementById("task_category_input"); const prioInput = document.getElementById("task_priority_input");
    const texto = titleInput.value.trim(); if(!texto) return;
    tareas.push({ id: Date.now(), texto: texto, categoria: catInput.value, prioridad: prioInput.value, completada: false });
    titleInput.value = ""; localStorage.setItem('maker_tareas', JSON.stringify(tareas)); renderTareas();
}
function eliminarTarea(id) { tareas = tareas.filter(t => t.id !== id); localStorage.setItem('maker_tareas', JSON.stringify(tareas)); renderTareas(); }
function toggleTareaCompletada(id) {
    const index = tareas.findIndex(t => t.id === id);
    if (index !== -1) { tareas[index].completada = !tareas[index].completada; localStorage.setItem('maker_tareas', JSON.stringify(tareas)); renderTareas(); }
}
function actualizarTareaTexto(id, valor) {
    const index = tareas.findIndex(t => t.id === id);
    if (index !== -1) { tareas[index].texto = valor; localStorage.setItem('maker_tareas', JSON.stringify(tareas)); }
}
function renderTareas() {
    const container = document.getElementById("tracker_tareas_container"); if(!container) return; container.innerHTML = "";
    const filtroCat = document.getElementById("filter_category")?.value || "Todos"; const filtroPrio = document.getElementById("filter_priority")?.value || "Todos";
    let tareasFiltradas = tareas.filter(t => {
        const cat = t.categoria || "⚙️ Config"; const prio = t.prioridad || "🟡 Media";
        const pasaCat = (filtroCat === "Todos" || cat === filtroCat); const pasaPrio = (filtroPrio === "Todos" || prio.includes(filtroPrio)); 
        return pasaCat && pasaPrio;
    });
    tareasFiltradas.sort((a, b) => (a.completada ? 1 : 0) - (b.completada ? 1 : 0));
    if(tareasFiltradas.length === 0) { container.innerHTML = "<p style='color: var(--texto-mutado); text-align: center; padding: 40px; margin: 0; font-size: 14px;'>No hay tareas cargadas o ninguna coincide con los filtros.</p>"; return; }
    tareasFiltradas.forEach(t => {
        const row = document.createElement("div"); row.className = `task-row ${t.completada ? 'completed' : ''}`;
        const cat = t.categoria || "⚙️ Config"; const prio = t.prioridad || "🟡 Media"; const textoMostrar = t.texto || t.titulo || "Tarea sin descripción";
        let classPrio = "badge-prioridad-media"; if(prio.includes("Alta")) classPrio = "badge-prioridad-alta"; if(prio.includes("Baja")) classPrio = "badge-prioridad-baja";
        row.innerHTML = `<input type="checkbox" class="task-checkbox" ${t.completada ? 'checked' : ''} onchange="toggleTareaCompletada(${t.id})">
            <input type="text" class="task-text" value="${textoMostrar}" onchange="actualizarTareaTexto(${t.id}, this.value)" ${t.completada ? 'disabled' : ''}>
            <span class="task-badge badge-categoria">${cat}</span><span class="task-badge ${classPrio}">${prio}</span>
            <button class="btn-delete-card" onclick="eliminarTarea(${t.id})" title="Borrar Tarea" style="margin-left: auto;">🗑️</button>`;
        container.appendChild(row);
    });
}

// --- Dex Regional ---
async function cargarPokemon() {
    const grid = document.getElementById("pokemon_grid"); if (!grid) return;
    grid.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--texto-mutado);'>Conectando con PokeAPI, un segundito...</p>";
    try {
        const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
        if (!response.ok) throw new Error("El servidor rechazó la conexión.");
        const data = await response.json();
        todosLosPokemonData = data.results; todosLosPokemon = data.results.map(p => p.name); window.pokemonFiltradosActual = todosLosPokemonData;
        actualizarSelectsPersonajes(); ordenarArrayMaestro(todosLosPokemonData, capturables, 'poke'); renderPersonajes();
        grid.innerHTML = ""; pokemonMostrados = 0; mostrarMasPokemon(); await verificarTiposGuardados();
    } catch (error) { grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #d9534f; padding: 30px;"><button class="action-btn" onclick="cargarPokemon()">🔄 Reintentar Conexión</button></div>`; }
}

function crearCardPokemon(poke) {
    const id = poke.url.split('/')[6]; const nombre = poke.name; const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    const card = document.createElement("div"); card.className = "pokemon-card"; card.dataset.nombre = nombre; card.dataset.id = id; 
    if (capturables[nombre] && capturables[nombre].length > 0) card.classList.add("capturable");
    card.onclick = (event) => abrirModal(event, nombre);
    
    // NUEVO BOTÓN DE ELIMINAR
    card.innerHTML = `
        <button class="quick-delete-btn" title="Eliminar de todas las rutas" onclick="quitarCapturaRapida(event, '${nombre}')">🗑️</button>
        <button class="options-btn" title="Editar detalles" onclick="abrirModal(event, '${nombre}')">⚙️</button>
        <img src="${sprite}" alt="${nombre}" loading="lazy"><span>${nombre}</span>
    `;
    return card;
}

// LÓGICA DE ELIMINACIÓN RÁPIDA
function quitarCapturaRapida(event, nombre) {
    event.stopPropagation();
    if(confirm(`¿Estás seguro de que querés eliminar a ${nombre} de ABSOLUTAMENTE TODAS las rutas del juego?`)) {
        delete capturables[nombre];
        localStorage.setItem('rose_capturables_data', JSON.stringify(capturables));
        const card = document.querySelector(`#pokemon_grid .pokemon-card[data-nombre="${nombre}"]`);
        if (card) card.classList.remove("capturable"); 
        aplicarOrden("pokemon_grid");
        actualizarContadorTipos();
        if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema();
    }
}

function mostrarMasPokemon() {
    const grid = document.getElementById("pokemon_grid"); const btnViejo = document.getElementById("btn_cargar_mas_poke"); if (btnViejo) btnViejo.remove();
    const listaBase = window.pokemonFiltradosActual; const limite = Math.min(pokemonMostrados + ITEMS_POR_PAGINA, listaBase.length);
    const fragment = document.createDocumentFragment();
    for (let i = pokemonMostrados; i < limite; i++) { fragment.appendChild(crearCardPokemon(listaBase[i])); }
    grid.appendChild(fragment); pokemonMostrados = limite;
    if (pokemonMostrados < listaBase.length) {
        const btnDiv = document.createElement("div"); btnDiv.id = "btn_cargar_mas_poke"; btnDiv.style = "grid-column: 1 / -1; text-align: center; margin-top: 15px;";
        btnDiv.innerHTML = `<button class="action-btn" onclick="mostrarMasPokemon()" style="width: auto; background-color: #3498db; padding: 8px 20px; border-radius: 20px;">⬇️ Cargar más Pokémon</button>`;
        grid.appendChild(btnDiv);
    }
}

async function filtrarPokemon() {
    const input = document.getElementById("search_pokemon").value.toLowerCase();
    const tipoSelect = document.getElementById("search_type").value;
    const estadoSelect = document.getElementById("search_status") ? document.getElementById("search_status").value : "all";
    const grid = document.getElementById("pokemon_grid");
    if (tipoSelect && (!window.cacheFiltroTipo || window.cacheFiltroTipo.tipo !== tipoSelect)) {
        grid.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; color: var(--texto-mutado);'>Filtrando ecosistema global por tipo...</p>";
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/type/${tipoSelect}`); const data = await res.json();
            const pokes = data.pokemon.map(p => p.pokemon.name); window.cacheFiltroTipo = { tipo: tipoSelect, lista: pokes };
        } catch(e) { window.cacheFiltroTipo = { tipo: tipoSelect, lista: [] }; }
    }
    let filtrados = todosLosPokemonData;
    if (tipoSelect && window.cacheFiltroTipo) filtrados = filtrados.filter(p => window.cacheFiltroTipo.lista.includes(p.name));
    if (input !== "") filtrados = filtrados.filter(p => p.name.includes(input));
    if (estadoSelect === "added") filtrados = filtrados.filter(p => capturables[p.name] && capturables[p.name].length > 0);
    else if (estadoSelect === "missing") filtrados = filtrados.filter(p => !capturables[p.name] || capturables[p.name].length === 0);
    grid.innerHTML = ""; window.pokemonFiltradosActual = filtrados; pokemonMostrados = 0; mostrarMasPokemon();
}

function abrirModal(event, nombre) {
    if(event) event.stopPropagation(); 
    pokeActual = nombre; document.getElementById("modal_poke_name").textContent = nombre;
    document.querySelectorAll('input[name="enc_method"]').forEach(cb => cb.checked = false);
    
    // Autocompletar ruta si estamos en la pestaña Ecosistemas
    let defaultRoute = "";
    if (document.getElementById("tab_mapas").classList.contains("active")) {
        const selector = document.getElementById("mapas_selector");
        if (selector && selector.value) defaultRoute = selector.value;
    }
    document.getElementById("enc_route").value = defaultRoute;

    document.getElementById("enc_time_dia").checked = true;
    document.getElementById("enc_time_noche").checked = true;
    
    // Resetear niveles y chance
    document.getElementById("enc_min_level").value = "1";
    document.getElementById("enc_max_level").value = "1";
    document.getElementById("enc_chance").value = "10";

    pintarLocacionesPokemon();
    document.getElementById("capture_modal").style.display = "flex";
}

function pintarLocacionesPokemon() {
    const container = document.getElementById("poke_locations_container"); if(!container) return; container.innerHTML = "";
    const lista = capturables[pokeActual] || [];
    if(lista.length === 0) { container.innerHTML = "<p style='margin:0; font-size:12px; color:var(--texto-mutado);'>No aparece en ninguna ruta todavía.</p>"; return; }
    
    lista.forEach((enc, idx) => {
        const div = document.createElement("div");
        div.style = "display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:5px; padding:3px; border-bottom:1px solid var(--borde-card); color:var(--texto-principal);";
        let detalles = `Nv ${enc.minLevel || 1}-${enc.maxLevel || 1} (${enc.chance || 10}%)`;
        div.innerHTML = `<span>📍 <b>${enc.ruta}</b> - ${enc.metodo} (${enc.tiempo})<br><small style="color:var(--texto-mutado)">${detalles}</small></span>
                         <div>
                             <button onclick="editarRutaPokemonSpecific(${idx})" style="background:transparent; border:none; color:#f39c12; cursor:pointer; font-weight:bold; margin-right: 10px;" title="Editar">✏️</button>
                             <button onclick="eliminarRutaPokemonSpecific(${idx})" style="background:transparent; border:none; color:#d9534f; cursor:pointer; font-weight:bold;" title="Borrar">✕</button>
                         </div>`;
        container.appendChild(div);
    });
}

function editarRutaPokemonSpecific(idx) {
    const enc = capturables[pokeActual][idx];

    // Volcamos los datos actuales en el formulario
    document.getElementById("enc_route").value = enc.ruta;
    document.querySelectorAll('input[name="enc_method"]').forEach(cb => { cb.checked = enc.metodo.includes(cb.value); });
    document.getElementById("enc_time_dia").checked = enc.tiempo.includes("Día");
    document.getElementById("enc_time_noche").checked = enc.tiempo.includes("Noche");
    document.getElementById("enc_min_level").value = enc.minLevel || 1;
    document.getElementById("enc_max_level").value = enc.maxLevel || 1;
    document.getElementById("enc_chance").value = enc.chance || 10;

    // Eliminamos la versión vieja para que, al darle a "Guardar", se actualice en lugar de duplicarse
    eliminarRutaPokemonSpecific(idx);
}

function eliminarRutaPokemonSpecific(idx) {
    if(capturables[pokeActual]) {
        capturables[pokeActual].splice(idx, 1);
        if(capturables[pokeActual].length === 0) delete capturables[pokeActual];
        localStorage.setItem('rose_capturables_data', JSON.stringify(capturables));
        pintarLocacionesPokemon(); actualizarContadorTipos();
        const card = document.querySelector(`#pokemon_grid .pokemon-card[data-nombre="${pokeActual}"]`);
        if(card && !capturables[pokeActual]) card.classList.remove("capturable");
        if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema();
    }
}

function cerrarModal() { document.getElementById("capture_modal").style.display = "none"; }

async function guardarCaptura() {
    const ruta = document.getElementById("enc_route").value.trim() || "Ubicación desconocida";
    const checkboxesM = document.querySelectorAll('input[name="enc_method"]:checked'); const metodo = checkboxesM.length > 0 ? Array.from(checkboxesM).map(cb => cb.value).join(", ") : "Ninguno";
    const checkboxesT = document.querySelectorAll('input[name="enc_time"]:checked'); const tiempo = checkboxesT.length > 0 ? Array.from(checkboxesT).map(cb => cb.value).join(", ") : "Ninguno";
    
    // Capturar niveles y chance
    const minLvl = document.getElementById("enc_min_level").value || 1;
    const maxLvl = document.getElementById("enc_max_level").value || 1;
    const chance = document.getElementById("enc_chance").value || 10;

    if(!capturables[pokeActual]) capturables[pokeActual] = [];
    capturables[pokeActual].push({ ruta: ruta, metodo: metodo, tiempo: tiempo, minLevel: minLvl, maxLevel: maxLvl, chance: chance });
    localStorage.setItem('rose_capturables_data', JSON.stringify(capturables));
    
    const card = document.querySelector(`#pokemon_grid .pokemon-card[data-nombre="${pokeActual}"]`); if (card) card.classList.add("capturable");
    actualizarContadorTipos(); pintarLocacionesPokemon(); 
    if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema();
    document.getElementById("enc_route").value = "";
}

function quitarCaptura() {
    delete capturables[pokeActual]; localStorage.setItem('rose_capturables_data', JSON.stringify(capturables));
    const card = document.querySelector(`#pokemon_grid .pokemon-card[data-nombre="${pokeActual}"]`); if (card) card.classList.remove("capturable");
    actualizarContadorTipos(); if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema(); cerrarModal();
}

async function asegurarTipos(nombre) {
    if (!typeCache[nombre]) {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombre}`); const data = await res.json();
            typeCache[nombre] = data.types.map(t => t.type.name); localStorage.setItem('rose_type_cache', JSON.stringify(typeCache));
        } catch(e) {}
    }
}
async function verificarTiposGuardados() { for (let nombre of Object.keys(capturables)) await asegurarTipos(nombre); actualizarContadorTipos(); }
function actualizarContadorTipos() {
    const claves = Object.keys(capturables); if (document.getElementById("total_counter")) document.getElementById("total_counter").textContent = `Total: ${claves.length}`;
    const container = document.getElementById("type_counter_container"); if (!container) return;
    const conteo = {}; claves.forEach(nombre => { (typeCache[nombre] || []).forEach(tipo => { conteo[tipo] = (conteo[tipo] || 0) + 1; }); });
    container.innerHTML = "";
    Object.entries(conteo).sort((a, b) => b[1] - a[1]).forEach(([tipo, cantidad]) => {
        const badge = document.createElement("div"); badge.className = `type-badge type-${tipo}`; badge.textContent = `${tipo}: ${cantidad}`; container.appendChild(badge);
    });
}
function generarListaCapturables() {
    const nombres = Object.keys(capturables); if (nombres.length === 0) { alert("No marcaste ningún Pokémon."); return; }
    let texto = `Los pokemon obtenibles son:\n-------------------------\n\n`;
    nombres.sort((a, b) => { return (parseInt(todosLosPokemon.indexOf(a)) || 0) - (parseInt(todosLosPokemon.indexOf(b)) || 0); }).forEach(poke => {
        const d = capturables[poke]; texto += `- ${poke} | Obtención: ${d.metodo} | Ubicación: ${d.ruta}\n`;
    });
    const blob = new Blob([texto], { type: "text/plain" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Pokemon_Obtenibles.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// --- Ecosistemas / Mapas ---
function actualizarSelectorMapas() {
    const selector = document.getElementById("mapas_selector"); if (!selector) return; const valActual = selector.value;
    selector.innerHTML = '<option value="">- Seleccioná un Mapa / Zona -</option>';
    configuracion.zonas.forEach(zona => { const opt = document.createElement("option"); opt.value = zona; opt.textContent = zona; selector.appendChild(opt); });
    selector.value = valActual;
}

function renderEcosistema() {
    const selector = document.getElementById("mapas_selector"); const grid = document.getElementById("ecosistema_grid");
    if (!selector || !grid) return; const zonaSeleccionada = selector.value; grid.innerHTML = "";
    if (!zonaSeleccionada) { grid.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; color: var(--texto-mutado); padding: 20px;'>Seleccioná una zona para ver su ecosistema.</p>"; return; }
    
    let pokesEnZona = [];
    Object.keys(capturables).forEach(nombre => {
        let encuentros = capturables[nombre] || []; encuentros.forEach(enc => { if (enc.ruta === zonaSeleccionada) pokesEnZona.push({ nombre: nombre, enc: enc }); });
    });
    
    let objetosEnZona = [];
    Object.keys(objetosDisponibles).forEach(nombre => { let rutas = objetosDisponibles[nombre] || []; if (rutas.includes(zonaSeleccionada)) objetosEnZona.push(nombre); });
    
    if (pokesEnZona.length === 0 && objetosEnZona.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; color: var(--texto-mutado); padding: 20px;'>No hay datos registrados en esta zona todavía.</p>"; return;
    }

    // ESTADÍSTICAS DE TIPOS
    let typeCounts = {};
    pokesEnZona.forEach(p => {
        let tipos = typeCache[p.nombre] || [];
        tipos.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
    });
    
    let totalUniquePokes = new Set(pokesEnZona.map(p => p.nombre)).size;
    
    if(totalUniquePokes > 0) {
        let statsDiv = document.createElement("div");
        statsDiv.style = "grid-column: 1 / -1; background: var(--bg-principal); padding: 15px; border-radius: 8px; border: 1px solid var(--borde); margin-bottom: 20px;";
        statsDiv.innerHTML = `<h4 style="margin-top:0; margin-bottom:10px; font-size:14px; color:var(--texto-secundario);">📊 Estadísticas tipos presentes:</h4>`;
        
        let badgesContainer = document.createElement("div");
        badgesContainer.style = "display: flex; flex-wrap: wrap; gap: 8px;";
        
        Object.entries(typeCounts).sort((a,b) => b[1] - a[1]).forEach(([tipo, count]) => {
            let pct = Math.round((count / totalUniquePokes) * 100);
            let b = document.createElement("span");
            b.className = `type-badge type-${tipo}`;
            b.textContent = `${tipo}: ${pct}%`;
            badgesContainer.appendChild(b);
        });
        statsDiv.appendChild(badgesContainer);
        grid.appendChild(statsDiv);
    }

    const metodosDefinidos = [
        { nombre: "Hierba Alta", emoji: "🌿" }, { nombre: "Surfeando", emoji: "🌊" }, { nombre: "Pescando", emoji: "🎣" },
        { nombre: "Evento", emoji: "🎁" }, { nombre: "Intercambio", emoji: "🔄" }, { nombre: "Evolucionando", emoji: "🧬" }, { nombre: "Ninguno", emoji: "❓" }
    ];

    // Lógica para subdividir por tiempo
    const gruposTiempo = [
        { id: 'ambos', nombre: "Día y Noche", emoji: "☀️🌙", eval: (t) => t.includes("Día") && t.includes("Noche") || t === "Cualquier momento" || t === "" },
        { id: 'dia', nombre: "Solo Día", emoji: "☀️", eval: (t) => t.includes("Día") && !t.includes("Noche") },
        { id: 'noche', nombre: "Solo Noche", emoji: "🌙", eval: (t) => t.includes("Noche") && !t.includes("Día") },
        { id: 'otro', nombre: "Otro horario", emoji: "⏱️", eval: (t) => !t.includes("Día") && !t.includes("Noche") && t !== "Cualquier momento" && t !== "" }
    ];

    metodosDefinidos.forEach(metodoObj => {
        const listaMetodo = pokesEnZona.filter(p => {
            const m = p.enc.metodo || "Ninguno";
            if (metodoObj.nombre === "Ninguno" && m === "Ninguno") return true;
            if (metodoObj.nombre !== "Ninguno" && m.includes(metodoObj.nombre)) return true;
            return false;
        });

        if (listaMetodo.length > 0) {
            // Título Principal del Método (Ej: 🌿 Hierba Alta)
            const titleEl = document.createElement("h3");
            titleEl.style = "grid-column: 1 / -1; margin-top: 20px; margin-bottom: 0px; color: var(--texto-principal); border-bottom: 2px solid var(--borde-card); padding-bottom: 5px; font-size: 18px;";
            titleEl.textContent = `${metodoObj.emoji} ${metodoObj.nombre}`;
            grid.appendChild(titleEl);

            // Sub-división por Horario
            gruposTiempo.forEach(grupo => {
                const listaTiempo = listaMetodo.filter(p => grupo.eval(p.enc.tiempo || ""));
                
                if(listaTiempo.length > 0) {
                    // Subtítulo del Horario (Ej: ☀️ Solo Día)
                    const subTitleEl = document.createElement("h4");
                    subTitleEl.style = "grid-column: 1 / -1; margin-top: 15px; margin-bottom: 5px; color: #0070f8; font-size: 14px; display: flex; align-items: center; gap: 5px;";
                    subTitleEl.innerHTML = `<span>${grupo.emoji}</span> ${grupo.nombre}`;
                    grid.appendChild(subTitleEl);

                    listaTiempo.forEach(p => {
                        const pokeData = todosLosPokemonData.find(pd => pd.name === p.nombre);
                        if (pokeData) {
                            const card = crearCardPokemon(pokeData);
                            card.classList.add("capturable");
                            
                            const infoExtra = document.createElement("div");
                            infoExtra.style = "font-size: 11px; color: var(--texto-mutado); margin-top: 5px; font-weight: 500;";
                            
                            // Mostramos directo el nivel y chance, ya no hace falta aclarar el horario en la tarjeta
                            let detalles = `Nv ${p.enc.minLevel || 1}-${p.enc.maxLevel || 1} | ${p.enc.chance || 10}%`;
                            infoExtra.innerHTML = `<span style="color:#d9534f; font-weight:bold;">${detalles}</span>`;
                            
                            card.appendChild(infoExtra); grid.appendChild(card);
                        }
                    });
                }
            });
        }
    });

    // Render de Objetos
    if (objetosEnZona.length > 0) {
        const titleEl = document.createElement("h3");
        titleEl.style = "grid-column: 1 / -1; margin-top: 30px; margin-bottom: 5px; color: var(--texto-principal); border-bottom: 2px solid var(--borde-card); padding-bottom: 5px; font-size: 18px;";
        titleEl.textContent = `🎒 Objetos en esta Zona`; grid.appendChild(titleEl);
        objetosEnZona.forEach(nombre => {
            const card = document.createElement("div"); card.className = "pokemon-card capturable";
            card.innerHTML = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${nombre}.png" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'"><span>${nombre.replace(/-/g, ' ')}</span>`;
            card.onclick = (event) => abrirModalObjeto(event, nombre); grid.appendChild(card);
        });
    }
}

// --- Objetos ---
async function cargarObjetos() {
    const grid = document.getElementById("item_grid"); if (!grid) return; grid.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--texto-mutado);'>Conectando con PokeAPI...</p>";
    try {
        const response = await fetch("https://pokeapi.co/api/v2/item?limit=1600"); const data = await response.json();
        todosLosObjetosData = data.results.filter(i => !["unused", "dummy", "data-card", "machine-part", "dynamax"].some(ex => i.name.includes(ex)));
        ordenarArrayMaestro(todosLosObjetosData, objetosDisponibles, 'item');
        grid.innerHTML = ""; objetosMostrados = 0; mostrarMasObjetos(); actualizarContadorObjetos();
    } catch (error) { grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #d9534f; padding: 30px;"><button class="action-btn" onclick="cargarObjetos()">🔄 Reintentar</button></div>`; }
}
function crearCardObjeto(item) {
    const card = document.createElement("div"); card.className = "pokemon-card"; card.dataset.nombre = item.name; 
    if (objetosDisponibles[item.name] && objetosDisponibles[item.name].length > 0) card.classList.add("capturable");
    card.onclick = (event) => abrirModalObjeto(event, item.name);
    card.innerHTML = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'"><span>${item.name.replace(/-/g, ' ')}</span>`;
    return card;
}
function mostrarMasObjetos() {
    const grid = document.getElementById("item_grid"); const btnViejo = document.getElementById("btn_cargar_mas_item"); if (btnViejo) btnViejo.remove();
    const limite = Math.min(objetosMostrados + ITEMS_POR_PAGINA, todosLosObjetosData.length); const fragment = document.createDocumentFragment();
    for (let i = objetosMostrados; i < limite; i++) { fragment.appendChild(crearCardObjeto(todosLosObjetosData[i])); }
    grid.appendChild(fragment); objetosMostrados = limite;
    if (objetosMostrados < todosLosObjetosData.length) {
        const btnDiv = document.createElement("div"); btnDiv.id = "btn_cargar_mas_item"; btnDiv.style = "grid-column: 1 / -1; text-align: center; margin-top: 15px;";
        btnDiv.innerHTML = `<button class="action-btn" onclick="mostrarMasObjetos()" style="width: auto; background-color: #3498db; padding: 8px 20px; border-radius: 20px;">⬇️ Cargar más Objetos</button>`;
        grid.appendChild(btnDiv);
    }
}
function filtrarObjetos() {
    const input = document.getElementById("search_item").value.toLowerCase(); const grid = document.getElementById("item_grid"); grid.innerHTML = "";
    if (input === "") { objetosMostrados = 0; mostrarMasObjetos(); return; }
    const filtrados = todosLosObjetosData.filter(i => i.name.replace(/-/g, ' ').includes(input));
    const fragment = document.createDocumentFragment(); filtrados.forEach(item => fragment.appendChild(crearCardObjeto(item))); grid.appendChild(fragment);
}
function abrirModalObjeto(event, nombre) {
    if(event) event.stopPropagation(); objetoActual = nombre; document.getElementById("modal_item_name").textContent = nombre.replace(/-/g, ' ');
    document.getElementById("item_route").value = ""; pintarLocacionesObjeto(); document.getElementById("object_modal").style.display = "flex";
}
function pintarLocacionesObjeto() {
    const container = document.getElementById("object_locations_container"); if(!container) return; container.innerHTML = "";
    const lista = objetosDisponibles[objetoActual] || [];
    if(lista.length === 0) { container.innerHTML = "<p style='margin:0; font-size:12px; color:var(--texto-mutado);'>No disponible en ningún mapa todavía.</p>"; return; }
    lista.forEach((ruta, idx) => {
        const div = document.createElement("div"); div.style = "display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:5px; padding:3px; border-bottom:1px solid var(--borde-card); color:var(--texto-principal);";
        div.innerHTML = `<span>📍 <b>${ruta}</b></span> <button onclick="eliminarRutaObjetoSpecific(${idx})" style="background:transparent; border:none; color:#d9534f; cursor:pointer; font-weight:bold;">✕</button>`;
        container.appendChild(div);
    });
}
function guardarObjetoRuta() {
    const ruta = document.getElementById("item_route").value.trim(); if(!ruta) return;
    if(!objetosDisponibles[objetoActual] || !Array.isArray(objetosDisponibles[objetoActual])) objetosDisponibles[objetoActual] = [];
    if(!objetosDisponibles[objetoActual].includes(ruta)) objetosDisponibles[objetoActual].push(ruta);
    localStorage.setItem('rose_items_data', JSON.stringify(objetosDisponibles));
    const card = document.querySelector(`#item_grid .pokemon-card[data-nombre="${objetoActual}"]`); if (card) card.classList.add("capturable");
    actualizarContadorObjetos(); pintarLocacionesObjeto(); if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema(); document.getElementById("item_route").value = "";
}
function eliminarRutaObjetoSpecific(idx) {
    if(objetosDisponibles[objetoActual]) {
        objetosDisponibles[objetoActual].splice(idx, 1); if(objetosDisponibles[objetoActual].length === 0) delete objetosDisponibles[objetoActual];
        localStorage.setItem('rose_items_data', JSON.stringify(objetosDisponibles)); pintarLocacionesObjeto(); actualizarContadorObjetos();
        const card = document.querySelector(`#item_grid .pokemon-card[data-nombre="${objetoActual}"]`); if(card && !objetosDisponibles[objetoActual]) card.classList.remove("capturable");
        if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema();
    }
}
function quitarObjetoTotal() {
    delete objetosDisponibles[objetoActual]; localStorage.setItem('rose_items_data', JSON.stringify(objetosDisponibles));
    const card = document.querySelector(`#item_grid .pokemon-card[data-nombre="${objetoActual}"]`); if (card) card.classList.remove("capturable");
    actualizarContadorObjetos(); if(document.getElementById("tab_mapas").classList.contains("active")) renderEcosistema(); cerrarModalObjeto();
}
function cerrarModalObjeto() { document.getElementById("object_modal").style.display = "none"; }
function actualizarContadorObjetos() { if (document.getElementById("total_items_counter")) document.getElementById("total_items_counter").textContent = `Total: ${Object.keys(objetosDisponibles).length}`; }
function generarListaObjetos() {
    const nombres = Object.keys(objetosDisponibles); if (nombres.length === 0) { alert("No marcaste ningún objeto."); return; }
    let texto = `Objetos disponibles:\n--------------------\n\n`; nombres.sort().forEach(item => { texto += `- ${item.replace(/-/g, ' ')}\n`; });
    const blob = new Blob([texto], { type: "text/plain" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Objetos.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// --- Backup ---
function exportarDatos() {
    const datosCompletos = { capturables, objetos: objetosDisponibles, configuracion, personajes, tareas, historia, typeCache, tema: localStorage.getItem('maker_theme') || 'light', fecha: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(datosCompletos, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `PokeMAKER_MasterBackup_${configuracion.nombreJuego.replace(/\s+/g, '_')}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function importarDatos(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (json.capturables) capturables = json.capturables; if (json.objetos) objetosDisponibles = json.objetos;
            if (json.configuracion) configuracion = json.configuracion; if (json.personajes) personajes = json.personajes;
            if (json.tareas) tareas = json.tareas; if (json.historia) historia = json.historia;
            if (json.typeCache) typeCache = json.typeCache; if (json.tema) localStorage.setItem('maker_theme', json.tema);
            localStorage.setItem('rose_capturables_data', JSON.stringify(capturables)); localStorage.setItem('rose_items_data', JSON.stringify(objetosDisponibles));
            localStorage.setItem('maker_config', JSON.stringify(configuracion)); localStorage.setItem('maker_personajes', JSON.stringify(personajes));
            localStorage.setItem('maker_tareas', JSON.stringify(tareas)); localStorage.setItem('maker_historia', JSON.stringify(historia));
            localStorage.setItem('rose_type_cache', JSON.stringify(typeCache)); alert("¡Proyecto cargado exitosamente!"); location.reload(); 
        } catch (err) { alert("Error al importar."); }
    }; reader.readAsText(file);
}

// --- Configuración ---
function guardarConfiguracion() {
    configuracion.nombreJuego = document.getElementById("config_game_name").value || "Pokémon Fangame"; localStorage.setItem('maker_config', JSON.stringify(configuracion));
    actualizarDatalistZonas(); actualizarSelectorMapas(); actualizarSelectsPersonajes();
}
function agregarElementoConfig(tipoElemento, inputId) {
    const input = document.getElementById(inputId); const valor = input.value.trim();
    if (valor && !configuracion[tipoElemento].includes(valor)) {
        configuracion[tipoElemento].push(valor); input.value = ""; guardarConfiguracion();
        if(tipoElemento === 'zonas') { renderZonas(); actualizarSelectorMapas(); }
        if(tipoElemento === 'facciones') renderFacciones(); if(tipoElemento === 'clases') renderClases();
    }
}
function eliminarElementoConfig(tipoElemento, valorABorrar) {
    configuracion[tipoElemento] = configuracion[tipoElemento].filter(v => v !== valorABorrar); guardarConfiguracion();
    if(tipoElemento === 'zonas') { renderZonas(); actualizarSelectorMapas(); renderEcosistema(); }
    if(tipoElemento === 'facciones') renderFacciones(); if(tipoElemento === 'clases') renderClases();
}
function agregarZona() { agregarElementoConfig('zonas', "nueva_zona_input"); } function eliminarZona(zona) { eliminarElementoConfig('zonas', zona); }
function agregarFaccion() { agregarElementoConfig('facciones', "nueva_faccion_input"); } function eliminarFaccion(faccion) { eliminarElementoConfig('facciones', faccion); }
function agregarClase() { agregarElementoConfig('clases', "nueva_clase_input"); } function eliminarClase(clase) { eliminarElementoConfig('clases', clase); }
function renderListaConfig(contenedorId, array, funcionEliminarNombre) {
    const contenedor = document.getElementById(contenedorId); if (!contenedor) return; contenedor.innerHTML = "";
    array.forEach(item => { const div = document.createElement("div"); div.className = "zona-item"; div.innerHTML = `<span>📌 ${item}</span> <button class="btn-eliminar-zona" onclick="${funcionEliminarNombre}('${item}')">X</button>`; contenedor.appendChild(div); });
}
function renderZonas() { renderListaConfig("lista_zonas", configuracion.zonas, "eliminarZona"); } function renderFacciones() { renderListaConfig("lista_facciones", configuracion.facciones, "eliminarFaccion"); }
function renderClases() { renderListaConfig("lista_clases", configuracion.clases, "eliminarClase"); }
function actualizarDatalistZonas() {
    const datalist = document.getElementById("zonas_list"); if (!datalist) return; datalist.innerHTML = "";
    configuracion.zonas.forEach(z => { const o = document.createElement("option"); o.value = z; datalist.appendChild(o); });
}

// --- Personajes ---
function getPokemonSpriteUrl(nombre) {
    const poke = todosLosPokemonData.find(p => p.name === nombre);
    if (poke) {
        const id = poke.url.split('/')[6];
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    }
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${nombre}.png`;
}
function actualizarSelectsPersonajes() {
    const cl = document.getElementById("char_class"); const fc = document.getElementById("char_faction"); const zn = document.getElementById("char_zone"); if(!cl) return;
    cl.innerHTML = '<option value="">- Ninguna -</option>' + configuracion.clases.map(c => `<option value="${c}">${c}</option>`).join('');
    fc.innerHTML = '<option value="">- Ninguna -</option>' + configuracion.facciones.map(f => `<option value="${f}">${f}</option>`).join('');
    zn.innerHTML = '<option value="">- Ninguna -</option>' + configuracion.zonas.map(z => `<option value="${z}">${z}</option>`).join('');
    let op = ""; todosLosPokemon.forEach(p => { op += `<option value="${p}">${p}</option>`; });
    for(let i = 1; i <= 6; i++) { const s = document.getElementById(`char_poke_${i}`); if (s) s.innerHTML = `<option value="">- Slot ${i} -</option>` + op; }
}
function abrirModalNuevoPersonaje() {
    editandoPersonajeId = null; tempAvatarBase64 = "";
    document.getElementById("char_name").value = ""; document.getElementById("char_class").value = ""; document.getElementById("char_faction").value = ""; document.getElementById("char_zone").value = ""; document.getElementById("char_notes").value = ""; 
    for(let i = 1; i <= 6; i++) document.getElementById(`char_poke_${i}`).value = "";
    document.getElementById("char_image_preview").style.backgroundImage = "none"; document.getElementById("char_image_icon").style.display = "block";
    document.getElementById("modal_char_title").textContent = "Crear Personaje"; document.getElementById("personaje_modal").style.display = "flex";
}
function cerrarModalPersonaje() { document.getElementById("personaje_modal").style.display = "none"; }
function previsualizarImagen(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const MAX_SIZE = 150; let width = img.width; let height = img.height;
            if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            tempAvatarBase64 = canvas.toDataURL('image/png'); document.getElementById("char_image_preview").style.backgroundImage = `url(${tempAvatarBase64})`; document.getElementById("char_image_icon").style.display = "none";
        }
        img.src = e.target.result;
    }; reader.readAsDataURL(file);
}
function guardarPersonaje() {
    const nombre = document.getElementById("char_name").value.trim(); if (!nombre) { alert("Obligatorio."); return; }
    const equipo = []; for(let i = 1; i <= 6; i++) { const p = document.getElementById(`char_poke_${i}`).value; if (p) equipo.push(p); }
    if (editandoPersonajeId !== null) {
        const index = personajes.findIndex(p => p.id === editandoPersonajeId);
        if (index !== -1) personajes[index] = { ...personajes[index], nombre, clase: document.getElementById("char_class").value, faccion: document.getElementById("char_faction").value, zona: document.getElementById("char_zone").value, notas: document.getElementById("char_notes").value, equipo, avatar: tempAvatarBase64 || personajes[index].avatar };
    } else personajes.push({ id: Date.now(), nombre, clase: document.getElementById("char_class").value, faccion: document.getElementById("char_faction").value, zona: document.getElementById("char_zone").value, notas: document.getElementById("char_notes").value, equipo, avatar: tempAvatarBase64 });
    localStorage.setItem('maker_personajes', JSON.stringify(personajes)); cerrarModalPersonaje(); renderPersonajes();
}
function editarPersonajeWrapper(event, id) {
    event.stopPropagation(); const p = personajes.find(p => p.id === id); if (!p) return;
    editandoPersonajeId = id; tempAvatarBase64 = p.avatar || ""; document.getElementById("char_name").value = p.nombre; document.getElementById("char_class").value = p.clase || ""; document.getElementById("char_faction").value = p.faccion || ""; document.getElementById("char_zone").value = p.zona || ""; document.getElementById("char_notes").value = p.notes || p.notas || ""; 
    for(let i = 1; i <= 6; i++) document.getElementById(`char_poke_${i}`).value = p.equipo[i-1] || "";
    if (p.avatar) { document.getElementById("char_image_preview").style.backgroundImage = `url(${p.avatar})`; document.getElementById("char_image_icon").style.display = "none"; } else { document.getElementById("char_image_preview").style.backgroundImage = "none"; document.getElementById("char_image_icon").style.display = "block"; }
    document.getElementById("modal_char_title").textContent = "Editar Personaje"; document.getElementById("personaje_modal").style.display = "flex";
}
function eliminarPersonaje(event, id) { event.stopPropagation(); if(confirm("¿Eliminar?")) { personajes = personajes.filter(p => p.id !== id); localStorage.setItem('maker_personajes', JSON.stringify(personajes)); renderPersonajes(); } }
function verPersonaje(id) {
    const p = personajes.find(p => p.id === id); if(!p) return;
    const style = p.avatar ? `background-image: url(${p.avatar});` : '';
    const avatarDiv = document.getElementById("view_char_avatar"); avatarDiv.style = `width: 100px; height: 100px; margin: 0 auto 15px auto; border-radius: 50%; background-color: var(--bg-principal); background-size: cover; background-position: center; display: flex; justify-content: center; align-items: center; font-size: 40px; color: #ccc; ${style}`; avatarDiv.innerHTML = p.avatar ? '' : '👤'; document.getElementById("view_char_name").textContent = p.nombre;
    let inf = []; if(p.clase) inf.push(p.clase); if(p.faccion) inf.push(p.faccion); if(p.zona) inf.push(`📍 ${p.zona}`);
    document.getElementById("view_char_info").textContent = inf.join(" | "); const n = document.getElementById("view_char_notes"); if(p.notas) { n.style.display = "block"; n.textContent = `"${p.notas}"`; } else n.style.display = "none";
    const team = document.getElementById("view_char_team"); team.innerHTML = "";
    if(p.equipo.length > 0) { p.equipo.forEach(pk => { team.innerHTML += `<div style="text-align: center;"><img src="${getPokemonSpriteUrl(pk)}" style="width: 50px; height: 50px; background: var(--bg-principal); border-radius: 50%;" onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/poke-ball.png';"><br><span style="font-size: 10px;">${pk}</span></div>`; }); }
    else team.innerHTML = "<span style='color: var(--texto-mutado); font-size: 12px;'>Sin asignados</span>";
    document.getElementById("personaje_view_modal").style.display = "flex";
}
function cerrarModalViewPersonaje() { document.getElementById("personaje_view_modal").style.display = "none"; }
function renderPersonajes() {
    const c = document.getElementById("lista_personajes"); if(!c) return; c.innerHTML = "";
    if (personajes.length === 0) { c.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--texto-mutado);">Vacío.</p>'; return; }
    personajes.forEach(p => {
        const div = document.createElement("div"); div.className = "personaje-grid-card"; div.onclick = () => verPersonaje(p.id); const style = p.avatar ? `background-image: url(${p.avatar});` : '';
        div.innerHTML = `<div><div class="avatar" style="${style} display: flex; justify-content: center; align-items: center; font-size: 24px; color: #ccc;">${p.avatar ? '' : '👤'}</div><div style="font-weight: bold; font-size: 14px;">${p.nombre}</div><div style="font-size: 11px; color: var(--texto-secundario);">${p.clase || 'Sin clase'}</div><div style="display: flex; justify-content: center; gap: 3px; flex-wrap: wrap; margin-top: 5px;">${p.equipo.map(pk => `<img src="${getPokemonSpriteUrl(pk)}" style="width: 20px; height: 20px;" onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/poke-ball.png';">`).join('')}</div></div><div style="display: flex; justify-content: center; gap: 5px; margin-top: 10px;"><button style="background: #f39c12; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 10px;" onclick="editarPersonajeWrapper(event, ${p.id})">Editar</button><button style="background: #d9534f; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 10px;" onclick="eliminarPersonaje(event, ${p.id})">Borrar</button></div>`;
        c.appendChild(div);
    });
}

// --- Guion ---
function agregarEscena() { const nuevaEscena = { id: Date.now(), titulo: "Nueva Escena", texto: "" }; historia.push(nuevaEscena); localStorage.setItem('maker_historia', JSON.stringify(historia)); seleccionarEscena(nuevaEscena.id); renderEscenas(); }
function renderEscenas() {
    const c = document.getElementById("lista_escenas"); if(!c) return; c.innerHTML = "";
    historia.forEach(e => {
        const div = document.createElement("div"); div.className = `escena-item ${escenaActualId === e.id ? 'active' : ''}`; div.draggable = true; 
        div.ondragstart = (event) => handleDragStart(event, e.id); div.ondragover = (event) => handleDragOver(event);
        div.ondragend = (event) => { event.target.style.opacity = "1"; }; div.ondrop = (event) => handleDrop(event, e.id);
        div.onclick = () => seleccionarEscena(e.id); div.innerHTML = `<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;">☰ ${e.titulo || "Sin título"}</span><button class="btn-delete-card" onclick="eliminarEscena(event, ${e.id})">🗑️</button>`;
        c.appendChild(div);
    });
}
function handleDragStart(e, id) { dragSrcId = id; e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = "0.5"; } function handleDragOver(e) { e.preventDefault(); return false; }
function handleDrop(e, targetId) {
    e.preventDefault(); if (dragSrcId === targetId) return;
    const srcIndex = historia.findIndex(ex => ex.id === dragSrcId); const targetIndex = historia.findIndex(ex => ex.id === targetId);
    if (srcIndex !== -1 && targetIndex !== -1) { const [movedScene] = historia.splice(srcIndex, 1); historia.splice(targetIndex, 0, movedScene); localStorage.setItem('maker_historia', JSON.stringify(historia)); renderEscenas(); }
}
function seleccionarEscena(id) {
    escenaActualId = id; const e = historia.find(ex => ex.id === id);
    if (e) { document.getElementById("editor_vacio").style.display = "none"; document.getElementById("editor_escena").style.display = "flex"; document.getElementById("escena_titulo").value = e.titulo; document.getElementById("escena_texto").innerHTML = e.texto || ""; } renderEscenas();
}
function formatearTexto(comando) { document.execCommand(comando, false, null); document.getElementById('escena_texto').focus(); guardarEscenaActual(); }
function guardarEscenaActual() {
    if (!escenaActualId) return; const index = historia.findIndex(e => e.id === escenaActualId);
    if (index !== -1) { historia[index].titulo = document.getElementById("escena_titulo").value; historia[index].texto = document.getElementById("escena_texto").innerHTML; localStorage.setItem('maker_historia', JSON.stringify(historia)); renderEscenas(); }
}
function eliminarEscena(event, id) {
    event.stopPropagation(); if(confirm("¿Eliminar escena?")) { historia = historia.filter(e => e.id !== id); localStorage.setItem('maker_historia', JSON.stringify(historia));
        if (escenaActualId === id) { escenaActualId = null; document.getElementById("editor_vacio").style.display = "flex"; document.getElementById("editor_escena").style.display = "none"; } renderEscenas();
    }
}

function borrarProyecto() {
    const confirmacion = confirm("¿Estás seguro de que querés borrar TODO tu progreso? Esta acción no se puede deshacer.");
    
    if (confirmacion) {
        // Limpiamos el localStorage del navegador
        localStorage.clear();
        
        // Recargamos la página para que todo vuelva a su estado inicial
        location.reload();
    }
}