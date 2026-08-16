import { customAlphabet } from "nanoid";

// Excludes 0/O/1/I/L - characters that are easy to misread on a phone screen
// or when someone's calling the code out across a loud room.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const generateRoomCode = customAlphabet(ALPHABET, 5);
