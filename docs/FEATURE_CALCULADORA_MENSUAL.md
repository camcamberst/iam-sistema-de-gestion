# Documentación de Funcionalidad: Calculadora de Plataformas Mensuales

## Descripción General
Se implementó una funcionalidad para manejar plataformas que realizan pagos mensuales (en lugar de quincenales), permitiendo a las modelos registrar el **Total Mensual** acumulado en el segundo periodo (P2), mientras el sistema deduce automáticamente lo ya reportado en el primer periodo (P1).

## Flujo de Trabajo

### 1. Activación Dinámica
No se requiere configuración previa en base de datos. La funcionalidad se activa dinámicamente durante el uso de la calculadora:
- **Modo Normal (Quincenal):** Comportamiento por defecto. El valor ingresado se guarda tal cual como la ganancia del periodo.
- **Modo Mensual:** Se activa automáticamente cuando el usuario ingresa un valor mayor a 0 para **P1**.

### 2. Ingreso de Valor P1 (Deducción)
1.  El usuario hace clic en el **nombre de la plataforma** (indicado con un icono de lápiz ✎ al pasar el mouse).
2.  Se abre un pequeño input flotante ("Ingresar valor de P1").
3.  El usuario ingresa el valor reportado/pagado en la primera quincena.
4.  Al confirmar, el sistema guarda este valor en memoria para el cálculo.

### 3. Cálculo Automático en P2
Una vez ingresado el P1:
- El input principal de la fila cambia visualmente (borde azul) y su título indica "Ingresa el TOTAL MENSUAL".
- El usuario ingresa el **monto total acumulado del mes**.
- **Lógica Interna:** El sistema calcula `Ganancia P2 = Total Mensual (Input) - P1`.
- **Visualización:**
    - El input mantiene el valor del "Total Mensual" visible para el usuario.
    - Debajo del input aparece un texto discreto: `- P1 (valor)`.
    - Las columnas de resultados (USD/COP) muestran el valor neto calculado para P2.

## Archivos Modificados

### `app/admin/model/calculator/page.tsx`
Vista que utiliza el administrador/monitor para ver y editar la calculadora de una modelo específica.
- **Estados Agregados:** `p1Values`, `monthlyTotals`, `editingP1Platform`.
- **Lógica de Renderizado:** Se modificó la celda de la tabla para incluir el botón en el nombre y el manejo condicional del input.

### `app/model/calculator/page.tsx`
Vista principal que utiliza la modelo ("Mi Calculadora").
- **Sincronización:** Se replicó la misma lógica y diseño que en la vista de administrador para garantizar consistencia.

## Detalles Técnicos
- **Persistencia P1:** Actualmente, el valor de P1 se maneja en el estado de la sesión y se carga desde la base de datos si existe un registro para el día 1 del mes. No se fuerza un guardado en segundo plano al momento de editar P1 (revertido por solicitud), por lo que se confía en el flujo de guardado general o en la carga de datos históricos.
- **Estética:** Se priorizó mantener las dimensiones de la tabla inalteradas. Se utiliza un solo input que cambia de función lógicamente pero mantiene su tamaño, evitando que la fila se expanda verticalmente.

## Historial de Cambios Recientes
- **Refactorización UI:** Eliminación de checkboxes explícitos para "Modo Mensual".
- **Simplificación:** Unificación de inputs en la columna de valores.
- **Corrección de Rutas:** Ajuste para asegurar que los cambios se aplicaran en la ruta correcta de administración (`admin/model`).

