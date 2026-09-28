#!/usr/bin/env python3
"""AERA Logic Pro local OSC companion.

Logic Pro supports OSC controller assignments over UDP/IPv4. This companion
translates AERA's validated local file-bridge commands into loopback OSC
messages and only acknowledges commands after matching Logic feedback is
observed.

No cloud service or third-party Python package is used.
"""
import argparse, json, os, socket, struct, time
from pathlib import Path

SCHEMA_VERSION=1
ROOT=Path.home()/".aera"/"bridges"/"logic"
COMMANDS=ROOT/"commands"
ACKS=ROOT/"acks"
STATE=ROOT/"state.json"
CAPS=[
 "transport.play","transport.stop","transport.record.toggle",
 "track.mute.set","track.solo.set","track.arm.set","track.volume.set","track.pan.set",
]
PATHS={
 "transport.play":"/aera/transport/play",
 "transport.stop":"/aera/transport/stop",
 "transport.record.toggle":"/aera/transport/record",
 "track.mute.set":"/aera/track/mute",
 "track.solo.set":"/aera/track/solo",
 "track.arm.set":"/aera/track/arm",
 "track.volume.set":"/aera/track/volume",
 "track.pan.set":"/aera/track/pan",
}

def atomic_json(path,payload):
 path.parent.mkdir(parents=True,exist_ok=True)
 tmp=path.with_suffix(".tmp")
 tmp.write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
 os.replace(tmp,path)

def pstr(value):
 raw=value.encode()+b"\0"
 return raw+b"\0"*((4-len(raw)%4)%4)

def encode(address,value=1.0):
 if isinstance(value,str): return pstr(address)+pstr(",s")+pstr(value)
 if isinstance(value,int) and not isinstance(value,bool):
  return pstr(address)+pstr(",i")+struct.pack(">i",value)
 return pstr(address)+pstr(",f")+struct.pack(">f",float(value))

def rstr(packet,offset):
 end=packet.find(b"\0",offset)
 if end<0: raise ValueError("unterminated OSC string")
 value=packet[offset:end].decode("utf-8",errors="replace")
 return value,(end+4)&~3

def decode(packet):
 address,offset=rstr(packet,0)
 tags,offset=rstr(packet,offset)
 values=[]
 for tag in tags[1:]:
  if tag=="f":
   values.append(struct.unpack(">f",packet[offset:offset+4])[0]); offset+=4
  elif tag=="i":
   values.append(struct.unpack(">i",packet[offset:offset+4])[0]); offset+=4
  elif tag=="s":
   value,offset=rstr(packet,offset); values.append(value)
  else: raise ValueError("unsupported OSC type "+tag)
 return address,values

def parse_args():
 p=argparse.ArgumentParser(description="Run AERA's Logic Pro OSC companion.")
 p.add_argument("--logic-port",type=int,default=9000)
 p.add_argument("--listen-port",type=int,default=9001)
 p.add_argument("--ack-timeout",type=float,default=1.6)
 p.add_argument("--capabilities",default=",".join(CAPS))
 return p.parse_args()

def state_for(capabilities):
 return {
  "schemaVersion":1,"dawId":"logic","bridgeVersion":"0.2.0","projectName":None,
  "transport":{"playing":False,"recording":False,"positionSeconds":None,"positionBeats":None,"bpm":None},
  "selectedTrack":None,"capabilities":capabilities,
 }

def track(state):
 if state["selectedTrack"] is None:
  state["selectedTrack"]={"id":"selected","index":0,"name":"Selected Track","muted":False,"soloed":False,"armed":False,"volume":0.0,"pan":0.0,"fx":[]}
 return state["selectedTrack"]

def bval(value):
 if isinstance(value,str): return value.lower() in ("1","true","on","yes")
 return float(value)>=0.5

def feedback(state,address,values):
 if not values:return False
 value=values[0]
 if address=="/aera/state/transport/play": state["transport"]["playing"]=bval(value)
 elif address=="/aera/state/transport/record": state["transport"]["recording"]=bval(value)
 elif address=="/aera/state/transport/position": state["transport"]["positionSeconds"]=float(value)
 elif address=="/aera/state/bpm": state["transport"]["bpm"]=float(value)
 elif address=="/aera/state/project/name": state["projectName"]=str(value)
 elif address.startswith("/aera/state/track/"):
  t=track(state); field=address.rsplit("/",1)[-1]
  if field=="index": t["index"]=int(value)
  elif field=="name": t["name"]=str(value)
  elif field=="mute": t["muted"]=bval(value)
  elif field=="solo": t["soloed"]=bval(value)
  elif field=="arm": t["armed"]=bval(value)
  elif field=="volume": t["volume"]=float(value)
  elif field=="pan": t["pan"]=float(value)
  elif field=="fx": t["fx"]=[x.strip() for x in str(value).split(",") if x.strip()]
  else:return False
 else:return False
 return True

def pump(sock,state):
 changed=False
 for _ in range(32):
  try: packet,_=sock.recvfrom(65535)
  except BlockingIOError: break
  try:
   address,values=decode(packet); changed=feedback(state,address,values) or changed
  except Exception as error: print("Ignored malformed Logic feedback:",error)
 return changed

def command_value(capability,payload):
 if capability.startswith("transport."): return 1.0
 value=payload.get("value")
 if isinstance(value,bool): return 1.0 if value else 0.0
 if isinstance(value,(int,float)): return float(value)
 raise ValueError("missing command value")

def verified(capability,payload,before,state):
 t=state.get("selectedTrack")
 if capability=="transport.play": return state["transport"]["playing"] is True
 if capability=="transport.stop": return state["transport"]["playing"] is False
 if capability=="transport.record.toggle": return state["transport"]["recording"]!=before["transport"]["recording"]
 if not t:return False
 expected=payload.get("value")
 if capability=="track.mute.set": return t["muted"] is bool(expected)
 if capability=="track.solo.set": return t["soloed"] is bool(expected)
 if capability=="track.arm.set": return t["armed"] is bool(expected)
 if capability=="track.volume.set": return abs(t["volume"]-float(expected))<=0.015
 if capability=="track.pan.set": return abs(t["pan"]-float(expected))<=0.015
 return False

def handle(path,tx,rx,state,target,timeout):
 cid=path.stem; capability=""
 try:
  env=json.loads(path.read_text(encoding="utf-8"))
  cid=str(env["id"]); capability=str(env["capability"]); payload=env.get("input") or {}
  if env.get("schemaVersion")!=1: raise ValueError("unsupported schema")
  if payload.get("appId")!="logic": raise ValueError("invalid Logic target")
  if capability not in state["capabilities"] or capability not in PATHS: raise ValueError("capability not enabled")
  before=json.loads(json.dumps(state))
  tx.sendto(encode(PATHS[capability],command_value(capability,payload)),target)
  deadline=time.monotonic()+timeout; ok=False
  while time.monotonic()<deadline:
   if pump(rx,state): atomic_json(STATE,state)
   if verified(capability,payload,before,state): ok=True; break
   time.sleep(0.015)
  atomic_json(ACKS/f"{cid}.json",{"id":cid,"ok":ok,"capability":capability,"result":state if ok else None,"error":None if ok else "Logic did not return matching OSC feedback before timeout."})
 except Exception as error:
  atomic_json(ACKS/f"{cid}.json",{"id":cid,"ok":False,"capability":capability,"result":None,"error":str(error)})
 finally:
  try:path.unlink()
  except FileNotFoundError:pass

def main():
 cfg=parse_args()
 capabilities=[x.strip() for x in cfg.capabilities.split(",") if x.strip() in CAPS]
 if not capabilities: raise SystemExit("No supported Logic capabilities enabled.")
 ROOT.mkdir(parents=True,exist_ok=True); COMMANDS.mkdir(exist_ok=True); ACKS.mkdir(exist_ok=True)
 rx=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); rx.bind(("127.0.0.1",cfg.listen_port)); rx.setblocking(False)
 tx=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); target=("127.0.0.1",cfg.logic_port)
 state=state_for(capabilities); last=0.0
 print(f"AERA Logic companion: receive 127.0.0.1:{cfg.listen_port}, send 127.0.0.1:{cfg.logic_port}")
 while True:
  changed=pump(rx,state)
  for path in sorted(COMMANDS.glob("*.json"))[:8]:
   handle(path,tx,rx,state,target,cfg.ack_timeout); changed=True
  now=time.monotonic()
  if changed or now-last>=0.75: atomic_json(STATE,state); last=now
  time.sleep(0.025)

if __name__=="__main__":
 try: main()
 except KeyboardInterrupt: pass
