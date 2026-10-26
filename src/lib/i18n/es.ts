// Spanish copy. Keys are shared with en.ts; add new keys here first.
export const es = {
  // ── Meal logging v2 (chat replies and draft table) ─────────────────────
  'logV2.saved':              'He registrado tu {mealType} con estos valores:',
  'logV2.saved.fromHistory':  'Lo he basado en lo que registraste el {date}.',
  'logV2.confirm':            'Esto es lo que voy a registrar. ¿Lo guardo o quieres cambiar algo?',
  'logV2.confirmChanges':     '¿Guardo estos cambios?',
  'logV2.question':           'No conozco bien «{dish}». ¿Qué ingredientes lleva?',
  'logV2.cancelled':          'Vale, no lo registro.',
  'logV2.keptUnchanged':      'Vale, lo dejo como estaba.',
  'logV2.alreadySaved':       'Ya lo tenía guardado así; no he cambiado nada.',
  'logV2.error':              'No he podido analizar la comida. ¿Lo intentas de nuevo?',
  'logV2.estimatedAlert':     'Cantidades estimadas.',

  'logV2.table.dish':         'Plato',
  'logV2.table.ingredient':   'Ingrediente',
  'logV2.table.amount':       'Cantidad',
  'logV2.table.estimated':    'Estimado',
  'logV2.table.stated':       'Indicado',
  'logV2.table.yours':        'Tuyo',
  'logV2.table.fromHistory':  'Según una comida anterior',

  'logV2.actions.save':        'Guardar',
  'logV2.actions.saveChanges': 'Guardar cambios',
  'logV2.actions.cancel':      'Cancelar',
  'logV2.actions.edit':        'Editar',
  'logV2.actions.remove':      'Quitar',
  'logV2.actions.addIngredient': 'Añadir ingrediente',

  'mealType.breakfast': 'desayuno',
  'mealType.lunch':     'almuerzo',
  'mealType.dinner':    'cena',
  'mealType.snack':     'merienda',

  // ── Preferences page ───────────────────────────────────────────────────
  'preferences.nav':               'Preferencias',
  'preferences.title':             'Preferencias',
  'preferences.logPipeline.title': 'Registro de comidas por chat',
  'preferences.logPipeline.v1':        'Clásico (v1)',
  'preferences.logPipeline.v1.desc':   'Registra la comida en un paso, como hasta ahora.',
  'preferences.logPipeline.v2':        'Por ingredientes (v2)',
  'preferences.logPipeline.v2.desc':   'Desglosa cada plato en ingredientes y cantidades estimadas, y te pide confirmación cuando no está seguro.',
  'preferences.logPipeline.shadow':      'v2 + sombra v1',
  'preferences.logPipeline.shadow.desc': 'Herramienta de desarrollo: v2 responde y v1 se ejecuta en segundo plano sin guardar nada, para comparar. Cuesta más.',
  'preferences.saved':  'Preferencia guardada.',
  'preferences.error':  'No se ha podido guardar la preferencia.',
} as const;

export type MessageKey = keyof typeof es;
