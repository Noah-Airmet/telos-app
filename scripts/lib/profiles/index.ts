import type { Profile } from "../types.js";
import { ldsBomProfile } from "./lds-bom.js";
import { kjvProfile } from "./kjv.js";
import { nrsvueProfile } from "./nrsvue.js";
import { hardyBomProfile } from "./hardy-bom.js";
import { turleyDcProfile } from "./turley-dc.js";
import { ldsPogpProfile } from "./lds-pogp.js";
import { jsbProfile } from "./jsb.js";
import { oxfordStudyBibleProfile } from "./oxford-study-bible.js";

export const profiles: Record<string, Profile> = {
  "lds-bom": ldsBomProfile,
  "kjv": kjvProfile,
  "nrsvue": nrsvueProfile,
  "hardy-bom": hardyBomProfile,
  "turley-dc": turleyDcProfile,
  "lds-pogp": ldsPogpProfile,
  "jsb": jsbProfile,
  "oxford-study-bible": oxfordStudyBibleProfile,
};

export function listProfiles(): string[] {
  return Object.keys(profiles);
}
