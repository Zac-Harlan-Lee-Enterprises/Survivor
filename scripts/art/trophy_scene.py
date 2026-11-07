"""Render the champion's trophy, standing still with its plaque to the front,
for the Hall of Champions (src/components/Trophy.tsx): a gold loving-cup, two handles, a slender stem
with a knop, on a stepped black-marble plinth with an engraved gold plaque.
Everything is modelled here from numbers (lathed profiles, swept handles,
bevelled blocks, real 3D type), so nothing is downloaded and the design is
our own, not any league's trophy.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        -P scripts/art/trophy_scene.py -- --out /tmp/trophy \\
        [--frames 1] [--fps 12] [--samples 96] [--height 660] \\
        [--line1 "THE SUNDAY SURVIVORS"] [--line2 "2026 CHAMPION"] \\
        [--name "Allison Petty"] [--only 0,15]

--name adds the winner's name as a third line on the plaque, so the trophy
can be re-engraved for the real champion at the end of the season.

The trophy turns under fixed lights, like a turntable in a studio: a warm key
from straight above (the shaft of light it rises into), thin rims behind
either side to draw its silhouette against the dark page, two tall front
strips for the long highlights down the bowl, a low warm bounce that makes
the plaque glow when it faces front, and Blender's own studio HDRI, dimmed
and clamped, as the room the gold reflects. The strips and the bounce are
light-linked (Cycles) to the gold alone: on the polished marble or the satin
plaque they flash flat grey or white as a face turns into them. Frame 0 has
the plaque square to the camera; frame i is turned 360·i/N degrees, so the
last frame runs back into the first without repeating it.

The page uses frame 0 alone; --frames 60 still renders the whole turn, in
about 2½ minutes on an M3 Pro (Metal). If a run exits
with no frames right after the shaders change, run it again (the first run
most likely compiles Metal kernels; it happened twice in development).

Writes `turn-000.png` … (transparent, Cycles) and `take.json` (frame count,
size, fps, the plaque's name line) into --out; trophy_film.py packs frame 0
for the page.
"""
import argparse
import json
import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Vector

GOLD_IOR = (0.18299, 0.42108, 1.3734)  # gold, measured (n, R G B)
GOLD_K = (3.4242, 2.3459, 1.7704)  # and its extinction
HDRI_TURN = 270  # degrees: puts the studio's white cyc behind the trophy, not behind the camera
FONTS = [
    "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
]
ITALIC_FONTS = [
    "/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf",
]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--frames", type=int, default=1)
    p.add_argument("--fps", type=int, default=12)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--height", type=int, default=660, help="frame height in px; width is 2/3 of it")
    p.add_argument("--line1", default="THE SUNDAY SURVIVORS")
    p.add_argument("--line2", default="2026 CHAMPION")
    p.add_argument("--name", default="")
    p.add_argument(
        "--name-slot",
        action="store_true",
        help="lay the plaque out for a name but leave its line blank, for the page to engrave",
    )
    p.add_argument("--only", default="", help="comma-separated frame numbers to render (for looking)")
    return p.parse_args(argv)


# ── geometry helpers ──────────────────────────────────────────────────────────


def catmull(points, steps=10):
    """A smooth curve through `points` (2D tuples), sampled `steps` per span."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = (Vector(pts[i + k]) for k in (-1, 0, 1, 2))
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(
                tuple(
                    0.5
                    * (
                        2 * p1
                        + (-p0 + p2) * t
                        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                        + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
                    )
                )
            )
    out.append(tuple(points[-1]))
    return out


def arc(cx, cz, r, a0, a1, steps=8):
    """Points on a circle in the (r, z) plane, from angle a0 to a1 (degrees)."""
    return [
        (cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / steps)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / steps)))
        for i in range(steps + 1)
    ]


def dedupe(profile):
    out = []
    for p in profile:
        if not out or (Vector(p) - Vector(out[-1])).length > 1e-5:
            out.append(p)
    return out


def lathe(name, profile, segments=192, smooth_angle=35):
    """Spin an (r, z) profile round the Z axis. A point with r == 0 becomes a
    single pole vertex, so a profile that starts and ends on the axis closes."""
    profile = dedupe(profile)
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append(
                [bm.verts.new((r * math.cos(2 * math.pi * k / segments), r * math.sin(2 * math.pi * k / segments), z)) for k in range(segments)]
            )
    for a, b in zip(rings, rings[1:]):
        for k in range(segments):
            k1 = (k + 1) % segments
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[k1]))
            elif len(b) == 1:
                bm.faces.new((a[k], b[0], a[k1]))
            else:
                bm.faces.new((a[k], b[k], b[k1], a[k1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    smooth(ob, smooth_angle)
    return ob


def smooth(ob, angle=35):
    for f in ob.data.polygons:
        f.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(angle))


def box(name, sx, sy, sz, z0, bevel=0.012, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z0 + sz / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = bevel
    m.segments = 4
    m.limit_method = "ANGLE"
    m.harden_normals = True
    smooth(ob, 30)
    if mat:
        ob.data.materials.append(mat)
    return ob


def tube(name, path, radii, mat, sides=48):
    """Sweep a round section along a 3D polyline, radius varying per point."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0
    cu.bevel_resolution = sides // 4
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(path) - 1)
    for p, (co, r) in zip(sp.points, zip(path, radii)):
        p.co = (*co, 1)
        p.radius = r
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


# ── materials ────────────────────────────────────────────────────────────────


def gold(name, roughness, vary=True):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    met = nt.nodes.new("ShaderNodeBsdfMetallic")
    met.fresnel_type = "PHYSICAL_CONDUCTOR"
    met.inputs["IOR"].default_value = GOLD_IOR
    met.inputs["Extinction"].default_value = GOLD_K
    # a polish that is not quite perfect: roughness breathes a little
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18
    noise.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = roughness * 0.8
    ramp.inputs["To Max"].default_value = roughness * 1.25
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    if vary:
        nt.links.new(ramp.outputs["Result"], met.inputs["Roughness"])
    else:  # an even satin brush, so the engraving reads
        met.inputs["Roughness"].default_value = roughness
    nt.links.new(met.outputs[0], out.inputs[0])
    return m


def marble():
    m = bpy.data.materials.new("marble")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 12
    noise.inputs["Distortion"].default_value = 3.5
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 0.9
    wave.inputs["Distortion"].default_value = 9
    wave.inputs["Detail"].default_value = 8
    wave.inputs["Detail Scale"].default_value = 2
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.006, 0.006, 0.007, 1)
    ramp.color_ramp.elements[1].position = 0.035
    ramp.color_ramp.elements[1].color = (0.006, 0.006, 0.007, 1)
    e = ramp.color_ramp.elements.new(0.012)
    e.color = (0.035, 0.034, 0.033, 1)
    ramp.color_ramp.elements[0].position = 0.0
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Color"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.18
    bsdf.inputs["Coat Weight"].default_value = 0.35
    bsdf.inputs["Coat Roughness"].default_value = 0.04
    return m


def enamel():
    m = bpy.data.materials.new("enamel")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.012, 0.010, 0.009, 1)
    b.inputs["Roughness"].default_value = 0.45
    return m


# ── the trophy ───────────────────────────────────────────────────────────────

def cup_profile():
    """(r, z) of the gold cup from the foot's underside, up the outside, over
    the lip and down the inside of the bowl; z = 0 is the top of the plinth."""
    p = []
    # foot: a broad disc with a rounded edge, an ogee rising into the stem
    p += [(0.0, 0.0), (0.56, 0.0)]
    p += arc(0.56, 0.035, 0.035, -90, 90, 8)
    p += [(0.545, 0.075), (0.50, 0.085)]
    p += catmull([(0.50, 0.085), (0.42, 0.11), (0.30, 0.17), (0.22, 0.24), (0.19, 0.29)], 10)
    p += arc(0.19, 0.31, 0.02, -90, 90, 6)  # bead
    p += catmull([(0.17, 0.33), (0.12, 0.38), (0.085, 0.46), (0.075, 0.55)], 10)
    # collar, knop, collar
    p += [(0.075, 0.58), (0.10, 0.59)]
    p += arc(0.10, 0.605, 0.015, -90, 90, 5)
    p += [(0.085, 0.62)]
    p += [(0.17 * math.sin(math.radians(a)) + 0.0, 0.715 - 0.095 * math.cos(math.radians(a))) for a in range(30, 151, 4)]
    p += [(0.085, 0.81)]
    p += arc(0.10, 0.825, 0.015, -90, 90, 5)
    p += [(0.075, 0.84), (0.07, 0.87)]
    p += catmull([(0.07, 0.87), (0.072, 0.93), (0.09, 0.99), (0.14, 1.04)], 8)
    # bowl: a cushion at its base, then a deep bell flaring to the lip
    p += arc(0.15, 1.06, 0.025, -80, 90, 8)
    p += catmull(
        [
            (0.15, 1.085),
            (0.30, 1.12),
            (0.48, 1.22),
            (0.60, 1.38),
            (0.66, 1.60),
            (0.68, 1.85),
            (0.70, 2.10),
            (0.75, 2.30),
            (0.80, 2.40),
        ],
        12,
    )
    # a rolled lip
    p += arc(0.80, 2.43, 0.03, -90, 180, 14)
    # inside: a wall 0.03 thick, down to a rounded bottom
    p += catmull(
        [
            (0.77, 2.43),
            (0.72, 2.32),
            (0.67, 2.10),
            (0.65, 1.85),
            (0.63, 1.60),
            (0.56, 1.40),
            (0.42, 1.27),
            (0.22, 1.20),
            (0.0, 1.18),
        ],
        12,
    )
    return p


def outer_radius(profile, z):
    """The cup's outside radius at height z (the first crossing going up)."""
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    raise ValueError(z)


def handle_path(side):
    """A loving-cup ear: leaves the bowl under the lip, swings out and down in
    a generous curve and tucks back into the bowl's shoulder with a small curl."""
    pts = [
        (0.68, 2.26),
        (0.90, 2.35),
        (1.08, 2.30),
        (1.17, 2.13),
        (1.13, 1.90),
        (1.01, 1.68),
        (0.85, 1.51),
        (0.70, 1.42),
        (0.60, 1.38),
    ]
    curve = catmull(pts, 14)
    return [(side * x, 0.0, z) for x, z in curve]


def handle_radii(n):
    out = []
    for i in range(n):
        t = i / (n - 1)
        # thick where it meets the bowl at the top, slimming through the swing
        out.append(0.056 * (1.0 - 0.30 * math.sin(math.pi * min(1, t * 1.1))) + 0.014 * (1 - t))
    return out


def build_text(body, font_path, size, spacing, mat, extrude):
    cu = bpy.data.curves.new("type", "FONT")
    cu.body = body
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.size = size
    cu.space_character = spacing
    cu.extrude = extrude
    cu.bevel_depth = extrude * 0.25
    cu.bevel_resolution = 2
    cu.resolution_u = 6
    for path in font_path:
        if os.path.exists(path):
            cu.font = bpy.data.fonts.load(path, check_existing=True)
            break
    ob = bpy.data.objects.new("type", cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


# Corners of the plaque's blank name line, in the world at frame 0 (--name-slot).
SLOT = []


def build(args, pivot):
    m_gold = gold("gold", 0.14)
    m_plaque = gold("plaque gold", 0.3, vary=False)
    m_marble = marble()
    m_enamel = enamel()

    # plinth: a plinth step, a tall block that carries the plaque, a cap
    lines = [args.line1, args.line2] + ([args.name or ""] if args.name or args.name_slot else [])
    parts = [
        box("plinth step", 1.46, 1.46, 0.14, 0.0, 0.02, m_marble),
        box("plinth block", 1.26, 1.26, 0.66, 0.14, 0.015, m_marble),
        box("plinth cap", 1.36, 1.36, 0.10, 0.80, 0.02, m_marble),
    ]
    top = 0.90
    cup = lathe("cup", [(r, z + top) for r, z in cup_profile()], 192, 35)
    cup.data.materials.append(m_gold)
    parts.append(cup)
    # a fine bead girdling the bowl where the handles come home
    r_band = outer_radius(cup_profile(), 1.40) - 0.006
    bead = lathe("bead", [(r_band + x, z + top) for x, z in arc(0.0, 1.40, 0.02, -110, 110, 14)], 192, 60)
    bead.data.materials.append(m_gold)
    parts.append(bead)
    for side in (1, -1):
        path = [(x, y, z + top) for x, y, z in handle_path(side)]
        parts.append(tube("handle", path, handle_radii(len(path)), m_gold))

    # plaque on the front face (−Y, toward the camera at frame 0)
    face_y = -0.63
    pw = 1.06
    ph = 0.44 if len(lines) == 2 else 0.52
    pz = 0.14 + 0.66 / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, face_y - 0.008, pz))
    plaque = bpy.context.active_object
    plaque.name = "plaque"
    plaque.scale = (pw, 0.016, ph)
    bpy.ops.object.transform_apply(scale=True)
    bv = plaque.modifiers.new("bevel", "BEVEL")
    bv.width = 0.006
    bv.segments = 3
    bv.harden_normals = True
    smooth(plaque, 30)
    plaque.data.materials.append(m_plaque)
    parts.append(plaque)

    # the engraving: black enamel letters standing a hair proud of the plate
    front = face_y - 0.016
    sizes = [0.090, 0.135, 0.105][: len(lines)]
    spacings = [1.12, 1.06, 1.02]
    fonts = [FONTS, FONTS, ITALIC_FONTS]
    gap = [0.0, 0.17, 0.155]
    zs = []
    z = 0.0
    for i in range(len(lines)):
        z -= gap[i]
        zs.append(z)
    mid = (zs[0] + zs[-1]) / 2
    for i, line in enumerate(lines):
        if not line:
            # The blank line the page engraves: where it is, for take.json.
            half_w = (pw - 0.14) / 2
            half_h = sizes[i] * 0.62
            zc = pz + (zs[i] - mid) - 0.01
            SLOT.extend([(x, front - 0.001, z) for x in (-half_w, half_w) for z in (zc - half_h, zc + half_h)])
            continue
        t = build_text(line, fonts[i], sizes[i], spacings[i], m_enamel, 0.0025)
        t.rotation_euler = (math.radians(90), 0, 0)
        t.location = (0, front - 0.0005, pz + (zs[i] - mid) - 0.01)
        bpy.context.view_layer.update()
        if t.dimensions.x > pw - 0.14:
            k = (pw - 0.14) / t.dimensions.x
            t.scale = (k, k, 1)
        parts.append(t)
    # a fine engraved rule between the league and the title
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, front - 0.0005, pz + (zs[0] + zs[1]) / 2 - mid - 0.004))
    rule = bpy.context.active_object
    rule.scale = (0.30, 0.003, 0.004)
    rule.data.materials.append(m_enamel)
    parts.append(rule)

    # Who the linked lights may touch. `cup`: the cup, its bead and handles,
    # lit by the strips; not the marble (it would mirror them as a flat grey
    # slab) nor the plaque (its satin gold blooms white under them as it turns
    # and the engraving goes). `warm`: the cup and the plaque, lit by the low
    # bounce, which is what makes the plate glow and read when it faces front.
    cup_set = bpy.data.collections.new("cup")
    warm_set = bpy.data.collections.new("warm")
    for ob in parts:
        ob.parent = pivot
        if ob.active_material is m_gold:
            cup_set.objects.link(ob)
        if ob.active_material is not m_marble:
            warm_set.objects.link(ob)
    return cup_set, warm_set


# ── studio ───────────────────────────────────────────────────────────────────


def area(name, loc, target, size, power, color, shape="RECTANGLE", size_y=None):
    li = bpy.data.lights.new(name, "AREA")
    li.shape = shape
    li.size = size
    if size_y:
        li.size_y = size_y
    li.energy = power
    li.color = color
    ob = bpy.data.objects.new(name, li)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def studio(scene, cup_set, warm_set):
    world = bpy.data.worlds.new("studio")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    hdri = None
    for root in (os.path.dirname(bpy.app.binary_path), os.path.join(os.path.dirname(bpy.app.binary_path), "..", "Resources")):
        for dirpath, _dirs, files in os.walk(root):
            if "studio.exr" in files and dirpath.endswith(os.path.join("studiolights", "world")):
                hdri = os.path.join(dirpath, "studio.exr")
                break
        if hdri:
            break
    turn = nt.nodes.new("ShaderNodeMapping")
    turn.inputs["Rotation"].default_value = (0, 0, math.radians(HDRI_TURN))
    nt.links.new(coord.outputs["Generated"], turn.inputs["Vector"])
    nt.links.new(turn.outputs["Vector"], env.inputs["Vector"])
    if hdri:
        env.image = bpy.data.images.load(hdri)
        # clamped: the studio's own lamps are tiny and fierce, and on the satin
        # plaque they bloom it white. The HDRI is the room, the lights are ours.
        cap = nt.nodes.new("ShaderNodeVectorMath")
        cap.operation = "MINIMUM"
        cap.inputs[1].default_value = (1.0, 1.0, 1.0)
        nt.links.new(env.outputs["Color"], cap.inputs[0])
        nt.links.new(cap.outputs["Vector"], bg.inputs["Color"])
    # the studio's floor and white cyc are bright; a trophy shot on black has a
    # dark floor, and otherwise the marble faces mirror it as a grey flash
    # as they turn. Fade the world out below the horizon.
    xyz = nt.nodes.new("ShaderNodeSeparateXYZ")
    fade = nt.nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = -0.12
    fade.inputs["From Max"].default_value = 0.04
    fade.inputs["To Min"].default_value = 0.02
    fade.inputs["To Max"].default_value = 0.4
    nt.links.new(coord.outputs["Generated"], xyz.inputs[0])
    nt.links.new(xyz.outputs["Z"], fade.inputs["Value"])
    nt.links.new(fade.outputs["Result"], bg.inputs["Strength"])

    warm = (1.0, 0.86, 0.62)
    white = (1.0, 0.95, 0.88)
    area("key", (0.0, -0.5, 7.0), (0, 0, 2.2), 2.0, 1000, warm, "DISK")
    area("rim left", (-3.2, 2.6, 2.4), (0, 0, 1.9), 0.35, 260, (1.0, 0.92, 0.80), "RECTANGLE", 3.6)
    area("rim right", (3.2, 2.6, 2.4), (0, 0, 1.9), 0.35, 260, (1.0, 0.92, 0.80), "RECTANGLE", 3.6)
    # linked lights: see the sets in build()
    for ob in (
        area("strip left", (-3.4, -4.2, 2.0), (0, 0, 1.8), 0.6, 380, white, "RECTANGLE", 4.5),
        area("strip right", (3.9, -3.2, 2.3), (0, 0, 1.8), 0.35, 210, white, "RECTANGLE", 4.5),
    ):
        ob.light_linking.receiver_collection = cup_set
    bounce = area("bounce", (0.0, -5.0, -1.2), (0, 0, 1.6), 3.0, 90, warm, "RECTANGLE", 1.0)
    bounce.light_linking.receiver_collection = warm_set
    area("fill", (0.0, -8.0, 5.5), (0, 0, 1.2), 4.0, 220, white, "RECTANGLE", 2.5)


def camera(scene):
    cam = bpy.data.cameras.new("cam")
    cam.lens = 85
    cam.sensor_fit = "VERTICAL"
    cam.sensor_height = 24
    ob = bpy.data.objects.new("cam", cam)
    bpy.context.collection.objects.link(ob)
    ob.location = (0.0, -15.2, 1.55)
    target = Vector((0.0, 0.0, 1.70))
    ob.rotation_euler = (target - ob.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = ob


def setup_render(scene, args):
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as exc:  # no GPU: the CPU gets there, slower
        print("trophy: rendering on CPU", exc)
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 12
    scene.cycles.glossy_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.render.film_transparent = True
    scene.render.resolution_y = args.height
    scene.render.resolution_x = round(args.height * 2 / 3)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    vs = scene.view_settings
    try:
        vs.view_transform = "AgX"
        vs.look = "AgX - Punchy"
    except TypeError:
        pass
    vs.exposure = 0.0


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    pivot = bpy.data.objects.new("turntable", None)
    bpy.context.collection.objects.link(pivot)
    studio(scene, *build(args, pivot))
    camera(scene)
    setup_render(scene, args)

    # Where the blank name line falls in the picture at frame 0, in pixels.
    name_box = None
    if SLOT:
        from bpy_extras.object_utils import world_to_camera_view
        from mathutils import Vector

        pivot.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        rx, ry = scene.render.resolution_x, scene.render.resolution_y
        pts = [world_to_camera_view(scene, scene.camera, Vector(c)) for c in SLOT]
        xs = [p.x * rx for p in pts]
        ys = [(1 - p.y) * ry for p in pts]
        name_box = dict(x=min(xs), y=min(ys), w=max(xs) - min(xs), h=max(ys) - min(ys))

    frames = range(args.frames)
    if args.only:
        frames = [int(x) for x in args.only.split(",")]
    t0 = time.time()
    for i in frames:
        pivot.rotation_euler = (0, 0, 2 * math.pi * i / args.frames)
        scene.render.filepath = os.path.join(args.out, f"turn-{i:03d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"trophy: frame {i} done at {time.time() - t0:.1f}s", flush=True)
    json.dump(
        dict(
            frames=args.frames,
            width=scene.render.resolution_x,
            height=scene.render.resolution_y,
            fps=args.fps,
            lines=[args.line1, args.line2] + ([args.name] if args.name else []),
            nameBox=name_box,
        ),
        open(os.path.join(args.out, "take.json"), "w"),
        indent=2,
    )


main()
