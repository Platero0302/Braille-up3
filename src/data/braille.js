export const BRAILLE = {
  A: [1], B: [1, 2], C: [1, 4], D: [1, 4, 5], E: [1, 5],
  F: [1, 2, 4], G: [1, 2, 4, 5], H: [1, 2, 5], I: [2, 4], J: [2, 4, 5],
  K: [1, 3], L: [1, 2, 3], M: [1, 3, 4], N: [1, 3, 4, 5], O: [1, 3, 5],
  P: [1, 2, 3, 4], Q: [1, 2, 3, 4, 5], R: [1, 2, 3, 5], S: [2, 3, 4], T: [2, 3, 4, 5],
  U: [1, 3, 6], V: [1, 2, 3, 6], W: [2, 4, 5, 6], X: [1, 3, 4, 6], Y: [1, 3, 4, 5, 6], Z: [1, 3, 5, 6]
};

export const WORDS = [
  "CASA", "BOLA", "GATO", "LUA", "SOL", "MALA", "PATO", "DADO", "SAPO", "VIDA"
];

export const PHRASES = [
  "EU AMO LER",
  "O GATO PULA",
  "HOJE TEM SOL",
  "A BOLA E AZUL",
  "EU VOU A ESCOLA"
];

export function dotsForLetter(letter) {
  return BRAILLE[String(letter || "").toUpperCase()] || [];
}
