import type { Profile } from "../types.js";
import { ldsBomProfile } from "./lds-bom.js";
import { kjvProfile } from "./kjv.js";
import { nrsvueProfile } from "./nrsvue.js";
import { hardyBomProfile } from "./hardy-bom.js";

export const profiles: Record<string, Profile> = {
  "lds-bom": ldsBomProfile,
  "kjv": kjvProfile,
  "nrsvue": nrsvueProfile,
  "hardy-bom": hardyBomProfile,
};

export function listProfiles(): string[] {
  return Object.keys(profiles);
}
