const API_URL = window.location.origin;


/* =====================================================
   VARIABLES
===================================================== */

let mapa = null;
let marcador = null;

let mapaIncidencias = null;
let marcadoresIncidencias = [];
let incidenciasGuardadas = [];
let ventanaInformacion = null;

let tokenOperador =
  sessionStorage.getItem('sige_token_operador');

let codigoOperadorSesion =
  sessionStorage.getItem('sige_codigo_operador');


const UBICACION_INICIAL = {
  lat: -10.68,
  lng: -76.25
};


/* =====================================================
   INICIO
===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  cargarCategorias();

  const btnUbicacion =
    document.getElementById('btnUbicacion');

  if (btnUbicacion) {
    btnUbicacion.addEventListener(
      'click',
      usarUbicacionActual
    );
  }


  const formIncidencia =
    document.getElementById('formIncidencia');

  if (formIncidencia) {
    formIncidencia.addEventListener(
      'submit',
      registrarIncidencia
    );
  }


  const formLogin =
    document.getElementById('formLoginOperador');

  if (formLogin) {
    formLogin.addEventListener(
      'submit',
      iniciarSesionOperador
    );
  }

});


/* =====================================================
   GOOGLE MAPS
===================================================== */

window.initMap = function () {

  /* MAPA PARA REPORTAR */

  const elementoMapa =
    document.getElementById('map');

  if (elementoMapa) {

    mapa = new google.maps.Map(
      elementoMapa,
      {
        center: UBICACION_INICIAL,
        zoom: 14,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      }
    );


    mapa.addListener('click', evento => {

      seleccionarUbicacion({
        lat: evento.latLng.lat(),
        lng: evento.latLng.lng()
      });

    });

  }


  /* MAPA GENERAL DE INCIDENCIAS */

  const elementoMapaIncidencias =
    document.getElementById('mapaIncidencias');

  if (elementoMapaIncidencias) {

    mapaIncidencias =
      new google.maps.Map(
        elementoMapaIncidencias,
        {
          center: UBICACION_INICIAL,
          zoom: 13,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true
        }
      );


    ventanaInformacion =
      new google.maps.InfoWindow();

  }

};


/* =====================================================
   SELECCIONAR UBICACIÓN
===================================================== */

function seleccionarUbicacion(posicion) {

  if (!mapa) {
    return;
  }


  if (!marcador) {

    marcador = new google.maps.Marker({
      position: posicion,
      map: mapa,
      draggable: true,
      title: 'Ubicación de la incidencia'
    });


    marcador.addListener(
      'dragend',
      () => {

        const posicionNueva =
          marcador.getPosition();

        actualizarCoordenadas({
          lat: posicionNueva.lat(),
          lng: posicionNueva.lng()
        });

      }
    );

  } else {

    marcador.setPosition(posicion);

  }


  mapa.panTo(posicion);

  actualizarCoordenadas(posicion);

}


function actualizarCoordenadas(posicion) {

  document.getElementById('latitud').value =
    posicion.lat.toFixed(6);

  document.getElementById('longitud').value =
    posicion.lng.toFixed(6);

  document.getElementById('estadoUbicacion').textContent =
    '📍 Ubicación seleccionada correctamente.';

}


/* =====================================================
   GEOLOCALIZACIÓN
===================================================== */

function usarUbicacionActual() {

  const estado =
    document.getElementById('estadoUbicacion');


  if (!navigator.geolocation) {

    estado.textContent =
      'Tu navegador no permite obtener la ubicación.';

    return;
  }


  estado.textContent =
    'Obteniendo tu ubicación...';


  navigator.geolocation.getCurrentPosition(

    posicion => {

      const ubicacion = {
        lat: posicion.coords.latitude,
        lng: posicion.coords.longitude
      };


      seleccionarUbicacion(ubicacion);

      mapa.setZoom(17);

      estado.textContent =
        '📍 Ubicación actual detectada correctamente.';

    },


    error => {

      console.error(error);

      estado.textContent =
        'No fue posible obtener tu ubicación. Selecciona el punto manualmente en el mapa.';

    },


    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }

  );

}


/* =====================================================
   CATEGORÍAS
===================================================== */

async function cargarCategorias() {

  const select =
    document.getElementById('categoria');

  if (!select) {
    return;
  }


  try {

    const respuesta =
      await fetch(`${API_URL}/api/categorias`);


    if (!respuesta.ok) {
      throw new Error(
        'No se pudieron cargar las categorías'
      );
    }


    const datos =
      await respuesta.json();


    select.innerHTML =
      '<option value="">Seleccione una categoría</option>';


    datos.categorias.forEach(categoria => {

      const opcion =
        document.createElement('option');

      opcion.value =
        categoria.id;

      opcion.textContent =
        categoria.descripcion;

      select.appendChild(opcion);

    });

  } catch (error) {

    console.error(error);

    select.innerHTML =
      '<option value="">Error al cargar categorías</option>';

  }

}


/* =====================================================
   REGISTRAR INCIDENCIA
===================================================== */

async function registrarIncidencia(event) {

  event.preventDefault();


  const mensaje =
    document.getElementById('mensaje');

  const boton =
    document.getElementById('btnRegistrar');

  const latitud =
    document.getElementById('latitud').value;

  const longitud =
    document.getElementById('longitud').value;


  if (!latitud || !longitud) {

    mensaje.innerHTML = `
      <div class="alert alert-warning">
        Selecciona primero la ubicación de la incidencia.
      </div>
    `;

    return;
  }


  const datos = {

    categoria_id:
      Number(
        document.getElementById('categoria').value
      ),

    descripcion:
      document
        .getElementById('descripcion')
        .value
        .trim(),

    latitud:
      Number(latitud),

    longitud:
      Number(longitud),

    origen:
      'CIUDADANO'

  };


  try {

    boton.disabled = true;
    boton.textContent = 'Registrando...';


    const respuesta =
      await fetch(
        `${API_URL}/api/incidencias`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body:
            JSON.stringify(datos)
        }
      );


    const resultado =
      await respuesta.json();


    if (!respuesta.ok) {

      throw new Error(
        resultado.mensaje ||
        'Error al registrar incidencia'
      );

    }


    mensaje.innerHTML = `
      <div class="alert alert-success">
        <strong>
          Incidencia registrada correctamente.
        </strong>

        <br><br>

        Código:

        <strong>
          ${escaparHTML(resultado.incidencia.codigo)}
        </strong>
      </div>
    `;


    document
      .getElementById('formIncidencia')
      .reset();


    if (marcador) {

      marcador.setMap(null);
      marcador = null;

    }


    mapa.setCenter(UBICACION_INICIAL);
    mapa.setZoom(14);


    document.getElementById(
      'estadoUbicacion'
    ).textContent =
      'Selecciona una nueva ubicación en el mapa.';


    cargarIncidenciasMapa();

  } catch (error) {

    console.error(error);

    mensaje.innerHTML = `
      <div class="alert alert-danger">
        ${escaparHTML(error.message)}
      </div>
    `;

  } finally {

    boton.disabled = false;
    boton.textContent =
      'Registrar incidencia';

  }

}


/* =====================================================
   CAMBIAR VISTAS
===================================================== */

function mostrarVista(vista) {

  const reporte =
    document.getElementById('vistaReporte');

  const vistaMapa =
    document.getElementById('vistaMapa');

  const operador =
    document.getElementById('vistaOperador');


  const btnReporte =
    document.getElementById('btnVistaReporte');

  const btnMapa =
    document.getElementById('btnVistaMapa');

  const btnOperador =
    document.getElementById('btnVistaOperador');


  reporte.style.display = 'none';
  vistaMapa.style.display = 'none';
  operador.style.display = 'none';


  btnReporte.classList.remove('active');
  btnMapa.classList.remove('active');
  btnOperador.classList.remove('active');


  if (vista === 'reporte') {

    reporte.style.display = 'block';

    btnReporte.classList.add('active');


    setTimeout(() => {

      if (mapa) {

        google.maps.event.trigger(
          mapa,
          'resize'
        );

      }

    }, 100);

  }


  else if (vista === 'mapa') {

    vistaMapa.style.display = 'block';

    btnMapa.classList.add('active');


    setTimeout(() => {

      if (mapaIncidencias) {

        google.maps.event.trigger(
          mapaIncidencias,
          'resize'
        );

      }

      cargarIncidenciasMapa();

    }, 150);

  }


  else if (vista === 'operador') {

    operador.style.display = 'block';

    btnOperador.classList.add('active');

    comprobarSesionOperador();

  }

}


/* =====================================================
   MAPA GENERAL DE INCIDENCIAS
===================================================== */

async function cargarIncidenciasMapa() {

  const resumen =
    document.getElementById('resumenMapa');

  if (!resumen) {
    return;
  }


  resumen.textContent =
    'Cargando incidencias...';


  try {

    const respuesta =
      await fetch(`${API_URL}/api/incidencias`);


    if (!respuesta.ok) {
      throw new Error(
        'No se pudieron cargar las incidencias'
      );
    }


    const datos =
      await respuesta.json();


    incidenciasGuardadas =
      datos.incidencias || [];


    cargarFiltroCategorias();

    aplicarFiltrosMapa();

  } catch (error) {

    console.error(error);

    resumen.innerHTML = `
      <span class="text-danger">
        Error al cargar incidencias.
      </span>
    `;

  }

}


function cargarFiltroCategorias() {

  const select =
    document.getElementById('filtroCategoria');

  if (!select) {
    return;
  }


  const valorActual =
    select.value;


  const categorias =
    [
      ...new Set(
        incidenciasGuardadas
          .map(i => i.categoria)
          .filter(Boolean)
      )
    ];


  select.innerHTML =
    '<option value="">Todas las categorías</option>';


  categorias.forEach(categoria => {

    const opcion =
      document.createElement('option');

    opcion.value =
      categoria;

    opcion.textContent =
      formatearTexto(categoria);

    select.appendChild(opcion);

  });


  if (
    [...select.options]
      .some(opcion =>
        opcion.value === valorActual
      )
  ) {

    select.value = valorActual;

  }

}


function aplicarFiltrosMapa() {

  const filtroEstado =
    document.getElementById('filtroEstado');

  const filtroCategoria =
    document.getElementById('filtroCategoria');


  if (
    !filtroEstado ||
    !filtroCategoria
  ) {
    return;
  }


  const estado =
    filtroEstado.value;

  const categoria =
    filtroCategoria.value;


  const filtradas =
    incidenciasGuardadas.filter(
      incidencia => {

        const cumpleEstado =
          !estado ||
          incidencia.estado === estado;

        const cumpleCategoria =
          !categoria ||
          incidencia.categoria === categoria;

        return (
          cumpleEstado &&
          cumpleCategoria
        );

      }
    );


  dibujarIncidencias(filtradas);

}


function dibujarIncidencias(incidencias) {

  if (!mapaIncidencias) {
    return;
  }


  marcadoresIncidencias.forEach(
    marcadorActual =>
      marcadorActual.setMap(null)
  );


  marcadoresIncidencias = [];


  if (ventanaInformacion) {
    ventanaInformacion.close();
  }


  const limites =
    new google.maps.LatLngBounds();

  let totalValidos = 0;


  incidencias.forEach(incidencia => {

    const lat =
      Number(incidencia.latitud);

    const lng =
      Number(incidencia.longitud);


    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return;
    }


    const posicion = {
      lat: lat,
      lng: lng
    };


    const marcadorActual =
      new google.maps.Marker({

        position: posicion,
        map: mapaIncidencias,
        title: incidencia.codigo,

        icon:
          crearIconoEstado(
            incidencia.estado
          )

      });


    marcadorActual.addListener(
      'click',
      () => {

        const contenido = `
          <div class="info-incidencia">

            <h6>
              ${escaparHTML(incidencia.codigo)}
            </h6>

            <div>
              <strong>Tipo:</strong>
              ${escaparHTML(
                formatearTexto(
                  incidencia.categoria
                )
              )}
            </div>

            <div>
              <strong>Estado:</strong>
              ${escaparHTML(
                formatearTexto(
                  incidencia.estado
                )
              )}
            </div>

            <div>
              <strong>Prioridad:</strong>
              ${escaparHTML(
                incidencia.prioridad
              )}
            </div>

            <div>
              <strong>Origen:</strong>
              ${escaparHTML(
                incidencia.origen
              )}
            </div>

            <hr>

            ${escaparHTML(
              incidencia.descripcion
            )}

          </div>
        `;


        ventanaInformacion.setContent(
          contenido
        );


        ventanaInformacion.open({
          anchor: marcadorActual,
          map: mapaIncidencias
        });

      }
    );


    marcadoresIncidencias.push(
      marcadorActual
    );


    limites.extend(posicion);

    totalValidos++;

  });


  document.getElementById(
    'resumenMapa'
  ).innerHTML = `
    <strong>${totalValidos}</strong>
    incidencia(s) mostrada(s).
  `;


  if (totalValidos > 0) {

    mapaIncidencias.fitBounds(
      limites
    );


    if (totalValidos === 1) {

      mapaIncidencias.setZoom(16);

    }

  } else {

    mapaIncidencias.setCenter(
      UBICACION_INICIAL
    );

    mapaIncidencias.setZoom(13);

  }

}


/* =====================================================
   ICONOS SEGÚN ESTADO
===================================================== */

function crearIconoEstado(estado) {

  const colores = {

    PENDIENTE_VALIDACION:
      '#dc3545',

    VALIDADO:
      '#fd7e14',

    EN_ATENCION:
      '#ffc107',

    SOLUCIONADO:
      '#198754',

    DESCARTADO:
      '#343a40'

  };


  return {

    path:
      google.maps.SymbolPath.CIRCLE,

    scale:
      10,

    fillColor:
      colores[estado] || '#0d6efd',

    fillOpacity:
      1,

    strokeColor:
      '#ffffff',

    strokeWeight:
      2

  };

}


/* =====================================================
   LOGIN OPERADOR
===================================================== */

async function iniciarSesionOperador(event) {

  event.preventDefault();


  const codigo =
    document
      .getElementById('codigoOperador')
      .value
      .trim()
      .toUpperCase();


  const password =
    document
      .getElementById('passwordOperador')
      .value;


  const mensaje =
    document.getElementById('mensajeLogin');

  const boton =
    document.getElementById('btnLoginOperador');


  try {

    boton.disabled = true;
    boton.textContent =
      'Iniciando sesión...';


    const respuesta =
      await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              codigo: codigo,
              password: password
            })
        }
      );


    const datos =
      await respuesta.json();


    if (!respuesta.ok) {

      throw new Error(
        datos.mensaje ||
        'No fue posible iniciar sesión'
      );

    }


    tokenOperador =
      datos.token;

    codigoOperadorSesion =
      datos.operador;


    sessionStorage.setItem(
      'sige_token_operador',
      tokenOperador
    );


    sessionStorage.setItem(
      'sige_codigo_operador',
      codigoOperadorSesion
    );


    document.getElementById(
      'passwordOperador'
    ).value = '';


    mensaje.innerHTML = '';

    mostrarPanelOperador();

  } catch (error) {

    console.error(error);

    mensaje.innerHTML = `
      <div class="alert alert-danger">
        ${escaparHTML(error.message)}
      </div>
    `;

  } finally {

    boton.disabled = false;
    boton.textContent =
      'Iniciar sesión';

  }

}


function comprobarSesionOperador() {

  if (
    tokenOperador &&
    codigoOperadorSesion
  ) {

    mostrarPanelOperador();

  } else {

    document.getElementById(
      'panelLoginOperador'
    ).style.display = 'flex';


    document.getElementById(
      'panelGestionOperador'
    ).style.display = 'none';

  }

}


function mostrarPanelOperador() {

  document.getElementById(
    'panelLoginOperador'
  ).style.display = 'none';


  document.getElementById(
    'panelGestionOperador'
  ).style.display = 'block';


  document.getElementById(
    'operadorSesion'
  ).textContent =
    codigoOperadorSesion;


  cargarPanelOperador();

}


function cerrarSesionOperador() {

  tokenOperador = null;
  codigoOperadorSesion = null;


  sessionStorage.removeItem(
    'sige_token_operador'
  );


  sessionStorage.removeItem(
    'sige_codigo_operador'
  );


  const form =
    document.getElementById(
      'formLoginOperador'
    );

  if (form) {
    form.reset();
  }


  comprobarSesionOperador();

}


/* =====================================================
   PANEL OPERADOR
===================================================== */

async function cargarPanelOperador() {

  const lista =
    document.getElementById(
      'listaIncidenciasOperador'
    );


  lista.textContent =
    'Cargando incidencias...';


  try {

    const respuesta =
      await fetch(
        `${API_URL}/api/incidencias`
      );


    if (!respuesta.ok) {

      throw new Error(
        'No se pudieron cargar las incidencias'
      );

    }


    const datos =
      await respuesta.json();

    const incidencias =
      datos.incidencias || [];


    actualizarResumenOperador(
      incidencias
    );


    dibujarListaOperador(
      incidencias
    );

  } catch (error) {

    console.error(error);

    lista.innerHTML = `
      <div class="alert alert-danger">
        ${escaparHTML(error.message)}
      </div>
    `;

  }

}


function actualizarResumenOperador(
  incidencias
) {

  const contar = estado =>
    incidencias.filter(
      incidencia =>
        incidencia.estado === estado
    ).length;


  document.getElementById(
    'totalPendientes'
  ).textContent =
    contar('PENDIENTE_VALIDACION');


  document.getElementById(
    'totalValidadas'
  ).textContent =
    contar('VALIDADO');


  document.getElementById(
    'totalAtencion'
  ).textContent =
    contar('EN_ATENCION');


  document.getElementById(
    'totalSolucionadas'
  ).textContent =
    contar('SOLUCIONADO');

}


function dibujarListaOperador(
  incidencias
) {

  const lista =
    document.getElementById(
      'listaIncidenciasOperador'
    );


  if (incidencias.length === 0) {

    lista.innerHTML = `
      <div class="alert alert-light border">
        No existen incidencias registradas.
      </div>
    `;

    return;
  }


  lista.innerHTML = '';


  incidencias.forEach(
    incidencia => {

      const elemento =
        document.createElement('div');


      elemento.className =
        'incidencia-operador';


      elemento.innerHTML = `

        <div
          class="d-flex justify-content-between
                 align-items-start flex-wrap gap-2"
        >

          <div>

            <div class="codigo-incidencia">
              ${escaparHTML(
                incidencia.codigo
              )}
            </div>

            <div class="text-muted">
              ${escaparHTML(
                formatearTexto(
                  incidencia.categoria
                )
              )}
            </div>

          </div>


          <span
            class="badge bg-secondary estado-badge"
          >
            ${escaparHTML(
              formatearTexto(
                incidencia.estado
              )
            )}
          </span>

        </div>


        <hr>


        <p class="mb-2">

          ${escaparHTML(
            incidencia.descripcion
          )}

        </p>


        <div class="small text-muted">

          Prioridad:

          <strong>
            ${escaparHTML(
              incidencia.prioridad
            )}
          </strong>

          &nbsp; | &nbsp;

          Origen:

          <strong>
            ${escaparHTML(
              incidencia.origen
            )}
          </strong>

        </div>
        
        <div class="mt-3">

          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            id="btn-clima-${incidencia.id}"
            onclick="consultarClimaOperador(${incidencia.id})"
          >
            🌦 Ver clima del reporte
          </button>

          <div
            id="clima-${incidencia.id}"
            class="mt-2"
          ></div>

        </div>

        <div
          class="acciones-operador"
          id="acciones-${incidencia.id}"
        ></div>

      `;


      lista.appendChild(elemento);

      crearBotonesEstado(
        incidencia
      );

    }
  );

}


function crearBotonesEstado(
  incidencia
) {

  const contenedor =
    document.getElementById(
      `acciones-${incidencia.id}`
    );


  if (!contenedor) {
    return;
  }


  if (
    incidencia.estado ===
    'PENDIENTE_VALIDACION'
  ) {

    const validar =
      document.createElement('button');

    validar.className =
      'btn btn-success btn-sm';

    validar.textContent =
      'Validar';

    validar.addEventListener(
      'click',
      () =>
        cambiarEstadoOperador(
          incidencia.id,
          'VALIDADO'
        )
    );


    const descartar =
      document.createElement('button');

    descartar.className =
      'btn btn-outline-danger btn-sm';

    descartar.textContent =
      'Descartar';

    descartar.addEventListener(
      'click',
      () =>
        cambiarEstadoOperador(
          incidencia.id,
          'DESCARTADO'
        )
    );


    contenedor.appendChild(validar);
    contenedor.appendChild(descartar);

  }


  else if (
    incidencia.estado ===
    'VALIDADO'
  ) {

    const atender =
      document.createElement('button');

    atender.className =
      'btn btn-warning btn-sm';

    atender.textContent =
      'Iniciar atención';


    atender.addEventListener(
      'click',
      () =>
        cambiarEstadoOperador(
          incidencia.id,
          'EN_ATENCION'
        )
    );


    contenedor.appendChild(
      atender
    );

  }


  else if (
    incidencia.estado ===
    'EN_ATENCION'
  ) {

    const solucionar =
      document.createElement('button');

    solucionar.className =
      'btn btn-success btn-sm';

    solucionar.textContent =
      'Marcar como solucionado';


    solucionar.addEventListener(
      'click',
      () =>
        cambiarEstadoOperador(
          incidencia.id,
          'SOLUCIONADO'
        )
    );


    contenedor.appendChild(
      solucionar
    );

  }


  else {

    contenedor.innerHTML = `
      <span class="text-muted small">
        No hay acciones disponibles.
      </span>
    `;

  }

}

async function consultarClimaOperador(
  incidenciaId
) {

  const contenedor =
    document.getElementById(
      `clima-${incidenciaId}`
    );

  const boton =
    document.getElementById(
      `btn-clima-${incidenciaId}`
    );


  if (!contenedor || !boton) {
    return;
  }


  try {

    boton.disabled = true;
    boton.textContent =
      'Cargando clima...';


    contenedor.innerHTML = `
      <div class="text-muted small">
        Cargando clima registrado...
      </div>
    `;


    const respuesta =
      await fetch(
        `${API_URL}/api/incidencias/${incidenciaId}/clima`,
        {
          method: 'GET',

          headers: {
            'Authorization':
              `Bearer ${tokenOperador}`
          }
        }
      );


    const datos =
      await respuesta.json();


    if (respuesta.status === 401) {

      cerrarSesionOperador();

      throw new Error(
        'La sesión expiró. Inicie sesión nuevamente.'
      );

    }


    if (!respuesta.ok) {

      throw new Error(
        datos.mensaje ||
        'No fue posible consultar el clima'
      );

    }


    const temperatura =
      Number(datos.temperatura)
        .toFixed(2);

    const viento =
      Number(datos.velocidad_viento)
        .toFixed(2);

    const precipitacion =
      Number(datos.precipitacion)
        .toFixed(2);


    contenedor.innerHTML = `
      <div class="alert alert-info py-2 mb-0">

        <div>
          <strong>🌡 Temperatura:</strong>
          ${temperatura} °C
        </div>

        <div>
          <strong>💨 Viento:</strong>
          ${viento} km/h
        </div>

        <div>
          <strong>🌧 Precipitación:</strong>
          ${precipitacion} mm
        </div>

        <div>
          <strong>☁️ Clima:</strong>
          ${escaparHTML(
            datos.descripcion_clima || 'Sin descripción'
          )}
        </div>

      </div>
    `;


  } catch (error) {

    console.error(error);

    contenedor.innerHTML = `
      <div class="alert alert-danger py-2 mb-0">
        ${escaparHTML(error.message)}
      </div>
    `;

  } finally {

    boton.disabled = false;
    boton.textContent =
      '🌦 Ver clima del reporte';

  }

}

async function cambiarEstadoOperador(
  incidenciaId,
  nuevoEstado
) {

  const observacion =
    prompt(
      'Ingrese una observación para el cambio de estado:'
    );


  if (observacion === null) {
    return;
  }


  const mensaje =
    document.getElementById(
      'mensajeOperador'
    );


  try {

    const respuesta =
      await fetch(
        `${API_URL}/api/incidencias/${incidenciaId}/estado`,
        {
          method: 'PATCH',

          headers: {

            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${tokenOperador}`

          },

          body:
            JSON.stringify({
              estado: nuevoEstado,
              observacion:
                observacion.trim()
            })
        }
      );


    const datos =
      await respuesta.json();


    if (respuesta.status === 401) {

      cerrarSesionOperador();

      throw new Error(
        'La sesión expiró. Inicie sesión nuevamente.'
      );

    }


    if (!respuesta.ok) {

      throw new Error(
        datos.mensaje ||
        'No fue posible actualizar la incidencia'
      );

    }


    mensaje.innerHTML = `
      <div class="alert alert-success">
        Estado actualizado correctamente.
      </div>
    `;


    await cargarPanelOperador();

    await cargarIncidenciasMapa();

  } catch (error) {

    console.error(error);

    mensaje.innerHTML = `
      <div class="alert alert-danger">
        ${escaparHTML(error.message)}
      </div>
    `;

  }

}


/* =====================================================
   UTILIDADES
===================================================== */

function formatearTexto(texto) {

  if (!texto) {
    return '';
  }


  return texto
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      letra =>
        letra.toUpperCase()
    );

}


function escaparHTML(texto) {

  const elemento =
    document.createElement('div');

  elemento.textContent =
    texto ?? '';

  return elemento.innerHTML;

}

