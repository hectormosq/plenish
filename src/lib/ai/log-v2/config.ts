// Tunable values for the v2 logging pipeline (spec §Confidence Levels & Thresholds).
// Thresholds are meant to be adjusted from ai_pipeline_runs data.

/** Dish score at or above this is high confidence. */
export const CONFIDENCE_HIGH = 0.85;
/** Dish score below this is low confidence. */
export const CONFIDENCE_LOW = 0.5;

export const MAX_DISHES = 10;
export const MAX_INGREDIENTS_PER_DISH = 40;

/** Used when the model returns a missing or non-positive quantity. */
export const DEFAULT_QUANTITY_G = 100;

/**
 * Shadow v1 runs (T049/T050) are not built yet. Until they are, the
 * 'v2_shadow_v1' preference is not offered and behaves as 'v2'.
 */
export const SHADOW_V1_ENABLED = false;
