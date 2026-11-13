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
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Vector  # noqa: E402
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
# planted ahead of him and, in the dance, his arms flung wide and the cane held
# out (two metres across) and thrown up over his head; his feet FOOT from the top.
FRAME_W, FRAME_H, FOOT = 72.0, 84.0, 80.0


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--ppu", type=float, default=8.0)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--only", default="")
    ap.add_argument("--closeup", action="store_true", help="also render his head and shoulders, large")
    ap.add_argument("--chest", action="store_true", help="also render his chest, large (to look for anything showing through the suit)")
    ap.add_argument("--blur", type=int, default=0, help="the most sub-frame poses averaged for a fast frame of the dance (0: no blur)")
    ap.add_argument("--shutter", type=float, default=0.3, help="the shutter, in frames")
    ap.add_argument("--blur-px", type=float, default=25.0, help="blur a dance frame when a limb moves this far (pixels) in a frame")
    ap.add_argument("--blur-samples", type=int, default=10, help="samples for each sub-frame pose (they are averaged)")
    ap.add_argument("--no-limits", action="store_true", help="do not fail on a joint outside its human range")
    ap.add_argument("--nosim", action="store_true", help="skip any cloth simulation (quick looks at the pose and the dress)")
    return ap.parse_args(argv)


def camera(scene, ppu, closeup=False, head_z=1.7, chest=False):
    if chest:
        return view.setup_figure_camera(scene, head_z * TILE, 720, 800, 720 / (0.6 * TILE), tilt_deg=death_motion.TILT)
    if closeup:
        cam = view.setup_figure_camera(scene, head_z * TILE, 640, 800, 640 / (0.42 * TILE), tilt_deg=death_motion.TILT)
        return cam
    return view.setup_figure_camera(scene, FOOT - FRAME_H / 2, int(FRAME_W * ppu), int(FRAME_H * ppu), ppu, tilt_deg=death_motion.TILT)


def set_frame(person, cane, hat, f, sims, key):
    person.rig.root.location = (f["hips"], 0.0, 0.0)
    person.rig.set_pose(f["R"], f["root"])
    keys = person.body_obj.data.shape_keys.key_blocks
    keys["blink"].value = f["blink"]
    # His mouth shut (the engine's talking shapes off).
    keys["talk"].value = f.get("talk", 0.0)
    keys["talk2"].value = f.get("talk2", 0.0)
    cane.matrix_basis = Matrix(f["cane"].tolist())
    hat.hide_render = f["hat"] is None
    if f["hat"] is not None:
        hat.matrix_basis = Matrix(np.asarray(f["hat"]).tolist())
    for g in sims:
        v = g.shapes.get(("death", key))
        if v is not None:
            g.obj.data.vertices.foreach_set("co", v.ravel())
            g.obj.data.update()
    bpy.context.view_layer.update()


def fast_frames(mo, take, ppb):
    """How fast his fastest limb moves in each frame of the dance (pixels a frame, 0 outside it):
    his feet, hands, the cane's tip and the hat when it is not on his head, measured from
    his pelvis. (His head is not counted: it is kept sharp.)"""
    bones = ("foot.L", "foot.R", "wrist.L", "wrist.R")
    ih = mo.idx["head"]
    rel = []
    for f in take:
        D = mo.fk(f["R"], f["root"])
        pel = (f["root"] @ np.append(mo.Jp, 1.0))[:3]
        pts = [mo.at(D, b, mo.heads[mo.idx[b]]) - pel for b in bones]
        pts.append(f["cane"][:3, 3] - pel)
        hc = mo.at(D, "head", 0.5 * (mo.heads[ih] + mo.tails[ih]))
        if f["hat"] is not None and np.linalg.norm(np.asarray(f["hat"])[:3, 3] - hc) > 0.22:
            pts.append(np.asarray(f["hat"])[:3, 3] - pel)
        else:
            pts.append(pts[-1])
        rel.append(np.array(pts))
    d0, d1 = mo.dance_frames
    speed = []
    for i, f in enumerate(take):
        rec = f["rec"]
        if rec is None or rec[0] != "scene" or not (d0 - 2 <= rec[1] <= d1 + 2):
            speed.append(0.0)
            continue
        j0, j1 = max(0, i - 1), min(len(take) - 1, i + 1)
        speed.append(float(max(np.linalg.norm(rel[i] - rel[j0], axis=1).max(), np.linalg.norm(rel[j1] - rel[i], axis=1).max())) * ppb)
    return speed


def label(rec):
    kind, k = rec
    return f"walk-{k:02d}" if kind == "walk" else f"scene-{k:03d}"


def main():
    a = args()
    os.makedirs(a.out, exist_ok=True)
    scene = common.reset(a.samples)
    person = world_person.Person(death_cast.APPEARANCE, name="death", pid="death")
    skin = death_dress.hide_covered(person)
    skin["nippleMoveMm"] = float(death_cast.NIPPLE_MOVE_MM)
    print("SKIN", skin, flush=True)
    if skin["chestSkinShowing"] or not (skin["neckSkinKept"] and skin["handsSkinKept"]):
        raise SystemExit("skin showing over the chest, or the neck/hands masked: %s" % skin)
    mo = death_motion.Motion(person, death_dress.SOLE)
    cane = death_dress.cane(person, mo.L)
    hat = death_dress.boater(person)
    print("DEATH height", round(person.H, 3), "cane", mo.L, "stride", round(mo.d, 3), flush=True)
    sims = [g for g in person.cloth.garments if g.sim]
    take = mo.take()
    print("TAKE", len(take), "frames", sum(1 for f in take if f["rec"]), "to render; dance is scene-%03d to scene-%03d" % mo.dance_frames, flush=True)
    for i, f in enumerate(take):
        bad = [k for k, v in f["R"].items() if not np.isfinite(v).all()]
        if bad or not np.isfinite(f["root"]).all() or not np.isfinite(f["cane"]).all():
            print("NAN at take frame", i, "scene", i - 91, bad[:6], np.isfinite(f["root"]).all(), np.isfinite(f["cane"]).all(), flush=True)
            break
    flags, jsum = mo.joint_check(take)
    print("JOINTS", jsum, flush=True)
    print("JOINT FLAGS", len(flags), "in", len({f[0] for f in flags}), "frames", flush=True)
    for fl in flags:
        print("  FLAG", *fl, flush=True)
    if flags and not a.no_limits:
        raise SystemExit("joint limits broken on %d frames: see the FLAG lines" % len({f[0] for f in flags}))
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
    # The fast frames of the dance are blurred (the frames are posed one by one, so the
    # renderer cannot): poses spread over a short shutter are rendered and averaged afterwards
    # (death_blur.py), as many as keep the copies under about three pixels apart; his head and
    # hat are kept sharp (a mask for death_blur.py). Frames moving less than --blur-px are left sharp.
    speed = [0.0] * len(take)
    subs = {}
    grid = max(3, a.blur | 1) if a.blur > 1 else 0
    if grid:
        speed = fast_frames(mo, take, ppb)
        offs = [(k / (grid - 1) - 0.5) * a.shutter for k in range(grid)]
        subs = {k: mo.take(shift=o) for k, o in enumerate(offs) if k != grid // 2}
        print("BLUR", sum(1 for v in speed if v > a.blur_px), "fast frames of", len(take), "grid", grid, "shutter", a.shutter, flush=True)
    os.makedirs(os.path.join(a.out, "blur"), exist_ok=True)

    def head_mask(f):
        """Circles (x, y, r in pixels) round his head, and his hat when it is on it."""
        W, H = float(scene.render.resolution_x), float(scene.render.resolution_y)
        D = mo.fk(f["R"], f["root"])
        ih = mo.idx["head"]
        hc = mo.at(D, "head", 0.5 * (mo.heads[ih] + mo.tails[ih]))
        circles = [(hc, 0.125)]
        if f["hat"] is not None:
            hp = np.asarray(f["hat"])[:3, 3]
            if np.linalg.norm(hp - (hc + np.array([0.0, 0.0, 0.1]))) < 0.22:
                circles.append((hp + np.array([0.0, 0.0, 0.04]), 0.19))
        out = []
        for p, r in circles:
            v = world_to_camera_view(scene, scene.camera, person.rig.root.matrix_world @ Vector(p.tolist()))
            out.append((v.x * W, (1.0 - v.y) * H, r * ppb))
        return out

    for ti, f in enumerate(take):
        if f["rec"] is None:
            continue
        name = label(f["rec"])
        frames.append(dict(name=name, x=round(-f["hips"] * ppb, 2)))
        if only and name not in only and name.replace("-0", "").replace("-", "") not in only:
            continue
        set_frame(person, cane, hat, f, sims, f["rec"])
        camera(scene, a.ppu)
        scene.render.filepath = os.path.join(a.out, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("FRAME", name, flush=True)
        if speed[ti] > a.blur_px:
            n = int(2 * math.ceil((speed[ti] * a.shutter / 3.2) / 2.0) + 1)
            n = max(3, min(grid, n))
            ks = sorted({int(round(v)) for v in np.linspace(0, grid - 1, n)} - {grid // 2})
            json.dump(dict(mask=head_mask(f), n=len(ks) + 1), open(os.path.join(a.out, "blur", name + ".json"), "w"))
            full = scene.cycles.samples
            scene.cycles.samples = min(full, a.blur_samples)
            for k in ks:
                set_frame(person, cane, hat, subs[k][ti], sims, f["rec"])
                camera(scene, a.ppu)
                scene.render.filepath = os.path.join(a.out, "blur", f"{name}__{k}.png")
                bpy.ops.render.render(write_still=True)
            scene.cycles.samples = full
        if a.chest:
            camera(scene, a.ppu, chest=True, head_z=person.H * 0.74)
            scene.render.filepath = os.path.join(a.out, name + "-chest.png")
            bpy.ops.render.render(write_still=True)
        if a.closeup:
            camera(scene, a.ppu, closeup=True, head_z=person.H - 0.16)
            scene.render.filepath = os.path.join(a.out, name + "-closeup.png")
            bpy.ops.render.render(write_still=True)
    mo.arm_clearance(take)
    bad = sorted((v, k) for k, v in mo.by_frame.items() if v < 0) if hasattr(mo, "by_frame") else []
    print("ARMS", mo.worst_at, "inside body:", [(k[1], round(v * 100, 1)) for v, k in bad if k[0] == "scene"][:80], flush=True)
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
            joints=dict(summary=jsum, flagged=sorted({fl[0] for fl in flags})),
            # Skin under his clothes is masked; what showed on his chest is flattened (death_cast.py).
            skin=skin,
            dance=list(mo.dance_frames),
            frames=frames,
        ),
        open(os.path.join(a.out, "take.json"), "w"),
        indent=1,
    )


main()
