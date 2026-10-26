import type { MessageKey } from './es';

// English copy. Must define every key in es.ts.
export const en: Record<MessageKey, string> = {
  'logV2.saved':              'I logged your {mealType} with these values:',
  'logV2.saved.fromHistory':  'Based on what you logged on {date}.',
  'logV2.confirm':            "Here's what I'll log. Shall I save it, or do you want to change something?",
  'logV2.confirmChanges':     'Save these changes?',
  'logV2.question':           "I'm not sure what «{dish}» contains. What are its ingredients?",
  'logV2.cancelled':          "OK, I won't log it.",
  'logV2.keptUnchanged':      "OK, I'll leave it as it was.",
  'logV2.error':              "I couldn't analyse that meal. Could you try again?",
  'logV2.estimatedAlert':     'Quantities are estimates.',

  'logV2.table.dish':         'Dish',
  'logV2.table.ingredient':   'Ingredient',
  'logV2.table.amount':       'Amount',
  'logV2.table.estimated':    'Estimated',
  'logV2.table.stated':       'Stated',
  'logV2.table.yours':        'Yours',
  'logV2.table.fromHistory':  'Based on an earlier meal',

  'logV2.actions.save':        'Save',
  'logV2.actions.saveChanges': 'Save changes',
  'logV2.actions.cancel':      'Cancel',
  'logV2.actions.edit':        'Edit',
  'logV2.actions.remove':      'Remove',
  'logV2.actions.addIngredient': 'Add ingredient',

  'mealType.breakfast': 'breakfast',
  'mealType.lunch':     'lunch',
  'mealType.dinner':    'dinner',
  'mealType.snack':     'snack',

  'preferences.nav':               'Preferences',
  'preferences.title':             'Preferences',
  'preferences.logPipeline.title': 'Chat meal logging',
  'preferences.logPipeline.v1':        'Classic (v1)',
  'preferences.logPipeline.v1.desc':   'Logs the meal in one step, as before.',
  'preferences.logPipeline.v2':        'By ingredient (v2)',
  'preferences.logPipeline.v2.desc':   'Breaks each dish into ingredients and estimated amounts, and asks you to confirm when it is not sure.',
  'preferences.logPipeline.shadow':      'v2 + shadow v1',
  'preferences.logPipeline.shadow.desc': 'Developer tool: v2 answers and v1 runs in the background without saving anything, for comparison. Costs more.',
  'preferences.saved':  'Preference saved.',
  'preferences.error':  'Could not save the preference.',
};
