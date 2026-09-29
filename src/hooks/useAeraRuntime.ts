import { useMemo } from "react";
import { AeraRuntime } from "../core/runtime";
import { abletonSkill } from "../skills/ableton";
import { flStudioSkill } from "../skills/flstudio";
import { logicSkill } from "../skills/logic";
import { proToolsSkill } from "../skills/protools";
import { reaperSkill } from "../skills/reaper";
import { wavrSkill } from "../skills/wavr";

export function useAeraRuntime() {
  return useMemo(() => {
    const runtime = new AeraRuntime();
    runtime.skills.register(reaperSkill);
    runtime.skills.register(flStudioSkill);
    runtime.skills.register(proToolsSkill);
    runtime.skills.register(logicSkill);
    runtime.skills.register(abletonSkill);
    runtime.skills.register(wavrSkill);
    return runtime;
  }, []);
}
