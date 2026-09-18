export const SWAPPABLE = ['.kt', '.swift', '.cpp', '.cc', '.cxx'];

/** A header compiles into nothing on its own; what includes it is swapped instead. */
export const HEADERS = ['.h', '.hpp', '.hh', '.hxx'];

export const NATIVE_SOURCES = ['.cpp', '.cc', '.cxx'];

export const TRANSLATION_UNITS = ['.cpp', '.cc', '.cxx', '.mm'];

/** How far an include graph is followed before it is treated as a cycle. */
export const INCLUDE_DEPTH = 16;
