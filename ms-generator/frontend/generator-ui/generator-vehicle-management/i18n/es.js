export default {
  navigation: {
    'settings': 'Configuraciones',
    'generator-vehicle-management': 'Vehicles',
    'generator-vehicle-generation': 'Generador de Vehículos',
  },
  vehicles: {
    vehicles: 'Vehicles',
    search: 'Búsqueda rápida por nombre',
    add_new_vehicle: 'Agregar Nueva',
    add_new_vehicle_short: 'Agregar',
    rows_per_page: 'Filas por página:',
    of: 'de',
    remove: 'Eliminar',
    table_colums: {
      name: 'Nombre',
      active: 'Activo'
    },
    remove_dialog_title: "¿Desea eliminar las vehicles seleccionadas?",
    remove_dialog_description: "Esta acción no se puede deshacer",
    remove_dialog_no: "No",
    remove_dialog_yes: "Si",
    filters: {
      title: "Filtros",
      active: "Activo"
    }
  },
  vehicle: {
    vehicles: 'Vehicles',
    vehicle_detail: 'Detalle de la Vehicle',
    save: 'GUARDAR',
    basic_info: 'Información Básica',
    name: 'Nombre',
    description: 'Descripción',
    active: 'Activo',
    metadata_tab: 'Metadatos',
    metadata: {
      createdBy: 'Creado por',
      createdAt: 'Creado el',
      updatedBy: 'Modificado por',
      updatedAt: 'Modificado el',
    },
    not_found: 'Lo sentimos pero no pudimos encontrar la entidad que busca',
    internal_server_error: 'Error Interno del Servidor',
    update_success: 'Vehicle ha sido actualizado',
    create_success: 'Vehicle ha sido creado',
    form_validations: {
      name: {
        length: "El nombre debe tener al menos {len} caracteres",
        required: "El nombre es requerido",
      }
    },
  },
  vehicleGeneration: {
    title: 'Generador de Flota Vehicular',
    startSimulation: 'Iniciar Simulación',
    stopSimulation: 'Detener Simulación',
    running: 'Corriendo...',
    stopped: 'Detenido',
    vehiclesGenerated: 'Vehículos Generados',
    realTimeVehicles: 'Vehículos Generados en Tiempo Real',
    generatingVehicles: 'Generando vehículos...',
    startSimulationPrompt: 'Presiona "Iniciar Simulación" para comenzar',
    tableHeaders: {
      year: 'Año',
      type: 'Tipo',
      horsepower: 'Potencia (HP)',
      topSpeed: 'Vel. Máxima (km/h)',
      powerSource: 'Fuente de Energía',
      aid: 'AID'
    }
  }
};