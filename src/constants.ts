export const GATE_SIZE = 128;
export const PIN_SIZE = 28;
export const PIN_HIT_SIZE = 44;
export const EDGE_ZONE_PX = 48;
export const DRAG_THRESHOLD_PX = 8;
export const MIN_CONNECTION_DELAY_MS = 120;
export const MAX_CONNECTION_DELAY_MS = 900;
export const OFF_CANVAS_CONNECTION_DELAY_MS = 50;

/** LCD display geometry and configuration bounds. */
export const DISPLAY_WIDTH = 236;
export const DISPLAY_MIN_HEIGHT = 148;
/** Vertical distance between pins in a display column. */
export const DISPLAY_PIN_GAP = 34;
/** Extra width for each additional display pin column, including its label. */
export const DISPLAY_PIN_COLUMN_GAP = 54;
/** Padding around the display's pin grid. */
export const DISPLAY_PIN_MARGIN = 18;
/** Gap between the display's pin grid and the screen. */
export const DISPLAY_SCREEN_GAP = 16;
export const DISPLAY_MIN_BITS = 1;
export const DISPLAY_MAX_BITS = 40;
export const DISPLAY_MAX_PIN_ROWS = 6;
export const DISPLAY_MIN_DIGITS = 1;
export const DISPLAY_MAX_DIGITS = 12;

/** Custom chip pin layout: chips grow so adjacent pins never overlap. */
export const CHIP_PIN_GAP = 38;
export const CHIP_PIN_MARGIN = 24;
