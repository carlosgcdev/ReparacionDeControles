// ============================================================
// CONFIGURACIÓN DEL SISTEMA DE ÓRDENES
// Pega entre las comillas la URL de la aplicación web de Google Apps Script
// (termina en /exec). Mientras no la pegues, la página funciona como antes:
// el cotizador envía el reporte solo por WhatsApp y la sección
// "Rastrea tu reparación" muestra un aviso.
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbyh8NN7nJnp_MTanlK2d5c-dSQVijQ8_Cwrp_AEI4p7Knu7U7WiV1r_VuuurjkDpiXO-A/exec";

const WHATSAPP_TALLER = "523123816985";
const TIEMPO_LIMITE_API = 12000; // milisegundos antes de dar por fallida una consulta

/** true solo si API_URL tiene una dirección real de Apps Script. */
function apiConfigurada() {
  return /^https:\/\/script\.google(usercontent)?\.com\//.test(String(API_URL).trim());
}

/**
 * Llama a la API de Apps Script evitando la solicitud previa (preflight) de CORS:
 *  - GET con parámetros en la URL (sin encabezados personalizados).
 *  - POST con Content-Type text/plain (solicitud "simple").
 */
async function llamarApi(opciones) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_API);
  try {
    let respuesta;
    if (opciones.metodo === 'POST') {
      respuesta = await fetch(API_URL.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(opciones.cuerpo),
        signal: controlador.signal
      });
    } else {
      const url = API_URL.trim() + '?' + new URLSearchParams(opciones.parametros).toString();
      respuesta = await fetch(url, { method: 'GET', signal: controlador.signal });
    }
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

/** Escapa texto antes de insertarlo como HTML. */
function escaparHtml(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** "2026-10-10" → "10 oct 2026" */
function fechaLegible(texto) {
  if (!texto) return '';
  const p = String(texto).split('-').map(Number);
  if (p.length !== 3) return texto;
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dineroLegible(n) {
  if (n === '' || n === null || n === undefined) return '';
  return '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

(function() {
  'use strict';

  // Ruta en Google Maps hacia el taller (Real Pereira 10, Santa Cristina, Villa de Álvarez)
  const googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent('Reparaciónes de controles Xbox, Playstation y Nintendo Switch Colima, Real Pereira 10, Santa Cristina, 28973 Villa de Álvarez, Col.');

  // --- 1. ENLACES DE MAPA ---
  const mapBtn = document.getElementById('mapBtn');
  if (mapBtn) {
    mapBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.open(googleMapsUrl, '_blank');
    });
  }

  const mapPlaceholder = document.getElementById('mapPlaceholder');
  if (mapPlaceholder) {
    mapPlaceholder.addEventListener('click', function() {
      window.open(googleMapsUrl, '_blank');
    });
  }

  // --- 2. EFECTO DINÁMICO EN NAVBAR ---
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // --- 2a. MENÚ ☰ EN CELULAR ---
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  if (navbar && navToggle && navMenu) {
    const abrirCerrarMenu = function(abrir) {
      navbar.classList.toggle('menu-abierto', abrir);
      navToggle.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      navToggle.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
      // Se cambia solo la clase del ícono (reemplazar el elemento rompería la detección de "toque fuera")
      const icono = navToggle.querySelector('i');
      if (icono) icono.className = abrir ? 'fas fa-xmark' : 'fas fa-bars';
    };

    navToggle.addEventListener('click', function() {
      abrirCerrarMenu(!navbar.classList.contains('menu-abierto'));
    });

    // Se cierra al elegir una sección, al tocar fuera, con Escape o al agrandar la pantalla
    navMenu.addEventListener('click', function(e) {
      if (e.target.closest('a')) abrirCerrarMenu(false);
    });
    document.addEventListener('click', function(e) {
      if (navbar.classList.contains('menu-abierto') && !e.composedPath().includes(navbar)) abrirCerrarMenu(false);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navbar.classList.contains('menu-abierto')) {
        abrirCerrarMenu(false);
        navToggle.focus();
      }
    });
    window.addEventListener('resize', function() {
      if (window.innerWidth > 640) abrirCerrarMenu(false);
    });
  }

  // --- 2b. APARICIÓN SUAVE AL HACER SCROLL ---
  const revealTargets = document.querySelectorAll(
    '.section-header, .servicio-card, .porque-item, .galeria-item, .cotizador-wrapper, .rastreo-wrapper, .contacto-wrapper'
  );
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add('is-visible');
          revealObserver.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach(function(el) {
      // Escalonado ligero entre tarjetas hermanas
      const index = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.animationDelay = Math.min(index, 4) * 80 + 'ms';
      el.classList.add('reveal');
      revealObserver.observe(el);
    });
  }

  // --- 3. SCRIPT DE HORARIO DINÁMICO ---
  // Lunes a Sábado de 9:00 AM (9) a 8:00 PM (20)
  const statusBadge = document.getElementById('status-badge');
  if (statusBadge) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const currentHour = now.getHours();

    if (currentDay >= 1 && currentDay <= 6 && currentHour >= 9 && currentHour < 20) {
      statusBadge.className = 'badge-status open';
      statusBadge.innerHTML = '<i class="fas fa-circle"></i> Abierto ahora';
    } else {
      statusBadge.className = 'badge-status closed';
      statusBadge.innerHTML = '<i class="fas fa-circle"></i> Cerrado por ahora';
    }
  }

  // --- 4. MOTOR INTERACTIVO DE PARTÍCULAS (CANVAS) ---
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particlesArray = [];
    const numberOfParticles = 45;

    const mouse = {
      x: null,
      y: null,
      radius: 120
    };

    window.addEventListener('mousemove', function(event) {
      mouse.x = event.x;
      mouse.y = event.y;
    });

    window.addEventListener('mouseout', function() {
      mouse.x = null;
      mouse.y = null;
    });

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
      }

      draw() {
        ctx.fillStyle = 'rgba(255, 170, 0, 0.18)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0 || this.x > canvas.width) this.speedX = -this.speedX;
        if (this.y < 0 || this.y > canvas.height) this.speedY = -this.speedY;

        if (mouse.x != null && mouse.y != null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouse.radius) {
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            let force = (mouse.radius - distance) / mouse.radius;
            
            this.x -= forceDirectionX * force * 2;
            this.y -= forceDirectionY * force * 2;
          }
        }
      }
    }

    function init() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesArray = [];
      for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
      }
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', function() {
      init();
    });

    init();
    animate();
  }
})();
// ============================================================
// LÓGICA DEL COTIZADOR DINÁMICO MULTI-MANDO ANATÓMICO
// Con sistema de órdenes conectado: pide nombre y teléfono, genera un
// prerregistro con folio y después abre WhatsApp con el folio incluido.
// Si el sistema no está conectado o falla, funciona solo con WhatsApp.
// ============================================================
function initCotizador() {
  const botonesConsola = document.querySelectorAll('.btn-consola');
  const resumenReporte = document.getElementById('resumen-reporte');
  const btnEnviarReporte = document.getElementById('btnEnviarReporte');
  const datosCliente = document.getElementById('datosCliente');
  const errorDatos = document.getElementById('datosClienteError');
  const folioResultado = document.getElementById('folioResultado');
  const inputNombre = document.getElementById('cotNombre');
  const inputTelefono = document.getElementById('cotTelefono');
  const inputTrampa = document.getElementById('cotSitioWeb');

  if (!botonesConsola.length || !resumenReporte || !btnEnviarReporte) {
    return;
  }

  let consolaSeleccionada = "Xbox";
  let fallasSeleccionadas = new Set();
  let momentoDatosVisibles = 0; // para medir el tiempo de llenado (antispam)
  let enviando = false;
  const textoBotonOriginal = btnEnviarReporte.innerHTML;
  const usarSistema = apiConfigurada() && datosCliente;

  // Mapeo de nombres exactos del atributo data-consola a IDs del DOM
  const consolaToMandoId = {
    'Xbox': 'mando-xbox',
    'PlayStation': 'mando-playstation',
    'Nintendo Switch': 'mando-nintendo-switch'
  };

  // Función constructora para gestionar los eventos de clic
  function manejarClickComponente(e) {
    e.stopPropagation(); // Evita burbujeos inesperados
    const falla = this.getAttribute('data-falla');

    if (fallasSeleccionadas.has(falla)) {
      fallasSeleccionadas.delete(falla);
      this.classList.remove('falla-activa');
    } else {
      fallasSeleccionadas.add(falla);
      this.classList.add('falla-activa');
    }
    this.setAttribute('aria-pressed', fallasSeleccionadas.has(falla) ? 'true' : 'false');
    actualizarInterfaz();
  }

  // Con teclado: Enter o espacio marcan la pieza enfocada
  function manejarTeclaComponente(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      manejarClickComponente.call(this, e);
    }
  }

  // Inicializa los listeners exclusivamente en la consola activa
  function inicializarListenersMando(mandoId) {
    // Remover selectores y listeners previos de todo el documento para limpiar estados viejos
    document.querySelectorAll('.componente-mando').forEach(comp => {
      comp.removeEventListener('click', manejarClickComponente);
      comp.removeEventListener('keydown', manejarTeclaComponente);
    });

    // Añadir el listener únicamente a los componentes visibles del mando actual
    const mandoActual = document.getElementById(mandoId);
    if (mandoActual) {
      const componentes = mandoActual.querySelectorAll('.componente-mando');
      componentes.forEach(comp => {
        comp.addEventListener('click', manejarClickComponente);
        comp.addEventListener('keydown', manejarTeclaComponente);
        comp.setAttribute('aria-pressed', 'false');
      });
    }
  }

  // Cambio dinámico de consolas
  botonesConsola.forEach(btn => {
    btn.addEventListener('click', function() {
      botonesConsola.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const consolaTexto = this.getAttribute('data-consola');
      consolaSeleccionada = consolaTexto;

      // Limpiar absolutamente todos los sets y clases CSS previas
      fallasSeleccionadas.clear();
      document.querySelectorAll('.componente-mando').forEach(c => {
        c.classList.remove('falla-activa');
        c.setAttribute('aria-pressed', 'false');
      });

      // Ocultar de manera garantizada todas las secciones de controles
      document.querySelectorAll('.mando-dinamico').forEach(mando => {
        mando.style.display = 'none';
        mando.classList.remove('active');
      });

      // Mostrar exclusivamente el control seleccionado
      const targetMandoId = consolaToMandoId[consolaSeleccionada];
      const mandoAIluminar = document.getElementById(targetMandoId);
      if (mandoAIluminar) {
        mandoAIluminar.style.display = 'block';
        mandoAIluminar.classList.add('active');
        // Re-mapear triggers táctiles
        inicializarListenersMando(targetMandoId);
      }

      actualizarInterfaz();
    });
  });

  // Renderizador de cadenas de texto y validador del botón de acción
  function actualizarInterfaz() {
    // Cualquier cambio en la selección invalida el folio mostrado anteriormente
    if (folioResultado) {
      folioResultado.hidden = true;
      folioResultado.innerHTML = '';
    }
    if (errorDatos) errorDatos.textContent = '';
    btnEnviarReporte.hidden = false;

    if (fallasSeleccionadas.size === 0) {
      const mensajeBase = consolaSeleccionada === 'Nintendo Switch'
        ? 'Toca las piezas del control que fallan para generar el reporte.'
        : 'Haz clic en las piezas que fallan en el control de arriba.';
      resumenReporte.innerHTML = mensajeBase;
      resumenReporte.style.color = "#aaa";
      btnEnviarReporte.style.opacity = "0.5";
      btnEnviarReporte.style.pointerEvents = "none";
      if (usarSistema) datosCliente.hidden = true;
    } else {
      const listaFallas = Array.from(fallasSeleccionadas).map(escaparHtml).join(', ');
      resumenReporte.innerHTML = `<strong>Fallas seleccionadas:</strong> <span style="color:#ff3b30; font-weight:bold;">${listaFallas}</span>`;
      resumenReporte.style.color = "#fff";
      btnEnviarReporte.style.opacity = "1";
      btnEnviarReporte.style.pointerEvents = "auto";
      if (usarSistema && datosCliente.hidden) {
        datosCliente.hidden = false;
        if (!momentoDatosVisibles) momentoDatosVisibles = Date.now();
      }
    }
  }

  // Texto del reporte para WhatsApp (con folio si se generó)
  function construirMensaje(folio, nombre) {
    const listaFallas = Array.from(fallasSeleccionadas).map(f => `• ${f}`).join('\n');
    return `Hola, acabo de generar un reporte técnico desde el Cotizador Interactivo de tu Página Web:\n\n` +
           (folio ? `*Folio:* ${folio}\n` : '') +
           (nombre ? `*Nombre:* ${nombre}\n` : '') +
           `*Dispositivo:* Control de ${consolaSeleccionada}\n` +
           `*Componentes Dañados:*\n${listaFallas}\n\n` +
           `¿Me podrían indicar un presupuesto estimado de reparación y su horario de atención?`;
  }

  function urlWhatsApp(folio, nombre) {
    return `https://wa.me/${WHATSAPP_TALLER}?text=${encodeURIComponent(construirMensaje(folio, nombre))}`;
  }

  // Muestra el folio (o el aviso de error) y el botón para continuar en WhatsApp
  function mostrarResultado(folio, nombre, aviso, telefono) {
    const enlace = escaparHtml(urlWhatsApp(folio, nombre));
    folioResultado.innerHTML = folio
      ? `<div class="folio-tarjeta">
           <span class="folio-etiqueta"><i class="fas fa-circle-check"></i> ¡Listo! Tu folio es</span>
           <strong class="folio-numero">${escaparHtml(folio)}</strong>
           <p>Con tu número de teléfono puedes <a href="#rastrear" data-rastrear="${escaparHtml(telefono || '')}">rastrear tu reparación</a> cuando quieras.</p>
           <div class="folio-acciones">
             <button type="button" class="btn btn-outline" data-copiar="${escaparHtml(folio)}"><i class="far fa-copy"></i> Copiar folio</button>
             <a class="btn btn-primary btn-whatsapp-folio" href="${enlace}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Enviar reporte por WhatsApp</a>
           </div>
         </div>`
      : `<div class="folio-tarjeta folio-aviso">
           <p><i class="fas fa-circle-info"></i> ${escaparHtml(aviso)}</p>
           <div class="folio-acciones">
             <a class="btn btn-primary btn-whatsapp-folio" href="${enlace}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Enviar reporte por WhatsApp</a>
           </div>
         </div>`;
    folioResultado.hidden = false;
    // Con folio generado se ocultan el formulario y el botón para no duplicar el prerregistro
    if (folio) {
      datosCliente.hidden = true;
      btnEnviarReporte.hidden = true;
    }
    folioResultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Copiar folio y atajo para llenar el rastreo
  if (folioResultado) {
    folioResultado.addEventListener('click', function(e) {
      const copiar = e.target.closest('[data-copiar]');
      if (copiar) {
        const folio = copiar.getAttribute('data-copiar');
        const listo = () => { copiar.innerHTML = '<i class="fas fa-check"></i> Copiado'; };
        if (navigator.clipboard) navigator.clipboard.writeText(folio).then(listo, () => {});
        return;
      }
      const rastrear = e.target.closest('[data-rastrear]');
      if (rastrear) {
        const campoTel = document.getElementById('rastreoTel');
        if (campoTel && !campoTel.disabled) {
          campoTel.value = rastrear.getAttribute('data-rastrear');
          campoTel.dispatchEvent(new Event('input')); // aplica el formato 312 123 4567
        }
      }
    });
  }

  // El mensaje de error se borra en cuanto la persona corrige sus datos
  [inputNombre, inputTelefono].forEach(campo => {
    if (campo) campo.addEventListener('input', () => { errorDatos.textContent = ''; });
  });

  // Validación ligera en el navegador (el servidor vuelve a validar todo)
  function validarDatos() {
    const nombre = inputNombre.value.trim().replace(/\s+/g, ' ');
    const telefono = inputTelefono.value.replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{2,60}$/.test(nombre)) {
      return { error: 'Escribe tu nombre (solo letras).', campo: inputNombre };
    }
    if (!/^\d{10}$/.test(telefono)) {
      return { error: 'Escribe tu teléfono a 10 dígitos.', campo: inputTelefono };
    }
    return { nombre, telefono };
  }

  function ponerCargando(si) {
    enviando = si;
    btnEnviarReporte.disabled = si;
    btnEnviarReporte.innerHTML = si
      ? '<i class="fas fa-spinner fa-spin"></i> Generando folio…'
      : textoBotonOriginal;
  }

  // Envío del reporte
  btnEnviarReporte.addEventListener('click', async function() {
    if (fallasSeleccionadas.size === 0 || enviando) return;

    // Sin sistema de órdenes: igual que antes, directo a WhatsApp
    if (!usarSistema) {
      window.open(urlWhatsApp(), '_blank');
      return;
    }

    const datos = validarDatos();
    if (datos.error) {
      errorDatos.textContent = datos.error;
      datos.campo.focus();
      return;
    }
    errorDatos.textContent = '';
    ponerCargando(true);

    try {
      const r = await llamarApi({
        metodo: 'POST',
        cuerpo: {
          accion: 'prerregistro',
          nombre: datos.nombre,
          telefono: datos.telefono,
          consola: consolaSeleccionada,
          fallas: Array.from(fallasSeleccionadas),
          sitio_web: inputTrampa ? inputTrampa.value : '',
          tiempo: Date.now() - momentoDatosVisibles
        }
      });
      if (r && r.ok && r.folio) {
        mostrarResultado(r.folio, datos.nombre, '', datos.telefono);
      } else {
        mostrarResultado(null, datos.nombre,
          ((r && r.error) || 'No pudimos generar tu folio.') + ' Puedes enviarnos tu reporte por WhatsApp y te atendemos igual.');
      }
    } catch (err) {
      // El sistema no respondió: el cliente sigue pudiendo enviar su reporte
      mostrarResultado(null, datos.nombre, 'No pudimos generar tu folio en este momento, pero puedes enviarnos tu reporte por WhatsApp y te atendemos igual.');
    } finally {
      ponerCargando(false);
    }
  });

  // Inicialización de arranque por defecto (Xbox)
  inicializarListenersMando('mando-xbox');
}

// ============================================================
// RASTREA TU REPARACIÓN (por número de teléfono)
// ============================================================
function initRastreo() {
  const form = document.getElementById('formRastreo');
  const resultado = document.getElementById('rastreoResultado');
  const inputTel = document.getElementById('rastreoTel');
  const boton = document.getElementById('btnRastrear');
  if (!form || !resultado) return;

  // Descripción amable de cada estado
  const DESCRIPCIONES = {
    'Prerregistro': 'Recibimos tu solicitud. Trae tu equipo al taller para empezar; el diagnóstico es gratis.',
    'Recibido': 'Tu equipo ya está en el taller y está en fila para revisión.',
    'En diagnóstico': 'Estamos revisando tu equipo para encontrar la falla.',
    'Esperando pieza': 'Estamos esperando una pieza para tu reparación.',
    'En reparación': 'Tu equipo está en reparación.',
    'Reparado': '¡Tu equipo está listo! Ya puedes pasar a recogerlo.',
    'Entregado': 'Tu equipo fue entregado. ¡Gracias por tu confianza!'
  };
  const ICONOS = {
    'Prerregistro': 'fa-file-signature',
    'Recibido': 'fa-box-open',
    'En diagnóstico': 'fa-magnifying-glass',
    'Esperando pieza': 'fa-truck-fast',
    'En reparación': 'fa-screwdriver-wrench',
    'Reparado': 'fa-circle-check',
    'Entregado': 'fa-hand-holding-heart'
  };

  // Sin sistema conectado: aviso amable y formulario desactivado
  if (!apiConfigurada()) {
    resultado.innerHTML = `
      <div class="rastreo-mensaje">
        <i class="fas fa-tools"></i>
        <div>
          <strong>El rastreo en línea estará disponible muy pronto.</strong>
          <p>Mientras tanto, pregúntanos por tu equipo por WhatsApp y con gusto te decimos cómo va.</p>
          <a class="btn btn-outline" href="https://wa.me/${WHATSAPP_TALLER}?text=${encodeURIComponent('Hola, quiero saber cómo va la reparación de mi equipo.')}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Preguntar por WhatsApp</a>
        </div>
      </div>`;
    form.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    form.classList.add('desactivado');
    return;
  }

  function mostrarMensaje(tipo, icono, titulo, texto) {
    resultado.innerHTML = `
      <div class="rastreo-mensaje ${tipo}">
        <i class="fas ${icono}"></i>
        <div><strong>${titulo}</strong>${texto ? `<p>${texto}</p>` : ''}</div>
      </div>`;
  }

  // Línea de tiempo: "Esperando pieza" solo aparece si la orden está en ese paso
  function pasosPara(estado) {
    const pasos = ['Recibido', 'En diagnóstico', 'En reparación', 'Reparado', 'Entregado'];
    if (estado === 'Prerregistro') pasos.unshift('Prerregistro');
    if (estado === 'Esperando pieza') pasos.splice(pasos.indexOf('En diagnóstico') + 1, 0, 'Esperando pieza');
    return pasos;
  }

  function tarjetaOrden(o) {
    const equipo = [o.tipo, o.plataforma, o.modelo].filter(Boolean).map(escaparHtml).join(' · ');
    const pasos = pasosPara(o.estado);
    const actual = pasos.indexOf(o.estado);
    const lineaTiempo = `<ol class="linea-tiempo">${pasos.map((paso, i) => {
      const clase = i < actual ? 'completado' : i === actual ? 'actual' : 'pendiente';
      const icono = i < actual ? 'fa-check' : (ICONOS[paso] || 'fa-circle');
      return `<li class="paso ${clase}">
          <span class="paso-punto"><i class="fas ${icono}"></i></span>
          <span class="paso-texto">${escaparHtml(paso)}${i === actual ? `<small>${DESCRIPCIONES[paso] || ''}</small>` : ''}</span>
        </li>`;
    }).join('')}</ol>`;

    // Datos de entrega, saldo y garantía
    const datos = [];
    if (o.estado !== 'Entregado') {
      datos.push(['fa-calendar-day', 'Fecha estimada', o.fechaEstimada ? fechaLegible(o.fechaEstimada) : 'Por confirmar']);
      datos.push(['fa-wallet', 'Saldo pendiente', o.saldo !== '' ? dineroLegible(o.saldo) : 'Por cotizar']);
    } else {
      datos.push(['fa-calendar-check', 'Entregado', fechaLegible(o.fechaEntrega)]);
      datos.push(['fa-shield-halved', 'Garantía', `Vigente hasta el ${fechaLegible(o.garantiaHasta)} (${o.diasGarantia} ${o.diasGarantia === 1 ? 'día' : 'días'})`]);
    }

    return `
      <div class="rastreo-tarjeta">
        <div class="rastreo-cabecera">
          <div>
            <span class="rastreo-folio">${escaparHtml(o.folio)}</span>
            <span class="rastreo-equipo">${equipo}</span>
          </div>
          <span class="rastreo-estado" data-estado="${escaparHtml(o.estado)}">${escaparHtml(o.estado)}</span>
        </div>
        ${lineaTiempo}
        <dl class="rastreo-datos">${datos.map(d => `
          <div><dt><i class="fas ${d[0]}"></i> ${d[1]}</dt><dd>${escaparHtml(d[2])}</dd></div>`).join('')}</dl>
      </div>`;
  }

  function dibujarOrdenes(ordenes) {
    const titulo = ordenes.length === 1
      ? 'Encontramos 1 reparación'
      : `Encontramos ${ordenes.length} reparaciones`;
    resultado.innerHTML = `<p class="rastreo-conteo"><i class="fas fa-circle-check"></i> ${titulo}</p>` +
      ordenes.map(tarjetaOrden).join('');
  }

  // Solo números, con espacios para que se lea fácil: 312 123 4567
  inputTel.addEventListener('input', () => {
    const d = inputTel.value.replace(/\D/g, '').slice(0, 12);
    inputTel.value = d.length > 6 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
      : d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const tel = inputTel.value.replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');
    if (tel.length !== 10) {
      mostrarMensaje('error', 'fa-circle-exclamation', 'Revisa tu número', 'Escribe tu teléfono a 10 dígitos, el mismo que dejaste en el taller.');
      inputTel.focus();
      return;
    }

    boton.disabled = true;
    resultado.innerHTML = `<div class="rastreo-cargando"><span class="spinner"></span> Consultando tus reparaciones…</div>`;
    try {
      const r = await llamarApi({ metodo: 'GET', parametros: { accion: 'consultar', tel: tel } });
      if (r && r.ok && Array.isArray(r.ordenes) && r.ordenes.length) {
        dibujarOrdenes(r.ordenes);
      } else {
        mostrarMensaje('error', 'fa-magnifying-glass', 'No encontramos reparaciones con ese número',
          escaparHtml((r && r.error) || 'Revisa que sea el mismo teléfono que dejaste en el taller.'));
      }
    } catch (err) {
      mostrarMensaje('error', 'fa-wifi', 'No pudimos consultar en este momento',
        'Revisa tu conexión e intenta de nuevo en unos minutos, o pregúntanos por WhatsApp.');
    } finally {
      boton.disabled = false;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initCotizador(); initRastreo(); });
} else {
  initCotizador();
  initRastreo();
}
