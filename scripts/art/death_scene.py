"""Render Death for the scene where he arrives (src/components/DeathArrives.tsx)
with BibleGame's figure engine: who he is (death_cast.py), what he wears
(death_dress.py) and how he moves (death_motion.py), lit cold from the
front and rimmed from behind (death_scene_lights.py). Any garment marked for
simulation is draped through the whole take by the engine's cloth solver
(his suit has none: it is cut to him and follows him).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        -P scripts/art/death_scene.py -- --out /tmp/death [--ppu 8] [--samples 64]
        [--only walk-00,scene-040]  [--closeup]  [--nosim]

Needs a BibleGame checkout (BIBLEGAME, default ~/Documents/BibleGame) with
MakeHuman's CC0 data fetched there (`npm run art:fetch-makehuman`). Nothing in
BibleGame changes.

Writes one PNG a frame into --out (`walk-00.png` … the looped stride,
`scene-000.png` … what follows it) and `take.json`: the frame size, where his
feet are in it, the frame rate, and how far he has travelled at each frame
(pixels). death_film.py packs them for the page.
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import death_cast  # noqa: E402  (who he is; puts BibleGame's art library on the path)

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix  # noqa: E402

import common  # noqa: E402
import view  # noqa: E402
import world_cloth  # noqa: E402
import world_person  # noqa: E402

import death_dress  # noqa: E402
from death_scene_lights import lights  # noqa: E402
import death_motion  # noqa: E402

world_cloth.FPS = death_motion.FPS
TILE = 32.0
# The frame, in the engine's units (32 to a metre): wide enough for the cane
# planted ahead of him and the coat swinging, his feet FOOT from the top.
FRAME_W, FRAME_H, FOOT = 40.0, 70.0, 66.0


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--ppu", type=float, default=8.0)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--only", default="")
    ap.add_argument("--closeup", action="store_true", help="also render his head and shoulders, large")
    ap.add_argument("--nosim", action="store_true", help="skip any cloth simulation (quick looks at the pose and the dress)")
    return ap.parse_args(argv)


def camera(scene, ppu, closeup=False, head_z=1.7):
    if closeup:
        cam = view.setup_figure_camera(scene, head_z * TILE, 640, 800, 640 / (0.42 * TILE), tilt_deg=death_motion.TILT)
        return cam
    return view.setup_figure_camera(scene, FOOT - FRAME_H / 2, int(FRAME_W * ppu), int(FRAME_H * ppu), ppu, tilt_deg=death_motion.TILT)


def set_frame(person, cane, f, sims, key):
    person.rig.root.location = (f["hips"], 0.0, 0.0)
    person.rig.set_pose(f["R"], f["root"])
    keys = person.body_obj.data.shape_keys.key_blocks
    keys["blink"].value = f["blink"]
    # His mouth shut (the engine's talking shapes off).
    keys["talk"].value = 0.0
    keys["talk2"].value = 0.0
    cane.matrix_basis = Matrix(f["cane"].tolist())
    for g in sims:
        v = g.shapes.get(("death", key))
        if v is not None:
            g.obj.data.vertices.foreach_set("co", v.ravel())
            g.obj.data.update()
    bpy.context.view_layer.update()


def label(rec):
    kind, k = rec
    return f"walk-{k:02d}" if kind == "walk" else f"scene-{k:03d}"


def main():
    a = args()
    os.makedirs(a.out, exist_ok=True)
    scene = common.reset(a.samples)
    person = world_person.Person(death_cast.APPEARANCE, name="death", pid="death")
    death_dress.hide_covered(person)
    mo = death_motion.Motion(person, death_dress.SOLE)
    cane = death_dress.cane(person, mo.L)
    print("DEATH height", round(person.H, 3), "cane", mo.L, "stride", round(mo.d, 3), flush=True)
    sims = [g for g in person.cloth.garments if g.sim]
    take = mo.take()
    print("TAKE", len(take), "frames", sum(1 for f in take if f["rec"]), "to render", flush=True)
    z = mo.z_hips
    C = death_motion.CYCLE
    walk = z[10 + C : 10 + 3 * C]
    print("HIPS standing", round(float(mo.Jp[2]), 3), "walking", round(float(walk.min()), 3), round(float(walk.max()), 3), "end", round(float(z[-1]), 3), flush=True)
    if a.nosim:
        for g in sims:
            g.obj.hide_render = True
    elif sims:
        wr = person.cloth
        timeline = [(i + 1, {"pose": (f["R"], f["root"])}, f["rec"]) for i, f in enumerate(take)]
        wr._timeline = lambda clip, states: timeline
        wr._posed = lambda spec: spec["pose"]
        wr._run("death", set(), sims)
    # He walks to screen right (the take's -Y turned to +X), and the frame
    # follows him: his hips stay at its middle; take.json says where he is.
    person.rig.root.rotation_euler = (0.0, 0.0, math.radians(90.0))
    lights(scene)
    only = set(a.only.split(",")) if a.only else None
    frames = []
    ppb = a.ppu * TILE
    for f in take:
        if f["rec"] is None:
            continue
        name = label(f["rec"])
        frames.append(dict(name=name, x=round(-f["hips"] * ppb, 2)))
        if only and name not in only and name.replace("-0", "").replace("-", "") not in only:
            continue
        set_frame(person, cane, f, sims, f["rec"])
        camera(scene, a.ppu)
        scene.render.filepath = os.path.join(a.out, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("FRAME", name, flush=True)
        if a.closeup:
            camera(scene, a.ppu, closeup=True, head_z=person.H - 0.16)
            scene.render.filepath = os.path.join(a.out, name + "-closeup.png")
            bpy.ops.render.render(write_still=True)
    json.dump(
        dict(
            fps=death_motion.FPS,
            cycle=death_motion.CYCLE,
            ppu=a.ppu,
            frameWidth=int(FRAME_W * a.ppu),
            frameHeight=int(FRAME_H * a.ppu),
            originX=FRAME_W * a.ppu / 2,
            originY=FOOT * a.ppu,
            crownY=round((FOOT - person.H * TILE) * a.ppu, 1),
            stride=round(mo.d * ppb, 2),
            # How far his arms stay outside his body at the closest (cm).
            armClearance=round(mo.arm_clearance(take) * 100, 1),
            cane=mo.L,
            frames=frames,
        ),
        open(os.path.join(a.out, "take.json"), "w"),
        indent=1,
    )


main()
