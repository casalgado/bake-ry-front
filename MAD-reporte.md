## 1. ¿Cómo funciona el sistema de punta a punta?

El flujo central del sistema va desde la creación de un pedido hasta su cierre completo (entregado y cobrado).

### Paso 1 — Creación del pedido
El administrador o el staff crea el pedido en el sistema. Durante la creación se define:
- **Cliente**: B2B (empresa) o B2C (persona natural). Puede seleccionarse un cliente existente o crearse uno nuevo.
- **Productos y cantidades**: se seleccionan del catálogo del restaurante, con soporte de variaciones (ej. tamaño, sabor, gramaje) y combinaciones de precio diferenciado. Es posible modificar precios, costos e impuestos para cada combinacion. 
- **Fecha de entrega y hora**: define cuándo debe estar listo el pedido.
- **Tipo de entrega**: retiro en tienda (pickup) o domicilio (delivery), con dirección y tarifa de entrega.
- **Notas**: internas, para produccion o para delivery.
- **Precio y descuentos**: el sistema calcula subtotales, impuestos (IVA inclusivo o exclusivo) y descuentos a nivel de ítem o de pedido total.

El pedido queda registrado y visible inmediatamente para todos los roles del sistema.

### Paso 2 — Producción
El equipo de producción accede a su dashboard y ve los ítems que deben preparar para el día. Hay dos vistas disponibles:
- **Vista individual**: cada ítem de cada pedido por separado.
- **Vista agrupada**: ítems consolidados por producto y variación (ej. "10 unidades de Pan integral 500g"), ideal para planear la producción en lote.

El equipo puede marcar ítems como producidos a medida que avanza el trabajo.

### Paso 3 — Entrega
El driver (asistente de entrega) accede a su propio dashboard y ve únicamente los pedidos asignados para entrega. Puede:
- Ver la dirección, el cliente, los ítems y las notas de entrega.
- Marcar el pedido como entregado.
- Confirmar si el pago fue recibido en efectivo en el momento de la entrega.

El administrador puede consultar el calendario de entregas para tener visibilidad de la distribución diaria.

### Paso 4 — Pago
El pago puede registrarse en cualquier punto del proceso:
- **Pago total**: el pedido se marca como pagado con el método de pago correspondiente (efectivo, transferencia, tarjeta, etc.).
- **Pago parcial**: se registran uno o más pagos parciales, cada uno con su fecha, monto y método. El sistema calcula automáticamente el saldo pendiente.
- **Fecha de cobro programada**: se puede definir una fecha de pago esperada para hacer seguimiento de cuentas por cobrar.

El administrador puede consultar que pedidos estan en estado 'por cobrar'

### Paso 5 — Cierre y reportes
Una vez el pedido está pagado y entregado, queda cerrado y disponible en todos los módulos de reporte:
- **Reporte de ventas**: ingresos por período, desglosados por producto, método de pago, cliente B2B/B2C.
- **Estado de resultados**: ingresos menos costos de producción, para ver la rentabilidad real por producto o período.
- **Fechas de cobro**: seguimiento de pagos pendientes y programados.

---

## 3. Funcionalidades principales

### 3.01 Gestión de pedidos
El módulo central del sistema. Permite crear, editar y seguir pedidos con toda su complejidad operativa.

**Capacidades:**
- Creación de pedidos con múltiples ítems, variaciones y precios diferenciados
- Edición de pedidos en cualquier estado
- Duplicación de pedidos (útil para pedidos recurrentes de un mismo cliente)
- Estados de pedido configurables (ej. pendiente, en producción, listo, entregado)
- Registro de pagos: total, parcial o en múltiples cuotas
- Soporte de descuentos a nivel de ítem y a nivel de pedido (porcentaje o monto fijo)
- Manejo de impuestos: IVA inclusivo o exclusivo, con desglose por tasa
- Pedidos cortesía (complimentary) sin costo
- Pedidos cotización (quote) sin impacto en reportes financieros
- Creación de pedidos sin conexión a internet (modo offline)
- Historial de cambios por pedido: quién editó qué y cuándo
- Notas internas, notas para el cliente y notas de entrega
- Visibilidad en tiempo real de los cambios (sincronización automática)

### 3.02 Catálogo de productos
Gestión completa del portafolio de productos del restaurante.

**Capacidades:**
- Creación y edición de productos con nombre, descripción, precio de venta y costo
- Agrupación en colecciones (ej. Panes, Pasteles, Bebidas)
- Variaciones de producto: un mismo producto puede tener múltiples presentaciones con precios individuales (ej. Pan de yuca 200g / 500g / 1kg, cada uno con su precio y costo)
- Combinaciones de variaciones con múltiples dimensiones (ej. sabor + tamaño)
- Código contable por producto para integración con sistemas financieros
- Importación y exportación masiva de productos en Excel
- Orden de visualización configurable

### 3.03 Gestión de usuarios y clientes
Administración de todos los actores que interactúan con el sistema.

**Capacidades:**
- Creación de clientes B2C (personas naturales) con nombre, teléfono, dirección y fecha de cumpleaños
- Creación de clientes B2B (empresas) con nombre legal, NIT y periodo de gracia de facturación
- Creación de staff con rol y acceso al sistema
- Cliente especial "Punto de Venta" (POS) para ventas presenciales anónimas
- Historial de pedidos por cliente
- Búsqueda y filtrado de clientes

### 3.04 Reportes y análisis
Módulo financiero y operativo para la toma de decisiones.

**Capacidades:**
- **Reporte de ventas**: ingresos totales, número de pedidos, desglose por producto, cliente B2B/B2C, método de pago
- **Estado de resultados**: ingresos vs. costos de producción, margen bruto por producto o período
- **Fechas de cobro**: vista de pagos programados y vencidos para hacer seguimiento de cuentas por cobrar
- Filtros por período: día, semana, mes, trimestre, año
- Segmentación por categoría de producto o colección

### 3.05 Producción
Dashboard específico para el equipo de producción.

**Capacidades:**
- Vista de ítems individuales por pedido con nombre de cliente y fecha de entrega
- Vista agrupada de ítems por producto y variación con cantidades consolidadas
- Marcado de ítems como producidos
- Filtro por fecha de entrega

### 3.06 Entregas
Dashboard y herramientas para el equipo de reparto.

**Capacidades:**
- Lista de pedidos para entrega del día con dirección, cliente e ítems
- Marcado de pedidos como entregados
- Confirmación de pago recibido en entrega (efectivo)
- Calendario de entregas para vista semanal/mensual
- Resumen de entregas por driver

### 3.07 Inventarios, Recetas e Ingredientes (EN DESARROLLO)
Módulo de costeo y control de insumos.

**Capacidades:**
- Registro de ingredientes con precio unitario y unidad de medida
- Creación de recetas vinculadas a cada producto
- Cálculo automático del costo de producción por receta
- Instrucciones de preparación paso a paso
- Clasificación de ingredientes por categoría y temperatura de almacenamiento
- Descuento automático de ingredientes al marcar un ítem como producido (en desarrollo)

### 3.08 Manejo de Caja (EN DESARROLLO)
Módulo para el control de flujo de dinero diario.

**Capacidades:**
- Registro de ingresos y egresos del negocio (pagos de clientes, compras a proveedores, gastos operativos)
- Cierre de caja al final del día y del mes
- Visibilidad en tiempo real del dinero disponible en caja
- Eliminación de dependencia de hojas de cálculo externas para el control de efectivo

### 3.09 Chatbot con IA para toma de pedidos (EN DESARROLLO)
Asistente conversacional integrado con WhatsApp para recepción automática de pedidos.

**Capacidades:**
- Recepción e interpretación de pedidos escritos en lenguaje natural por WhatsApp
- Confirmación de detalles del pedido con el cliente antes de registrarlo
- Creación automática del pedido en la plataforma sin intervención del staff
- Reducción de errores de transcripción y tiempo de respuesta al cliente


### 3.10 Suscripción y facturación de la plataforma (EN DESARROLLO)
Sistema de monetización de MAD.

**Capacidades:**
- Modelo de suscripción mensual por panadería
- Integración con PayU para cobros automáticos
- Almacenamiento seguro de tarjetas (tokenización)
- Estados: prueba (trial), activo, suspendido, cancelado
- Periodo de gracia ante fallas de pago antes de suspensión
- Panel del administrador del sistema para gestionar todas las suscripciones

---

## 4. Roles de usuario y permisos

El sistema maneja 7 roles con accesos diferenciados. Cada usuario pertenece a una panadería específica y solo puede ver la información de su propio negocio.

**Administrador del sistema (`system_admin`):** Es el rol de MAD como plataforma. Tiene visibilidad sobre todas las panaderías registradas, gestiona suscripciones, configura ajustes globales y puede hacer onboarding de nuevos clientes. No opera dentro de una panadería específica — opera la plataforma en sí.

**Administrador de panadería (`bakery_admin`):** Acceso completo a su panadería. Crea y edita pedidos, gestiona el catálogo de productos, administra usuarios y clientes, consulta todos los reportes y configura el sistema. Es el rol principal del dueño o gerente del negocio.

**Staff (`bakery_staff`):** Tiene las mismas capacidades operativas que el administrador. La diferencia no está en el sistema sino en la responsabilidad organizacional — es el rol del equipo de trabajo del día a día.

**Asistente contable (`accounting_assistant`):** Accede únicamente al dashboard de contabilidad. Puede consultar reportes de ventas, estado de resultados y fechas de cobro, pero no puede crear ni modificar pedidos ni productos. Ideal para un contador externo o un área de finanzas que necesita visibilidad financiera sin acceso operativo.

**Asistente de producción (`production_assistant`):** Ve únicamente el dashboard de producción. Puede consultar los ítems pendientes de preparar y marcarlos como producidos, tanto en vista individual como agrupada. No tiene acceso a pedidos completos ni a información financiera.

**Asistente de entregas (`delivery_assistant`):** Ve únicamente los pedidos asignados para entrega. Puede marcar pedidos como entregados y confirmar pagos recibidos en efectivo. Es el rol del equipo de reparto o domiciliarios.

**Cliente (`bakery_customer`):** No accede al sistema. Existe como registro en la base de datos para asociar pedidos a personas o empresas, guardar su historial de compras y sus datos de contacto.

---


## 6. Procesos aún manuales (fuera del sistema)

Manejo de caja (registro de ingresos y egreros como pago a proveedores o compras), inventarios: cantidades, stock, compras. Recepcion de pedidos y estrategias de comunicaion/marketing (por ejemplo, mi hermano usa MAD y B2Chat)

---

## 7. Arquitectura técnica

### Visión general

El frontend es una aplicación web construida en Vue.js que corre directamente en el navegador del usuario. Gestiona la navegación entre pantallas según el rol de quien esté logueado, mantiene el estado de la aplicación en memoria y se comunica con el backend a través de llamadas HTTP. La autenticación la maneja Firebase directamente desde el cliente, lo que significa que el login y la gestión de sesión no pasan por los servidores propios del sistema.

El backend es una API REST construida en Express.js, desplegada como funciones serverless en Google Cloud (Firebase Functions). Recibe las solicitudes del frontend, aplica las reglas de negocio, valida permisos y lee o escribe en Firestore, que es la base de datos. Para los pagos y la gestión de suscripciones, el backend se conecta con PayU, que procesa las transacciones con tarjeta y maneja los cobros recurrentes.

### Patrones clave de la arquitectura

**Multi-tenancy nativo**
Cada panadería es un tenant aislado. Toda la información vive bajo su propio espacio en la base de datos:
```
/bakeries/{bakeryId}/orders
/bakeries/{bakeryId}/products
/bakeries/{bakeryId}/users
/bakeries/{bakeryId}/settings/default
```
El sistema verifica en cada request que el usuario pertenece a la panadería que está consultando. El `system_admin` es el único rol con visibilidad transversal.


**Sincronización en tiempo real**
Los pedidos se sincronizan en tiempo real usando Firestore subscriptions. Cuando un driver marca un pedido como entregado, el admin lo ve actualizado automáticamente sin necesidad de refrescar la página.


---

## 8. Stack tecnológico

### Frontend (aplicación web)
| Tecnología | Uso |
|-----------|-----|
| **Vue 3** | Framework principal (Composition API) |
| **Pinia** | Estado global de la aplicación |
| **Vue Router** | Navegación con guards por rol |
| **TailwindCSS** | Estilos utilitarios |
| **Firebase Auth SDK** | Autenticación del usuario en el cliente |
| **Axios** | Comunicación con la API |
| **Headless UI** | Componentes de UI accesibles (modales, dropdowns) |
| **Phosphor Icons** | Iconografía |
| **ExcelJS** | Exportación de datos a Excel |
| **Vite** | Bundler y servidor de desarrollo |

### Backend (API y lógica de negocio)
| Tecnología | Uso |
|-----------|-----|
| **Node.js 20** | Runtime del servidor |
| **Express.js** | Framework HTTP |
| **Firebase Functions v2** | Deploy serverless en la nube (us-central1) |
| **Firebase Admin SDK** | Acceso a Firestore y Firebase Auth desde el servidor |
| **PayU API** | Procesamiento de pagos y suscripciones |
| **Jest + Supertest** | Pruebas unitarias e integración |

### Infraestructura
| Servicio | Uso |
|---------|-----|
| **Firebase Hosting** | Alojamiento del frontend |
| **Firebase Functions** | Backend serverless escalable |
| **Firestore** | Base de datos NoSQL en tiempo real |
| **Firebase Authentication** | Gestión de identidad y tokens JWT |
| **Google Cloud** | Infraestructura subyacente de Firebase |

---

## 9. Escalabilidad

### Fortalezas actuales

**Infraestructura serverless:** Firebase Functions escala automáticamente según la demanda. No requiere gestión de servidores ni aprovisionamiento manual de capacidad. Ante un pico de uso, el sistema responde sin intervención.

**Base de datos diseñada para escala:** Firestore es una base de datos distribuida de Google que escala horizontalmente. No hay un límite práctico en la cantidad de documentos o colecciones que puede manejar.

**Multi-tenancy sin fricción:** Agregar una nueva panadería al sistema no requiere ningún cambio de infraestructura. El aislamiento por `bakeryId` en todas las colecciones garantiza que cada cliente vive en su propio espacio sin interferir con otros.

**Código escalable por diseño:** El patrón factory en el backend permite agregar nuevos módulos (nuevas entidades de negocio) con mínimo código nuevo. La base de controladores y servicios ya maneja paginación, filtros, ordenamiento y auditoría automáticamente.

### Limitaciones actuales

- **Costo de Firestore a escala:** Firestore cobra por número de lecturas y escrituras. Con bajo volumen esto es despreciable, pero si el sistema crece significativamente en usuarios activos, los reportes y consultas frecuentes podrían encarecer la operación. La solución estándar es agregar una capa de caché para las consultas más pesadas.

- **Reportes calculados en tiempo real:** Hoy los reportes de ventas y rentabilidad se generan al momento de consultarlos, sin resultados pre-calculados. Con mucho volumen de datos esto puede volverse lento. La mitigación es calcularlos en background de forma periódica y servirlos desde un resultado guardado.

- **Sin sistema de colas:** No hay mecanismo para ejecutar tareas en segundo plano de forma confiable (envío de notificaciones, sincronización offline, emails). Esto limita la automatización. Se resuelve integrando un sistema de colas como Cloud Tasks.

- **Sincronización offline incompleta:** La creación de pedidos sin internet funciona, pero la reconciliación de esos datos al recuperar la conexión no está completamente implementada. Es un caso de uso de baja frecuencia hoy, pero relevante si el sistema se usa más en campo.

**En resumen:** la arquitectura es sólida para la etapa actual. Ninguna de estas limitaciones es un bloqueante — son inversiones técnicas que se hacen conforme el volumen lo justifique.

---

## 10. Alcance actual

MAD no es un MVP. Es un producto que ya funciona en producción y que cubre el ciclo operativo completo de una panadería: desde que entra un pedido hasta que se cobra, se produce y se entrega. Eso en sí mismo es un logro importante, porque la mayoría de las herramientas similares resuelven una parte del problema — las ventas, o la producción, o los reportes — pero no el todo conectado.

Lo que hace que MAD esté por encima de un MVP es la profundidad con la que resuelve cada parte. No es solo "crear un pedido": es crear pedidos con variaciones complejas, pagos parciales, descuentos granulares, impuestos configurables, modo offline y trazabilidad de cada cambio. No es solo "ver reportes": es entender la rentabilidad real por producto, descontando los costos de producción. Ese nivel de detalle normalmente no llega en la primera versión de un producto.

Dicho esto, el producto todavía tiene puertas abiertas importantes: las notificaciones al cliente son manuales, el inventario no se descuenta automáticamente al producir, y no hay facturación electrónica. Eso no es un problema de diseño — es simplemente el espacio natural de crecimiento que le queda al producto. El núcleo está sólido. Lo que falta son las capas que convierten un sistema operativo funcional en una experiencia completamente automatizada.

---

## 11. Potencial a futuro

Lo más emocionante de MAD es que lo difícil ya está hecho. Construir la infraestructura multi-tenant, el modelo de datos para pedidos complejos, los roles diferenciados, el sistema de billing — eso es lo que toma años y es lo que cuesta hacer bien. Y ya está. Lo que viene ahora es crecer sobre una base sólida, no reescribir desde cero.

En el corto plazo, el salto más grande vendría de cerrar el ciclo de comunicación con el cliente. Hoy, cuando se crea un pedido, el cliente no recibe nada automáticamente — alguien del equipo le escribe por WhatsApp. Automatizar eso (confirmación de pedido, recordatorio de pago, aviso de despacho) no es solo una comodidad: es el tipo de detalle que convierte a un cliente ocasional en uno fiel, y que libera horas de trabajo manual cada semana. La base técnica para esto ya existe en el sistema.

En el mediano plazo, hay una oportunidad clara con la facturación electrónica. En Colombia, los clientes B2B cada vez exigen más la factura DIAN, y sin eso MAD pierde terreno con cuentas corporativas. Resolverlo abriría una puerta significativa hacia empresas más grandes. También está el tema de multi-sucursal: muchas panaderías que crecen abren un segundo local, y hoy MAD no lo soporta de forma nativa, aunque la arquitectura ya tiene la base para hacerlo con poco esfuerzo.

Pero la oportunidad más grande — y la más diferenciadora — está en el largo plazo. MAD tiene algo que muy pocas herramientas tienen: datos transaccionales reales de panaderías. Con el tiempo, eso permite hacer cosas que ninguna hoja de cálculo puede: proyectar demanda por temporada, detectar qué productos son más rentables, anticipar cuándo un cliente habitual va a hacer su próximo pedido. Eso es el tipo de inteligencia que convierte a MAD de una herramienta operativa en un activo estratégico para el negocio.

Y mirando más lejos todavía: la arquitectura soporta escalar a cientos de panaderías en distintos países sin cambiar nada de fondo. MAD no está construido para una panadería — está construido para un mercado.

---

