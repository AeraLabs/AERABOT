#!/usr/bin/env python3
"""AERA Pro Tools Scripting SDK wrapper.

This wrapper owns AERA's local bridge protocol but deliberately does not
redistribute Avid SDK-generated sources. It delegates to a local helper
executable built against the official Pro Tools Scripting SDK.

Helper contract:
  helper snapshot
    -> JSON: {"projectName":..., "transport":..., "selectedTrack":...,
              "capabilities":[...]}
  helper command <capability> <json-input>
    -> JSON: {"ok":true, "result":{...}} or {"ok":false, "error":"..."}
"""
import argparse, json, os, subprocess, time
from pathlib import Path

ROOT=Path.home()/".aera"/"bridges"/"protools"
COMMANDS=ROOT/"commands"
ACKS=ROOT/"acks"
STATE=ROOT/"state.json"
CAPS={
 "transport.play","transport.stop","transport.record.toggle",
 "track.mute.set","track.solo.set","track.arm.set","track.volume.set","track.pan.set",
}

def atomic_json(path,payload):
 path.parent.mkdir(parents=True,exist_ok=True)
 tmp=path.with_suffix(".tmp")
 tmp.write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
 os.replace(tmp,path)

def parse_args():
 p=argparse.ArgumentParser(description="Run AERA's Pro Tools SDK wrapper.")
 p.add_argument("--helper",required=True)
 p.add_argument("--poll-seconds",type=float,default=0.35)
 p.add_argument("--helper-timeout",type=float,default=2.0)
 return p.parse_args()

def run_helper(helper,timeout,*arguments):
 done=subprocess.run([helper,*arguments],capture_output=True,text=True,timeout=timeout,check=False)
 if done.returncode!=0:
  raise RuntimeError(done.stderr.strip() or f"helper exited with {done.returncode}")
 try:return json.loads(done.stdout)
 except json.JSONDecodeError as error: raise RuntimeError("helper returned invalid JSON") from error

def normalize_snapshot(payload):
 capabilities=[x for x in payload.get("capabilities",[]) if x in CAPS]
 transport=payload.get("transport") or {}
 selected=payload.get("selectedTrack")
 if selected is not None:
  selected={
   "id":str(selected.get("id","selected")),
   "index":int(selected.get("index",0)),
   "name":str(selected.get("name","Selected Track")),
   "muted":bool(selected.get("muted",False)),
   "soloed":bool(selected.get("soloed",False)),
   "armed":bool(selected.get("armed",False)),
   "volume":float(selected.get("volume",0.0)),
   "pan":float(selected.get("pan",0.0)),
   "fx":[str(x) for x in selected.get("fx",[])],
  }
 return {
  "schemaVersion":1,"dawId":"protools","bridgeVersion":"0.2.0",
  "projectName":payload.get("projectName"),
  "transport":{
   "playing":bool(transport.get("playing",False)),
   "recording":bool(transport.get("recording",False)),
   "positionSeconds":transport.get("positionSeconds"),
   "positionBeats":transport.get("positionBeats"),
   "bpm":transport.get("bpm"),
  },
  "selectedTrack":selected,"capabilities":capabilities,
 }

def handle(path,helper,timeout):
 cid=path.stem; capability=""
 try:
  env=json.loads(path.read_text(encoding="utf-8"))
  cid=str(env["id"]); capability=str(env["capability"]); payload=env.get("input") or {}
  if env.get("schemaVersion")!=1: raise ValueError("unsupported schema")
  if payload.get("appId")!="protools": raise ValueError("invalid Pro Tools target")
  if capability not in CAPS: raise ValueError("unsupported Pro Tools capability")
  response=run_helper(helper,timeout,"command",capability,json.dumps(payload,separators=(",",":")))
  ok=response.get("ok") is True
  atomic_json(ACKS/f"{cid}.json",{
   "id":cid,"ok":ok,"capability":capability,
   "result":response.get("result"),
   "error":None if ok else str(response.get("error") or "Pro Tools command failed."),
  })
 except Exception as error:
  atomic_json(ACKS/f"{cid}.json",{"id":cid,"ok":False,"capability":capability,"result":None,"error":str(error)})
 finally:
  try:path.unlink()
  except FileNotFoundError:pass

def main():
 cfg=parse_args()
 helper=str(Path(cfg.helper).expanduser().resolve())
 if not Path(helper).is_file(): raise SystemExit("Configured Pro Tools SDK helper does not exist.")
 ROOT.mkdir(parents=True,exist_ok=True); COMMANDS.mkdir(exist_ok=True); ACKS.mkdir(exist_ok=True)
 last=0.0
 while True:
  now=time.monotonic()
  if now-last>=cfg.poll_seconds:
   try: atomic_json(STATE,normalize_snapshot(run_helper(helper,cfg.helper_timeout,"snapshot")))
   except Exception as error: print("Pro Tools snapshot error:",error)
   last=now
  for path in sorted(COMMANDS.glob("*.json"))[:8]: handle(path,helper,cfg.helper_timeout)
  time.sleep(0.03)

if __name__=="__main__":
 try:main()
 except KeyboardInterrupt:pass
